import Link from "next/link";
import { Upload } from "lucide-react";
import { requireContext } from "@/lib/workspace";
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/calls/status-badge";
import { FilterBar } from "@/components/calls/filter-bar";
import { sentimentTone } from "@/lib/sentiment";
import { riskLevel } from "@/lib/playbooks/scoring";
import { formatDate, formatDuration } from "@/lib/utils";
import type { RiskFlagRow, SyncStatus } from "@/types/db";

type RiskLevel = "high" | "medium" | "low" | "unknown";

const syncTone: Record<string, "positive" | "negative" | "warning" | "neutral"> = {
  synced: "positive",
  failed: "negative",
  pending: "warning",
  unsynced: "neutral",
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const supabase = await createServerSupabase();

  const [{ data: calls }, { data: insights }, { data: syncLogs }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, title, customer_name, language, status, duration_sec, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("insights")
      .select("call_id, sentiment_label, sentiment_score, deal_health_score, deal_stage_recommendation, risk_flags")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("crm_sync_logs")
      .select("call_id, status, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  const insightByCall = new Map((insights ?? []).map((i) => [i.call_id, i]));
  // Latest sync status per call.
  const syncByCall = new Map<string, SyncStatus>();
  for (const log of syncLogs ?? []) {
    if (!syncByCall.has(log.call_id!)) syncByCall.set(log.call_id!, log.status);
  }

  let items = (calls ?? []).map((c) => {
    const ins = insightByCall.get(c.id);
    const score = ins?.deal_health_score ?? null;
    const flags = (ins?.risk_flags ?? []) as RiskFlagRow[];
    const risk: RiskLevel = flags.some((f) => f.severity === "high")
      ? "high"
      : (riskLevel(score) as RiskLevel);
    return {
      id: c.id,
      title: c.title,
      customer_name: c.customer_name,
      language: c.language,
      status: c.status,
      duration_sec: c.duration_sec,
      created_at: c.created_at,
      sentiment_label: ins?.sentiment_label ?? null,
      sentiment_score: ins?.sentiment_score == null ? null : Number(ins.sentiment_score),
      deal_stage: ins?.deal_stage_recommendation ?? null,
      deal_health_score: score,
      risk,
      sync: (syncByCall.get(c.id) ?? "unsynced") as string,
    };
  });

  // --- URL-param filters ---
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) {
    items = items.filter((c) =>
      [c.title, c.customer_name, c.deal_stage, c.language]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }
  if (sp.sentiment) items = items.filter((c) => c.sentiment_label === sp.sentiment);
  if (sp.risk) items = items.filter((c) => c.risk === sp.risk);
  if (sp.language) items = items.filter((c) => c.language === sp.language);
  if (sp.sync) items = items.filter((c) => c.sync === sp.sync);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="text-sm text-slate-400">{items.length} shown</p>
        </div>
        <Link href="/upload">
          <Button>
            <Upload className="h-4 w-4" />
            Upload call
          </Button>
        </Link>
      </div>

      <FilterBar />

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Call</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Sentiment</th>
              <th className="px-4 py-3 font-medium">Lang</th>
              <th className="px-4 py-3 font-medium">CRM</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-slate-900/40">
                <td className="px-4 py-3">
                  <Link href={`/calls/${c.id}`} dir="auto" className="font-medium text-slate-100 hover:text-indigo-300">
                    {c.title || "Untitled call"}
                  </Link>
                  <div dir="auto" className="text-xs text-slate-500">{c.customer_name || "—"}</div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 tabular-nums text-slate-300">
                  {c.deal_health_score ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {c.risk === "unknown" ? (
                    <span className="text-slate-600">—</span>
                  ) : (
                    <Badge tone={c.risk === "high" ? "negative" : c.risk === "medium" ? "warning" : "positive"}>
                      {c.risk}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.sentiment_score == null ? (
                    <span className="text-slate-600">—</span>
                  ) : (
                    <Badge tone={sentimentTone(c.sentiment_score)}>
                      {c.sentiment_score > 0 ? "+" : ""}
                      {Math.round(c.sentiment_score * 100)}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 uppercase text-slate-400">{c.language || "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={syncTone[c.sync] ?? "neutral"}>{c.sync}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(c.created_at)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No calls match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
