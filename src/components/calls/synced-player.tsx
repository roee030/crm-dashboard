"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { activeUtteranceIndex } from "@/lib/transcript-metrics";
import { cn } from "@/lib/utils";
import type { Utterance } from "@/types/db";

const SPEEDS = [1, 1.25, 1.5, 2];
const SPEAKER_BORDER = [
  "border-indigo-500/40",
  "border-emerald-500/40",
  "border-amber-500/40",
  "border-sky-500/40",
];

function ms(t: number): string {
  const s = Math.floor(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded bg-amber-400/30 text-amber-200">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function SyncedPlayer({
  src,
  utterances,
}: {
  src: string | null;
  utterances: Utterance[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [query, setQuery] = useState("");

  const speakers = [...new Set(utterances.map((u) => u.speaker))];
  const activeIdx = activeUtteranceIndex(utterances, currentMs);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Keep the active utterance in view.
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  function seek(startMs: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = startMs / 1000;
    void audioRef.current.play();
  }

  return (
    <div className="space-y-3">
      {src ? (
        <audio
          ref={audioRef}
          controls
          preload="none"
          src={src}
          onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
          className="w-full"
        />
      ) : (
        <p className="text-sm text-slate-500">
          No audio attached — click an utterance to view it (seek disabled).
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                speed === s ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript…"
            className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div ref={listRef} className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {utterances.length === 0 ? (
          <p className="text-sm text-slate-500">No transcript available.</p>
        ) : (
          utterances.map((u, i) => {
            const speakerIdx = speakers.indexOf(u.speaker);
            const matches = query.trim() && u.text.toLowerCase().includes(query.toLowerCase());
            const dimmed = query.trim() && !matches;
            return (
              <button
                key={i}
                data-idx={i}
                onClick={() => seek(u.start_ms)}
                className={cn(
                  "block w-full rounded-lg border-l-2 px-3 py-2 text-left transition-colors",
                  SPEAKER_BORDER[speakerIdx % SPEAKER_BORDER.length],
                  i === activeIdx ? "bg-indigo-500/15" : "bg-slate-900/40 hover:bg-slate-900",
                  dimmed && "opacity-40",
                )}
              >
                <div className="mb-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-300">Speaker {u.speaker}</span>
                  <span>·</span>
                  <span className="tabular-nums">{ms(u.start_ms)}</span>
                </div>
                <p dir="auto" className="text-sm leading-relaxed text-slate-200">
                  <Highlighted text={u.text} query={query} />
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
