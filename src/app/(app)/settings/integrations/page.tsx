import { requireContext } from "@/lib/workspace";
import { getIntegrationStatuses } from "@/lib/crm/integration";
import { IntegrationCard } from "@/components/settings/integration-card";

export default async function IntegrationsPage() {
  const ctx = await requireContext();
  const statuses = await getIntegrationStatuses(ctx.workspaceId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Integrations</h1>
        <p className="text-sm text-slate-400">
          Connect HubSpot or Monday.com with an API token (fastest) or OAuth. Insights
          sync as call notes, deal-stage updates, and follow-up tasks.
        </p>
      </div>

      <div className="grid gap-5">
        <IntegrationCard status={statuses.hubspot} />
        <IntegrationCard status={statuses.monday} />
      </div>
    </div>
  );
}
