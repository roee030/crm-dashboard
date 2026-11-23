"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TrendChart({
  data,
}: {
  data: { label: string; calls: number; won: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="calls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
            color: "#e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="calls"
          name="Calls"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#calls)"
        />
        <Line type="monotone" dataKey="won" name="Won" stroke="#10b981" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
