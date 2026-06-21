"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Check, Minus, X, Plus, Trash2 } from "lucide-react";
import { updateBlockTimes, markBlock, deleteBlock } from "@/lib/actions/blocks";
import { addDaysStr } from "@/lib/date";
import { toast } from "sonner";
import type { TimeBlock, BlockStatus } from "@/types/database";

// ── Layout constants ────────────────────────────────────────────────
const START_HOUR  = 0;   // midnight
const END_HOUR    = 24;  // midnight (full 24-hour day)
const PX_PER_HOUR = 64;
const PX_PER_MIN  = PX_PER_HOUR / 60;
const SNAP_MINS   = 15;
const TOTAL_HOURS = END_HOUR - START_HOUR;

// Short hour label, e.g. 0 → "12a", 12 → "12p", 24 → "12a".
function hourLabel(hour: number) {
  const h = hour % 24;
  return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  work:        "#8b5cf6",
  health:      "#10b981",
  learning:    "#3b82f6",
  fitness:     "#f59e0b",
  mindfulness: "#06b6d4",
  personal:    "#f43f5e",
  general:     "#6b7280",
};

const STATUS_CFG = {
  hit:     { label: "Hit",     Icon: Check,  cls: "text-emerald-400 bg-emerald-500/15 ring-emerald-500/30" },
  partial: { label: "Partial", Icon: Minus,  cls: "text-amber-400  bg-amber-500/15  ring-amber-500/30"  },
  missed:  { label: "Missed",  Icon: X,      cls: "text-red-400    bg-red-500/15    ring-red-500/30"    },
} as const;

