"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Criterion } from "@/lib/playbooks/scoring";

type Result = { ok: true } | { ok: false; error: string };

async function requireManage(): Promise<{ workspaceId: string } | { error: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!member) return { error: "No workspace" };
  if (member.role !== "owner" && member.role !== "admin") {
    return { error: "Only workspace admins can edit playbooks" };
  }
  return { workspaceId: member.workspace_id };
}

export async function updatePlaybook(
  id: string,
  patch: { name: string; description: string; criteria: Criterion[] },
): Promise<Result> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  // Normalize weights to non-negative numbers.
  const criteria = patch.criteria.map((c) => ({
    ...c,
    weight: Math.max(0, Math.round(Number(c.weight) || 0)),
  }));

  const admin = createAdminClient();
  const { error } = await admin
    .from("playbooks")
    .update({ name: patch.name, description: patch.description, criteria })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId); // RLS-equivalent scoping on the admin client
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setDefaultPlaybook(id: string): Promise<Result> {
  const ctx = await requireManage();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const admin = createAdminClient();
  await admin
    .from("playbooks")
    .update({ is_default: false })
    .eq("workspace_id", ctx.workspaceId);
  const { error } = await admin
    .from("playbooks")
    .update({ is_default: true })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
