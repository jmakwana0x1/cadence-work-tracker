"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { markBlock, createBlock } from "@/lib/actions/blocks";
import { toast } from "sonner";
import type { BlockStatus } from "@/types/database";

// One unified "Today" timeline merging planner time-blocks AND synced Google
// Calendar events on a single hour grid — the design's single-calendar surface.
// Blocks are placed by tapping an empty slot (drops a 1h draft you can name and
// drag-resize), so the grid itself is the time input.

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
  date: string; // yyyy-mm-dd, for the create action
}

// Default visible window. The grid expands beyond this to fit any event (or the
// draft you're placing) that falls outside it, so nothing is ever clipped.
const DEFAULT_START = 7;
const DEFAULT_END = 21; // 9pm — evening slots stay tappable by default
const ROW_H = 54;
const CLAY = "#C15F3C";
const GREEN = "#5B8A5A";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtT(h: number): string {
  const hr = Math.floor(h);
  const mn = Math.round((h - hr) * 60);
  const ap = hr >= 12 && hr < 24 ? "PM" : "AM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12} ${ap}` : `${h12}:${pad(mn)} ${ap}`;
}

// Fractional hour → "HH:MM" for the server action (snapped to 15-min steps).
function hhmm(h: number): string {
  const snapped = Math.round(h * 4) / 4;
  const hr = Math.floor(snapped) % 24;
  const mn = Math.round((snapped - Math.floor(snapped)) * 60);
  return `${pad(hr)}:${pad(mn)}`;
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

interface Draft {
  start: number;
  end: number;
}

export function TodayTimeline({ items, nowHour, dateLabel, date }: TodayTimelineProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  // Adaptive window: start from the defaults, then stretch to include every
  // event, the live "now" line, and the draft you're placing.
  const [lo, hi] = useMemo(() => {
    let low = DEFAULT_START;
    let high = DEFAULT_END;
    for (const it of items) {
      low = Math.min(low, Math.floor(it.start));
      high = Math.max(high, Math.ceil(it.end));
    }
    if (nowHour !== null) {
      low = Math.min(low, Math.floor(nowHour));
      high = Math.max(high, Math.ceil(nowHour));
    }
    if (draft) {
      low = Math.min(low, Math.floor(draft.start));
      high = Math.max(high, Math.ceil(draft.end));
    }
    return [Math.max(0, low), Math.min(24, high)];
  }, [items, nowHour, draft]);

  const gridHeight = (hi - lo) * ROW_H;
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  function openDraft(hour: number) {
    const start = Math.max(lo, Math.min(hour, 23));
    setDraft({ start, end: Math.min(start + 1, 24) });
    setLabel("");
  }

  function cancelDraft() {
    setDraft(null);
    setLabel("");
  }

  function saveDraft() {
    if (!draft) return;
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Give the block a name");
      return;
    }
    const fd = new FormData();
    fd.set("planned_label", trimmed);
    fd.set("category", "general");
    fd.set("date", date);
    fd.set("start_time", hhmm(draft.start));
    fd.set("end_time", hhmm(draft.end));
    startTransition(async () => {
      try {
        await createBlock(fd);
        toast.success("Block added", { description: `${fmtT(draft.start)} – ${fmtT(draft.end)}` });
        cancelDraft();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create block");
      }
    });
  }

  // Drag the draft's bottom handle to set its duration (snaps to 15 min).
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid || !draft) return;
    const rect = grid.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const raw = lo + (ev.clientY - rect.top) / ROW_H;
      const snapped = Math.round(raw * 4) / 4; // 15-min steps
      setDraft((d) => (d ? { ...d, end: Math.min(Math.max(d.start + 0.25, snapped), 24) } : d));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
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

      {/* Hint */}
      <p className="mt-3 text-[11px] text-muted-foreground-2">Tap an empty slot to add a block.</p>

      {/* Grid */}
      <div
        ref={gridRef}
        className={`relative mt-2 pl-[46px] ${isPending ? "opacity-70" : ""}`}
        style={{ height: gridHeight }}
      >
        {hours.map((h) => {
          const top = (h - lo) * ROW_H;
          return (
            <div key={h}>
              <button
                onClick={() => openDraft(h)}
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
            const visStart = Math.max(item.start, lo);
            const visEnd = Math.min(item.end, hi);
            if (visEnd <= visStart) return null;
            const top = (visStart - lo) * ROW_H + 2;
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

          {/* Draft being placed */}
          {draft && (
            <div
              className="absolute left-0 right-2 rounded-[11px] px-3 pt-2 pb-1 shadow-sm"
              style={{
                top: (draft.start - lo) * ROW_H + 2,
                height: Math.max((draft.end - draft.start) * ROW_H - 5, 64),
                background: "#FBF1EB",
                border: `1px solid ${CLAY}`,
                borderLeft: `3px solid ${CLAY}`,
                zIndex: 30,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <input
                  autoFocus
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDraft();
                    if (e.key === "Escape") cancelDraft();
                  }}
                  placeholder="What's this block?"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground-2"
                />
                <button onClick={cancelDraft} aria-label="Cancel" className="flex-none text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold" style={{ color: CLAY }}>
                  {fmtT(draft.start)} – {fmtT(draft.end)}
                </span>
                <button
                  onClick={saveDraft}
                  disabled={isPending}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                  style={{ background: CLAY }}
                >
                  {isPending ? "Adding…" : "Add"}
                </button>
              </div>
              {/* Resize handle */}
              <div
                onPointerDown={startResize}
                className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-end justify-center pb-0.5 touch-none"
                aria-label="Drag to set duration"
              >
                <span className="h-1 w-8 rounded-full" style={{ background: CLAY, opacity: 0.5 }} />
              </div>
            </div>
          )}

          {/* Now indicator */}
          {nowHour !== null && nowHour >= lo && nowHour <= hi && (
            <div
              className="absolute left-0 right-2"
              style={{ top: (nowHour - lo) * ROW_H, height: 0, borderTop: `1.5px solid ${CLAY}` }}
            >
              <span className="absolute -left-[5px] -top-1 h-[9px] w-[9px] rounded-full" style={{ background: CLAY }} />
            </div>
          )}
        </div>
      </div>

      {/* Add block — drops a draft at the next hour */}
      <button
        onClick={() => openDraft(nowHour !== null ? Math.floor(nowHour) + 1 : 9)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add block
      </button>
    </div>
  );
}