// ── Helpers ─────────────────────────────────────────────────────────
const DAY_MINS = 24 * 60;

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minsToTime(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
// True when the block ends on the next day (end time wraps past midnight).
function isOvernight(b: TimeBlock) { return timeToMins(b.end_time) <= timeToMins(b.start_time); }
// Duration in minutes, accounting for overnight blocks that cross midnight.
function blockDuration(b: TimeBlock) {
  const start = timeToMins(b.start_time);
  const end = timeToMins(b.end_time);
  return isOvernight(b) ? end + DAY_MINS - start : end - start;
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${ampm}`;
}

// ── Day-view segments ───────────────────────────────────────────────
// Overnight blocks are drawn the way Google Calendar's day view does: split at
// midnight into a "start" chip (start → midnight) on the block's own day and an
// "end" chip (midnight → end) on the following day. Same-day blocks are "whole".
type SegmentKind = "whole" | "start" | "end";
interface Segment {
  block: TimeBlock;
  kind: SegmentKind;
  startMin: number; // minutes from midnight of the rendered day
  endMin: number;
}

// Expand the blocks visible to a planner date into renderable segments.
function buildSegments(blocks: TimeBlock[], date: string): Segment[] {
  const prev = addDaysStr(date, -1);
  const segs: Segment[] = [];
  for (const block of blocks) {
    const start = timeToMins(block.start_time);
    const end = timeToMins(block.end_time);
    const overnight = end <= start;
    if (block.date === date) {
      segs.push(
        overnight
          ? { block, kind: "start", startMin: start, endMin: DAY_MINS }
          : { block, kind: "whole", startMin: start, endMin: end }
      );
    } else if (block.date === prev && overnight) {
      // Tail of yesterday's overnight block, continuing into this morning.
      segs.push({ block, kind: "end", startMin: 0, endMin: end });
    }
  }
  return segs;
}

// ── Single draggable block segment ───────────────────────────────────
function BlockItem({
  seg,
  isDragging,
  onMark,
  onDelete,
}: {
  seg: Segment;
  isDragging?: boolean;
  onMark: (id: string, status: BlockStatus) => void;
  onDelete: (id: string) => void;
}) {
  const { block, kind } = seg;
  // The after-midnight tail ("end") is a read-only continuation: you reschedule
  // an overnight block from its start chip, the same as Google Calendar.
  const draggable = kind !== "end";
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.id,
    disabled: !draggable,
  });
  const color = CATEGORY_COLORS[block.category] ?? CATEGORY_COLORS.general;
  const height = Math.max((seg.endMin - seg.startMin) * PX_PER_MIN, 16);
  const status = block.actual_status;

  // Round only the "open" edge flat where the block continues onto another day.
  const radius =
    kind === "start" ? "rounded-t-lg" : kind === "end" ? "rounded-b-lg" : "rounded-lg";

  const style: React.CSSProperties = {
    position: "absolute",
    top: seg.startMin * PX_PER_MIN,
    left: 0,
    right: 0,
    height,
    transform: transform ? `translateY(${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`h-full ${radius} flex flex-col overflow-hidden group select-none`}
        style={{
          background: `${color}18`,
          borderLeft: `3px solid ${color}`,
          border: `1px solid ${color}40`,
          borderLeftWidth: 3,
        }}
      >
        {/* Drag handle + label */}
        <div
          {...(draggable ? listeners : {})}
          {...(draggable ? attributes : {})}
          className={`flex-1 px-2 pt-1.5 overflow-hidden ${
            draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
        >
          <p className="text-xs font-medium text-foreground leading-tight truncate">
            {kind === "end" && <span className="text-muted-foreground">↳ </span>}
            {block.planned_label}
          </p>
          {height > 32 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {fmtTime(block.start_time)} – {fmtTime(block.end_time)}
              {kind === "start" && " ›"}
            </p>
          )}
        </div>

        {/* Status / actions row */}
        {height > 44 && (
          <div className="flex items-center gap-1 px-1.5 pb-1.5">
            {status ? (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ${STATUS_CFG[status].cls}`}>
                {STATUS_CFG[status].label}
              </span>
            ) : (
              <>
                {(["hit", "partial", "missed"] as BlockStatus[]).map((s) => {
                  const { Icon } = STATUS_CFG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => onMark(block.id, s)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title={STATUS_CFG[s].label}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
              </>
            )}
            <button
              onClick={() => onDelete(block.id)}
              className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Droppable timeline ───────────────────────────────────────────────
function Timeline({
  segments,
  onMark,
  onDelete,
  activeId,
  onClickHour,
}: {
  segments: Segment[];
  onMark: (id: string, status: BlockStatus) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
  onClickHour: (h: number) => void;
}) {
  const { setNodeRef } = useDroppable({ id: "timeline" });

  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{ height: TOTAL_HOURS * PX_PER_HOUR }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
        const hour = START_HOUR + i;
        return (
          <div
            key={i}
            className="absolute left-0 right-0 flex items-start"
            style={{ top: i * PX_PER_HOUR }}
          >
            <span className="text-[10px] text-muted-foreground/50 w-10 flex-shrink-0 -translate-y-2 select-none text-right pr-2">
              {hourLabel(hour)}
            </span>
            <div className="flex-1 border-t border-white/[0.06]" />
            {/* Click to create block at this hour */}
            <button
              onClick={() => onClickHour(hour)}
              className="absolute right-1 -translate-y-2 opacity-0 hover:opacity-100 text-muted-foreground/40 hover:text-cadence-accent transition-opacity"
              style={{ top: 0 }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* Block segments */}
      <div className="absolute inset-0 ml-10">
        {segments.map((seg) => (
          <BlockItem
            key={`${seg.block.id}-${seg.kind}`}
            seg={seg}
            isDragging={activeId === seg.block.id && seg.kind !== "end"}
            onMark={onMark}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main planner client ──────────────────────────────────────────────
interface PlannerClientProps {
  blocks: TimeBlock[];
  date: string;
  onCreateClick: (hour?: number) => void;
}

export function PlannerClient({ blocks, date, onCreateClick }: PlannerClientProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [isPending, startTransition] = useTransition();
  const timelineRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Open scrolled to the earliest block (or ~6am) so the full-day timeline
  // doesn't start parked on the empty small hours.
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const todays = blocks.filter((b) => b.date === date);
    const earliestMin = todays.length
      ? Math.min(...todays.map((b) => timeToMins(b.start_time)))
      : 6 * 60;
    el.scrollTop = Math.max(0, (earliestMin - START_HOUR * 60) * PX_PER_MIN - 24);
    // Mount-only: a one-time initial scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep local state in sync when server revalidates
  if (JSON.stringify(blocks.map((b) => b.id + b.start_time + b.actual_status)) !==
      JSON.stringify(localBlocks.map((b) => b.id + b.start_time + b.actual_status))) {
    setLocalBlocks(blocks);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.delta.y) return;

    const draggedId = String(e.active.id);
    const block = localBlocks.find((b) => b.id === draggedId);
    if (!block) return;

    const deltaMinutes = e.delta.y / PX_PER_MIN;
    const rawNewStart = timeToMins(block.start_time) + deltaMinutes;
    const snapped = Math.round(rawNewStart / SNAP_MINS) * SNAP_MINS;
    const duration = blockDuration(block);
    // Same-day blocks must fit before midnight; overnight blocks may start
    // anywhere and wrap, so their end is taken modulo a full day.
    const maxStart = isOvernight(block) ? END_HOUR * 60 - SNAP_MINS : END_HOUR * 60 - duration;
    const newStart = Math.max(START_HOUR * 60, Math.min(maxStart, snapped));
    const newEnd = (newStart + duration) % DAY_MINS;

    const newStartTime = minsToTime(newStart);
    const newEndTime = minsToTime(newEnd);
    if (newStartTime === block.start_time) return;

    // Optimistic update
    setLocalBlocks((prev) =>
      prev.map((b) =>
        b.id === draggedId ? { ...b, start_time: newStartTime, end_time: newEndTime } : b
      )
    );

    startTransition(async () => {
      try {
        await updateBlockTimes(draggedId, newStartTime, newEndTime);
      } catch {
        toast.error("Failed to move block");
        setLocalBlocks(blocks); // revert
      }
    });
  }

  const handleMark = useCallback((id: string, status: BlockStatus) => {
    setLocalBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, actual_status: status } : b))
    );
    startTransition(async () => {
      try {
        await markBlock(id, status);
      } catch {
        toast.error("Failed to mark block");
        setLocalBlocks(blocks);
      }
    });
  }, [blocks]);

  const handleDelete = useCallback((id: string) => {
    setLocalBlocks((prev) => prev.filter((b) => b.id !== id));
    startTransition(async () => {
      try {
        await deleteBlock(id);
      } catch {
        toast.error("Failed to delete block");
        setLocalBlocks(blocks);
      }
    });
  }, [blocks]);

  // Split overnight blocks into Google-Calendar-style day-view segments: this
  // day's blocks (clamped at midnight) plus the tail of yesterday's overnighters.
  const segments = buildSegments(localBlocks, date);
  const activeSeg = segments.find((s) => s.block.id === activeId && s.kind !== "end");
  const activeBlock = activeSeg?.block;

  // Plan vs actual stats — only this day's own blocks (a tail chip continued
  // from yesterday isn't counted again here).
  const todays = localBlocks.filter((b) => b.date === date);
  const total = todays.length;
  const hitCount = todays.filter((b) => b.actual_status === "hit").length;
  const partialCount = todays.filter((b) => b.actual_status === "partial").length;
  const missedCount = todays.filter((b) => b.actual_status === "missed").length;
  const markedCount = hitCount + partialCount + missedCount;
  const remainingCount = total - markedCount;

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${isPending ? "opacity-80" : ""}`}>
      {/* Header stats */}
      {total > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{total} block{total !== 1 ? "s" : ""} planned</span>
          {hitCount > 0 && <span className="text-emerald-400">{hitCount} hit</span>}
          {partialCount > 0 && <span className="text-amber-400">{partialCount} partial</span>}
          {missedCount > 0 && <span className="text-red-400">{missedCount} missed</span>}
          {remainingCount > 0 && markedCount > 0 && (
            <span>{remainingCount} remaining</span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div ref={timelineRef} className="glass-card overflow-y-auto" style={{ maxHeight: 560 }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="p-4">
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-2xl">🗓️</p>
                <p className="text-sm font-medium text-foreground">No blocks planned</p>
                <p className="text-xs text-muted-foreground">Click + next to any hour to add a block.</p>
              </div>
            ) : (
              <Timeline
                segments={segments}
                onMark={handleMark}
                onDelete={handleDelete}
                activeId={activeId}
                onClickHour={(h) => onCreateClick(h)}
              />
            )}

            {segments.length === 0 && (
              <div
                className="relative mt-0"
                style={{ height: TOTAL_HOURS * PX_PER_HOUR }}
              >
                {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
                  const hour = START_HOUR + i;
                  return (
                    <div
                      key={i}
                      className="absolute left-0 right-0 flex items-start"
                      style={{ top: i * PX_PER_HOUR }}
                    >
                      <span className="text-[10px] text-muted-foreground/40 w-10 flex-shrink-0 -translate-y-2 select-none text-right pr-2">
                        {hourLabel(hour)}
                      </span>
                      <div className="flex-1 border-t border-white/[0.05]" />
                      <button
                        onClick={() => onCreateClick(hour)}
                        className="absolute right-1 -translate-y-2 opacity-0 hover:opacity-100 text-muted-foreground/40 hover:text-cadence-accent transition-opacity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeBlock && activeSeg && (
              <div
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-foreground shadow-lg"
                style={{
                  width: 200,
                  height: Math.max((activeSeg.endMin - activeSeg.startMin) * PX_PER_MIN, 16),
                  background: `${CATEGORY_COLORS[activeBlock.category] ?? "#8b5cf6"}30`,
                  border: `1px solid ${CATEGORY_COLORS[activeBlock.category] ?? "#8b5cf6"}60`,
                  borderLeftWidth: 3,
                }}
              >
                {activeBlock.planned_label}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
