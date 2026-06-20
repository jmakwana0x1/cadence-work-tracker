"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TrendPoint {
  date: string;
  score: number;
  label: string;
}

interface ScoreTrendProps {
  data: TrendPoint[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass px-3 py-2 rounded-xl text-xs shadow-xl">
      <p className="text-muted-foreground">{d.label}</p>
      <p className="text-foreground font-semibold tabular-nums">{d.score.toFixed(1)}</p>
    </div>
  );
}

export function ScoreTrend({ data }: ScoreTrendProps) {
  if (data.length < 2) {
    return (
      <div className="glass-card p-5 flex items-center justify-center h-28">
        <p className="text-xs text-muted-foreground">Log habits for a few days to see your trend</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">30-day trend</p>
      <ResponsiveContainer width="100%" height={90}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--cadence-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--cadence-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(data.length / 5)}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickCount={3}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--cadence-accent)"
            strokeWidth={2}
            fill="url(#scoreGrad)"
            dot={false}
            activeDot={{ r: 3, fill: "var(--cadence-accent)", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
