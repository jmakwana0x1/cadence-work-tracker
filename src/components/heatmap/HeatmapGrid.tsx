"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Cell {
  date: string;
  activity: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

interface HeatmapGridProps {
  cells: Cell[];
  today: string;
}

// Cell size + gap must match for month-label alignment
const CELL = 13;   // px
const GAP  = 3;    // px

// Warm clay intensity scale (Claude design): empty → light → mid → strong → full.
const INTENSITY_COLOR = ["#F1ECE3", "#EDD8C8", "#DCAF92", "#CE8A5E", "#C15F3C"] as const;

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function HeatmapGrid({ cells, today }: HeatmapGridProps) {
  const [tooltip, setTooltip] = useState<{
    date: string; activity: number; x: number; y: number;
  } | null>(null);

  // Group into weeks — cells start on a Sunday so week[dow] === day dow
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Month label: first week in which a new month appears
  const monthMarkers = new Map<number, string>();
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = new Date((week[0]?.date ?? "") + "T00:00:00").getMonth();
    if (!isNaN(m) && m !== lastMonth) {
      monthMarkers.set(wi, MONTH_LABELS[m]);
      lastMonth = m;
    }
  });

  // Day-label column width (fixed so month labels align)
  const DAY_COL_W = 28; // px

  return (
    <div className="glass-card p-4 overflow-x-auto">
      {/* min-w-max prevents wrapping; inner div is natural width */}
      <div className="min-w-max flex flex-col" style={{ gap: 6 }}>

        {/* Month labels row */}
        <div className="flex" style={{ paddingLeft: DAY_COL_W + GAP }}>
          {weeks.map((_, wi) => (
            <div key={wi} style={{ width: CELL, marginRight: wi < weeks.length - 1 ? GAP : 0, flexShrink: 0 }}>
              {monthMarkers.has(wi) && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap select-none">
                  {monthMarkers.get(wi)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Grid: day labels + week columns */}
        <div className="flex" style={{ gap: GAP }}>
          {/* Day-of-week labels */}
          <div className="flex flex-col flex-shrink-0" style={{ width: DAY_COL_W, gap: GAP }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex items-center justify-end pr-1 select-none"
                style={{ height: CELL }}
              >
                {/* Only show Mon, Wed, Fri to avoid crowding */}
                {(i === 1 || i === 3 || i === 5) && (
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                )}
              </div>
            ))}
          </div>

          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col flex-shrink-0" style={{ gap: GAP }}>
              {Array.from({ length: 7 }).map((_, dow) => {
                const cell = week[dow];

                if (!cell) {
                  return <div key={dow} style={{ width: CELL, height: CELL }} />;
                }

                const isToday = cell.date === today;

                return (
                  <motion.div
                    key={dow}
                    whileHover={{ scale: 1.5 }}
                    transition={{ type: "spring", stiffness: 600, damping: 22 }}
                    className={`cursor-pointer rounded-[3px] ${
                      isToday ? "ring-1 ring-[#C15F3C] ring-offset-1 ring-offset-background" : ""
                    }`}
                    style={{ width: CELL, height: CELL, background: INTENSITY_COLOR[cell.intensity] }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        date: cell.date,
                        activity: cell.activity,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 6,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 select-none" style={{ paddingLeft: DAY_COL_W + GAP }}>
          <span className="text-[10px] text-muted-foreground">Less</span>
          {INTENSITY_COLOR.map((c, i) => (
            <div key={i} className="rounded-[3px]" style={{ width: CELL, height: CELL, background: c }} />
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full pb-1"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="glass px-3 py-1.5 rounded-lg text-xs shadow-xl border border-border">
            <p className="text-foreground font-medium">{formatDate(tooltip.date)}</p>
            <p className="text-muted-foreground">
              {tooltip.activity === 0
                ? "No activity"
                : `${tooltip.activity} habit${tooltip.activity !== 1 ? "s" : ""} logged`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
