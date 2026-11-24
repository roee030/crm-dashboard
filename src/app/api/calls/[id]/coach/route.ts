import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { generateCoaching } from "@/lib/claude/coach";
import { coachingSchema } from "@/schemas/coaching";
import { isDemoMode } from "@/lib/demo/mode";
import { demoCoaching } from "@/lib/demo/responses";
import type { Objection, ActionItem } from "@/types/db";

export const runtime = "nodejs";

/**
 * POST /api/calls/[id]/coach
 * Returns cached coaching from insights.call_coaching if present; otherwise
 * generates it with Claude, caches it, and returns it. Pass { refresh: true } to
 * force regeneration.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let refresh = false;
  try {
    const body = await req.json();
    refresh = Boolean(body?.refresh);
  } catch {
    /* no body */
  }

  // Demo mode: return simulated coaching (cached-style) with no Claude call.
  if (isDemoMode()) {
    const parsed = coachingSchema.safeParse(demoCoaching(id));
    if (parsed.success) {
      return NextResponse.json({ coaching: parsed.data, cached: !refresh });
    }
    return NextResponse.json({ error: "No demo coaching for this call." }, { status: 404 });
  }

  const db = createAdminClient();
  const { data: call } = await db
    .from("calls")
    .select("id, workspace_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const ctx = await resolveContext(req, call.workspace_id);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: insight } = await db
    .from("insights")
    .select("call_coaching, objections, action_items")
    .eq("call_id", id)
    .maybeSingle();
  if (!insight) {
    return NextResponse.json({ error: "Call has no insights yet." }, { status: 409 });
  }

  // Serve cache unless forced.
  if (!refresh && insight.call_coaching) {
    const parsed = coachingSchema.safeParse(insight.call_coaching);
    if (parsed.success) return NextResponse.json({ coaching: parsed.data, cached: true });
  }

  const { data: transcript } = await db
    .from("transcripts")
    .select("full_text, language")
    .eq("call_id", id)
    .maybeSingle();
  if (!transcript?.full_text) {
    return NextResponse.json({ error: "No transcript available." }, { status: 409 });
  }

  try {
    const coaching = await generateCoaching({
      fullText: transcript.full_text,
      language: transcript.language,
      objections: (insight.objections ?? []) as Objection[],
      actionItems: (insight.action_items ?? []) as ActionItem[],
    });
    await db.from("insights").update({ call_coaching: coaching }).eq("call_id", id);
    return NextResponse.json({ coaching, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: "Coaching failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
