import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * "Enter Live Demo" button shown on the marketing landing and auth pages when
 * the app is in zero-env demo mode. Links straight into the authenticated shell
 * (no login required in demo). Renders nothing in production.
 */
export function DemoCta({ variant = "solid" }: { variant?: "solid" | "subtle" }) {
  if (!isDemoMode()) return null;

  if (variant === "subtle") {
    return (
      <Link
        href="/dashboard"
        className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-600/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-600/20"
      >
        <PlayCircle className="h-4 w-4" />
        Enter Live Demo (no sign-in needed)
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
    >
      <PlayCircle className="h-4 w-4" />
      Enter Live Demo <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
