import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** OAuth / email-confirmation callback: exchanges the code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Open-redirect guard: resolve the target, then require it to be same-origin,
  // a relative "/path" (not "//host" or "/\host"), and free of control chars.
  const nextParam = searchParams.get("next") ?? "/dashboard";
  let target = new URL("/dashboard", origin);
  try {
    const candidate = new URL(nextParam, origin);
    if (
      candidate.origin === origin &&
      nextParam.startsWith("/") &&
      !/[\\\t\r\n]/.test(nextParam)
    ) {
      target = candidate;
    }
  } catch {
    /* malformed next → fall back to /dashboard */
  }

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
