import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { finalizeCall } from "@/lib/pipeline/finalize";

export const runtime = "nodejs";

/**
 * GET /api/calls/[id]/sync-status  (local-dev poll path, no tunnel needed)
 *
 * Drives the SAME idempotent finalize step as the webhook, then returns the
 * current call status (+ whether a transcript/insights exist). Call it on an
 * interval from your test script until status is `completed` or `failed`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Load the call to know its workspace for the membership check.
  const db = createAdminClient();
  const { data: call } = await db
    .from("calls")
    .select("id, workspace_id, status, error_message, language")
    .eq("id", id)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const ctx = await resolveContext(req, call.workspace_id);
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Advance the pipeline (idempotent). Skip the external call once terminal.
  let finalize = null;
  if (call.status !== "completed" && call.status !== "failed") {
    finalize = await finalizeCall(id);
  }

  const { data: fresh } = await db
    .from("calls")
    .select("status, error_message, language")
    .eq("id", id)
    .single();

  const [{ count: hasTranscript }, { count: hasInsights }] = await Promise.all([
    db.from("transcripts").select("id", { count: "exact", head: true }).eq("call_id", id),
    db.from("insights").select("id", { count: "exact", head: true }).eq("call_id", id),
  ]);

  return NextResponse.json({
    call_id: id,
    status: fresh?.status ?? call.status,
    language: fresh?.language ?? call.language,
    error_message: fresh?.error_message ?? null,
    transcript_ready: (hasTranscript ?? 0) > 0,
    insights_ready: (hasInsights ?? 0) > 0,
    finalize,
  });
}
