import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "indigo" | "emerald" | "rose" | "amber";
}) {
  const bar = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
    amber: "bg-amber-500",
  }[accent ?? "indigo"];

  return (
    <Card className="relative overflow-hidden">
      <span className={cn("absolute inset-x-0 top-0 h-1", bar)} />
      <div className="p-5">
        <div className="text-sm font-medium text-slate-400">{label}</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </div>
    </Card>
  );
}
