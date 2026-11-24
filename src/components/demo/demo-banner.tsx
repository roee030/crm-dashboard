import { Sparkles } from "lucide-react";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * Non-intrusive banner shown inside the (app) shell when the app is running in
 * zero-env demo mode (no `.env.local` configured). Renders nothing in production.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-indigo-500/30 bg-indigo-600/10 px-4 py-1.5 text-center text-xs text-indigo-200">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
      <span>
        <span className="font-medium">Demo Mode (No .env configured)</span> — Exploring interactive
        preview with sample Hebrew &amp; English sales data
      </span>
    </div>
  );
}
