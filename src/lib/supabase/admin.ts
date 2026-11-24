import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { isDemoMode } from "@/lib/demo/mode";
import { createDemoClient } from "@/lib/demo/client";

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code
 * (pipeline writes, webhook finalize). Never import into a client component.
 *
 * In zero-env demo mode this returns the shared in-memory demo client (same
 * store as the user-scoped client), so server reads/writes stay consistent.
 */
export function createAdminClient() {
  if (isDemoMode()) {
    return createDemoClient() as unknown as SupabaseClient<Database>;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
