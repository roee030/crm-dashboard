import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "warning" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  negative: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  info: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
