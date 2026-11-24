import { describe, it, expect } from "vitest";
import { matchedTriggers, buildAlertPayload, type AlertInsight } from "@/lib/alerts/format";

const base: AlertInsight = {
  sentiment_score: 0.5,
  sentiment_label: "positive",
  deal_health_score: 80,
  risk_flags: [],
};

describe("matchedTriggers", () => {
  it("always includes on_call_completed when configured", () => {
    expect(matchedTriggers(["on_call_completed"], base)).toEqual(["on_call_completed"]);
  });

  it("fires on_negative_sentiment only below -0.4", () => {
    expect(matchedTriggers(["on_negative_sentiment"], { ...base, sentiment_score: -0.5 })).toContain("on_negative_sentiment");
    expect(matchedTriggers(["on_negative_sentiment"], { ...base, sentiment_score: -0.3 })).not.toContain("on_negative_sentiment");
  });

  it("fires on_high_risk_deal for low score or high-severity flag", () => {
    expect(matchedTriggers(["on_high_risk_deal"], { ...base, deal_health_score: 40 })).toContain("on_high_risk_deal");
    expect(
      matchedTriggers(["on_high_risk_deal"], {
        ...base,
        deal_health_score: 90,
        risk_flags: [{ severity: "high", code: "x", title: "t", evidence_quote: "q" }],
      }),
    ).toContain("on_high_risk_deal");
  });

  it("does not fire triggers that are not configured", () => {
    expect(matchedTriggers([], { ...base, sentiment_score: -0.9, deal_health_score: 10 })).toEqual([]);
  });
});

describe("buildAlertPayload", () => {
  it("produces a Slack Block Kit payload with fields and a link", () => {
    const payload = buildAlertPayload(
      { id: "c1", title: "Acme", customer_name: "Acme Corp" },
      { ...base, deal_health_score: 42, sentiment_score: -0.6, sentiment_label: "negative", risk_flags: [{ severity: "high", code: "x", title: "No next step", evidence_quote: "q" }] },
      ["on_high_risk_deal"],
      "https://app.example.com",
    );
    expect(payload.text).toContain("Acme Corp");
    const blocks = payload.blocks as { type: string }[];
    expect(blocks.some((b) => b.type === "actions")).toBe(true);
    expect(JSON.stringify(payload)).toContain("https://app.example.com/calls/c1");
    expect(JSON.stringify(payload)).toContain("42/100");
  });

  it("omits the action block when no appUrl is given", () => {
    const payload = buildAlertPayload({ id: "c1", title: null, customer_name: null }, base, ["on_call_completed"]);
    const blocks = payload.blocks as { type: string }[];
    expect(blocks.some((b) => b.type === "actions")).toBe(false);
  });
});
