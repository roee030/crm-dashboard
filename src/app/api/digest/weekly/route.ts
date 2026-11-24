import { NextResponse } from "next/server";
import { requireContext } from "@/lib/workspace";
import { getWeeklyDigest } from "@/lib/digest";

export const runtime = "nodejs";

/** GET /api/digest/weekly — executive weekly brief, strictly workspace-scoped. */
export async function GET() {
  const ctx = await requireContext();
  const digest = await getWeeklyDigest(ctx.workspaceId);
  return NextResponse.json({ workspace: ctx.workspaceName, digest });
}
