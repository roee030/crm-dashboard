import { cn } from "@/lib/utils";
import type { Utterance } from "@/types/db";

const speakerStyles = [
  "border-indigo-500/40 bg-indigo-500/5",
  "border-emerald-500/40 bg-emerald-500/5",
  "border-amber-500/40 bg-amber-500/5",
  "border-sky-500/40 bg-sky-500/5",
];

function ms(t: number): string {
  const s = Math.floor(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TranscriptViewer({ utterances }: { utterances: Utterance[] }) {
  if (!utterances || utterances.length === 0) {
    return <p className="text-sm text-slate-500">No transcript available.</p>;
  }

  const speakers = [...new Set(utterances.map((u) => u.speaker))];

  return (
    <div className="space-y-3">
      {utterances.map((u, i) => {
        const idx = speakers.indexOf(u.speaker);
        return (
          <div
            key={i}
            className={cn(
              "rounded-lg border-l-2 px-4 py-2.5",
              speakerStyles[idx % speakerStyles.length],
            )}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-300">Speaker {u.speaker}</span>
              <span>·</span>
              <span className="tabular-nums">{ms(u.start_ms)}</span>
            </div>
            {/* dir="auto" so Hebrew renders RTL and English LTR, per utterance. */}
            <p dir="auto" className="text-sm leading-relaxed text-slate-200">
              {u.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
