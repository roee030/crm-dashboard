import type { RiskFlagRow } from "@/types/db";

export type AlertTrigger = "on_high_risk_deal" | "on_negative_sentiment" | "on_call_completed";

export type AlertCall = {
  id: string;
  title: string | null;
  customer_name: string | null;
};

export type AlertInsight = {
  sentiment_score: number | null;
  sentiment_label: string | null;
  deal_health_score: number | null;
  risk_flags: RiskFlagRow[];
};

/** Which configured triggers fire for this call's insight (pure, testable). */
export function matchedTriggers(
  configured: string[],
  insight: AlertInsight,
): AlertTrigger[] {
  const out: AlertTrigger[] = [];
  const has = (t: AlertTrigger) => configured.includes(t);

  if (has("on_call_completed")) out.push("on_call_completed");

  if (has("on_negative_sentiment") && insight.sentiment_score != null && insight.sentiment_score < -0.4) {
    out.push("on_negative_sentiment");
  }

  const highRisk =
    (insight.deal_health_score != null && insight.deal_health_score < 50) ||
    insight.risk_flags.some((r) => r.severity === "high");
  if (has("on_high_risk_deal") && highRisk) {
    out.push("on_high_risk_deal");
  }

  return out;
}

const TRIGGER_LABEL: Record<AlertTrigger, string> = {
  on_high_risk_deal: "⚠️ High-risk deal",
  on_negative_sentiment: "🔻 Negative sentiment",
  on_call_completed: "✅ Call completed",
};

/** Slack Block Kit payload (also valid JSON for Teams/Make/custom consumers). */
export function buildAlertPayload(
  call: AlertCall,
  insight: AlertInsight,
  triggers: AlertTrigger[],
  appUrl?: string,
): Record<string, unknown> {
  const name = call.customer_name || call.title || "Call";
  const link = appUrl ? `${appUrl}/calls/${call.id}` : undefined;
  const health = insight.deal_health_score != null ? `${insight.deal_health_score}/100` : "n/a";
  const sentiment =
    insight.sentiment_score != null
      ? `${insight.sentiment_label ?? ""} (${insight.sentiment_score > 0 ? "+" : ""}${Math.round(insight.sentiment_score * 100)})`
      : "n/a";
  const headline = triggers.map((t) => TRIGGER_LABEL[t]).join("  ·  ");

  const fields = [
    `*Deal health:* ${health}`,
    `*Sentiment:* ${sentiment}`,
  ];
  if (insight.risk_flags.length) {
    fields.push(`*Risks:* ${insight.risk_flags.map((r) => r.title).slice(0, 3).join(", ")}`);
  }

  return {
    text: `SignalDesk — ${headline}: ${name}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*SignalDesk alert* — ${headline}\n*${name}*` } },
      { type: "section", fields: fields.map((f) => ({ type: "mrkdwn", text: f })) },
      ...(link
        ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open call" }, url: link }] }]
        : []),
    ],
  };
}
