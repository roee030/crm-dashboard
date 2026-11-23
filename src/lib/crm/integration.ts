import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, maybeDecrypt } from "@/lib/crypto";
import { getProvider } from "./index";
import { refreshHubspotTokenIfNeeded } from "./hubspot";
import type {
  CrmConfig,
  CrmCredentials,
  ProviderKey,
  SyncCall,
  SyncInsight,
} from "./types";
import type { Objection, ActionItem } from "@/types/db";

/** Public (token-free) view of an integration for client components. */
export type IntegrationStatus = {
  provider: ProviderKey;
  connected: boolean;
  isActive: boolean;
  authMode: "token" | "oauth" | null;
  accountLabel: string | null;
  config: CrmConfig;
};

export async function getIntegrationStatuses(
  workspaceId: string,
): Promise<Record<ProviderKey, IntegrationStatus>> {
  const db = createAdminClient();
  const { data } = await db
    .from("crm_integrations")
    .select("provider, is_active, account_label, config")
    .eq("workspace_id", workspaceId);

  const base = (provider: ProviderKey): IntegrationStatus => ({
    provider,
    connected: false,
    isActive: false,
    authMode: null,
    accountLabel: null,
    config: {},
  });
  const result: Record<ProviderKey, IntegrationStatus> = {
    hubspot: base("hubspot"),
    monday: base("monday"),
  };

  for (const row of data ?? []) {
    const provider = row.provider as ProviderKey;
    const config = (row.config ?? {}) as CrmConfig;
    result[provider] = {
      provider,
      connected: true,
      isActive: row.is_active,
      authMode: config.auth_mode ?? "token",
      accountLabel: row.account_label,
      config, // tokens are never selected, so this is token-free
    };
  }
  return result;
}

/** Load decrypted credentials for one active provider, or null. */
export async function loadCredentials(
  workspaceId: string,
  provider: ProviderKey,
): Promise<CrmCredentials | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("crm_integrations")
    .select("provider, access_token, refresh_token, expires_at, config, is_active")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data || !data.is_active) return null;
  let accessToken = maybeDecrypt(data.access_token);
  if (!accessToken) return null;
  const refreshToken = maybeDecrypt(data.refresh_token);
  const config = (data.config ?? {}) as CrmConfig;

  // Auto-refresh HubSpot OAuth tokens nearing expiry.
  if (provider === "hubspot" && config.auth_mode === "oauth") {
    accessToken = await refreshHubspotTokenIfNeeded({
      workspaceId,
      accessToken,
      refreshToken,
      expiresAt: data.expires_at,
    });
  }

  return { provider, accessToken, refreshToken, config };
}

export async function saveTokenIntegration(args: {
  workspaceId: string;
  provider: ProviderKey;
  accessToken: string;
  refreshToken?: string | null;
  authMode: "token" | "oauth";
  accountLabel?: string | null;
  configPatch?: Partial<CrmConfig>;
}): Promise<void> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("crm_integrations")
    .select("config")
    .eq("workspace_id", args.workspaceId)
    .eq("provider", args.provider)
    .maybeSingle();

  const config: CrmConfig = {
    ...((existing?.config ?? {}) as CrmConfig),
    ...(args.configPatch ?? {}),
    auth_mode: args.authMode,
  };

  await db
    .from("crm_integrations")
    .upsert(
      {
        workspace_id: args.workspaceId,
        provider: args.provider,
        access_token: encryptSecret(args.accessToken),
        refresh_token: args.refreshToken ? encryptSecret(args.refreshToken) : null,
        account_label: args.accountLabel ?? null,
        config,
        is_active: true,
      },
      { onConflict: "workspace_id,provider" },
    );
}

export async function updateIntegrationConfig(
  workspaceId: string,
  provider: ProviderKey,
  patch: Partial<CrmConfig>,
): Promise<void> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("crm_integrations")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  const config = { ...((existing?.config ?? {}) as CrmConfig), ...patch };
  await db
    .from("crm_integrations")
    .update({ config })
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
}

export async function disconnectIntegration(
  workspaceId: string,
  provider: ProviderKey,
): Promise<void> {
  const db = createAdminClient();
  await db
    .from("crm_integrations")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
}

export type SyncOutcome = {
  provider: ProviderKey;
  status: "synced" | "failed";
  externalRef?: string;
  url?: string;
  error?: string;
};

/**
 * Run the sync for one call across the requested providers, logging every
 * attempt into crm_sync_logs. `autoOnly` restricts to integrations with
 * config.auto_sync === true (used by the finalize auto-sync hook).
 */
export async function runSyncForCall(opts: {
  workspaceId: string;
  callId: string;
  provider?: ProviderKey;
  autoOnly?: boolean;
}): Promise<SyncOutcome[]> {
  const db = createAdminClient();

  const { data: call } = await db
    .from("calls")
    .select("id, title, customer_name, customer_email, customer_phone")
    .eq("id", opts.callId)
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();
  const { data: insight } = await db
    .from("insights")
    .select("summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation")
    .eq("call_id", opts.callId)
    .maybeSingle();

  if (!call || !insight) return [];

  const syncCall: SyncCall = call;
  const syncInsight: SyncInsight = {
    summary: insight.summary,
    sentiment_label: insight.sentiment_label,
    sentiment_score: insight.sentiment_score == null ? null : Number(insight.sentiment_score),
    objections: (insight.objections ?? []) as Objection[],
    action_items: (insight.action_items ?? []) as ActionItem[],
    deal_stage_recommendation: insight.deal_stage_recommendation,
  };

  const providers: ProviderKey[] = opts.provider ? [opts.provider] : ["hubspot", "monday"];
  const outcomes: SyncOutcome[] = [];

  for (const key of providers) {
    const creds = await loadCredentials(opts.workspaceId, key);
    if (!creds) continue;
    if (opts.autoOnly && !creds.config.auto_sync) continue;

    // Log a pending attempt up front.
    const { data: log } = await db
      .from("crm_sync_logs")
      .insert({
        workspace_id: opts.workspaceId,
        call_id: opts.callId,
        provider: key,
        status: "pending",
      })
      .select("id")
      .single();

    try {
      const provider = getProvider(creds);
      const res = await provider.sync(syncCall, syncInsight);
      await db
        .from("crm_sync_logs")
        .update({ status: "synced", external_ref: res.externalRef, error: null })
        .eq("id", log!.id);
      await db.from("calls").update({ crm_contact_ref: res.externalRef }).eq("id", opts.callId);
      outcomes.push({ provider: key, status: "synced", externalRef: res.externalRef, url: res.url });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await db.from("crm_sync_logs").update({ status: "failed", error }).eq("id", log!.id);
      outcomes.push({ provider: key, status: "failed", error });
    }
  }

  return outcomes;
}

/** Fire-and-forget auto-sync used by finalize.ts. Never throws. */
export async function autoSyncCall(callId: string): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: call } = await db
      .from("calls")
      .select("workspace_id")
      .eq("id", callId)
      .maybeSingle();
    if (!call) return;
    await runSyncForCall({ workspaceId: call.workspace_id, callId, autoOnly: true });
  } catch {
    /* auto-sync must never break the pipeline */
  }
}
