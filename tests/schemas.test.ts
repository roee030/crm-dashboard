import { describe, it, expect } from "vitest";
import { insightsSchema } from "@/schemas/insights";
import { coachingSchema } from "@/schemas/coaching";

describe("insights schema", () => {
  it("accepts a valid English insight", () => {
    const parsed = insightsSchema.parse({
      summary: "Positive discovery call.",
      sentiment_label: "positive",
      sentiment_score: 0.6,
      objections: [{ text: "Too expensive", category: "price" }],
      action_items: [{ text: "Send ROI", owner: "AE", due_hint: "this week" }],
      deal_stage_recommendation: "Discovery",
    });
    expect(parsed.sentiment_label).toBe("positive");
  });

  it("defaults empty arrays and nullable action-item fields", () => {
    const parsed = insightsSchema.parse({
      summary: "x",
      sentiment_label: "neutral",
      sentiment_score: 0,
      objections: [],
      action_items: [{ text: "Follow up" }],
      deal_stage_recommendation: "Proposal",
    });
    expect(parsed.action_items[0].owner).toBeNull();
    expect(parsed.action_items[0].due_hint).toBeNull();
  });

  it("rejects out-of-range sentiment and bad labels", () => {
    expect(() =>
      insightsSchema.parse({
        summary: "x",
        sentiment_label: "angry",
        sentiment_score: 5,
        objections: [],
        action_items: [],
        deal_stage_recommendation: "X",
      }),
    ).toThrow();
  });

  it("preserves Hebrew (RTL) characters exactly through validation", () => {
    const hebrew = "הלקוח הביע חשש ממחיר גבוה מדי";
    const parsed = insightsSchema.parse({
      summary: hebrew,
      sentiment_label: "negative",
      sentiment_score: -0.5,
      objections: [{ text: "המחיר גבוה", category: "price" }],
      action_items: [],
      deal_stage_recommendation: "Closed Lost",
    });
    expect(parsed.summary).toBe(hebrew);
    expect([...parsed.summary]).toEqual([...hebrew]); // no reordering/mangling
    expect(parsed.objections[0].text).toBe("המחיר גבוה");
  });
});

describe("coaching schema", () => {
  it("validates a full coaching object with a Hebrew email", () => {
    const body = "שלום,\n\nתודה על השיחה. נשמח להתקדם לחתימה.\n\nבברכה";
    const parsed = coachingSchema.parse({
      scorecard: {
        discovery: { score: 8, feedback: "Good questions." },
        objection_handling: { score: 6, feedback: "Address price sooner." },
        next_step_closing: { score: 7, feedback: "Clear next step." },
      },
      missed_opportunities: [{ objection: "price", suggested_response: "Frame ROI." }],
      follow_up_email: { language: "he", subject: "המשך תהליך", body },
    });
    expect(parsed.scorecard.discovery.score).toBe(8);
    expect(parsed.follow_up_email.body).toBe(body);
  });

  it("rejects scores outside 1-10", () => {
    expect(() =>
      coachingSchema.parse({
        scorecard: {
          discovery: { score: 11, feedback: "x" },
          objection_handling: { score: 5, feedback: "x" },
          next_step_closing: { score: 5, feedback: "x" },
        },
        missed_opportunities: [],
        follow_up_email: { language: "en", subject: "s", body: "b" },
      }),
    ).toThrow();
  });
});
