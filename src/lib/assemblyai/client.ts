import { AssemblyAI, type Transcript } from "assemblyai";
import { MODELS } from "@/lib/config/models";
import type { Utterance } from "@/types/db";

export const assembly = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY ?? "",
});

export const WEBHOOK_AUTH_HEADER = "x-signaldesk-webhook";

/**
 * Submit a transcription job (fire-and-forget). Returns the AssemblyAI transcript id.
 * - `speech_models`: ordered fallback list (see MODELS).
 * - `speaker_labels`: diarization.
 * - `language_detection`: auto-detects English vs Hebrew (and others).
 * - If `webhookUrl` is provided we ask AssemblyAI to call us back; otherwise the
 *   caller polls via GET /api/calls/[id]/sync-status.
 */
export async function submitTranscription(opts: {
  audioUrl: string;
  webhookUrl?: string;
  webhookSecret?: string;
}): Promise<string> {
  const params: Record<string, unknown> = {
    audio: opts.audioUrl,
    speech_models: MODELS.assemblyai.speechModels,
    speaker_labels: true,
    language_detection: true,
  };

  if (opts.webhookUrl) {
    params.webhook_url = opts.webhookUrl;
    if (opts.webhookSecret) {
      params.webhook_auth_header_name = WEBHOOK_AUTH_HEADER;
      params.webhook_auth_header_value = opts.webhookSecret;
    }
  }

  // Cast: `speech_models` is current in the API but may trail in SDK typings.
  const job = await assembly.transcripts.submit(
    params as Parameters<typeof assembly.transcripts.submit>[0],
  );
  return job.id;
}

/** Upload raw audio bytes to AssemblyAI; returns a URL usable as `audio`. */
export async function uploadAudio(data: Buffer | Uint8Array): Promise<string> {
  return assembly.files.upload(data);
}

/** Fetch current transcript state from AssemblyAI. */
export async function getTranscript(id: string): Promise<Transcript> {
  return assembly.transcripts.get(id);
}

/** Normalize AssemblyAI utterances into our stored diarized shape (ms-based). */
export function mapUtterances(t: Transcript): Utterance[] {
  if (!t.utterances) return [];
  return t.utterances.map((u) => ({
    speaker: String(u.speaker),
    start_ms: u.start,
    end_ms: u.end,
    text: u.text,
  }));
}
