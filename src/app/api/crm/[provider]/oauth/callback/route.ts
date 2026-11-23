import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/crm/oauth";
import { saveTokenIntegration, loadCredentials } from "@/lib/crm/integration";
import { getProvider } from "@/lib/crm";
import type { ProviderKey } from "@/lib/crm/types";

export const runtime = "nodejs";

function isProvider(p: string): p is ProviderKey {
  return p === "hubspot" || p === "monday";
}

/** GET /api/crm/[provider]/oauth/callback — exchange code, encrypt & store tokens. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = new URL(req.url).origin;
  const settings = `${origin}/settings/integrations`;

  if (!isProvider(provider)) {
    return NextResponse.redirect(`${settings}?error=unknown_provider`);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const raw = cookieStore.get("crm_oauth")?.value;
  if (!code || !state || !raw) {
    return NextResponse.redirect(`${settings}?error=missing_params`);
  }

  let stored: { state: string; workspaceId: string; provider: string };
  try {
    stored = JSON.parse(raw);
  } catch {
    return NextResponse.redirect(`${settings}?error=bad_state`);
  }
  if (stored.state !== state || stored.provider !== provider) {
    return NextResponse.redirect(`${settings}?error=state_mismatch`);
  }

  try {
    const redirectUri = `${process.env.APP_URL ?? origin}/api/crm/${provider}/oauth/callback`;
    const token = await exchangeCodeForToken(provider, code, redirectUri);

    await saveTokenIntegration({
      workspaceId: stored.workspaceId,
      provider,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      authMode: "oauth",
    });

    // Best-effort: label the connection with the account name.
    const creds = await loadCredentials(stored.workspaceId, provider);
    if (creds) {
      const verify = await getProvider(creds).verifyConnection();
      if (verify.ok && verify.account) {
        await saveTokenIntegration({
          workspaceId: stored.workspaceId,
          provider,
          accessToken: token.access_token,
          refreshToken: token.refresh_token ?? null,
          authMode: "oauth",
          accountLabel: verify.account,
        });
      }
    }

    const res = NextResponse.redirect(`${settings}?connected=${provider}`);
    res.cookies.delete("crm_oauth");
    return res;
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "oauth_failed");
    return NextResponse.redirect(`${settings}?error=${msg}`);
  }
}
