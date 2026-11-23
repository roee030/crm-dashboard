"use client";

import { useState, useTransition } from "react";
import { KeyRound, Plus, Copy, Check, Loader2, Trash2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createKey, revokeKey, sendTestCall, type ApiKeyView } from "@/app/(app)/settings/webhooks/actions";

function Snippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-slate-400 hover:text-slate-200"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs text-slate-300">{code}</pre>
    </div>
  );
}

export function WebhooksManager({
  initialKeys,
  ingestUrl,
}: {
  initialKeys: ApiKeyView[];
  ingestUrl: string;
}) {
  const [keys, setKeys] = useState<ApiKeyView[]>(initialKeys);
  const [label, setLabel] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const exampleKey = rawKey ?? "sd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <KeyRound className="h-4 w-4 text-indigo-400" /> Ingestion API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Key label (e.g. Zapier prod)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="max-w-xs"
            />
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await createKey(label);
                  if (res.ok) {
                    setRawKey(res.raw);
                    setKeys((k) => [res.view, ...k]);
                    setLabel("");
                  }
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generate key
            </Button>
          </div>

          {rawKey && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-2 text-xs text-amber-300">
                Copy this secret now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-slate-950 px-2 py-1.5 text-xs text-slate-200">{rawKey}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(rawKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-800">
            {keys.length === 0 && <p className="py-3 text-sm text-slate-500">No keys yet.</p>}
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200">{k.label ?? "Key"}</span>
                    {k.revoked_at ? <Badge tone="negative">revoked</Badge> : <Badge tone="positive">active</Badge>}
                  </div>
                  <code className="text-xs text-slate-500">{k.key_prefix}…</code>
                </div>
                {!k.revoked_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await revokeKey(k.id);
                        if (res.ok) {
                          setKeys((ks) =>
                            ks.map((x) => (x.id === k.id ? { ...x, revoked_at: new Date().toISOString() } : x)),
                          );
                        }
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setTestMsg(null);
                  const res = await sendTestCall();
                  setTestMsg(res.ok ? `Test call created (${res.callId.slice(0, 8)}…) — check the Calls page.` : res.error);
                })
              }
            >
              <Send className="h-4 w-4" /> Send test webhook call
            </Button>
            {testMsg && <span className="text-sm text-slate-400">{testMsg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-200">Integration snippets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Snippet
            label="cURL"
            code={`curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${exampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"recording_url":"https://example.com/call.mp3","customer_email":"buyer@acme.com","external_call_id":"crm-123"}'`}
          />
          <Snippet
            label="Make.com / Zapier (HTTP module)"
            code={`Method: POST
URL: ${ingestUrl}
Headers:
  Authorization: Bearer ${exampleKey}
  Content-Type: application/json
Body (JSON):
  { "recording_url": "{{recordingUrl}}", "customer_email": "{{email}}", "external_call_id": "{{callId}}" }`}
          />
          <Snippet
            label="Twilio / VoIP (recording webhook → your middleware)"
            code={`// On Twilio recording-status callback, forward:
POST ${ingestUrl}
Authorization: Bearer ${exampleKey}
{ "recording_url": RecordingUrl + ".mp3", "direction": "inbound", "external_call_id": CallSid }`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
