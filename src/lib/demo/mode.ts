/**
 * Zero-env demo mode detection.
 *
 * The app runs out-of-the-box with no `.env.local` by falling back to an
 * in-memory bilingual dataset (see `./data.ts` + `./client.ts`). Demo mode is on
 * when either (a) DEMO_MODE is explicitly "true", or (b) the Supabase env the
 * production path requires is not configured.
 *
 * When this returns `false`, every production code path (real Supabase + RLS,
 * AssemblyAI, Claude, CRM OAuth) is used unchanged — the demo layer is inert.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

/** The in-memory demo tenant. Mirrors the dev workspace id used by the API. */
export const DEMO_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_USER_EMAIL = "roee@signaldesk.io";
export const DEMO_WORKSPACE_NAME = "SignalDesk Demo Workspace";
