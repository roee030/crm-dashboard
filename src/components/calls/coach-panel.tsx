"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Coaching } from "@/schemas/coaching";

function scoreTone(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 5) return "text-amber-400";
  return "text-rose-400";
}

export function CoachPanel({
  callId,
  initial,
}: {
  callId: string;
  initial: Coaching | null;
}) {
  const [coaching, setCoaching] = useState<Coaching | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to generate coaching");
      else setCoaching(json.coaching as Coaching);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyEmail() {
    if (!coaching) return;
    const text = `${coaching.follow_up_email.subject}\n\n${coaching.follow_up_email.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          AI Call Coach
        </CardTitle>
        {coaching && (
          <Button variant="ghost" size="sm" onClick={() => run(true)} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {!coaching ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-400">
              Get a rep scorecard, missed-opportunity counters, and a ready-to-send
              follow-up email in the call&apos;s language.
            </p>
            <Button onClick={() => run(false)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analyzing…" : "Generate coaching"}
            </Button>
          </div>
        ) : (
          <>
            {/* Scorecard */}
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["Discovery", coaching.scorecard.discovery],
                  ["Objections", coaching.scorecard.objection_handling],
                  ["Closing", coaching.scorecard.next_step_closing],
                ] as const
              ).map(([label, block]) => (
                <div key={label} className="rounded-lg border border-slate-800 p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className={`text-2xl font-semibold ${scoreTone(block.score)}`}>
                    {block.score}
                    <span className="text-sm text-slate-600">/10</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{block.feedback}</p>
                </div>
              ))}
            </div>

            {/* Missed opportunities */}
            {coaching.missed_opportunities.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Missed Opportunities &amp; Counters
                </h4>
                <ul className="space-y-2">
                  {coaching.missed_opportunities.map((m, i) => (
                    <li key={i} className="rounded-lg border border-slate-800 p-3 text-sm">
                      <p dir="auto" className="text-slate-300">
                        <span className="text-rose-400">Objection:</span> {m.objection}
                      </p>
                      <p dir="auto" className="mt-1 text-slate-300">
                        <span className="text-emerald-400">Try:</span> {m.suggested_response}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Follow-up email */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Follow-Up Email ({coaching.follow_up_email.language})
                </h4>
                <Button variant="outline" size="sm" onClick={copyEmail}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p dir="auto" className="text-sm font-medium text-slate-200">
                  {coaching.follow_up_email.subject}
                </p>
                <p dir="auto" className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {coaching.follow_up_email.body}
                </p>
              </div>
            </section>
          </>
        )}

        {error && <p className="text-sm text-rose-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
