import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELS } from "@/lib/config/models";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Objection } from "@/types/db";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * POST /api/ai/chat — streaming workspace copilot.
 * Strictly scoped to the authenticated user's workspace: we resolve the workspace
 * from their membership and only feed Claude that workspace's call data.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rl = checkRateLimit(`chat:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return new Response("Rate limit exceeded", { status: 429 });

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return new Response("No workspace", { status: 403 });

  let messages: ChatMessage[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  messages = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12);
  if (messages.length === 0) return new Response("No messages", { status: 400 });

  // Build a bounded, workspace-scoped context document.
  const [{ data: calls }, { data: insights }] = await Promise.all([
    admin
      .from("calls")
      .select("id, title, customer_name, language, status, created_at")
      .eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: false })
      .limit(60),
    admin
      .from("insights")
      .select("call_id, summary, sentiment_label, sentiment_score, objections, deal_stage_recommendation")
      .eq("workspace_id", membership.workspace_id)
      .limit(60),
  ]);

  const insightByCall = new Map((insights ?? []).map((i) => [i.call_id, i]));
  const lines = (calls ?? []).map((c) => {
    const ins = insightByCall.get(c.id);
    const objs = ((ins?.objections ?? []) as Objection[]).map((o) => o.category).join(", ");
    return [
      `- ${c.customer_name ?? c.title ?? "Call"} (${c.language ?? "?"}, ${new Date(c.created_at).toISOString().slice(0, 10)})`,
      ins ? `sentiment=${ins.sentiment_label}(${ins.sentiment_score}), stage=${ins.deal_stage_recommendation}` : `status=${c.status}`,
      objs ? `objections=[${objs}]` : "",
      ins?.summary ? `summary="${ins.summary}"` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  });

  const system = [
    "You are SignalDesk AI, an analyst embedded in a sales-call intelligence product.",
    "Answer ONLY from the workspace call data below. If the data does not contain the answer, say so.",
    "Be concise and specific; cite customer names and numbers. Content may be English or Hebrew —",
    "preserve Hebrew exactly (RTL) and answer in the language the user used.",
    "",
    `Workspace call data (${lines.length} calls):`,
    lines.join("\n") || "(no calls yet)",
  ].join("\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const claudeStream = anthropic.messages.stream({
          model: MODELS.claude.model,
          max_tokens: 1024,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        claudeStream.on("text", (text) => controller.enqueue(encoder.encode(text)));
        await claudeStream.finalMessage();
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode(`\n[error: ${e instanceof Error ? e.message : "stream failed"}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
