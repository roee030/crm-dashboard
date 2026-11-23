export type Tone = "positive" | "negative" | "neutral";

export function sentimentTone(score: number | null | undefined): Tone {
  if (score == null) return "neutral";
  if (score >= 0.2) return "positive";
  if (score <= -0.2) return "negative";
  return "neutral";
}

export function sentimentLabel(score: number | null | undefined): string {
  if (score == null) return "—";
  const tone = sentimentTone(score);
  const pct = Math.round(score * 100);
  const word = tone === "positive" ? "Positive" : tone === "negative" ? "Negative" : "Neutral";
  return `${word} (${pct > 0 ? "+" : ""}${pct})`;
}
