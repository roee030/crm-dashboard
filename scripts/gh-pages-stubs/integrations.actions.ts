/**
 * Static-demo stub for src/app/(app)/settings/integrations/actions.ts.
 * Swapped in by scripts/build-gh-pages.mjs for the GitHub Pages export build.
 * Simulates the CRM connect/verify/map flow client-side.
 */
import type { CrmConfig, ProviderKey, TargetOption, VerifyResult } from "@/lib/crm/types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const ACCOUNT: Record<ProviderKey, string> = {
  hubspot: "Acme GTM (HubSpot)",
  monday: "RevOps Board (Monday)",
};

const TARGETS: Record<ProviderKey, TargetOption[]> = {
  hubspot: [
    { id: "default", name: "Sales Pipeline" } as TargetOption,
    { id: "enterprise", name: "Enterprise Pipeline" } as TargetOption,
  ],
  monday: [
    { id: "987654321", name: "RevOps Board" } as TargetOption,
    { id: "123456789", name: "Customer Success Board" } as TargetOption,
  ],
};

export async function connectWithToken(
  provider: ProviderKey,
  token: string,
): Promise<ActionResult<VerifyResult>> {
  if (!token.trim()) return { ok: false, error: "Token is required" };
  return { ok: true, data: { ok: true, account: ACCOUNT[provider] } as VerifyResult };
}

export async function verifyConnection(provider: ProviderKey): Promise<ActionResult<VerifyResult>> {
  return { ok: true, data: { ok: true, account: ACCOUNT[provider] } as VerifyResult };
}

export async function getTargets(provider: ProviderKey): Promise<ActionResult<TargetOption[]>> {
  return { ok: true, data: TARGETS[provider] };
}

export async function saveMapping(
  _provider: ProviderKey,
  _patch: Partial<CrmConfig>,
): Promise<ActionResult> {
  return { ok: true };
}

export async function disconnect(_provider: ProviderKey): Promise<ActionResult> {
  return { ok: true };
}
