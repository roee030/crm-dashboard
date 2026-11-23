"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#38bdf8"];

export function ObjectionsChart({
  data,
}: {
  data: { category: string; count: number }[];
}) {
  if (data.length === 0) {
    return <Empty label="No objections recorded yet" />;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
        <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={12} />
        <YAxis
          type="category"
          dataKey="category"
          stroke="#94a3b8"
          fontSize={12}
          width={90}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.08)" }}
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
            color: "#e2e8f0",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
      {label}
    </div>
  );
}
