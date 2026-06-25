"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { markBlock } from "@/lib/actions/blocks";
import { CreateBlockDialog } from "@/components/planner/CreateBlockDialog";
import { toast } from "sonner";
import type { BlockStatus } from "@/types/database";

// One unified "Today" timeline merging planner time-blocks AND synced Google
// Calendar events on a single hour grid — the design's single-calendar surface.

export interface TimelineItem {
  id: string;
  label: string;
  sub: string;
  start: number; // fractional local hour
  end: number;
  source: "planner" | "google";
  status: BlockStatus | null;
}

interface TodayTimelineProps {
  items: TimelineItem[];
  nowHour: number | null; // fractional local hour, or null if off-grid
  dateLabel: string;
  date: string; // yyyy-mm-dd, for the create dialog
}

const START_HR = 7;
const END_HR = 19;
const ROW_H = 54;
const CLAY = "#C15F3C";
const GREEN = "#5B8A5A";

function fmtT(h: number): string {
  const hr = Math.floor(h);
  const mn = Math.round((h - hr) * 60);
  const ap = hr >= 12 ? "PM" : "AM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12} ${ap}` : `${h12}:${String(mn).padStart(2, "0")} ${ap}`;
}

const STATUS_META: Record<BlockStatus, { mark: string; color: string }> = {
  hit: { mark: "✓", color: GREEN },
  partial: { mark: "◐", color: "#C99A3A" },
  missed: { mark: "✗", color: "#C0563F" },
};

const NEXT: Record<string, BlockStatus> = {
  none: "hit",
  hit: "partial",
  partial: "missed",
  missed: "hit",
};

export function TodayTimeline({ items, nowHour, dateLabel, date }: TodayTimelineProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultHour, setDefaultHour] = useState<number | undefined>();
  const [isPending, startTransition] = useTransition();

  const gridHeight = (END_HR - START_HR) * ROW_H;
  const hours = Array.from({ length: END_HR - START_HR + 1 }, (_, i) => START_HR + i);

  function openCreate(hour?: number) {
    setDefaultHour(hour);
    setDialogOpen(true);
  }

  function cycleStatus(item: TimelineItem) {
    if (item.source !== "planner") return;
    const next = NEXT[item.status ?? "none"];
    startTransition(async () => {
      try {
        await markBlock(item.id, next);
        toast.success(`Marked ${next}`, { description: item.label });
      } catch {
        toast.error("Couldn't update block");
      }
    });
  }

  return (
    <div className="glass-card px-[22px] pb-6 pt-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground-2">Today</div>
          <div className="mt-1.5 text-base font-semibold text-foreground">{dateLabel}</div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CLAY }} />
            Planner
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />
            Google
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className={`relative mt-[18px] pl-[46px] ${isPending ? "opacity-70" : ""}`} style={{ height: gridHeight }}>
        {hours.map((h) => {
          const top = (h - START_HR) * ROW_H;
          return (
            <div key={h}>
              <button
                onClick={() => openCreate(h)}
                aria-label={`Add block at ${fmtT(h)}`}
                className="absolute left-[46px] right-0 -translate-y-1/2 cursor-pointer"
                style={{ top, height: ROW_H }}
              >
                <span className="absolute inset-x-0 top-1/2 h-px bg-[#F1ECE3]" />
              </button>
              <div className="absolute left-0 w-10 -translate-y-1/2 text-right text-[11px] font-medium text-[#B5AFA3]" style={{ top }}>
                {fmtT(h)}
              </div>
            </div>
          );
        })}

        {/* Events */}
        <div className="absolute inset-y-0 left-[46px] right-0">
          {items.map((item) => {
            const visStart = Math.max(item.start, START_HR);
            const visEnd = Math.min(item.end, END_HR);
            if (visEnd <= visStart) return null;
            const top = (visStart - START_HR) * ROW_H + 2;
            const height = Math.max((visEnd - visStart) * ROW_H - 5, 22);
            const planner = item.source === "planner";
            const bar = planner ? CLAY : GREEN;
            const sm = item.status ? STATUS_META[item.status] : null;

            return (
              <button
                key={`${item.source}-${item.id}`}
                onClick={() => cycleStatus(item)}
                disabled={!planner || isPending}
                title={planner ? "Click to mark hit / partial / missed" : undefined}
                className="absolute left-0 right-2 overflow-hidden rounded-[11px] px-3 py-2 text-left"
                style={{
                  top,
                  height,
                  background: planner ? "#FBF1EB" : "#EEF3EC",
                  border: `1px solid ${planner ? "#F1DDD0" : "#DCE7D8"}`,
                  borderLeft: `3px solid ${bar}`,
                  cursor: planner ? "pointer" : "default",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    {sm && <span style={{ color: sm.color }}>{sm.mark} </span>}
                    {item.label}
                  </span>
                  <span className="flex-none text-[11px] font-semibold" style={{ color: bar }}>
                    {fmtT(item.start)}
                  </span>
                </div>
                {height > 30 && <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.sub}</div>}
              </button>
            );
          })}

          {/* Now indicator */}
          {nowHour !== null && nowHour >= START_HR && nowHour <= END_HR && (
            <div
              className="absolute left-0 right-2"
              style={{ top: (nowHour - START_HR) * ROW_H, height: 0, borderTop: `1.5px solid ${CLAY}` }}
            >
              <span className="absolute -left-[5px] -top-1 h-[9px] w-[9px] rounded-full" style={{ background: CLAY }} />
            </div>
          )}
        </div>
      </div>

      {/* Add block */}
      <button
        onClick={() => openCreate()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add block
      </button>

      <CreateBlockDialog open={dialogOpen} defaultHour={defaultHour} date={date} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
