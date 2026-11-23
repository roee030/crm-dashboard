import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { runSyncForCall } from "@/lib/crm/integration";

export const runtime = "nodejs";

const body = z.object({
  call_id: z.string().uuid(),
  provider: z.enum(["hubspot", "monday"]).optional(),
});

/** POST /api/crm/sync — manually push a call's insights to the connected CRM(s). */
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
    .select("id, workspace_id, status")
    .eq("id", input.call_id)
    .maybeSingle();

  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const ctx = await resolveContext(req, call.workspace_id);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  if (call.status !== "completed") {
    return NextResponse.json(
      { error: "Call is not analyzed yet; nothing to sync." },
      { status: 409 },
    );
  }

  const outcomes = await runSyncForCall({
    workspaceId: call.workspace_id,
    callId: call.id,
    provider: input.provider,
  });

  if (outcomes.length === 0) {
    return NextResponse.json(
      { error: "No active CRM integration to sync to." },
      { status: 409 },
    );
  }

  const anyOk = outcomes.some((o) => o.status === "synced");
  return NextResponse.json({ outcomes }, { status: anyOk ? 200 : 502 });
}
