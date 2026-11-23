"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/crm";
import {
  saveTokenIntegration,
  disconnectIntegration,
  updateIntegrationConfig,
  loadCredentials,
} from "@/lib/crm/integration";
import type { CrmConfig, ProviderKey, TargetOption, VerifyResult } from "@/lib/crm/types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

/** Ensure the caller is an owner/admin of a workspace; returns its id. */
async function requireManage(): Promise<{ workspaceId: string } | { error: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) return { error: "No workspace" };
  if (member.role !== "owner" && member.role !== "admin") {
    return { error: "Only workspace admins can manage integrations" };
  }
  return { workspaceId: member.workspace_id };
}

export async function connectWithToken(
  provider: ProviderKey,
  token: string,
): Promise<ActionResult<VerifyResult>> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!token.trim()) return { ok: false, error: "Token is required" };

  // Verify the token before persisting.
  const verify = await getProvider({
    provider,
    accessToken: token.trim(),
    config: {},
  }).verifyConnection();
  if (!verify.ok) return { ok: false, error: verify.error ?? "Verification failed" };

  await saveTokenIntegration({
    workspaceId: ctx.workspaceId,
    provider,
    accessToken: token.trim(),
    authMode: "token",
    accountLabel: verify.account ?? null,
  });
  return { ok: true, data: verify };
}

export async function verifyConnection(provider: ProviderKey): Promise<ActionResult<VerifyResult>> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const creds = await loadCredentials(ctx.workspaceId, provider);
  if (!creds) return { ok: false, error: "Not connected" };

  const verify = await getProvider(creds).verifyConnection();
  if (verify.ok && verify.account) {
    await updateIntegrationConfig(ctx.workspaceId, provider, {}); // no-op touch
  }
  return verify.ok ? { ok: true, data: verify } : { ok: false, error: verify.error ?? "Failed" };
}

export async function getTargets(provider: ProviderKey): Promise<ActionResult<TargetOption[]>> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const creds = await loadCredentials(ctx.workspaceId, provider);
  if (!creds) return { ok: false, error: "Not connected" };
  try {
    const targets = await getProvider(creds).listTargets();
    return { ok: true, data: targets };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveMapping(
  provider: ProviderKey,
  patch: Partial<CrmConfig>,
): Promise<ActionResult> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  await updateIntegrationConfig(ctx.workspaceId, provider, patch);
  return { ok: true };
}

export async function disconnect(provider: ProviderKey): Promise<ActionResult> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  await disconnectIntegration(ctx.workspaceId, provider);
  return { ok: true };
}
