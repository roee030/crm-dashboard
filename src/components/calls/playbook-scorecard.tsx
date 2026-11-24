import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Criterion } from "@/lib/playbooks/scoring";

type ResultMap = Record<string, { score: number; evidence: string; coaching_tip: string }>;

const SCORE_META: Record<number, { label: string; cls: string }> = {
  0: { label: "Not met", cls: "bg-rose-500" },
  1: { label: "Partial", cls: "bg-amber-500" },
  2: { label: "Met", cls: "bg-emerald-500" },
};

export function PlaybookScorecard({
  playbookName,
  criteria,
  results,
}: {
  playbookName: string;
  criteria: Criterion[];
  results: ResultMap;
}) {
  if (criteria.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-200">Playbook Scorecard · {playbookName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criteria.map((c) => {
          const r = results[c.key] ?? { score: 0, evidence: "", coaching_tip: "" };
          const meta = SCORE_META[r.score] ?? SCORE_META[0];
          return (
            <div key={c.key} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200" dir="auto">{c.label}</span>
                  <span className="text-xs text-slate-500">· weight {c.weight}</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${meta.cls}`} />
                  {meta.label} ({r.score}/2)
                </span>
              </div>
              {r.evidence && (
                <p dir="auto" className="mt-2 text-xs italic text-slate-400">“{r.evidence}”</p>
              )}
              {r.coaching_tip && (
                <p dir="auto" className="mt-1 text-xs text-indigo-300">Tip: {r.coaching_tip}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
