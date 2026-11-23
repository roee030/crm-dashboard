import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContext } from "@/lib/api/context";
import { submitTranscription, uploadAudio } from "@/lib/assemblyai/client";

export const runtime = "nodejs";

const jsonBody = z.object({
  workspace_id: z.string().uuid().optional(),
  title: z.string().optional(),
  direction: z.enum(["inbound", "outbound", "unknown"]).optional(),
  customer_name: z.string().optional(),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  // Provide EITHER a public audio_url OR upload a file via multipart/form-data.
  audio_url: z.string().url().optional(),
});

/**
 * POST /api/ingest
 * Creates a call, submits an AssemblyAI job, returns the call id for polling.
 *
 * Accepts application/json ({ audio_url, ... }) or multipart/form-data (field `file`
 * + the same text fields). On local dev, send header `x-dev-api-key` to skip auth.
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  let fields: z.infer<typeof jsonBody>;
  let fileBuffer: Buffer | null = null;
  let fileExt = "bin";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      fields = jsonBody.parse({
        workspace_id: form.get("workspace_id") || undefined,
        title: form.get("title") || undefined,
        direction: form.get("direction") || undefined,
        customer_name: form.get("customer_name") || undefined,
        customer_email: form.get("customer_email") || undefined,
        customer_phone: form.get("customer_phone") || undefined,
        audio_url: form.get("audio_url") || undefined,
      });
      if (file && file instanceof File) {
        fileBuffer = Buffer.from(await file.arrayBuffer());
        const dot = file.name.lastIndexOf(".");
        if (dot >= 0) fileExt = file.name.slice(dot + 1).toLowerCase();
      }
    } else {
      fields = jsonBody.parse(await req.json());
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  if (!fileBuffer && !fields.audio_url) {
    return NextResponse.json(
      { error: "Provide an `audio_url` or upload a `file`." },
      { status: 400 },
    );
  }

  const ctx = await resolveContext(req, fields.workspace_id);
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const db = createAdminClient();

  // 1) Create the call row up front so we always have an id to track/fail against.
  const { data: call, error: insertErr } = await db
    .from("calls")
    .insert({
      workspace_id: ctx.workspaceId,
      uploaded_by: ctx.userId,
      title: fields.title ?? null,
      direction: fields.direction ?? "unknown",
      customer_name: fields.customer_name ?? null,
      customer_email: fields.customer_email ?? null,
      customer_phone: fields.customer_phone ?? null,
      status: "uploaded",
    })
    .select("*")
    .single();

  if (insertErr || !call) {
    return NextResponse.json(
      { error: "Could not create call", detail: insertErr?.message },
      { status: 500 },
    );
  }

  try {
    // 2) Resolve an audio URL for AssemblyAI.
    let audioUrl = fields.audio_url ?? "";
    if (fileBuffer) {
      // Store the original in Supabase Storage for the record...
      const audioPath = `${ctx.workspaceId}/${call.id}.${fileExt}`;
      await db.storage.from("call-audio").upload(audioPath, fileBuffer, { upsert: true });
      await db.from("calls").update({ audio_path: audioPath }).eq("id", call.id);
      // ...and hand the bytes to AssemblyAI directly (no public URL needed).
      audioUrl = await uploadAudio(fileBuffer);
    }

    // 3) Submit the transcription job. Webhook only when APP_URL is configured.
    const appUrl = process.env.APP_URL;
    const webhookUrl = appUrl ? `${appUrl}/api/transcription/webhook` : undefined;

    const jobId = await submitTranscription({
      audioUrl,
      webhookUrl,
      webhookSecret: process.env.ASSEMBLYAI_WEBHOOK_SECRET,
    });

    await db
      .from("calls")
      .update({ status: "transcribing", external_provider_id: jobId })
      .eq("id", call.id);

    return NextResponse.json(
      {
        call_id: call.id,
        status: "transcribing",
        transcription_job_id: jobId,
        poll: `/api/calls/${call.id}/sync-status`,
        mode: webhookUrl ? "webhook" : "poll",
      },
      { status: 202 },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await db.from("calls").update({ status: "failed", error_message: detail }).eq("id", call.id);
    return NextResponse.json({ call_id: call.id, error: "Ingestion failed", detail }, { status: 502 });
  }
}
