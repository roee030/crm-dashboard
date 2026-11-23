import type { Utterance } from "@/types/db";

export type SpeakerStat = {
  speaker: string;
  durationMs: number;
  wordCount: number;
  turns: number;
  sharePct: number; // share of total speaking time
};

export type TalkMetrics = {
  totalMs: number;
  speakers: SpeakerStat[];
  /** Ratio of the most-talkative speaker's time to the rest (e.g. 1.5 = 60/40). */
  talkToListenRatio: number | null;
  dominantSpeaker: string | null;
};

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Index of the utterance active at `currentMs` (start_ms <= t < end_ms).
 * Falls back to the most recent utterance that has started. -1 if none. Pure.
 */
export function activeUtteranceIndex(utterances: Utterance[], currentMs: number): number {
  let fallback = -1;
  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    if (currentMs >= u.start_ms && currentMs < u.end_ms) return i;
    if (currentMs >= u.start_ms) fallback = i;
  }
  return fallback;
}

/**
 * Deterministic talk-to-listen ratio and per-speaker breakdown from diarized
 * utterances. Pure function — no AI, same input always yields the same output.
 */
export function computeTalkMetrics(utterances: Utterance[]): TalkMetrics {
  if (!utterances || utterances.length === 0) {
    return { totalMs: 0, speakers: [], talkToListenRatio: null, dominantSpeaker: null };
  }

  const bySpeaker = new Map<string, SpeakerStat>();
  for (const u of utterances) {
    const dur = Math.max(0, (u.end_ms ?? 0) - (u.start_ms ?? 0));
    const cur =
      bySpeaker.get(u.speaker) ??
      { speaker: u.speaker, durationMs: 0, wordCount: 0, turns: 0, sharePct: 0 };
    cur.durationMs += dur;
    cur.wordCount += wordCount(u.text);
    cur.turns += 1;
    bySpeaker.set(u.speaker, cur);
  }

  const speakers = [...bySpeaker.values()].sort((a, b) => b.durationMs - a.durationMs);
  const totalMs = speakers.reduce((sum, s) => sum + s.durationMs, 0);
  for (const s of speakers) {
    s.sharePct = totalMs > 0 ? Math.round((s.durationMs / totalMs) * 1000) / 10 : 0;
  }

  const dominant = speakers[0] ?? null;
  const restMs = totalMs - (dominant?.durationMs ?? 0);
  const talkToListenRatio =
    dominant && restMs > 0
      ? Math.round((dominant.durationMs / restMs) * 100) / 100
      : dominant && totalMs > 0
        ? Infinity
        : null;

  return {
    totalMs,
    speakers,
    talkToListenRatio: talkToListenRatio === Infinity ? null : talkToListenRatio,
    dominantSpeaker: dominant?.speaker ?? null,
  };
}
