import { describe, it, expect } from "vitest";
import { computeTalkMetrics } from "@/lib/transcript-metrics";

describe("computeTalkMetrics", () => {
  it("returns empty metrics for no utterances", () => {
    const m = computeTalkMetrics([]);
    expect(m.totalMs).toBe(0);
    expect(m.speakers).toHaveLength(0);
    expect(m.talkToListenRatio).toBeNull();
  });

  it("computes per-speaker shares and a 60/40 talk ratio", () => {
    const m = computeTalkMetrics([
      { speaker: "A", start_ms: 0, end_ms: 6000, text: "one two three" },
      { speaker: "B", start_ms: 6000, end_ms: 10000, text: "four five" },
    ]);
    expect(m.totalMs).toBe(10000);
    expect(m.dominantSpeaker).toBe("A");
    const a = m.speakers.find((s) => s.speaker === "A")!;
    const b = m.speakers.find((s) => s.speaker === "B")!;
    expect(a.sharePct).toBe(60);
    expect(b.sharePct).toBe(40);
    expect(a.wordCount).toBe(3);
    // 6000 / 4000 = 1.5
    expect(m.talkToListenRatio).toBe(1.5);
  });

  it("aggregates multiple turns per speaker", () => {
    const m = computeTalkMetrics([
      { speaker: "A", start_ms: 0, end_ms: 1000, text: "a" },
      { speaker: "B", start_ms: 1000, end_ms: 2000, text: "b" },
      { speaker: "A", start_ms: 2000, end_ms: 4000, text: "c d" },
    ]);
    const a = m.speakers.find((s) => s.speaker === "A")!;
    expect(a.turns).toBe(2);
    expect(a.durationMs).toBe(3000);
    expect(a.wordCount).toBe(3);
  });
});
