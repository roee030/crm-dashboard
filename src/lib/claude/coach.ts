import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/config/models";
import { coachingSchema, coachingJsonSchema, type Coaching } from "@/schemas/coaching";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
const TOOL_NAME = "record_coaching";

const SYSTEM = [
  "You are an elite B2B sales coach reviewing a single call transcript.",
  "Score the rep fairly and give concise, specific, actionable feedback.",
  "The transcript may be English or Hebrew (or a mix). Hebrew is right-to-left:",
  "preserve the original script exactly and never transliterate or reverse it.",
  "Write the follow-up email in the PRIMARY language of the call — Hebrew if the",
  "call is mostly Hebrew (keep it RTL/native), English if mostly English.",
  "Reference the customer's actual pain points and the agreed action items.",
  "Respond only through the record_coaching tool.",
].join(" ");

export async function generateCoaching(args: {
  fullText: string;
  language?: string | null;
  objections?: { text: string; category: string }[];
  actionItems?: { text: string; owner: string | null; due_hint: string | null }[];
}): Promise<Coaching> {
  const context = [
    args.language ? `Primary language code: ${args.language}.` : "Infer the language from the text.",
    args.objections?.length
      ? `Known objections: ${args.objections.map((o) => `[${o.category}] ${o.text}`).join("; ")}.`
      : "",
    args.actionItems?.length
      ? `Agreed action items: ${args.actionItems.map((a) => a.text).join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const message = await anthropic.messages.create({
    model: MODELS.claude.model,
    max_tokens: 3000,
    system: SYSTEM,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the rep scorecard, missed opportunities, and a follow-up email draft.",
        input_schema: coachingJsonSchema as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `${context}\n\nTranscript:\n"""\n${args.fullText}\n"""`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse) throw new Error("Claude did not return coaching output.");
  return coachingSchema.parse(toolUse.input);
}
