import { requireContext } from "@/lib/workspace";
import { createServerSupabase } from "@/lib/supabase/server";
import { PlaybookEditor } from "@/components/settings/playbook-editor";
import type { PlaybookRow } from "@/types/db";

export default async function PlaybooksPage() {
  const ctx = await requireContext();
  const supabase = await createServerSupabase();

  const { data: playbooks } = await supabase
    .from("playbooks")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Playbooks</h1>
        <p className="text-sm text-slate-400">
          Define the qualification criteria and weights used to score every call&apos;s deal
          health. The active default is applied to new calls; re-analyze a call to apply changes.
        </p>
      </div>

      {(playbooks ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">No playbooks yet.</p>
      ) : (
        <div className="space-y-5">
          {(playbooks ?? []).map((p) => (
            <PlaybookEditor key={p.id} playbook={p as PlaybookRow} />
          ))}
        </div>
      )}
    </div>
  );
}
