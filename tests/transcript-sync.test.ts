import { describe, it, expect } from "vitest";
import { activeUtteranceIndex } from "@/lib/transcript-metrics";
import type { Utterance } from "@/types/db";

const u: Utterance[] = [
  { speaker: "A", start_ms: 0, end_ms: 2000, text: "one" },
  { speaker: "B", start_ms: 2000, end_ms: 5000, text: "two" },
  { speaker: "A", start_ms: 5000, end_ms: 8000, text: "three" },
];

describe("activeUtteranceIndex", () => {
  it("matches the utterance whose window contains the time", () => {
    expect(activeUtteranceIndex(u, 0)).toBe(0);
    expect(activeUtteranceIndex(u, 1999)).toBe(0);
    expect(activeUtteranceIndex(u, 2000)).toBe(1);
    expect(activeUtteranceIndex(u, 6000)).toBe(2);
  });
  it("returns -1 before the first utterance starts", () => {
    expect(activeUtteranceIndex([{ speaker: "A", start_ms: 1000, end_ms: 2000, text: "x" }], 500)).toBe(-1);
  });
  it("falls back to the last started utterance past the end", () => {
    expect(activeUtteranceIndex(u, 9000)).toBe(2);
  });
  it("returns -1 for empty input", () => {
    expect(activeUtteranceIndex([], 100)).toBe(-1);
  });
});
