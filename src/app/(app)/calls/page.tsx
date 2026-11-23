import Link from "next/link";
import { Upload } from "lucide-react";
import { requireContext } from "@/lib/workspace";
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CallsList, type CallListItem } from "@/components/calls/calls-list";

export default async function CallsPage() {
  const ctx = await requireContext();
  const supabase = await createServerSupabase();

  const [{ data: calls }, { data: insights }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, title, customer_name, language, status, duration_sec, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("insights")
      .select("call_id, sentiment_score, deal_stage_recommendation")
      .eq("workspace_id", ctx.workspaceId),
  ]);

  const insightByCall = new Map(
    (insights ?? []).map((i) => [i.call_id, i]),
  );

  const items: CallListItem[] = (calls ?? []).map((c) => {
    const ins = insightByCall.get(c.id);
    return {
      id: c.id,
      title: c.title,
      customer_name: c.customer_name,
      language: c.language,
      status: c.status,
      duration_sec: c.duration_sec,
      created_at: c.created_at,
      sentiment_score: ins ? Number(ins.sentiment_score) : null,
      deal_stage: ins?.deal_stage_recommendation ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="text-sm text-slate-400">{items.length} calls in this workspace.</p>
        </div>
        <Link href="/upload">
          <Button>
            <Upload className="h-4 w-4" />
            Upload call
          </Button>
        </Link>
      </div>

      <CallsList calls={items} />
    </div>
  );
}
