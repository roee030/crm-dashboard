import { requireContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { WebhooksManager } from "@/components/settings/webhooks-manager";
import type { ApiKeyView } from "@/app/(app)/settings/webhooks/actions";

export default async function WebhooksPage() {
  const ctx = await requireContext();

  // Read keys via the service-role client, selecting only non-secret columns
  // (key_hash must never reach the client).
  const admin = createAdminClient();
  const { data: keys } = await admin
    .from("workspace_api_keys")
    .select("id, label, key_prefix, last_used_at, revoked_at, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  const ingestUrl = `${process.env.APP_URL ?? "https://your-app.example.com"}/api/webhooks/calls/ingest`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks &amp; Ingestion</h1>
        <p className="text-sm text-slate-400">
          Push calls into SignalDesk automatically from Zapier, Make, Twilio, or any VoIP
          platform. Generate a key, then POST recording URLs to the ingestion endpoint.
        </p>
      </div>
      <WebhooksManager initialKeys={(keys ?? []) as ApiKeyView[]} ingestUrl={ingestUrl} />
    </div>
  );
}
