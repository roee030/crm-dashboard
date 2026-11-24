import { createServerSupabase } from "@/lib/supabase/server";
import type { Criterion } from "@/lib/playbooks/scoring";
import type { Objection } from "@/types/db";

export type WeeklyDigest = {
  totalCalls: number;
  avgSentiment: number | null;
  sentimentDeltaWoW: number | null;
  topObjections: { category: string; count: number }[];
  atRiskDeals: { callId: string; name: string; score: number }[];
  bestCriterion: { label: string; avg: number } | null;
  worstCriterion: { label: string; avg: number } | null;
};

const DAY = 24 * 60 * 60 * 1000;

/** Compute the last-7-days executive digest for a workspace (RLS-scoped). */
export async function getWeeklyDigest(workspaceId: string): Promise<WeeklyDigest> {
  const supabase = await createServerSupabase();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const twoWeeksAgo = new Date(now - 14 * DAY).toISOString();

  const [{ data: calls }, { data: insights }, { data: playbook }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, title, customer_name, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", twoWeeksAgo),
    supabase
      .from("insights")
      .select("call_id, sentiment_score, deal_health_score, objections, playbook_results, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", twoWeeksAgo),
    supabase
      .from("playbooks")
      .select("criteria")
      .eq("workspace_id", workspaceId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const callName = new Map((calls ?? []).map((c) => [c.id, c.customer_name || c.title || "Call"]));
  const thisWeek = (insights ?? []).filter((i) => i.created_at >= weekAgo);
  const priorWeek = (insights ?? []).filter((i) => i.created_at < weekAgo);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const thisAvg = avg(thisWeek.map((i) => Number(i.sentiment_score)).filter(Number.isFinite));
  const priorAvg = avg(priorWeek.map((i) => Number(i.sentiment_score)).filter(Number.isFinite));

  // Top objections this week.
  const objCount = new Map<string, number>();
  for (const i of thisWeek) {
    for (const o of (i.objections ?? []) as Objection[]) {
      objCount.set(o.category, (objCount.get(o.category) ?? 0) + 1);
    }
  }
  const topObjections = [...objCount.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // At-risk deals this week.
  const atRiskDeals = thisWeek
    .filter((i) => i.deal_health_score != null && Number(i.deal_health_score) < 50)
    .map((i) => ({ callId: i.call_id, name: callName.get(i.call_id) ?? "Call", score: Number(i.deal_health_score) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  // Highest / lowest playbook criteria (avg score 0-2 across this week).
  const criteria = (playbook?.criteria ?? []) as Criterion[];
  const labelByKey = new Map(criteria.map((c) => [c.key, c.label]));
  const perKey = new Map<string, { sum: number; n: number }>();
  for (const i of thisWeek) {
    const results = (i.playbook_results ?? {}) as Record<string, { score: number }>;
    for (const [key, r] of Object.entries(results)) {
      const cur = perKey.get(key) ?? { sum: 0, n: 0 };
      cur.sum += Number(r.score) || 0;
      cur.n += 1;
      perKey.set(key, cur);
    }
  }
  const averages = [...perKey.entries()]
    .filter(([key]) => labelByKey.has(key))
    .map(([key, v]) => ({ label: labelByKey.get(key)!, avg: Math.round((v.sum / v.n) * 100) / 100 }))
    .sort((a, b) => b.avg - a.avg);

  return {
    totalCalls: (calls ?? []).filter((c) => c.created_at >= weekAgo).length,
    avgSentiment: thisAvg,
    sentimentDeltaWoW: thisAvg != null && priorAvg != null ? Math.round((thisAvg - priorAvg) * 100) / 100 : null,
    topObjections,
    atRiskDeals,
    bestCriterion: averages[0] ?? null,
    worstCriterion: averages.length > 1 ? averages[averages.length - 1] : null,
  };
}
