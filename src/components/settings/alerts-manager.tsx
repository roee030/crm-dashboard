"use client";

import { useState, useTransition } from "react";
import { Bell, Save, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAlertRule, sendTestAlert } from "@/app/(app)/settings/alerts/actions";

const TRIGGERS: { key: string; label: string; hint: string }[] = [
  { key: "on_high_risk_deal", label: "High-risk deal", hint: "deal health < 50 or a high-severity risk flag" },
  { key: "on_negative_sentiment", label: "Negative sentiment", hint: "sentiment score < −0.4" },
  { key: "on_call_completed", label: "Any call completed", hint: "every finished analysis" },
];

export function AlertsManager({
  initial,
}: {
  initial: { hasWebhook: boolean; triggers: string[]; is_active: boolean } | null;
}) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [triggers, setTriggers] = useState<string[]>(initial?.triggers ?? ["on_high_risk_deal"]);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const hasWebhook = initial?.hasWebhook ?? false;
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(key: string) {
    setTriggers((t) => (t.includes(key) ? t.filter((x) => x !== key) : [...t, key]));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <Bell className="h-4 w-4 text-indigo-400" /> Smart Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm text-slate-300">Outbound webhook URL (Slack / Teams / Make / Custom)</label>
          <Input
            placeholder={hasWebhook ? "•••• configured — enter a new URL to replace" : "https://hooks.slack.com/services/…"}
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          {hasWebhook && !webhookUrl && (
            <p className="text-xs text-slate-500">A webhook is saved. Leave blank to keep it.</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-300">Triggers</div>
          {TRIGGERS.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 px-4 py-2.5">
              <div>
                <div className="text-sm text-slate-200">{t.label}</div>
                <div className="text-xs text-slate-500">{t.hint}</div>
              </div>
              <input
                type="checkbox"
                checked={triggers.includes(t.key)}
                onChange={() => toggle(t.key)}
                className="h-4 w-4 accent-indigo-500"
              />
            </label>
          ))}
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 px-4 py-2.5">
          <span className="text-sm text-slate-200">Alerts active</span>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setMsg(null);
                const res = await saveAlertRule({ webhookUrl, triggers, isActive });
                setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error ?? "Failed" });
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setMsg(null);
                const res = await sendTestAlert();
                setMsg(res.ok ? { ok: true, text: "Test alert sent." } : { ok: false, text: res.error ?? "Failed" });
              })
            }
          >
            <Send className="h-4 w-4" /> Send test alert
          </Button>
          {msg && (
            <span className={msg.ok ? "flex items-center gap-1.5 text-sm text-emerald-400" : "text-sm text-rose-400"}>
              {msg.ok && <CheckCircle2 className="h-4 w-4" />}
              {msg.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
