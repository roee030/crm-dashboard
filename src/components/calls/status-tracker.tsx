"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/calls/status-badge";
import type { CallStatus } from "@/types/db";

const ACTIVE: CallStatus[] = ["uploaded", "transcribing", "analyzing"];

/**
 * Polls GET /api/calls/[id]/sync-status while the call is still processing.
 * Each poll drives the shared idempotent finalize step server-side. Stops once
 * the status is `completed` or `failed`, then refreshes the page to show results.
 */
export function StatusTracker({
  callId,
  initialStatus,
  initialError,
}: {
  callId: string;
  initialStatus: CallStatus;
  initialError: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/calls/${callId}/sync-status`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;

        const next = (json.status as CallStatus) ?? status;
        setError(json.error_message ?? null);

        if (next !== status) {
          setStatus(next);
          // Terminal → pull in the server-rendered transcript/insights.
          if (!ACTIVE.includes(next)) {
            router.refresh();
            return;
          }
        }
        if (ACTIVE.includes(next)) {
          timer.current = setTimeout(poll, 4000);
        }
      } catch {
        if (!cancelled) timer.current = setTimeout(poll, 6000);
      }
    }

    if (ACTIVE.includes(status)) {
      timer.current = setTimeout(poll, 2000);
    }
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, status]);

  const active = ACTIVE.includes(status);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
      {status === "completed" ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
      ) : status === "failed" ? (
        <AlertCircle className="h-5 w-5 text-rose-400" />
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {active && <span className="text-sm text-slate-400">Processing — this updates automatically.</span>}
        </div>
        {status === "failed" && error && (
          <p className="mt-1 text-sm text-rose-400">{error}</p>
        )}
      </div>
    </div>
  );
}
