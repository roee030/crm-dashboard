import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/mode";
import { buildDemoData } from "@/lib/demo/data";

export const runtime = "nodejs";

/**
 * GET /api/demo/audio/[id] — a real, playable WAV stream for a demo call.
 *
 * Generates a deterministic 8 kHz mono PCM tone whose length matches the call's
 * duration, so the HTML5 <audio> player and SyncedPlayer can play, scrub, change
 * speed, and highlight transcript utterances in real time. Supports HTTP Range
 * requests for smooth seeking. Demo mode only.
 */
const SAMPLE_RATE = 8000;
const TONES = [196, 220, 247, 262, 294, 330]; // gentle musical steps (Hz)

function generateWav(durationSec: number): Buffer {
  const totalSamples = Math.max(1, Math.round(durationSec * SAMPLE_RATE));
  const dataSize = totalSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF/WAVE header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format = PCM
  buffer.writeUInt16LE(1, 22); // channels = 1
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Tone changes every ~6s so scrubbing to different positions is audible.
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = TONES[Math.floor(t / 6) % TONES.length];
    // Soft envelope at each 6s segment boundary to avoid clicks.
    const seg = t % 6;
    const env = Math.min(1, seg / 0.3) * Math.min(1, (6 - seg) / 0.3);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.22 * env;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const callId = decodeURIComponent(id);
  const call = buildDemoData().calls.find((c) => c.id === callId);
  if (!call) {
    return NextResponse.json({ error: "Demo call not found" }, { status: 404 });
  }

  const wav = generateWav(call.duration_sec ?? 60);
  const total = wav.length;
  const range = req.headers.get("range");

  const baseHeaders: Record<string, string> = {
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (start <= end && start < total) {
        const chunk = new Uint8Array(wav.subarray(start, Math.min(end, total - 1) + 1));
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${Math.min(end, total - 1)}/${total}`,
            "Content-Length": String(chunk.length),
          },
        });
      }
    }
  }

  return new NextResponse(new Uint8Array(wav), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}
