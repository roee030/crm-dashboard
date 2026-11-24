"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, Download, X } from "lucide-react";

const SELECTS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: "sentiment",
    label: "Sentiment",
    options: [
      { value: "", label: "All sentiment" },
      { value: "positive", label: "Positive" },
      { value: "neutral", label: "Neutral" },
      { value: "negative", label: "Negative" },
    ],
  },
  {
    key: "risk",
    label: "Risk",
    options: [
      { value: "", label: "All risk" },
      { value: "high", label: "High risk" },
      { value: "medium", label: "Medium risk" },
      { value: "low", label: "Low risk" },
    ],
  },
  {
    key: "language",
    label: "Language",
    options: [
      { value: "", label: "All languages" },
      { value: "en", label: "English" },
      { value: "he", label: "Hebrew" },
    ],
  },
  {
    key: "sync",
    label: "CRM Sync",
    options: [
      { value: "", label: "All sync" },
      { value: "synced", label: "Synced" },
      { value: "pending", label: "Pending" },
      { value: "failed", label: "Failed" },
      { value: "unsynced", label: "Unsynced" },
    ],
  },
];

export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/calls${next.toString() ? `?${next}` : ""}`);
  }

  const hasFilters = ["q", "sentiment", "risk", "language", "sync"].some((k) => params.get(k));
  const exportHref = `/api/calls/export?format=csv`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
          setParam("q", input);
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search…"
          className="h-10 w-56 rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </form>

      {SELECTS.map((s) => (
        <select
          key={s.key}
          value={params.get(s.key) ?? ""}
          onChange={(e) => setParam(s.key, e.target.value)}
          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-200"
          aria-label={s.label}
        >
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {hasFilters && (
        <button
          onClick={() => router.push("/calls")}
          className="flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <X className="h-4 w-4" /> Clear
        </button>
      )}

      <a
        href={exportHref}
        className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800"
      >
        <Download className="h-4 w-4" /> Export CSV
      </a>
    </div>
  );
}
