"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/calls/status-badge";
import { sentimentTone } from "@/lib/sentiment";
import { formatDate, formatDuration } from "@/lib/utils";
import type { CallStatus } from "@/types/db";

export type CallListItem = {
  id: string;
  title: string | null;
  customer_name: string | null;
  language: string | null;
  status: CallStatus;
  duration_sec: number | null;
  created_at: string;
  sentiment_score: number | null;
  deal_stage: string | null;
};

export function CallsList({ calls }: { calls: CallListItem[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return calls;
    return calls.filter((c) =>
      [c.title, c.customer_name, c.deal_stage, c.language]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle)),
    );
  }, [q, calls]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          className="pl-9"
          placeholder="Search by customer, title, stage…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Call</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Sentiment</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Lang</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-slate-900/40">
                <td className="px-4 py-3">
                  <Link href={`/calls/${c.id}`} className="font-medium text-slate-100 hover:text-indigo-300">
                    {c.title || "Untitled call"}
                  </Link>
                  <div className="text-xs text-slate-500">{c.customer_name || "—"}</div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">
                  {c.sentiment_score == null ? (
                    <span className="text-slate-600">—</span>
                  ) : (
                    <Badge tone={sentimentTone(c.sentiment_score)}>
                      {c.sentiment_score > 0 ? "+" : ""}
                      {Math.round(c.sentiment_score * 100)}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">{c.deal_stage || "—"}</td>
                <td className="px-4 py-3 uppercase text-slate-400">{c.language || "—"}</td>
                <td className="px-4 py-3 tabular-nums text-slate-400">{formatDuration(c.duration_sec)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(c.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No calls match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
