import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { analyzeAndStoreInsights } from "@/lib/pipeline/analyze";

export const runtime = "nodejs";

/**
 * POST /api/calls/[id]/reanalyze
 * Re-scores an already-transcribed call against the workspace's current active
 * playbook (e.g. after the playbook criteria/weights were changed). Overwrites
 * the existing insights row.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const db = createAdminClient();
  const { data: call } = await db
    .from("calls")
    .select("id, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const ctx = await resolveContext(_req, call.workspace_id);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: transcript } = await db
    .from("transcripts")
    .select("full_text, language")
    .eq("call_id", id)
    .maybeSingle();
  if (!transcript?.full_text) {
    return NextResponse.json({ error: "No transcript to re-analyze." }, { status: 409 });
  }

  try {
    const { dealHealthScore } = await analyzeAndStoreInsights(db, {
      callId: id,
      workspaceId: call.workspace_id,
      fullText: transcript.full_text,
      language: transcript.language,
    });
    return NextResponse.json({ ok: true, deal_health_score: dealHealthScore });
  } catch (e) {
    return NextResponse.json(
      { error: "Re-analysis failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
