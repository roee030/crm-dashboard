import type { createAdminClient } from "@/lib/supabase/admin";
import { extractInsights } from "@/lib/claude/extract";
import { computeDealHealth, type Criterion } from "@/lib/playbooks/scoring";
import { MODELS } from "@/lib/config/models";

type Db = ReturnType<typeof createAdminClient>;

/** Load the workspace's active playbook criteria (default first, else any, else []). */
export async function loadActivePlaybookCriteria(
  db: Db,
  workspaceId: string,
): Promise<Criterion[]> {
  const { data } = await db
    .from("playbooks")
    .select("criteria, is_default, created_at")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.criteria ?? []) as Criterion[];
}

/**
 * Run Claude extraction against the active playbook, compute the deterministic
 * weighted deal-health score, and upsert the insights row. Used by both the
 * pipeline finalize step and the manual /reanalyze route.
 */
export async function analyzeAndStoreInsights(
  db: Db,
  args: { callId: string; workspaceId: string; fullText: string; language: string | null },
): Promise<{ dealHealthScore: number }> {
  const criteria = await loadActivePlaybookCriteria(db, args.workspaceId);

  const insights = await extractInsights({
    fullText: args.fullText,
    language: args.language,
    criteria,
  });

  const { score, results } = computeDealHealth(criteria, insights.playbook_results);

  await db.from("insights").upsert(
    {
      call_id: args.callId,
      workspace_id: args.workspaceId,
      model: MODELS.claude.model,
      summary: insights.summary,
      sentiment_label: insights.sentiment_label,
      sentiment_score: insights.sentiment_score,
      objections: insights.objections,
      action_items: insights.action_items,
      deal_stage_recommendation: insights.deal_stage_recommendation,
      deal_health_score: score,
      risk_flags: insights.risk_flags,
      playbook_results: results,
      raw: insights,
    },
    { onConflict: "call_id" },
  );

  return { dealHealthScore: score };
}
