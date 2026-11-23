"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, Loader2, Plug, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { IntegrationStatus } from "@/lib/crm/integration";
import type { ProviderKey, TargetOption } from "@/lib/crm/types";
import {
  connectWithToken,
  verifyConnection,
  getTargets,
  saveMapping,
  disconnect,
} from "@/app/(app)/settings/integrations/actions";

const META: Record<ProviderKey, { label: string; targetKey: "pipeline_id" | "board_id"; targetLabel: string; tokenHint: string }> = {
  hubspot: {
    label: "HubSpot",
    targetKey: "pipeline_id",
    targetLabel: "Deal pipeline",
    tokenHint: "Private App access token (Settings → Integrations → Private Apps)",
  },
  monday: {
    label: "Monday.com",
    targetKey: "board_id",
    targetLabel: "Board",
    tokenHint: "Personal API token (Admin → API, or your avatar → Developers)",
  },
};

export function IntegrationCard({ status }: { status: IntegrationStatus }) {
  const meta = META[status.provider];
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(status.connected && status.isActive);
  const [account, setAccount] = useState(status.accountLabel);
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState(
    (status.config[meta.targetKey] as string | undefined) ?? "",
  );
  const [autoSync, setAutoSync] = useState(Boolean(status.config.auto_sync));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<void>) {
    setMsg(null);
    startTransition(() => void fn());
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <Plug className="h-4 w-4 text-indigo-400" />
          {meta.label}
        </CardTitle>
        {connected ? (
          <Badge tone="positive">Connected{account ? ` · ${account}` : ""}</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!connected ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">{meta.tokenHint}</label>
              <Input
                type="password"
                placeholder="Paste API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await connectWithToken(status.provider, token);
                    if (res.ok) {
                      setConnected(true);
                      setAccount(res.data.account ?? null);
                      setToken("");
                      setMsg({ ok: true, text: "Connected and verified." });
                    } else {
                      setMsg({ ok: false, text: res.error });
                    }
                  })
                }
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Connect with token
              </Button>
              <a href={`/api/crm/${status.provider}/oauth/start`}>
                <Button variant="outline" type="button">
                  <Link2 className="h-4 w-4" />
                  Connect via OAuth
                </Button>
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">{meta.targetLabel}</label>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await getTargets(status.provider);
                      if (res.ok) setTargets(res.data);
                      else setMsg({ ok: false, text: res.error });
                    })
                  }
                >
                  Load options
                </Button>
              </div>
              <select
                value={selectedTarget}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedTarget(value);
                  run(async () => {
                    const res = await saveMapping(status.provider, { [meta.targetKey]: value });
                    setMsg(res.ok ? { ok: true, text: "Target saved." } : { ok: false, text: res.error });
                  });
                }}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
              >
                <option value="">
                  {targets.length ? "Select…" : selectedTarget ? `Saved: ${selectedTarget}` : "Load options first"}
                </option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 px-4 py-3">
              <span className="text-sm text-slate-200">Auto-sync on call completion</span>
              <input
                type="checkbox"
                checked={autoSync}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAutoSync(next);
                  run(async () => {
                    const res = await saveMapping(status.provider, { auto_sync: next });
                    setMsg(res.ok ? { ok: true, text: "Preference saved." } : { ok: false, text: res.error });
                  });
                }}
                className="h-4 w-4 accent-indigo-500"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await verifyConnection(status.provider);
                    setMsg(
                      res.ok
                        ? { ok: true, text: `Verified${res.data.account ? ` · ${res.data.account}` : ""}` }
                        : { ok: false, text: res.error },
                    );
                  })
                }
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verify connection
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await disconnect(status.provider);
                    if (res.ok) {
                      setConnected(false);
                      setAccount(null);
                      setMsg({ ok: true, text: "Disconnected." });
                    } else {
                      setMsg({ ok: false, text: res.error });
                    }
                  })
                }
              >
                Disconnect
              </Button>
            </div>
          </>
        )}

        {msg && (
          <p
            className={
              msg.ok
                ? "flex items-center gap-2 text-sm text-emerald-400"
                : "flex items-center gap-2 text-sm text-rose-400"
            }
          >
            {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {msg.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
