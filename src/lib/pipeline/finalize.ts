import { createAdminClient } from "@/lib/supabase/admin";
import { getTranscript, mapUtterances } from "@/lib/assemblyai/client";
import { extractInsights } from "@/lib/claude/extract";
import { autoSyncCall } from "@/lib/crm/integration";
import { MODELS } from "@/lib/config/models";

export type FinalizeResult = {
  callId: string;
  status: "processing" | "completed" | "failed" | "noop";
  idempotent?: boolean;
  detail?: string;
};

/**
 * Shared finalize step for BOTH /api/transcription/webhook and
 * /api/calls/[id]/sync-status. Safe to call concurrently and repeatedly.
 *
 * Idempotency strategy (no duplicate transcripts, Claude never runs twice):
 *  1. transcripts + insights have UNIQUE(call_id); we insert with
 *     ignoreDuplicates, so a racing second writer is a no-op at the data layer.
 *  2. The expensive Claude step is gated by a single atomic claim:
 *     UPDATE calls SET status='analyzing' WHERE id=? AND status IN (pre-analysis states)
 *     Postgres row-locks the row, so exactly one concurrent caller wins the claim;
 *     the loser sees 0 rows returned and backs off.
 */
export async function finalizeCall(callId: string): Promise<FinalizeResult> {
  const db = createAdminClient();

  const { data: call, error } = await db
    .from("calls")
    .select("*")
    .eq("id", callId)
    .single();

  if (error || !call) {
    return { callId, status: "noop", detail: "call not found" };
  }

  // Terminal states: nothing to do.
  if (call.status === "completed") {
    return { callId, status: "completed", idempotent: true };
  }
  if (call.status === "failed") {
    return { callId, status: "failed", idempotent: true, detail: call.error_message ?? undefined };
  }
  if (!call.external_provider_id) {
    return { callId, status: "noop", detail: "no transcription job id yet" };
  }

  // --- Pull transcript state from AssemblyAI ---
  const t = await getTranscript(call.external_provider_id);

  if (t.status === "error") {
    await db
      .from("calls")
      .update({ status: "failed", error_message: t.error ?? "transcription error" })
      .eq("id", callId)
      .neq("status", "completed");
    return { callId, status: "failed", detail: t.error ?? undefined };
  }

  if (t.status !== "completed") {
    // queued | processing — keep the call in transcribing and let the caller poll again.
    await db
      .from("calls")
      .update({ status: "transcribing" })
      .eq("id", callId)
      .in("status", ["uploaded", "transcribing"]);
    return { callId, status: "processing", detail: t.status };
  }

  // --- Transcript is ready: persist it idempotently (UNIQUE(call_id)) ---
  await db.from("transcripts").upsert(
    {
      call_id: callId,
      workspace_id: call.workspace_id,
      provider: "assemblyai",
      model: MODELS.assemblyai.speechModels[0],
      language: t.language_code ?? null,
      full_text: t.text ?? "",
      utterances: mapUtterances(t),
      confidence: t.confidence ?? null,
    },
    { onConflict: "call_id", ignoreDuplicates: true },
  );

  // Record detected language on the call (best-effort, harmless if repeated).
  if (t.language_code && call.language !== t.language_code) {
    await db.from("calls").update({ language: t.language_code }).eq("id", callId);
  }

  // --- Atomic claim for the Claude step: single winner only ---
  const { data: claimed } = await db
    .from("calls")
    .update({ status: "analyzing" })
    .eq("id", callId)
    .in("status", ["uploaded", "transcribing", "transcribed"])
    .select("id");

  if (!claimed || claimed.length === 0) {
    // Another invocation already claimed analysis (or it's already completed).
    return { callId, status: "processing", idempotent: true, detail: "analysis already in progress" };
  }

  // --- Run Claude and store insights (also UNIQUE(call_id)-guarded) ---
  try {
    const insights = await extractInsights({
      fullText: t.text ?? "",
      language: t.language_code,
    });

    await db.from("insights").upsert(
      {
        call_id: callId,
        workspace_id: call.workspace_id,
        model: MODELS.claude.model,
        summary: insights.summary,
        sentiment_label: insights.sentiment_label,
        sentiment_score: insights.sentiment_score,
        objections: insights.objections,
        action_items: insights.action_items,
        deal_stage_recommendation: insights.deal_stage_recommendation,
        raw: insights,
      },
      { onConflict: "call_id", ignoreDuplicates: true },
    );

    await db.from("calls").update({ status: "completed", error_message: null }).eq("id", callId);

    // Auto-sync to any CRM integration with auto_sync enabled. Never throws.
    await autoSyncCall(callId);

    return { callId, status: "completed" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // Release the claim into a failed state so it can be retried/inspected.
    await db.from("calls").update({ status: "failed", error_message: detail }).eq("id", callId);
    return { callId, status: "failed", detail };
  }
}
