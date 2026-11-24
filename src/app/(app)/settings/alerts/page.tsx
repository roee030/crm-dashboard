import { requireContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertsManager } from "@/components/settings/alerts-manager";

export default async function AlertsPage() {
  const ctx = await requireContext();
  const admin = createAdminClient();
  const { data: rule } = await admin
    .from("workspace_alert_rules")
    .select("webhook_url, triggers, is_active")
    .eq("workspace_id", ctx.workspaceId)
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Smart Alerts</h1>
        <p className="text-sm text-slate-400">
          Get notified in Slack, Teams, or any webhook when a call completes, turns negative,
          or a deal goes at-risk. Alerts fire automatically after each call is analyzed.
        </p>
      </div>
      <AlertsManager
        initial={rule ? { webhook_url: rule.webhook_url, triggers: rule.triggers ?? [], is_active: rule.is_active } : null}
      />
    </div>
  );
}
