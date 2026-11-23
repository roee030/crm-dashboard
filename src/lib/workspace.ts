import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type CurrentContext = {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
};

/**
 * Resolves the signed-in user and their (first) workspace. Redirects to /login
 * if unauthenticated. The onboarding trigger guarantees a workspace exists.
 */
export async function requireContext(): Promise<CurrentContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const workspaceId = membership?.workspace_id;
  if (!workspaceId) redirect("/login");

  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? "",
    workspaceId,
    workspaceName: ws?.name ?? "Workspace",
  };
}
