/**
 * Client-side static-demo engine for GitHub Pages hosting.
 *
 * When `NEXT_PUBLIC_STATIC_DEMO === "true"` the app is served as a pure static
 * bundle (no Node backend). Every feature that would normally hit a Route
 * Handler (`/api/*`) is instead fulfilled 100% in the browser from the in-memory
 * bilingual demo dataset (`buildDemoData()`), so play/seek audio, the AI copilot,
 * coaching, re-analyze, CSV export, the weekly digest, upload, CRM sync and lead
 * capture all work with no server.
 *
 * This module is deliberately client-safe: it imports only the pure demo data /
 * response synthesizers (no `server-only`, no Node built-ins), so it can be
 * imported from "use client" components. `isStaticDemo()` compiles to a constant
 * in the standard build (the `NEXT_PUBLIC_` env is inlined), so when it's unset
 * every production code path is untouched.
 */
import { buildDemoData, type DemoData } from "./data";
import { toCsv } from "@/lib/csv";
import type { WeeklyDigest } from "@/lib/digest";
import type { Criterion } from "@/lib/playbooks/scoring";
import type { Objection } from "@/types/db";

export { demoChatAnswer, demoCoaching, demoReanalyze } from "./responses";

/** True only in the GitHub Pages static export (set at build via env). */
export function isStaticDemo(): boolean {
  return process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
}

// --- Browser WAV synthesis ---------------------------------------------------
// Mirrors /api/demo/audio/[id] exactly, but emits a Blob URL in the browser so
// the <audio> element can play/seek/speed-change without any server.
const SAMPLE_RATE = 8000;
const TONES = [196, 220, 247, 262, 294, 330];

/** Build a deterministic PCM WAV (RIFF) buffer for a given duration. Pure. */
export function demoWavBuffer(durationSec: number): ArrayBuffer {
  const totalSamples = Math.max(1, Math.round((durationSec || 60) * SAMPLE_RATE));
  const dataSize = totalSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  // RIFF/WAVE header
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = 1
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = TONES[Math.floor(t / 6) % TONES.length];
    const seg = t % 6;
    const env = Math.min(1, seg / 0.3) * Math.min(1, (6 - seg) / 0.3);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.22 * env;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  return buffer;
}

/** Build a deterministic playable WAV (as a Blob object URL) for a duration. */
export function demoWavObjectUrl(durationSec: number): string {
  const blob = new Blob([demoWavBuffer(durationSec)], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

// --- Client-side Weekly Executive Brief --------------------------------------
const DAY = 24 * 60 * 60 * 1000;

/** Compute the same WeeklyDigest shape as /api/digest/weekly, in the browser. */
export function clientDemoDigest(): WeeklyDigest {
  const data = buildDemoData();
  const now = Date.now();
  const weekAgo = now - 7 * DAY;

  const callName = new Map(data.calls.map((c) => [c.id, c.customer_name || c.title || "Call"]));
  const thisWeek = data.insights.filter((i) => new Date(i.created_at).getTime() >= weekAgo);
  const priorWeek = data.insights.filter((i) => new Date(i.created_at).getTime() < weekAgo);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const thisAvg = avg(thisWeek.map((i) => Number(i.sentiment_score)).filter(Number.isFinite));
  const priorAvg = avg(priorWeek.map((i) => Number(i.sentiment_score)).filter(Number.isFinite));

  const objCount = new Map<string, number>();
  for (const i of thisWeek) {
    for (const o of (i.objections ?? []) as Objection[]) {
      objCount.set(o.category, (objCount.get(o.category) ?? 0) + 1);
    }
  }
  const topObjections = [...objCount.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const atRiskDeals = thisWeek
    .filter((i) => i.deal_health_score != null && Number(i.deal_health_score) < 50)
    .map((i) => ({ callId: i.call_id, name: callName.get(i.call_id) ?? "Call", score: Number(i.deal_health_score) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const defaultPlaybook = data.playbooks.find((p) => p.is_default) ?? data.playbooks[0];
  const criteria = (defaultPlaybook?.criteria ?? []) as Criterion[];
  const labelByKey = new Map(criteria.map((c) => [c.key, c.label]));
  const perKey = new Map<string, { sum: number; n: number }>();
  for (const i of thisWeek) {
    const results = (i.playbook_results ?? {}) as Record<string, { score: number }>;
    for (const [key, r] of Object.entries(results)) {
      const cur = perKey.get(key) ?? { sum: 0, n: 0 };
      cur.sum += Number(r.score) || 0;
      cur.n += 1;
      perKey.set(key, cur);
    }
  }
  const averages = [...perKey.entries()]
    .filter(([key]) => labelByKey.has(key))
    .map(([key, v]) => ({ label: labelByKey.get(key)!, avg: Math.round((v.sum / v.n) * 100) / 100 }))
    .sort((a, b) => b.avg - a.avg);

  return {
    totalCalls: data.calls.filter((c) => new Date(c.created_at).getTime() >= weekAgo).length,
    avgSentiment: thisAvg,
    sentimentDeltaWoW: thisAvg != null && priorAvg != null ? Math.round((thisAvg - priorAvg) * 100) / 100 : null,
    topObjections,
    atRiskDeals,
    bestCriterion: averages[0] ?? null,
    worstCriterion: averages.length > 1 ? averages[averages.length - 1] : null,
  };
}

// --- Client-side CSV export --------------------------------------------------
const CSV_COLUMNS = [
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

/** Build the same CSV document as /api/calls/export, from the demo dataset. */
export function clientDemoCsv(data: DemoData = buildDemoData()): string {
  const insightByCall = new Map(data.insights.map((i) => [i.call_id, i]));
  const rows = [...data.calls]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((c) => {
      const ins = insightByCall.get(c.id);
      const cats = ((ins?.objections ?? []) as Objection[]).map((o) => o.category).join("; ");
      const rec: Record<string, unknown> = {
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
      return CSV_COLUMNS.map((k) => rec[k]);
    });
  return toCsv(CSV_COLUMNS, rows);
}

/** Trigger a browser download of a text file (CSV/JSON) via a Blob + <a>. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
