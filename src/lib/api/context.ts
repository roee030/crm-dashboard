import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type RequestContext =
  | { ok: true; workspaceId: string; userId: string | null; dev: boolean }
  | { ok: false; status: number; error: string };

/**
 * Resolves which workspace a write belongs to.
 *
 * - Dev path: header `x-dev-api-key` matching env DEV_API_KEY lets you pass an
 *   explicit `workspaceId` (defaults to the seeded dev workspace) so the API is
 *   curl-testable before auth/UI exist. Disabled unless DEV_API_KEY is set.
 * - Normal path: uses the signed-in user's session; the caller must belong to the
 *   requested workspace (verified against workspace_members).
 */
export async function resolveContext(
  req: Request,
  bodyWorkspaceId?: string,
): Promise<RequestContext> {
  const devKey = process.env.DEV_API_KEY;
  const headerKey = req.headers.get("x-dev-api-key");

  if (devKey && headerKey && headerKey === devKey) {
    const workspaceId =
      bodyWorkspaceId ?? "00000000-0000-0000-0000-000000000010"; // seeded dev workspace
    return { ok: true, workspaceId, userId: null, dev: true };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  if (!bodyWorkspaceId) {
    return { ok: false, status: 400, error: "workspace_id is required" };
  }

  // Membership check (RLS also enforces this, but fail fast with a clear error).
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", bodyWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return { ok: false, status: 403, error: "Not a member of this workspace" };
  }

  return { ok: true, workspaceId: bodyWorkspaceId, userId: user.id, dev: false };
}
