"use client";

import { useState, useRef, useTransition, useCallback } from "react";
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
import { toast } from "sonner";
import type { TimeBlock, BlockStatus } from "@/types/database";

// ── Layout constants ────────────────────────────────────────────────
const START_HOUR  = 6;   // 6 am
const END_HOUR    = 23;  // 11 pm
const PX_PER_HOUR = 64;
const PX_PER_MIN  = PX_PER_HOUR / 60;
const SNAP_MINS   = 15;
const TOTAL_HOURS = END_HOUR - START_HOUR;

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
function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minsToTime(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function blockTop(b: TimeBlock)    { return (timeToMins(b.start_time) - START_HOUR * 60) * PX_PER_MIN; }
function blockHeight(b: TimeBlock) { return (timeToMins(b.end_time) - timeToMins(b.start_time)) * PX_PER_MIN; }
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${ampm}`;
}

// ── Single draggable block ───────────────────────────────────────────
function BlockItem({
  block,
  isDragging,
  onMark,
  onDelete,
}: {
  block: TimeBlock;
  isDragging?: boolean;
  onMark: (id: string, status: BlockStatus) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: block.id });
  const color = CATEGORY_COLORS[block.category] ?? CATEGORY_COLORS.general;
  const height = blockHeight(block);
  const status = block.actual_status;

  const style: React.CSSProperties = {
    position: "absolute",
    top: blockTop(block),
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
        className="h-full rounded-lg flex flex-col overflow-hidden group select-none"
        style={{
          background: `${color}18`,
          borderLeft: `3px solid ${color}`,
          border: `1px solid ${color}40`,
          borderLeftWidth: 3,
        }}
      >
        {/* Drag handle + label */}
        <div
          {...listeners}
          {...attributes}
          className="flex-1 px-2 pt-1.5 cursor-grab active:cursor-grabbing overflow-hidden"
        >
          <p className="text-xs font-medium text-foreground leading-tight truncate">
            {block.planned_label}
          </p>
          {height > 32 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {fmtTime(block.start_time)} – {fmtTime(block.end_time)}
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
  blocks,
  onMark,
  onDelete,
  activeId,
  onClickHour,
}: {
  blocks: TimeBlock[];
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
              {hour % 12 || 12}{hour < 12 ? "a" : "p"}
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

      {/* Blocks */}
      <div className="absolute inset-0 ml-10">
        {blocks.map((b) => (
          <BlockItem
            key={b.id}
            block={b}
            isDragging={activeId === b.id}
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
    const duration = timeToMins(block.end_time) - timeToMins(block.start_time);
    const newStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, snapped));
    const newEnd = newStart + duration;

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

  const activeBlock = localBlocks.find((b) => b.id === activeId);

  // Plan vs actual stats
  const marked = localBlocks.filter((b) => b.actual_status);
  const hitCount = localBlocks.filter((b) => b.actual_status === "hit").length;
  const partialCount = localBlocks.filter((b) => b.actual_status === "partial").length;

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${isPending ? "opacity-80" : ""}`}>
      {/* Header stats */}
      {localBlocks.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{localBlocks.length} blocks planned</span>
          {marked.length > 0 && (
            <>
              <span className="text-emerald-400">{hitCount} hit</span>
              {partialCount > 0 && <span className="text-amber-400">{partialCount} partial</span>}
              <span>{localBlocks.length - marked.length} remaining</span>
            </>
          )}
        </div>
      )}

      {/* Timeline */}
      <div ref={timelineRef} className="glass-card overflow-y-auto" style={{ maxHeight: 560 }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="p-4">
            {localBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-2xl">🗓️</p>
                <p className="text-sm font-medium text-foreground">No blocks planned</p>
                <p className="text-xs text-muted-foreground">Click + next to any hour to add a block.</p>
              </div>
            ) : (
              <Timeline
                blocks={localBlocks}
                onMark={handleMark}
                onDelete={handleDelete}
                activeId={activeId}
                onClickHour={(h) => onCreateClick(h)}
              />
            )}

            {localBlocks.length === 0 && (
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
                        {hour % 12 || 12}{hour < 12 ? "a" : "p"}
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
            {activeBlock && (
              <div
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-foreground shadow-lg"
                style={{
                  width: 200,
                  height: blockHeight(activeBlock),
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
