export type Criterion = {
  id: string;
  key: string;
  label: string;
  description: string;
  weight: number;
};

export type Playbook = {
  id: string;
  name: string;
  description: string | null;
  language: "en" | "he" | "both";
  criteria: Criterion[];
  is_default: boolean;
};

export type RiskFlag = {
  severity: "high" | "medium" | "low";
  code: string;
  title: string;
  evidence_quote: string;
};

/** Per-criterion result as returned by the model (score 0|1|2). */
export type PlaybookResultItem = {
  key: string;
  score: 0 | 1 | 2;
  evidence: string;
  coaching_tip: string;
};

/** Stored shape: criteria key -> result. */
export type PlaybookResultMap = Record<
  string,
  { score: number; evidence: string; coaching_tip: string }
>;

export type DealHealth = {
  score: number; // 0-100
  results: PlaybookResultMap;
};

/**
 * Deterministic weighted deal-health score.
 * score = Σ(weight_i · (result_i / 2)) / Σ(weight_i) · 100, rounded.
 * A criterion with no result contributes 0. Same inputs → same output (pure).
 */
export function computeDealHealth(
  criteria: Criterion[],
  results: PlaybookResultItem[],
): DealHealth {
  const byKey = new Map(results.map((r) => [r.key, r]));
  const resultMap: PlaybookResultMap = {};

  let weighted = 0;
  let totalWeight = 0;

  for (const c of criteria) {
    const weight = Number.isFinite(c.weight) ? c.weight : 0;
    totalWeight += weight;
    const r = byKey.get(c.key);
    const raw = r ? Math.max(0, Math.min(2, r.score)) : 0;
    weighted += weight * (raw / 2);
    resultMap[c.key] = {
      score: raw,
      evidence: r?.evidence ?? "",
      coaching_tip: r?.coaching_tip ?? "",
    };
  }

  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;
  return { score, results: resultMap };
}

/** Average adherence (0-100) across a set of deal-health scores. */
export function averageAdherence(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function riskLevel(score: number | null | undefined): "high" | "medium" | "low" | "unknown" {
  if (score == null) return "unknown";
  if (score < 50) return "high";
  if (score < 70) return "medium";
  return "low";
}
