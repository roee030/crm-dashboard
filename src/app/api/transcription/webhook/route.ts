import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeCall } from "@/lib/pipeline/finalize";
import { WEBHOOK_AUTH_HEADER } from "@/lib/assemblyai/client";

export const runtime = "nodejs";

/**
 * POST /api/transcription/webhook  (AssemblyAI completion callback — prod path)
 *
 * AssemblyAI echoes our shared secret in the configured auth header; we verify it,
 * then run the SAME idempotent finalize step the local poll endpoint uses.
 * Body: { transcript_id, status }.
 */
export async function POST(req: Request) {
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get(WEBHOOK_AUTH_HEADER);
    if (provided !== secret) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  let body: { transcript_id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcriptId = body.transcript_id;
  if (!transcriptId) {
    return NextResponse.json({ error: "Missing transcript_id" }, { status: 400 });
  }

  // Map the AssemblyAI transcript id back to our call.
  const db = createAdminClient();
  const { data: call } = await db
    .from("calls")
    .select("id")
    .eq("external_provider_id", transcriptId)
    .maybeSingle();

  if (!call) {
    // Unknown id — ack so AssemblyAI doesn't retry forever.
    return NextResponse.json({ ok: true, detail: "no matching call" }, { status: 200 });
  }

  const result = await finalizeCall(call.id);
  return NextResponse.json(result, { status: 200 });
}
