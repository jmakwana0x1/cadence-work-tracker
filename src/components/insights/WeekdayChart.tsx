"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { WeekdayStat } from "@/lib/insights";

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: WeekdayStat }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass px-3 py-2 rounded-xl text-xs shadow-xl">
      <p className="text-muted-foreground">{d.label}</p>
      <p className="text-foreground font-semibold tabular-nums">
        {d.value} {d.value === 1 ? "point" : "points"} · {d.count} logs
      </p>
    </div>
  );
}

export function WeekdayChart({ data, bestDow }: { data: WeekdayStat[]; bestDow: number | null }) {
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs text-muted-foreground">Not enough history yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.dow}
              fill={d.dow === bestDow ? "var(--cadence-accent)" : "rgba(139,92,246,0.35)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
