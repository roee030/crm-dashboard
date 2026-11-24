import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isDemoMode, DEMO_WORKSPACE_ID } from "@/lib/demo/mode";
import { buildDemoData, DEMO_CALL_COUNT } from "@/lib/demo/data";
import { createDemoClient, __resetDemoStore } from "@/lib/demo/client";
import { demoChatAnswer } from "@/lib/demo/responses";
import { coachingSchema } from "@/schemas/coaching";

describe("isDemoMode", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is true when Supabase env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(true);
  });

  it("is true when DEMO_MODE=true even with Supabase configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    process.env.DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);
  });

  it("is false when Supabase is fully configured and DEMO_MODE is off", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(false);
  });

  it("is true when only the service key is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(true);
  });
});

describe("demo data integrity", () => {
  it("has 8 calls, 4 Hebrew + 4 English", () => {
    const d = buildDemoData();
    expect(d.calls.length).toBe(DEMO_CALL_COUNT);
    expect(d.calls.length).toBe(8);
    expect(d.calls.filter((c) => c.language === "he").length).toBe(4);
    expect(d.calls.filter((c) => c.language === "en").length).toBe(4);
  });

  it("every tenant row carries the demo workspace id", () => {
    const d = buildDemoData();
    const tables = [d.calls, d.transcripts, d.insights, d.crm_integrations, d.crm_sync_logs, d.playbooks, d.workspace_api_keys, d.workspace_alert_rules];
    for (const rows of tables) {
      for (const r of rows as { workspace_id: string }[]) {
        expect(r.workspace_id).toBe(DEMO_WORKSPACE_ID);
      }
    }
  });

  it("every call has a 1:1 transcript and insight", () => {
    const d = buildDemoData();
    for (const call of d.calls) {
      expect(d.transcripts.filter((t) => t.call_id === call.id).length).toBe(1);
      expect(d.insights.filter((i) => i.call_id === call.id).length).toBe(1);
    }
  });

  it("utterance timestamps are ordered and within the call duration", () => {
    const d = buildDemoData();
    for (const t of d.transcripts) {
      const call = d.calls.find((c) => c.id === t.call_id)!;
      const durMs = (call.duration_sec ?? 0) * 1000;
      for (const u of t.utterances) {
        expect(u.start_ms).toBeLessThan(u.end_ms);
        expect(u.end_ms).toBeLessThanOrEqual(durMs + 1000);
      }
    }
  });

  it("insights expose BANT playbook results and valid coaching", () => {
    const d = buildDemoData();
    for (const i of d.insights) {
      expect(Object.keys(i.playbook_results).sort()).toEqual(["authority", "budget", "need", "timing"]);
      expect(coachingSchema.safeParse(i.call_coaching).success).toBe(true);
    }
  });

  it("deal health scores span a realistic range and risky deals carry flags", () => {
    const d = buildDemoData();
    const scores = d.insights.map((i) => i.deal_health_score ?? 0);
    expect(Math.min(...scores)).toBeLessThan(50);
    expect(Math.max(...scores)).toBeGreaterThan(90);
    for (const i of d.insights) {
      if ((i.deal_health_score ?? 100) < 50) expect(i.risk_flags.length).toBeGreaterThan(0);
    }
  });

  it("provides connected CRM integrations, playbooks, keys and an alert rule", () => {
    const d = buildDemoData();
    expect(d.crm_integrations.map((c) => c.provider).sort()).toEqual(["hubspot", "monday"]);
    expect(d.playbooks.some((p) => p.is_default && p.language === "en")).toBe(true);
    expect(d.playbooks.some((p) => p.language === "he")).toBe(true);
    expect(d.workspace_api_keys.length).toBeGreaterThan(0);
    expect(d.workspace_alert_rules.length).toBe(1);
  });

  it("returns a fresh deep copy each call (no shared mutation)", () => {
    const a = buildDemoData();
    a.calls[0].title = "MUTATED";
    const b = buildDemoData();
    expect(b.calls[0].title).not.toBe("MUTATED");
  });
});

describe("demo client (in-memory supabase)", () => {
  beforeEach(() => __resetDemoStore());

  it("filters calls by workspace_id", async () => {
    const db = createDemoClient();
    const { data } = await db.from("calls").select("*").eq("workspace_id", DEMO_WORKSPACE_ID);
    expect((data as unknown[]).length).toBe(8);
  });

  it("resolves the demo user via auth.getUser", async () => {
    const db = createDemoClient();
    const { data } = await db.auth.getUser();
    expect(data.user?.email).toBe("roee@signaldesk.io");
  });

  it("maybeSingle returns one row or null", async () => {
    const db = createDemoClient();
    const anyCall = buildDemoData().calls[0];
    const { data: hit } = await db.from("calls").select("*").eq("id", anyCall.id).maybeSingle();
    expect((hit as { id: string }).id).toBe(anyCall.id);
    const { data: miss } = await db.from("calls").select("*").eq("id", "nope").maybeSingle();
    expect(miss).toBeNull();
  });

  it("orders descending and limits", async () => {
    const db = createDemoClient();
    const { data } = await db
      .from("calls")
      .select("id, created_at")
      .eq("workspace_id", DEMO_WORKSPACE_ID)
      .order("created_at", { ascending: false })
      .limit(3);
    const rows = data as { created_at: string }[];
    expect(rows.length).toBe(3);
    expect(rows[0].created_at >= rows[1].created_at).toBe(true);
  });

  it("supports inserts that are then readable", async () => {
    const db = createDemoClient();
    await db.from("leads").insert({ email: "lead@example.com", name: "Test Lead" });
    const { data } = await db.from("leads").select("*").eq("email", "lead@example.com").maybeSingle();
    expect((data as { email: string }).email).toBe("lead@example.com");
  });

  it("supports head/count selects", async () => {
    const db = createDemoClient();
    const { count } = await db
      .from("insights")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", DEMO_WORKSPACE_ID);
    expect(count).toBe(8);
  });
});

describe("demoChatAnswer", () => {
  it("answers in Hebrew when asked in Hebrew", () => {
    const out = demoChatAnswer([{ role: "user", content: "אילו עסקאות בסיכון?" }]);
    expect(/[֐-׿]/.test(out)).toBe(true);
  });

  it("answers in English and references at-risk deals", () => {
    const out = demoChatAnswer([{ role: "user", content: "Which deals are at risk?" }]);
    expect(out.toLowerCase()).toContain("risk");
    expect(out).toContain("Globex");
  });

  it("surfaces top objection categories when asked about objections", () => {
    const out = demoChatAnswer([{ role: "user", content: "What are our top pricing objections?" }]);
    expect(out.toLowerCase()).toContain("objection");
  });
});
