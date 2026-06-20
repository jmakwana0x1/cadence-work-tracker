"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface Point {
  date: string;
  score: number;
  label: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass px-3 py-2 rounded-xl text-xs shadow-xl">
      <p className="text-muted-foreground">{d.label}</p>
      <p className="text-foreground font-semibold tabular-nums">{d.score.toFixed(1)}</p>
    </div>
  );
}

export function ScoreHistoryChart({ data, average }: { data: Point[]; average: number | null }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-56">
        <p className="text-xs text-muted-foreground">
          Keep logging — your score history will appear here.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="historyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--cadence-accent)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--cadence-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval={Math.max(0, Math.floor(data.length / 6))}
          minTickGap={16}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          tickCount={5}
        />
        {average !== null && (
          <ReferenceLine
            y={average}
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="4 4"
            label={{
              value: `avg ${average.toFixed(0)}`,
              fontSize: 9,
              fill: "var(--muted-foreground)",
              position: "insideTopRight",
            }}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--cadence-accent)"
          strokeWidth={2.5}
          fill="url(#historyGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--cadence-accent)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
