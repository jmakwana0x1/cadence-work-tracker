"use client";

import type { WeekdayStat } from "@/lib/insights";

// Completion rate by weekday, as warm Claude-design bars. The strongest day is
// clay-emphasized; the rest are a muted warm tint.
export function WeekdayChart({ data }: { data: WeekdayStat[]; bestDow?: number | null }) {
  const pcts = data.map((d) => (d.count > 0 ? Math.round((d.value / d.count) * 100) : 0));
  const maxPct = Math.max(...pcts);
  const hasData = maxPct > 0;

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-xs text-muted-foreground">Not enough history yet</p>
      </div>
    );
  }

  return (
    <div className="flex h-[168px] items-end gap-2.5">
      {data.map((d, i) => {
        const pct = pcts[i];
        const strong = pct === maxPct;
        const height = Math.round((pct / 100) * 116) + 6;
        return (
          <div key={d.dow} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: strong ? "var(--cadence-accent)" : "#9A958B" }}
            >
              {pct}%
            </span>
            <div
              className="w-full max-w-[34px]"
              style={{ height, borderRadius: "8px 8px 4px 4px", background: strong ? "var(--cadence-accent)" : "#EAD9CC" }}
            />
            <span className="text-xs" style={{ fontWeight: strong ? 600 : 500, color: strong ? "#2B2926" : "#9A958B" }}>
              {d.label.slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
