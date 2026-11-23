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
  },
  required: [
    "summary",
    "sentiment_label",
    "sentiment_score",
    "objections",
    "action_items",
    "deal_stage_recommendation",
  ],
} as const;
