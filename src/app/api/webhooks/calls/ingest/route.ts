import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey } from "@/lib/api-keys";
import { submitTranscription } from "@/lib/assemblyai/client";
import { isPublicHttpUrl } from "@/lib/net/ssrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { isDemoMode } from "@/lib/demo/mode";
import { buildDemoData } from "@/lib/demo/data";

export const runtime = "nodejs";

const body = z.object({
  recording_url: z.string().url(),
  title: z.string().max(300).optional(),
  direction: z.enum(["inbound", "outbound", "unknown"]).optional(),
  customer_name: z.string().max(200).optional(),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().max(60).optional(),
  language: z.string().max(10).optional(),
  external_call_id: z.string().max(200).optional(),
  auto_sync_crm: z.boolean().optional(),
});

/**
 * POST /api/webhooks/calls/ingest — zero-touch ingestion for Zapier/Make/VoIP.
 * Auth: `Authorization: Bearer sd_live_...` (constant-time verified).
 * Dedupes on (workspace_id, external_call_id). Returns 202 + status URL.
 */
export async function POST(req: Request) {
  // Demo mode: accept the test webhook without a real key and return a demo call.
  if (isDemoMode()) {
    let recordingOk = true;
    try {
      const b = await req.json();
      recordingOk = typeof b?.recording_url === "string";
    } catch {
      recordingOk = false;
    }
    if (!recordingOk) {
      return NextResponse.json({ error: "Provide a recording_url (demo)." }, { status: 400 });
    }
    const demo = buildDemoData().calls[0];
    const origin = new URL(req.url).origin;
    return NextResponse.json(
      { call_id: demo.id, status: "completed", mode: "demo", status_url: `${origin}/api/calls/${demo.id}/sync-status` },
      { status: 202 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const principal = await authenticateApiKey(token);
  if (!principal) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const rl = checkRateLimit(`ingest:${principal.keyId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let input: z.infer<typeof body>;
  try {
    input = body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid payload", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  // SSRF guard: never hand a private/loopback/metadata URL to the fetcher.
  if (!(await isPublicHttpUrl(input.recording_url))) {
    return NextResponse.json({ error: "recording_url is not a permitted public URL" }, { status: 400 });
  }

  const db = createAdminClient();
  const origin = process.env.APP_URL ?? new URL(req.url).origin;

  // Dedupe by caller id.
  if (input.external_call_id) {
    const { data: existing } = await db
      .from("calls")
      .select("id, status")
      .eq("workspace_id", principal.workspaceId)
      .eq("external_call_id", input.external_call_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { call_id: existing.id, status: existing.status, status_url: `${origin}/api/calls/${existing.id}/sync-status`, deduplicated: true },
        { status: 202 },
      );
    }
  }

  const { data: call, error } = await db
    .from("calls")
    .insert({
      workspace_id: principal.workspaceId,
      title: input.title ?? null,
      direction: input.direction ?? "unknown",
      customer_name: input.customer_name ?? null,
      customer_email: input.customer_email ?? null,
      customer_phone: input.customer_phone ?? null,
      language: input.language ?? null,
      external_call_id: input.external_call_id ?? null,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !call) {
    return NextResponse.json({ error: "Could not create call", detail: error?.message }, { status: 500 });
  }

  try {
    const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/transcription/webhook` : undefined;
    const jobId = await submitTranscription({
      audioUrl: input.recording_url,
      webhookUrl,
      webhookSecret: process.env.ASSEMBLYAI_WEBHOOK_SECRET,
    });
    await db
      .from("calls")
      .update({ status: "transcribing", external_provider_id: jobId })
      .eq("id", call.id);

    return NextResponse.json(
      { call_id: call.id, status: "transcribing", status_url: `${origin}/api/calls/${call.id}/sync-status` },
      { status: 202 },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await db.from("calls").update({ status: "failed", error_message: detail }).eq("id", call.id);
    return NextResponse.json({ call_id: call.id, error: "Ingestion failed", detail }, { status: 502 });
  }
}
