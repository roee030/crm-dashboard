import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { SyncStatus } from "@/types/db";

export type SyncLog = {
  id: string;
  provider: string;
  status: SyncStatus;
  external_ref: string | null;
  error: string | null;
  created_at: string;
};

const tone: Record<SyncStatus, "positive" | "negative" | "warning"> = {
  synced: "positive",
  failed: "negative",
  pending: "warning",
};

export function SyncHistory({ logs }: { logs: SyncLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">No sync attempts yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize text-slate-200">{l.provider}</span>
              <Badge tone={tone[l.status]}>{l.status}</Badge>
            </div>
            {l.external_ref && (
              <div className="truncate text-xs text-slate-500">ref: {l.external_ref}</div>
            )}
            {l.error && <div className="text-xs text-rose-400">{l.error}</div>}
          </div>
          <span className="shrink-0 text-xs text-slate-500">{formatDate(l.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
