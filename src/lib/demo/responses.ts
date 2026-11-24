/**
 * Synthesized, context-aware responses for AI/CRM endpoints in demo mode.
 * All answers are derived deterministically from the in-memory demo dataset —
 * no external Claude/AssemblyAI calls — and preserve Hebrew (RTL) when the user
 * writes in Hebrew.
 */
import { buildDemoData } from "./data";
import type { Objection } from "@/types/db";

type ChatMessage = { role: "user" | "assistant"; content: string };

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/** A smart-enough workspace copilot answer built from demo calls. */
export function demoChatAnswer(messages: ChatMessage[]): string {
  const data = buildDemoData();
  const insights = data.insights;
  const callById = new Map(data.calls.map((c) => [c.id, c]));
  const name = (callId: string) => {
    const c = callById.get(callId);
    return c?.customer_name || c?.title || "Call";
  };

  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const he = hasHebrew(last);
  const q = last.toLowerCase();

  // Aggregates
  const scores = insights.map((i) => Number(i.sentiment_score)).filter(Number.isFinite);
  const avgSentiment = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const objCount = new Map<string, number>();
  for (const i of insights) for (const o of (i.objections ?? []) as Objection[]) objCount.set(o.category, (objCount.get(o.category) ?? 0) + 1);
  const topObjections = [...objCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const atRisk = insights
    .filter((i) => i.deal_health_score != null && Number(i.deal_health_score) < 50)
    .sort((a, b) => Number(a.deal_health_score) - Number(b.deal_health_score));
  const negative = insights.filter((i) => Number(i.sentiment_score) < -0.2);

  const wantsObjections = /objection|pricing|price|budget/.test(q) || /התנגד|מחיר|תקציב/.test(last);
  const wantsRisk = /risk|attention|negative|at.?risk|slip/.test(q) || /סיכון|שלילי|סיכון|תשומת|נפילה/.test(last);
  const wantsHebrew = /hebrew|עברית|לקוחות/.test(last) || /summar|סכם|סיכום/.test(q) || /סכם/.test(last);

  if (wantsObjections) {
    if (he) {
      const lines = topObjections.map(([c, n], i) => `${i + 1}. ${c} — ${n} שיחות`);
      return [
        "שלוש קטגוריות ההתנגדות המובילות החודש:",
        ...lines,
        "",
        `ההתנגדות הבולטת ביותר היא סביב ${topObjections[0]?.[0] ?? "מחיר"}, בעיקר אצל גלובוס טק (בריאות העסקה 28) שם המנכ\"ל לוחץ לקצץ בהוצאות. מומלץ להוביל עם תמחור שנתי ובידול העברית.`,
      ].join("\n");
    }
    const lines = topObjections.map(([c, n], i) => `${i + 1}. ${c} — ${n} call(s)`);
    return [
      "Top objection categories this month:",
      ...lines,
      "",
      `The sharpest pressure is around ${topObjections[0]?.[0] ?? "pricing"}, led by Globex Industries (deal health 44) where the CFO is cutting tooling spend. Recommend leading with annual pricing and the bilingual CRM write-back Chorus/Gong can't match.`,
    ].join("\n");
  }

  if (wantsRisk) {
    if (he) {
      const lines = atRisk.map((i) => `• ${name(i.call_id)} — בריאות עסקה ${i.deal_health_score}/100, סנטימנט ${Number(i.sentiment_score).toFixed(2)}`);
      return [
        `${atRisk.length} עסקאות בסיכון דורשות תשומת לב:`,
        ...lines,
        "",
        "העסקה הדחופה ביותר היא גלובוס טק: לחץ מחיר מול מתחרה, קיצוץ תקציבי של המנכ\"ל, וסיכון להחליק מעבר לרבעון. כדאי להשיג קו ישיר למנכ\"ל לפני הדיון הפיננסי.",
      ].join("\n");
    }
    const lines = atRisk.map((i) => `• ${name(i.call_id)} — deal health ${i.deal_health_score}/100, sentiment ${Number(i.sentiment_score).toFixed(2)}`);
    return [
      `${atRisk.length} deals are at risk and need attention:`,
      ...lines,
      "",
      `Negative-sentiment calls: ${negative.map((i) => name(i.call_id)).join(", ") || "none"}. The most urgent is Globex Industries — competitor price pressure, a CFO budget cut, and slip risk past quarter-end. Get a direct line to the CFO before the finance review.`,
    ].join("\n");
  }

  if (wantsHebrew && he) {
    const heCalls = data.calls.filter((c) => c.language === "he");
    const lines = heCalls.map((c) => {
      const ins = insights.find((i) => i.call_id === c.id);
      return `• ${c.customer_name}: ${ins?.deal_stage_recommendation ?? ""}, בריאות עסקה ${ins?.deal_health_score ?? "—"}/100`;
    });
    return [
      `סיכום הלקוחות בעברית (${heCalls.length} שיחות):`,
      ...lines,
      "",
      "חברת אלפא ובנק הפועלים דיגיטל במסלול חיובי; מדיטק בשלב הדגמה עם סקירת אבטחה פתוחה; גלובוס טק בסיכון גבוה בשל לחץ מחיר.",
    ].join("\n");
  }

  // General overview
  if (he) {
    return [
      `יש ${data.calls.length} שיחות בסביבת העבודה, סנטימנט ממוצע ${avgSentiment.toFixed(2)}.`,
      `${atRisk.length} עסקאות בסיכון (בריאות עסקה מתחת ל-50) ו-${insights.filter((i) => (i.deal_stage_recommendation ?? "").toLowerCase().includes("won")).length} עסקאות שנסגרו בהצלחה.`,
      "שאל/י אותי על התנגדויות, עסקאות בסיכון, או סיכום לקוחות ספציפי.",
    ].join("\n");
  }
  return [
    `Your workspace has ${data.calls.length} calls with an average sentiment of ${avgSentiment.toFixed(2)}.`,
    `${atRisk.length} deals are at risk (deal health < 50) and ${insights.filter((i) => (i.deal_stage_recommendation ?? "").toLowerCase().includes("won")).length} have closed won.`,
    "Ask me about objections, at-risk deals, or a summary of specific customers (English or Hebrew).",
  ].join("\n");
}

/** Cached-style coaching for a demo call (falls back to a generic scorecard). */
export function demoCoaching(callId: string): unknown {
  const data = buildDemoData();
  const insight = data.insights.find((i) => i.call_id === callId);
  if (insight?.call_coaching) return insight.call_coaching;
  return {
    scorecard: {
      discovery: { score: 7, feedback: "Solid discovery; quantify the pain further next time." },
      objection_handling: { score: 6, feedback: "Address objections with concrete proof points." },
      next_step_closing: { score: 7, feedback: "Confirm a dated next step before ending the call." },
    },
    missed_opportunities: [],
    follow_up_email: {
      language: "en",
      subject: "Great speaking today — next steps",
      body: "Hi,\n\nThanks for the conversation. Here's a quick recap and the next steps we agreed on.\n\nBest,\nThe SignalDesk team",
    },
  };
}

/** Deterministic re-score for a demo call. */
export function demoReanalyze(callId: string): number {
  const data = buildDemoData();
  const insight = data.insights.find((i) => i.call_id === callId);
  return insight?.deal_health_score ?? 70;
}
