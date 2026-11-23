"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Outcome = {
  provider: string;
  status: "synced" | "failed";
  externalRef?: string;
  url?: string;
  error?: string;
};

/** Wired to POST /api/crm/sync. Pushes this call's insights to connected CRMs. */
export function SyncCrmButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/crm/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Sync failed");
      } else {
        const outcomes = (json.outcomes ?? []) as Outcome[];
        const ok = outcomes.filter((o) => o.status === "synced").map((o) => o.provider);
        const bad = outcomes.filter((o) => o.status === "failed").map((o) => o.provider);
        setMsg(
          [ok.length ? `Synced: ${ok.join(", ")}` : "", bad.length ? `Failed: ${bad.join(", ")}` : ""]
            .filter(Boolean)
            .join(" · "),
        );
        router.refresh();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" onClick={sync} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync to CRM
      </Button>
      {msg && <p className="max-w-xs text-right text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
