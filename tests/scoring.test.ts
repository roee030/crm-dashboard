import { describe, it, expect } from "vitest";
import { computeDealHealth, averageAdherence, riskLevel, type Criterion } from "@/lib/playbooks/scoring";

const criteria: Criterion[] = [
  { id: "a", key: "budget", label: "Budget", description: "", weight: 25 },
  { id: "b", key: "authority", label: "Authority", description: "", weight: 25 },
  { id: "c", key: "need", label: "Need", description: "", weight: 30 },
  { id: "d", key: "timing", label: "Timing", description: "", weight: 20 },
];

describe("computeDealHealth", () => {
  it("returns 100 when every criterion is fully met", () => {
    const r = computeDealHealth(criteria, criteria.map((c) => ({ key: c.key, score: 2, evidence: "", coaching_tip: "" })));
    expect(r.score).toBe(100);
  });

  it("returns 0 when nothing is met", () => {
    const r = computeDealHealth(criteria, []);
    expect(r.score).toBe(0);
    expect(r.results.budget.score).toBe(0);
  });

  it("is weighted, not a simple average", () => {
    // Only 'need' (weight 30) fully met → 30 * 1 / 100 = 30
    const r = computeDealHealth(criteria, [{ key: "need", score: 2, evidence: "x", coaching_tip: "y" }]);
    expect(r.score).toBe(30);
    expect(r.results.need.evidence).toBe("x");
  });

  it("clamps out-of-range scores and ignores unknown keys", () => {
    const r = computeDealHealth(criteria, [
      { key: "budget", score: 2 as const, evidence: "", coaching_tip: "" },
      { key: "ghost", score: 2 as const, evidence: "", coaching_tip: "" },
    ]);
    // budget weight 25 fully met → 25
    expect(r.score).toBe(25);
    expect(r.results.ghost).toBeUndefined();
  });

  it("returns 0 with no criteria (no division by zero)", () => {
    expect(computeDealHealth([], []).score).toBe(0);
  });
});

describe("averageAdherence", () => {
  it("averages valid numbers and ignores null/NaN", () => {
    expect(averageAdherence([80, 40, null, undefined, NaN])).toBe(60);
  });
  it("returns null when empty", () => {
    expect(averageAdherence([null, undefined])).toBeNull();
  });
});

describe("riskLevel", () => {
  it("maps score ranges", () => {
    expect(riskLevel(30)).toBe("high");
    expect(riskLevel(49)).toBe("high");
    expect(riskLevel(50)).toBe("medium");
    expect(riskLevel(69)).toBe("medium");
    expect(riskLevel(70)).toBe("low");
    expect(riskLevel(null)).toBe("unknown");
  });
});
