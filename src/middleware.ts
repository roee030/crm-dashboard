import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * Refreshes the Supabase auth session cookie on navigation.
 * Route guards for the (app) group land here in Phase 3 once login exists.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Zero-env demo mode: no auth session to refresh and no route guards — the
  // (app) group loads immediately against the in-memory demo dataset.
  if (isDemoMode()) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touches the session so expired tokens are refreshed into the response cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard the authenticated app group.
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/calls") ||
    path.startsWith("/upload");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Keep authenticated users out of the auth pages.
  if ((path === "/login" || path === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/transcription|api/crm).*)",
  ],
};
