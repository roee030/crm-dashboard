import type { ProviderKey } from "./types";

type OAuthProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
};

export function oauthConfig(provider: ProviderKey): OAuthProviderConfig {
  if (provider === "hubspot") {
    return {
      authorizeUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      scope: "crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write",
      clientId: process.env.HUBSPOT_CLIENT_ID,
      clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    };
  }
  return {
    authorizeUrl: "https://auth.monday.com/oauth2/authorize",
    tokenUrl: "https://auth.monday.com/oauth2/token",
    scope: "me:read boards:read boards:write updates:write",
    clientId: process.env.MONDAY_CLIENT_ID,
    clientSecret: process.env.MONDAY_CLIENT_SECRET,
  };
}

export function buildAuthorizeUrl(
  provider: ProviderKey,
  redirectUri: string,
  state: string,
): string {
  const cfg = oauthConfig(provider);
  const params = new URLSearchParams({
    client_id: cfg.clientId ?? "",
    redirect_uri: redirectUri,
    scope: cfg.scope,
    state,
    ...(provider === "hubspot" ? {} : { response_type: "code" }),
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function exchangeCodeForToken(
  provider: ProviderKey,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const cfg = oauthConfig(provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId ?? "",
    client_secret: cfg.clientSecret ?? "",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json as TokenResponse;
}
