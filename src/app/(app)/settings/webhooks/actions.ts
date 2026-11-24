"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api-keys";
import { submitTranscription } from "@/lib/assemblyai/client";

async function requireManage(): Promise<{ workspaceId: string; userId: string } | { error: string }> {
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
    return { error: "Only workspace admins can manage keys" };
  }
  return { workspaceId: member.workspace_id, userId: user.id };
}

export type ApiKeyView = {
  id: string;
  label: string | null;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** Create a key; returns the raw secret ONCE (never stored in plaintext). */
export async function createKey(
  label: string,
): Promise<{ ok: true; raw: string; view: ApiKeyView } | { ok: false; error: string }> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { raw, prefix, hash } = generateApiKey();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_api_keys")
    .insert({
      workspace_id: ctx.workspaceId,
      label: label || "Ingestion key",
      key_prefix: prefix,
      key_hash: hash,
      created_by: ctx.userId,
    })
    .select("id, label, key_prefix, last_used_at, revoked_at, created_at")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create key" };
  return { ok: true, raw, view: data as ApiKeyView };
}

export async function revokeKey(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("workspace_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Simulate an inbound webhook call end-to-end using a public sample recording. */
export async function sendTestCall(): Promise<{ ok: true; callId: string } | { ok: false; error: string }> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const admin = createAdminClient();
  const { data: call, error } = await admin
    .from("calls")
    .insert({
      workspace_id: ctx.workspaceId,
      title: "Test webhook call",
      direction: "inbound",
      customer_name: "Webhook Test",
      status: "uploaded",
    })
    .select("id")
    .single();
  if (error || !call) return { ok: false, error: error?.message ?? "Failed" };

  try {
    const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/transcription/webhook` : undefined;
    const jobId = await submitTranscription({
      audioUrl: "https://assembly.ai/wildfires.mp3",
      webhookUrl,
      webhookSecret: process.env.ASSEMBLYAI_WEBHOOK_SECRET,
    });
    await admin.from("calls").update({ status: "transcribing", external_provider_id: jobId }).eq("id", call.id);
    return { ok: true, callId: call.id };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await admin.from("calls").update({ status: "failed", error_message: detail }).eq("id", call.id);
    return { ok: false, error: detail };
  }
}
