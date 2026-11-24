"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RiskFlagRow } from "@/types/db";

function healthColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#f43f5e";
}

function Gauge({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = healthColor(score);
  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="66" textAnchor="middle" className="fill-slate-50" fontSize="30" fontWeight="700">
        {score}
      </text>
      <text x="70" y="88" textAnchor="middle" className="fill-slate-500" fontSize="11">
        / 100
      </text>
    </svg>
  );
}

const sevTone: Record<RiskFlagRow["severity"], "negative" | "warning" | "neutral"> = {
  high: "negative",
  medium: "warning",
  low: "neutral",
};

export function DealHealthCard({
  callId,
  score,
  riskFlags,
}: {
  callId: string;
  score: number | null;
  riskFlags: RiskFlagRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reanalyze() {
    setBusy(true);
    try {
      await fetch(`/api/calls/${callId}/reanalyze`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-slate-200">Deal Health &amp; Risk Radar</CardTitle>
        <Button variant="ghost" size="sm" onClick={reanalyze} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Re-analyze
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center">
          {score == null ? (
            <div className="flex h-36 w-36 items-center justify-center text-sm text-slate-500">
              Not scored
            </div>
          ) : (
            <Gauge score={score} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
            <ShieldAlert className="h-4 w-4" /> Risk flags
          </div>
          {riskFlags.length === 0 ? (
            <p className="text-sm text-slate-500">No risks detected.</p>
          ) : (
            <ul className="space-y-2">
              {riskFlags.map((r, i) => (
                <li key={i} className="rounded-lg border border-slate-800 p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge tone={sevTone[r.severity]}>{r.severity}</Badge>
                    <span className="text-sm font-medium text-slate-200">{r.title}</span>
                  </div>
                  {r.evidence_quote && (
                    <p dir="auto" className="mt-1 text-xs italic text-slate-400">
                      “{r.evidence_quote}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
