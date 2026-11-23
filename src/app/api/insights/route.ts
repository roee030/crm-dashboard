import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { finalizeCall } from "@/lib/pipeline/finalize";

export const runtime = "nodejs";

const body = z.object({
  call_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional(),
});

/**
 * POST /api/insights  — manually (re)trigger insight extraction for a call.
 * Mostly for retrying a `failed` call or forcing analysis in local dev. Runs the
 * shared idempotent finalize step, so it will not duplicate work already done.
 */
export async function POST(req: Request) {
  let input: z.infer<typeof body>;
  try {
    input = body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data: call } = await db
    .from("calls")
    .select("id, workspace_id")
    .eq("id", input.call_id)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const ctx = await resolveContext(req, call.workspace_id);
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const result = await finalizeCall(call.id);
  return NextResponse.json(result, { status: 200 });
}
