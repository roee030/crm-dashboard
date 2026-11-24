import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/config/models";
import { insightsSchema, insightsJsonSchema, type Insights } from "@/schemas/insights";
import type { Criterion } from "@/lib/playbooks/scoring";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

const TOOL_NAME = "record_insights";

const SYSTEM = [
  "You are a sales/support conversation analyst.",
  "You analyze a single call transcript and extract structured insights.",
  "The transcript may be in English or Hebrew (or a mix).",
  "Hebrew is written right-to-left: preserve the original wording and script exactly;",
  "do NOT transliterate, translate, reorder, or reverse any characters.",
  "Write `summary` and `deal_stage_recommendation` in the transcript's primary language.",
  "Score the call against the provided playbook criteria (0=not met, 1=partial, 2=met),",
  "quoting verbatim transcript evidence for each. Flag concrete deal risks.",
  "Base every field strictly on what the transcript supports; do not invent facts.",
  "Return your answer only via the `record_insights` tool.",
].join(" ");

/**
 * Run Claude with a forced tool call for structured output, then validate with Zod.
 * `fullText` is passed through untouched so RTL/Hebrew content is never corrupted.
 * `criteria` (the workspace's active playbook) tells the model which keys to score.
 */
export async function extractInsights(args: {
  fullText: string;
  language?: string | null;
  criteria?: Criterion[];
}): Promise<Insights> {
  const langHint = args.language
    ? `Detected language code: ${args.language}.`
    : "Language not specified; infer it from the text.";

  const criteria = args.criteria ?? [];
  const playbookHint = criteria.length
    ? `\n\nPlaybook criteria to score (use these exact keys in playbook_results):\n` +
      criteria.map((c) => `- ${c.key}: ${c.label} — ${c.description}`).join("\n")
    : "\n\nNo playbook configured; return an empty playbook_results array.";

  const message = await anthropic.messages.create({
    model: MODELS.claude.model,
    max_tokens: MODELS.claude.maxTokens,
    system: SYSTEM,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the structured insights extracted from the call.",
        input_schema: insightsJsonSchema as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `${langHint}${playbookHint}\n\nTranscript:\n"""\n${args.fullText}\n"""`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error("Claude did not return a tool_use block for insights.");
  }

  // Zod is the real contract; the model's JSON schema is a strong hint, not a guarantee.
  return insightsSchema.parse(toolUse.input);
}
