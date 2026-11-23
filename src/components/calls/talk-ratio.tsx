import type { TalkMetrics } from "@/lib/transcript-metrics";

function pct(ms: number, total: number): number {
  return total > 0 ? Math.round((ms / total) * 100) : 0;
}

const BAR = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500"];

export function TalkRatio({ metrics }: { metrics: TalkMetrics }) {
  if (metrics.speakers.length === 0) {
    return <p className="text-sm text-slate-500">No speaker data.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-400">Talk-to-listen ratio</span>
        <span className="text-lg font-semibold text-slate-100">
          {metrics.talkToListenRatio != null ? `${metrics.talkToListenRatio}:1` : "—"}
        </span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        {metrics.speakers.map((s, i) => (
          <div
            key={s.speaker}
            className={BAR[i % BAR.length]}
            style={{ width: `${pct(s.durationMs, metrics.totalMs)}%` }}
            title={`Speaker ${s.speaker}: ${s.sharePct}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {metrics.speakers.map((s, i) => (
          <div key={s.speaker} className="rounded-lg border border-slate-800 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${BAR[i % BAR.length]}`} />
              <span className="text-slate-300">Speaker {s.speaker}</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{s.sharePct}%</div>
            <div className="text-xs text-slate-500">
              {s.wordCount} words · {s.turns} turns
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
