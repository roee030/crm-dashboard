import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sentimentTone, sentimentLabel } from "@/lib/sentiment";
import type { InsightRow } from "@/types/db";

export function InsightsCard({ insight }: { insight: InsightRow }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>AI Insights</CardTitle>
        <Badge tone={sentimentTone(Number(insight.sentiment_score))}>
          {sentimentLabel(Number(insight.sentiment_score))}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Summary</h4>
          <p dir="auto" className="text-sm leading-relaxed text-slate-200">
            {insight.summary || "—"}
          </p>
        </section>

        <section>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Deal Stage Recommendation
          </h4>
          <Badge tone="info">{insight.deal_stage_recommendation || "—"}</Badge>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Objections</h4>
          {insight.objections.length === 0 ? (
            <p className="text-sm text-slate-500">None detected.</p>
          ) : (
            <ul className="space-y-1.5">
              {insight.objections.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                  <Badge tone="warning" className="shrink-0">{o.category}</Badge>
                  <span dir="auto">{o.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Action Items</h4>
          {insight.action_items.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="space-y-1.5">
              {insight.action_items.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  <span dir="auto">
                    {a.text}
                    {(a.owner || a.due_hint) && (
                      <span className="text-slate-500">
                        {" "}
                        — {a.owner ?? "unassigned"}
                        {a.due_hint ? `, ${a.due_hint}` : ""}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
