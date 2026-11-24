"use client";

import { useState } from "react";
import { FileText, X, Copy, Check, Loader2 } from "lucide-react";
import { isStaticDemo, clientDemoDigest } from "@/lib/demo/static";
import type { WeeklyDigest } from "@/lib/digest";

function toPlainText(d: WeeklyDigest): string {
  const lines = [
    "Weekly Executive Brief",
    `Total calls (7d): ${d.totalCalls}`,
    `Avg sentiment: ${d.avgSentiment != null ? Math.round(d.avgSentiment * 100) : "n/a"}` +
      (d.sentimentDeltaWoW != null ? ` (WoW ${d.sentimentDeltaWoW > 0 ? "+" : ""}${Math.round(d.sentimentDeltaWoW * 100)})` : ""),
    `Top objections: ${d.topObjections.map((o) => `${o.category} (${o.count})`).join(", ") || "none"}`,
    `At-risk deals: ${d.atRiskDeals.map((a) => `${a.name} ${a.score}`).join(", ") || "none"}`,
    d.bestCriterion ? `Strongest: ${d.bestCriterion.label} (${d.bestCriterion.avg}/2)` : "",
    d.worstCriterion ? `Weakest: ${d.worstCriterion.label} (${d.worstCriterion.avg}/2)` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function WeeklyBriefDrawer() {
  const [open, setOpen] = useState(false);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setOpen(true);
    if (digest) return;
    setLoading(true);
    try {
      if (isStaticDemo()) {
        await new Promise((r) => setTimeout(r, 300));
        setDigest(clientDemoDigest());
        return;
      }
      const res = await fetch("/api/digest/weekly");
      const json = await res.json();
      setDigest(json.digest as WeeklyDigest);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={load}
        className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
      >
        <FileText className="h-4 w-4" /> Weekly Brief
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 font-medium text-slate-100">
                <FileText className="h-4 w-4 text-indigo-400" /> Weekly Executive Brief
              </div>
              <div className="flex items-center gap-2">
                {digest && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(toPlainText(digest));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="text-slate-400 hover:text-slate-200"
                    title="Copy"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div dir="auto" className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {loading || !digest ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Building brief…
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Calls (7d)" value={String(digest.totalCalls)} />
                    <Metric
                      label="Avg sentiment"
                      value={digest.avgSentiment != null ? `${Math.round(digest.avgSentiment * 100)}` : "—"}
                      sub={digest.sentimentDeltaWoW != null ? `WoW ${digest.sentimentDeltaWoW > 0 ? "+" : ""}${Math.round(digest.sentimentDeltaWoW * 100)}` : undefined}
                    />
                  </div>

                  <Section title="Top objections">
                    {digest.topObjections.length === 0 ? (
                      <p className="text-slate-500">None.</p>
                    ) : (
                      <ul className="space-y-1">
                        {digest.topObjections.map((o) => (
                          <li key={o.category} className="flex justify-between text-slate-300">
                            <span>{o.category}</span>
                            <span className="text-slate-500">{o.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="At-risk deals">
                    {digest.atRiskDeals.length === 0 ? (
                      <p className="text-slate-500">None.</p>
                    ) : (
                      <ul className="space-y-1">
                        {digest.atRiskDeals.map((a) => (
                          <li key={a.callId} className="flex justify-between text-slate-300">
                            <span dir="auto">{a.name}</span>
                            <span className="text-rose-400">{a.score}/100</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="Playbook criteria">
                    {digest.bestCriterion && (
                      <p className="text-slate-300" dir="auto">
                        <span className="text-emerald-400">Strongest:</span> {digest.bestCriterion.label} ({digest.bestCriterion.avg}/2)
                      </p>
                    )}
                    {digest.worstCriterion && (
                      <p className="text-slate-300" dir="auto">
                        <span className="text-rose-400">Weakest:</span> {digest.worstCriterion.label} ({digest.worstCriterion.avg}/2)
                      </p>
                    )}
                    {!digest.bestCriterion && <p className="text-slate-500">No scored calls yet.</p>}
                  </Section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h4>
      {children}
    </div>
  );
}
