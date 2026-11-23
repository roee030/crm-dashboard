import { z } from "zod";

/** Structured insight output extracted by Claude. Validated before it hits the DB. */
export const insightsSchema = z.object({
  summary: z.string().min(1),
  sentiment_label: z.enum(["positive", "neutral", "negative"]),
  sentiment_score: z.number().min(-1).max(1),
  objections: z
    .array(
      z.object({
        text: z.string(),
        category: z.string(),
      }),
    )
    .default([]),
  action_items: z
    .array(
      z.object({
        text: z.string(),
        owner: z.string().nullable().default(null),
        due_hint: z.string().nullable().default(null),
      }),
    )
    .default([]),
  deal_stage_recommendation: z.string(),
  risk_flags: z
    .array(
      z.object({
        severity: z.enum(["high", "medium", "low"]),
        code: z.string(),
        title: z.string(),
        evidence_quote: z.string(),
      }),
    )
    .default([]),
  playbook_results: z
    .array(
      z.object({
        key: z.string(),
        score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        evidence: z.string(),
        coaching_tip: z.string(),
      }),
    )
    .default([]),
});

export type Insights = z.infer<typeof insightsSchema>;

/** JSON Schema mirror of the above, fed to Claude as a tool input_schema. */
export const insightsJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "2-4 sentence summary of the call." },
    sentiment_label: {
      type: "string",
      enum: ["positive", "neutral", "negative"],
      description: "Overall customer sentiment.",
    },
    sentiment_score: {
      type: "number",
      minimum: -1,
      maximum: 1,
      description: "Sentiment from -1 (very negative) to 1 (very positive).",
    },
    objections: {
      type: "array",
      description: "Concerns or objections the customer raised.",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: {
            type: "string",
            description: "e.g. price, timing, trust, features, competitor.",
          },
        },
        required: ["text", "category"],
      },
    },
    action_items: {
      type: "array",
      description: "Follow-up tasks implied by the call.",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          owner: { type: ["string", "null"] },
          due_hint: {
            type: ["string", "null"],
            description: "Natural-language timing if mentioned, else null.",
          },
        },
        required: ["text"],
      },
    },
    deal_stage_recommendation: {
      type: "string",
      description:
        "Recommended CRM deal stage, e.g. 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'.",
    },
    risk_flags: {
      type: "array",
      description:
        "Concrete deal risks found in the transcript: missing decision-maker, no agreed next step, unaddressed price objection, competitor mention, etc.",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"] },
          code: {
            type: "string",
            description: "snake_case code, e.g. missing_decision_maker, no_next_step, unaddressed_price, competitor_mention.",
          },
          title: { type: "string" },
          evidence_quote: { type: "string", description: "A short verbatim quote from the transcript (original language)." },
        },
        required: ["severity", "code", "title", "evidence_quote"],
      },
    },
    playbook_results: {
      type: "array",
      description:
        "Score the call against EACH provided playbook criterion key. score: 0=not met, 1=partial, 2=fully met.",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "The criterion key provided in the prompt." },
          score: { type: "integer", enum: [0, 1, 2] },
          evidence: { type: "string", description: "Verbatim transcript evidence (original language) or empty if none." },
          coaching_tip: { type: "string", description: "One concise tip to improve this criterion." },
        },
        required: ["key", "score", "evidence", "coaching_tip"],
      },
    },
  },
  required: [
    "summary",
    "sentiment_label",
    "sentiment_score",
    "objections",
    "action_items",
    "deal_stage_recommendation",
    "risk_flags",
    "playbook_results",
  ],
} as const;
