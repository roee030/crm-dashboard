import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireContext } from "@/lib/workspace";
import { AlertsManager } from "@/components/settings/alerts-manager";

export default async function AlertsPage() {
  const ctx = await requireContext();

  // Authorization gate: only owners/admins may view/manage alert config.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const canManage = member?.role === "owner" || member?.role === "admin";

  let initial: { hasWebhook: boolean; triggers: string[]; is_active: boolean } | null = null;
  if (canManage) {
    // webhook_url is a secret — never send it to the browser; expose only a flag.
    const { data: rule } = await admin
      .from("workspace_alert_rules")
      .select("webhook_url, triggers, is_active")
      .eq("workspace_id", ctx.workspaceId)
      .limit(1)
      .maybeSingle();
    initial = rule
      ? { hasWebhook: Boolean(rule.webhook_url), triggers: rule.triggers ?? [], is_active: rule.is_active }
      : null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Alerts</h1>
        <p className="text-sm text-slate-400">
          Get notified in Slack, Teams, or any webhook when a call completes, turns negative,
          or a deal goes at-risk. Alerts fire automatically after each call is analyzed.
        </p>
      </div>

      {canManage ? (
        <AlertsManager initial={initial} />
      ) : (
        <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
          Only workspace owners or admins can configure alerts.
        </p>
      )}
    </div>
  );
}
