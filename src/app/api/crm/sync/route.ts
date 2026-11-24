import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { runSyncForCall } from "@/lib/crm/integration";
import { isDemoMode } from "@/lib/demo/mode";

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

  // Demo mode: simulate a successful sync to the connected providers.
  if (isDemoMode()) {
    const providers = input.provider ? [input.provider] : (["hubspot", "monday"] as const);
    const ref = input.call_id.slice(-4);
    const outcomes = providers.map((p) => ({
      provider: p,
      status: "synced" as const,
      externalRef: p === "hubspot" ? `hs-note-${ref}` : `mon-item-${ref}`,
      url: p === "hubspot" ? `https://app.hubspot.com/contacts/demo/record/${ref}` : `https://demo.monday.com/boards/987654321/pulses/${ref}`,
    }));
    return NextResponse.json({ outcomes }, { status: 200 });
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
