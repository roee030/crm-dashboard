import { requireContext } from "@/lib/workspace";
import { getDashboardData } from "@/lib/dashboard";
import { sentimentLabel } from "@/lib/sentiment";
import { Kpi } from "@/components/dashboard/kpi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ObjectionsChart } from "@/components/charts/objections-chart";
import { TrendChart } from "@/components/charts/trend-chart";

export default async function DashboardPage() {
  const ctx = await requireContext();
  const d = await getDashboardData(ctx.workspaceId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400">Conversation intelligence across your calls.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total Calls" value={String(d.totalCalls)} hint={`${d.completedCalls} analyzed`} accent="indigo" />
        <Kpi
          label="Avg Sentiment"
          value={sentimentLabel(d.avgSentiment)}
          hint="across analyzed calls"
          accent={d.avgSentiment != null && d.avgSentiment < 0 ? "rose" : "emerald"}
        />
        <Kpi label="Deals Won" value={String(d.wonDeals)} hint="Closed Won" accent="emerald" />
        <Kpi
          label="At-Risk Objections"
          value={String(d.topObjections.reduce((a, b) => a + b.count, 0))}
          hint={`${d.topObjections.length} categories`}
          accent="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Objections</CardTitle>
          </CardHeader>
          <CardContent>
            <ObjectionsChart data={d.topObjections} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call &amp; Conversion Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={d.trend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline by Deal Stage</CardTitle>
        </CardHeader>
        <CardContent>
          {d.stageDistribution.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No analyzed calls yet.</p>
          ) : (
            <div className="space-y-3 py-2">
              {d.stageDistribution.map((s) => {
                const max = d.stageDistribution[0].count || 1;
                return (
                  <div key={s.stage} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-sm text-slate-300">{s.stage}</div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${(s.count / max) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-sm tabular-nums text-slate-400">{s.count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
