"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStaticDemo } from "@/lib/demo/static";

export function LeadForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);

    // Static demo (GitHub Pages): capture is simulated client-side.
    if (isStaticDemo()) {
      await new Promise((r) => setTimeout(r, 600));
      setState("done");
      return;
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source: "landing-early-access" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        setState("error");
      } else {
        setState("done");
      }
    } catch {
      setError("Network error");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <p className="text-sm text-emerald-300">
          You&apos;re on the list — we&apos;ll reach out to analyze 5 of your real sales calls.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          type="email"
          required
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Company (optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Get early access + free analysis of 5 real sales calls
      </Button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </form>
  );
}
