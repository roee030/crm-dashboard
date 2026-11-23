import type { ActionItem, Objection } from "@/types/db";

export type ProviderKey = "hubspot" | "monday";

export type CrmConfig = {
  auth_mode?: "token" | "oauth";
  auto_sync?: boolean;
  account_label?: string;
  // HubSpot
  pipeline_id?: string;
  deal_stage_map?: Record<string, string>; // our stage -> hubspot stage id
  // Monday
  board_id?: string;
  status_column_id?: string;
  status_map?: Record<string, string>; // our stage -> monday status label
};

export type CrmCredentials = {
  provider: ProviderKey;
  accessToken: string;
  refreshToken?: string | null;
  config: CrmConfig;
};

export type SyncCall = {
  id: string;
  title: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

export type SyncInsight = {
  summary: string | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  objections: Objection[];
  action_items: ActionItem[];
  deal_stage_recommendation: string | null;
};

export type VerifyResult = { ok: boolean; account?: string; error?: string };
export type TargetOption = { id: string; name: string };
export type SyncResult = { externalRef: string; url?: string; detail?: string };

export interface CrmProvider {
  key: ProviderKey;
  /** Cheap authenticated call to confirm the token works. */
  verifyConnection(): Promise<VerifyResult>;
  /** HubSpot deal pipelines, or Monday boards — for the mapping UI. */
  listTargets(): Promise<TargetOption[]>;
  /** Log the note, update the mapped stage, and create follow-up tasks. */
  sync(call: SyncCall, insight: SyncInsight): Promise<SyncResult>;
}

/** Plain-text note body shared by both providers. */
export function formatNoteBody(call: SyncCall, insight: SyncInsight): string {
  const lines: string[] = [`SignalDesk — ${call.title ?? "Call insights"}`];
  if (call.customer_name) lines.push(`Customer: ${call.customer_name}`);
  if (insight.summary) lines.push("", insight.summary);

  const score = insight.sentiment_score;
  lines.push(
    "",
    `Sentiment: ${insight.sentiment_label ?? "n/a"}${
      score != null ? ` (${score > 0 ? "+" : ""}${Math.round(score * 100)})` : ""
    }`,
  );

  if (insight.objections.length) {
    lines.push("", "Objections:");
    for (const o of insight.objections) lines.push(`• [${o.category}] ${o.text}`);
  }
  if (insight.deal_stage_recommendation) {
    lines.push("", `Recommended stage: ${insight.deal_stage_recommendation}`);
  }
  if (insight.action_items.length) {
    lines.push("", "Action items:");
    for (const a of insight.action_items) {
      const meta = [a.owner, a.due_hint].filter(Boolean).join(", ");
      lines.push(`• ${a.text}${meta ? ` (${meta})` : ""}`);
    }
  }
  return lines.join("\n");
}
