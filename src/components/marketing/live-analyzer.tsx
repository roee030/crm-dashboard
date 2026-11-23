"use client";

import { useState } from "react";
import { DEMO_CALLS } from "@/lib/demo/sample-calls";
import { cn } from "@/lib/utils";

const TABS = ["transcript", "insights", "email", "payload"] as const;
type Tab = (typeof TABS)[number];

export function LiveAnalyzer() {
  const [callKey, setCallKey] = useState<"en" | "he">("en");
  const [tab, setTab] = useState<Tab>("transcript");
  const call = DEMO_CALLS.find((c) => c.key === callKey)!;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-3">
        <div className="flex gap-1 rounded-lg bg-slate-950 p-1">
          {DEMO_CALLS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCallKey(c.key)}
              dir="auto"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                callKey === c.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-slate-500 sm:inline">Live sample · no signup</span>
      </div>

      <div className="flex gap-1 border-b border-slate-800 px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200",
            )}
          >
            {t === "payload" ? "CRM Payload" : t === "email" ? "Follow-Up" : t}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto p-4 text-sm">
        {tab === "transcript" && (
          <div className="space-y-2">
            {call.transcript.map((u, i) => (
              <div key={i} className="rounded-lg border-l-2 border-indigo-500/40 bg-indigo-500/5 px-3 py-2">
                <div className="text-xs text-slate-500">Speaker {u.speaker}</div>
                <p dir="auto" className="text-slate-200">{u.text}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "insights" && (
          <div dir="auto" className="space-y-3 text-slate-200">
            <p><span className="text-slate-500">Summary:</span> {call.insights.summary}</p>
            <p>
              <span className="text-slate-500">Sentiment:</span>{" "}
              <span className="text-emerald-400">{call.insights.sentiment}</span>
              {" · "}
              <span className="text-slate-500">Stage:</span> {call.insights.deal_stage}
            </p>
            <div>
              <span className="text-slate-500">Objections:</span>
              <ul className="mt-1 space-y-1">
                {call.insights.objections.map((o, i) => (
                  <li key={i} className="text-slate-300">• [{o.category}] {o.text}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-slate-500">Action items:</span>
              <ul className="mt-1 space-y-1">
                {call.insights.action_items.map((a, i) => (
                  <li key={i} className="text-slate-300">• {a}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "email" && (
          <div dir="auto" className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="font-medium text-slate-100">{call.followUpEmail.subject}</p>
            <p className="mt-2 whitespace-pre-wrap text-slate-300">{call.followUpEmail.body}</p>
          </div>
        )}

        {tab === "payload" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-orange-400">HubSpot</div>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                {JSON.stringify(call.hubspotPayload, null, 2)}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-indigo-400">Monday.com</div>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                {JSON.stringify(call.mondayPayload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
