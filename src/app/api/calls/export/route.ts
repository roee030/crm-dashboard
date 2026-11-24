import { NextResponse } from "next/server";
import { requireContext } from "@/lib/workspace";
import { createServerSupabase } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import type { Objection } from "@/types/db";

export const runtime = "nodejs";

const COLUMNS = [
  "call_id",
  "title",
  "customer_name",
  "customer_email",
  "language",
  "status",
  "sentiment_label",
  "sentiment_score",
  "deal_health_score",
  "deal_stage",
  "objection_categories",
  "crm_synced",
  "created_at",
];

/** GET /api/calls/export?format=csv|json — RLS-scoped export of the workspace's calls. */
export async function GET(req: Request) {
  const ctx = await requireContext();
  const supabase = await createServerSupabase();
  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";

  const [{ data: calls }, { data: insights }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, title, customer_name, customer_email, language, status, crm_contact_ref, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("insights")
      .select("call_id, sentiment_label, sentiment_score, deal_health_score, deal_stage_recommendation, objections")
      .eq("workspace_id", ctx.workspaceId),
  ]);

  const insightByCall = new Map((insights ?? []).map((i) => [i.call_id, i]));
  const records = (calls ?? []).map((c) => {
    const ins = insightByCall.get(c.id);
    const cats = ((ins?.objections ?? []) as Objection[]).map((o) => o.category).join("; ");
    return {
      call_id: c.id,
      title: c.title ?? "",
      customer_name: c.customer_name ?? "",
      customer_email: c.customer_email ?? "",
      language: c.language ?? "",
      status: c.status,
      sentiment_label: ins?.sentiment_label ?? "",
      sentiment_score: ins?.sentiment_score ?? "",
      deal_health_score: ins?.deal_health_score ?? "",
      deal_stage: ins?.deal_stage_recommendation ?? "",
      objection_categories: cats,
      crm_synced: c.crm_contact_ref ? "yes" : "no",
      created_at: c.created_at,
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new NextResponse(JSON.stringify(records, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="signaldesk-calls-${stamp}.json"`,
      },
    });
  }

  const csv = toCsv(
    COLUMNS,
    records.map((r) => COLUMNS.map((k) => (r as Record<string, unknown>)[k])),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="signaldesk-calls-${stamp}.csv"`,
    },
  });
}
