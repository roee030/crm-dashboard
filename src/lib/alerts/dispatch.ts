import { createAdminClient } from "@/lib/supabase/admin";
import { buildAlertPayload, matchedTriggers, type AlertInsight } from "./format";
import { isPublicHttpUrl } from "@/lib/net/ssrf";
import type { RiskFlagRow } from "@/types/db";

/**
 * Fire-and-forget outbound alerts after a call completes. Reads the workspace's
 * active alert rules, matches triggers, and POSTs to each webhook. NEVER throws —
 * the pipeline must not fail because an alert endpoint is down.
 */
export async function dispatchCallAlerts(callId: string): Promise<void> {
  try {
    const db = createAdminClient();

    const { data: call } = await db
      .from("calls")
      .select("id, workspace_id, title, customer_name")
      .eq("id", callId)
      .maybeSingle();
    if (!call) return;

    const { data: insightRow } = await db
      .from("insights")
      .select("sentiment_score, sentiment_label, deal_health_score, risk_flags")
      .eq("call_id", callId)
      .maybeSingle();
    if (!insightRow) return;

    const { data: rules } = await db
      .from("workspace_alert_rules")
      .select("webhook_url, triggers, is_active")
      .eq("workspace_id", call.workspace_id)
      .eq("is_active", true);
    if (!rules || rules.length === 0) return;

    const insight: AlertInsight = {
      sentiment_score: insightRow.sentiment_score == null ? null : Number(insightRow.sentiment_score),
      sentiment_label: insightRow.sentiment_label,
      deal_health_score: insightRow.deal_health_score,
      risk_flags: (insightRow.risk_flags ?? []) as RiskFlagRow[],
    };

    for (const rule of rules) {
      const triggers = matchedTriggers(rule.triggers ?? [], insight);
      if (triggers.length === 0) continue;
      // SSRF guard: never POST to private/loopback hosts.
      if (!(await isPublicHttpUrl(rule.webhook_url))) continue;

      const payload = buildAlertPayload(call, insight, triggers, process.env.APP_URL);
      try {
        await fetch(rule.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          // Do not follow redirects — a 3xx to a private host would bypass the
          // SSRF pre-check (residual DNS-rebinding TOCTOU noted in the report).
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* swallow — alerting is best-effort */
      }
    }
  } catch {
    /* alerting must never break the pipeline */
  }
}
