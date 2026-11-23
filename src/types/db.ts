/**
 * Hand-maintained Supabase types for the tables the pipeline touches.
 * Regenerate/replace with `supabase gen types typescript` once the CLI is wired.
 *
 * NOTE: these are `type` aliases, not `interface`s, on purpose — Supabase's
 * GenericSchema requires each Row to be assignable to `Record<string, unknown>`,
 * and interfaces lack the implicit index signature that object-literal types have.
 * Using `interface` here collapses every query result to `never`.
 */
export type CallStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "completed"
  | "failed";
export type CallDirection = "inbound" | "outbound" | "unknown";
export type MemberRole = "owner" | "admin" | "member";
export type SentimentLabel = "positive" | "neutral" | "negative";
export type CrmProvider = "hubspot" | "monday";
export type SyncStatus = "pending" | "synced" | "failed";

export type Utterance = {
  speaker: string;
  start_ms: number;
  end_ms: number;
  text: string;
};

export type Objection = { text: string; category: string };
export type ActionItem = { text: string; owner: string | null; due_hint: string | null };

export type CallRow = {
  id: string;
  workspace_id: string;
  uploaded_by: string | null;
  title: string | null;
  direction: CallDirection;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  audio_path: string | null;
  duration_sec: number | null;
  language: string | null;
  status: CallStatus;
  error_message: string | null;
  external_provider_id: string | null;
  crm_contact_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type TranscriptRow = {
  id: string;
  call_id: string;
  workspace_id: string;
  provider: string;
  model: string | null;
  language: string | null;
  full_text: string | null;
  utterances: Utterance[];
  confidence: number | null;
  created_at: string;
};

export type InsightRow = {
  id: string;
  call_id: string;
  workspace_id: string;
  model: string | null;
  summary: string | null;
  sentiment_label: SentimentLabel | null;
  sentiment_score: number | null;
  objections: Objection[];
  action_items: ActionItem[];
  deal_stage_recommendation: string | null;
  raw: unknown;
  call_coaching: unknown;
  deal_health_score: number | null;
  risk_flags: RiskFlagRow[];
  playbook_results: Record<string, { score: number; evidence: string; coaching_tip: string }>;
  created_at: string;
};

export type RiskFlagRow = {
  severity: "high" | "medium" | "low";
  code: string;
  title: string;
  evidence_quote: string;
};

export type PlaybookRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  language: "en" | "he" | "both";
  criteria: { id: string; key: string; label: string; description: string; weight: number }[];
  is_default: boolean;
  created_at: string;
};

export type WorkspaceApiKeyRow = {
  id: string;
  workspace_id: string;
  label: string | null;
  key_prefix: string;
  key_hash: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type WorkspaceAlertRuleRow = {
  id: string;
  workspace_id: string;
  webhook_url: string;
  triggers: string[];
  is_active: boolean;
  created_at: string;
};

export type LeadRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  message: string | null;
  source: string | null;
  created_at: string;
};

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
};

export type CrmIntegrationRow = {
  id: string;
  workspace_id: string;
  provider: CrmProvider;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  account_label: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

export type CrmSyncLogRow = {
  id: string;
  workspace_id: string;
  call_id: string | null;
  provider: CrmProvider;
  status: SyncStatus;
  external_ref: string | null;
  error: string | null;
  created_at: string;
};

type TableDef<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      calls: TableDef<CallRow>;
      transcripts: TableDef<TranscriptRow>;
      insights: TableDef<InsightRow>;
      users: TableDef<UserRow>;
      workspaces: TableDef<WorkspaceRow>;
      workspace_members: TableDef<WorkspaceMemberRow>;
      crm_integrations: TableDef<CrmIntegrationRow>;
      crm_sync_logs: TableDef<CrmSyncLogRow>;
      leads: TableDef<LeadRow>;
      playbooks: TableDef<PlaybookRow>;
      workspace_api_keys: TableDef<WorkspaceApiKeyRow>;
      workspace_alert_rules: TableDef<WorkspaceAlertRuleRow>;
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_member: {
        Args: { ws: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
