import { describe, it, expect, afterEach } from "vitest";
import {
  isStaticDemo,
  demoWavBuffer,
  clientDemoDigest,
  clientDemoCsv,
} from "@/lib/demo/static";
import { buildDemoData } from "@/lib/demo/data";

const td = (buf: ArrayBuffer, start: number, len: number) =>
  String.fromCharCode(...new Uint8Array(buf, start, len));

describe("isStaticDemo", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is true only when NEXT_PUBLIC_STATIC_DEMO === 'true'", () => {
    process.env.NEXT_PUBLIC_STATIC_DEMO = "true";
    expect(isStaticDemo()).toBe(true);
  });

  it("is false when unset (standard build is untouched)", () => {
    delete process.env.NEXT_PUBLIC_STATIC_DEMO;
    expect(isStaticDemo()).toBe(false);
  });

  it("is false for any value other than 'true'", () => {
    process.env.NEXT_PUBLIC_STATIC_DEMO = "1";
    expect(isStaticDemo()).toBe(false);
  });
});

describe("demoWavBuffer", () => {
  it("emits a valid RIFF/WAVE PCM header sized to the duration", () => {
    const seconds = 5;
    const buf = demoWavBuffer(seconds);
    const view = new DataView(buf);

    expect(td(buf, 0, 4)).toBe("RIFF");
    expect(td(buf, 8, 4)).toBe("WAVE");
    expect(td(buf, 12, 4)).toBe("fmt ");
    expect(td(buf, 36, 4)).toBe("data");

    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits/sample

    const dataSize = 5 * 8000 * 2;
    expect(view.getUint32(40, true)).toBe(dataSize);
    expect(buf.byteLength).toBe(44 + dataSize);
  });

  it("never produces an empty buffer, even for a zero duration", () => {
    expect(demoWavBuffer(0).byteLength).toBeGreaterThan(44);
  });
});

describe("clientDemoDigest", () => {
  it("counts the last-7-days window and surfaces the at-risk Globus deal", () => {
    const d = clientDemoDigest();
    // 7 of the 8 demo calls fall strictly inside the 7-day window (one is ~7d old).
    expect(d.totalCalls).toBeGreaterThanOrEqual(7);
    expect(d.totalCalls).toBeLessThanOrEqual(8);
    expect(d.avgSentiment).not.toBeNull();
    const names = d.atRiskDeals.map((a) => a.name);
    expect(names.some((n) => n.includes("גלובוס") || n.toLowerCase().includes("globex"))).toBe(true);
    // Lowest at-risk score is the Hebrew Globus deal (28).
    expect(Math.min(...d.atRiskDeals.map((a) => a.score))).toBe(28);
  });
});

describe("clientDemoCsv", () => {
  it("has the expected header and one row per call", () => {
    const csv = clientDemoCsv();
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "call_id,title,customer_name,customer_email,language,status,sentiment_label,sentiment_score,deal_health_score,deal_stage,objection_categories,crm_synced,created_at",
    );
    expect(lines.length).toBe(buildDemoData().calls.length + 1);
  });

  it("preserves Hebrew customer names and is formula-injection-safe", () => {
    const csv = clientDemoCsv();
    expect(csv).toContain("גלובוס טכנולוגיות");
    // No unescaped field may start with a spreadsheet formula trigger.
    for (const line of csv.split("\r\n")) {
      for (const field of line.split(",")) {
        expect(/^[=+\-@\t\r]/.test(field)).toBe(false);
      }
    }
  });
});
