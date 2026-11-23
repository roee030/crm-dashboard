import { createServerSupabase } from "@/lib/supabase/server";
import { averageAdherence } from "@/lib/playbooks/scoring";
import type { Objection } from "@/types/db";

export type AtRiskDeal = {
  callId: string;
  name: string;
  score: number;
};

export type DashboardData = {
  totalCalls: number;
  completedCalls: number;
  avgSentiment: number | null;
  wonDeals: number;
  avgAdherence: number | null;
  atRiskDeals: AtRiskDeal[];
  topObjections: { category: string; count: number }[];
  stageDistribution: { stage: string; count: number }[];
  trend: { label: string; calls: number; won: number }[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getDashboardData(workspaceId: string): Promise<DashboardData> {
  const supabase = await createServerSupabase();

  const [{ data: calls }, { data: insights }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, title, customer_name, status, created_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("insights")
      .select("call_id, sentiment_score, deal_health_score, objections, deal_stage_recommendation, created_at")
      .eq("workspace_id", workspaceId),
  ]);

  const callRows = calls ?? [];
  const insightRows = insights ?? [];

  const totalCalls = callRows.length;
  const completedCalls = callRows.filter((c) => c.status === "completed").length;

  const scores = insightRows
    .map((i) => Number(i.sentiment_score))
    .filter((n) => Number.isFinite(n));
  const avgSentiment =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const wonDeals = insightRows.filter(
    (i) => (i.deal_stage_recommendation ?? "").toLowerCase() === "closed won",
  ).length;

  // Playbook adherence + at-risk deals (deal_health_score < 50).
  const avgAdherence = averageAdherence(insightRows.map((i) => i.deal_health_score));
  const callName = new Map(
    callRows.map((c) => [c.id, c.customer_name || c.title || "Call"]),
  );
  const atRiskDeals: AtRiskDeal[] = insightRows
    .filter((i) => i.deal_health_score != null && Number(i.deal_health_score) < 50)
    .map((i) => ({
      callId: i.call_id,
      name: callName.get(i.call_id) ?? "Call",
      score: Number(i.deal_health_score),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  // Top objection categories.
  const objCounts = new Map<string, number>();
  for (const i of insightRows) {
    const objs = (i.objections ?? []) as Objection[];
    for (const o of objs) {
      const cat = o.category || "other";
      objCounts.set(cat, (objCounts.get(cat) ?? 0) + 1);
    }
  }
  const topObjections = [...objCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Deal stage distribution.
  const stageCounts = new Map<string, number>();
  for (const i of insightRows) {
    const stage = i.deal_stage_recommendation || "Unspecified";
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  }
  const stageDistribution = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  // Weekly trend over the last 6 weeks.
  const now = Date.now();
  const buckets: { label: string; calls: number; won: number }[] = [];
  for (let w = 5; w >= 0; w--) {
    const start = now - (w + 1) * WEEK_MS;
    const end = now - w * WEEK_MS;
    const label = new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const callsInWeek = callRows.filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t > start && t <= end;
    }).length;
    const wonInWeek = insightRows.filter((i) => {
      const t = new Date(i.created_at).getTime();
      return (
        t > start &&
        t <= end &&
        (i.deal_stage_recommendation ?? "").toLowerCase() === "closed won"
      );
    }).length;
    buckets.push({ label, calls: callsInWeek, won: wonInWeek });
  }

  return {
    totalCalls,
    completedCalls,
    avgSentiment,
    wonDeals,
    avgAdherence,
    atRiskDeals,
    topObjections,
    stageDistribution,
    trend: buckets,
  };
}
