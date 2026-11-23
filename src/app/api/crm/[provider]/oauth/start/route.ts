import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAuthorizeUrl } from "@/lib/crm/oauth";
import type { ProviderKey } from "@/lib/crm/types";

export const runtime = "nodejs";

function isProvider(p: string): p is ProviderKey {
  return p === "hubspot" || p === "monday";
}

/** GET /api/crm/[provider]/oauth/start — begin the OAuth 2.0 connect flow. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const origin = new URL(req.url).origin;
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.redirect(`${origin}/login`);

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${process.env.APP_URL ?? origin}/api/crm/${provider}/oauth/callback`;
  const authorizeUrl = buildAuthorizeUrl(provider, redirectUri, state);

  const res = NextResponse.redirect(authorizeUrl);
  // Bind state + workspace to this browser for the callback to verify.
  res.cookies.set(
    "crm_oauth",
    JSON.stringify({ state, workspaceId: membership.workspace_id, provider }),
    { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" },
  );
  return res;
}
