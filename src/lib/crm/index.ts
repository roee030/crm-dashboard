import { HubSpotProvider } from "./hubspot";
import { MondayProvider } from "./monday";
import type { CrmCredentials, CrmProvider, ProviderKey } from "./types";

export const PROVIDERS: { key: ProviderKey; label: string }[] = [
  { key: "hubspot", label: "HubSpot" },
  { key: "monday", label: "Monday.com" },
];

/** Factory: build the provider adapter from decrypted credentials. */
export function getProvider(creds: CrmCredentials): CrmProvider {
  switch (creds.provider) {
    case "hubspot":
      return new HubSpotProvider(creds);
    case "monday":
      return new MondayProvider(creds);
    default:
      throw new Error(`Unknown CRM provider: ${creds.provider}`);
  }
}

export * from "./types";
