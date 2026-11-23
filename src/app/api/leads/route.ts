import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(80).optional(),
});

/** POST /api/leads — public lead capture from the marketing landing page. */
export async function POST(req: Request) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  // Service-role insert (RLS grants no anon INSERT policy).
  const db = createAdminClient();
  const { error } = await db.from("leads").insert({
    email: input.email,
    name: input.name ?? null,
    company: input.company ?? null,
    message: input.message ?? null,
    source: input.source ?? "landing",
  });

  if (error) {
    return NextResponse.json({ error: "Could not save your request." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
