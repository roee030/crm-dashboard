import { z } from "zod";

const scoreBlock = z.object({
  score: z.number().min(1).max(10),
  feedback: z.string().min(1),
});

export const coachingSchema = z.object({
  scorecard: z.object({
    discovery: scoreBlock,
    objection_handling: scoreBlock,
    next_step_closing: scoreBlock,
  }),
  missed_opportunities: z
    .array(
      z.object({
        objection: z.string(),
        suggested_response: z.string(),
      }),
    )
    .default([]),
  follow_up_email: z.object({
    language: z.string(), // e.g. "en", "he"
    subject: z.string(),
    body: z.string(),
  }),
});

export type Coaching = z.infer<typeof coachingSchema>;

const scoreJson = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 1, maximum: 10 },
    feedback: { type: "string" },
  },
  required: ["score", "feedback"],
} as const;

export const coachingJsonSchema = {
  type: "object",
  properties: {
    scorecard: {
      type: "object",
      properties: {
        discovery: scoreJson,
        objection_handling: scoreJson,
        next_step_closing: scoreJson,
      },
      required: ["discovery", "objection_handling", "next_step_closing"],
    },
    missed_opportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          objection: { type: "string" },
          suggested_response: { type: "string" },
        },
        required: ["objection", "suggested_response"],
      },
    },
    follow_up_email: {
      type: "object",
      properties: {
        language: { type: "string", description: "Primary language code of the call, e.g. 'en' or 'he'." },
        subject: { type: "string" },
        body: {
          type: "string",
          description: "Full email body in the call's primary language; Hebrew stays Hebrew (RTL).",
        },
      },
      required: ["language", "subject", "body"],
    },
  },
  required: ["scorecard", "missed_opportunities", "follow_up_email"],
} as const;
