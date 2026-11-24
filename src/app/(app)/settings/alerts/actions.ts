"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicHttpUrl } from "@/lib/net/ssrf";
import { buildAlertPayload } from "@/lib/alerts/format";

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
    return { error: "Only workspace admins can manage alerts" };
  }
  return { workspaceId: member.workspace_id };
}

export async function saveAlertRule(input: {
  webhookUrl: string;
  triggers: string[];
  isActive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  if (input.webhookUrl && !(await isPublicHttpUrl(input.webhookUrl))) {
    return { ok: false, error: "Webhook URL must be a public http(s) endpoint." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("workspace_alert_rules")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("workspace_alert_rules")
      .update({ webhook_url: input.webhookUrl, triggers: input.triggers, is_active: input.isActive })
      .eq("id", existing.id)
      .eq("workspace_id", ctx.workspaceId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await admin.from("workspace_alert_rules").insert({
    workspace_id: ctx.workspaceId,
    webhook_url: input.webhookUrl,
    triggers: input.triggers,
    is_active: input.isActive,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function sendTestAlert(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const admin = createAdminClient();
  const { data: rule } = await admin
    .from("workspace_alert_rules")
    .select("webhook_url")
    .eq("workspace_id", ctx.workspaceId)
    .limit(1)
    .maybeSingle();

  if (!rule?.webhook_url) return { ok: false, error: "Save a webhook URL first." };
  if (!(await isPublicHttpUrl(rule.webhook_url))) {
    return { ok: false, error: "Webhook URL is not a permitted public endpoint." };
  }

  const payload = buildAlertPayload(
    { id: "test", title: "Test alert", customer_name: "SignalDesk" },
    { sentiment_score: -0.6, sentiment_label: "negative", deal_health_score: 42, risk_flags: [{ severity: "high", code: "test", title: "Test risk flag", evidence_quote: "This is a test alert." }] },
    ["on_call_completed", "on_negative_sentiment", "on_high_risk_deal"],
    process.env.APP_URL,
  );

  try {
    const res = await fetch(rule.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok || res.status === 0 ? { ok: true } : { ok: false, error: `Endpoint returned ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}
