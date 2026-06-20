"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, RefreshCw, LinkIcon, AlertCircle,
  CheckCircle2, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { CalendarEvent, TimeBlock } from "@/types/database";

// ── Constants ────────────────────────────────────────────────────────────────
const HOUR_H   = 64;   // px per hour
const START_H  = 6;    // 6 am
const END_H    = 24;   // midnight
const LABEL_W  = 48;   // left gutter for time labels

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isoToMinutes(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function isoToDateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatBlockTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// Group Google events by date string (YYYY-MM-DD local)
function groupEventsByDay(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = new Date(ev.start_at).toISOString().split("T")[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

// Build the 7 day keys starting from todayStr
function buildWeek(todayStr: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStr + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

// ── Sync state type ──────────────────────────────────────────────────────────
type SyncState =
  | { status: "idle" }
  | { status: "success"; pulled: number; pushed: number }
  | { status: "error"; message: string }
  | { status: "partial"; pulled: number; pushed: number; errors: string[] };

// ── Sub-components ───────────────────────────────────────────────────────────

function HourGrid() {
  const hours = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);
  return (
    <>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute w-full border-t border-white/[0.05]"
          style={{ top: (h - START_H) * HOUR_H }}
        >
          <span className="absolute -top-2.5 text-[10px] text-muted-foreground/40 select-none tabular-nums"
            style={{ left: -LABEL_W, width: LABEL_W - 8, textAlign: "right" }}>
            {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
          </span>
        </div>
      ))}
    </>
  );
}

function CurrentTimeLine({ todayStr }: { todayStr: string }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const key = now.toISOString().split("T")[0];
      if (key !== todayStr) { setMinutes(null); return; }
      setMinutes(now.getHours() * 60 + now.getMinutes());
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [todayStr]);

  if (minutes === null) return null;
  const top = ((minutes - START_H * 60) / 60) * HOUR_H;
  if (top < 0 || top > (END_H - START_H) * HOUR_H) return null;

  return (
    <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top }}>
      <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 -ml-1" />
      <div className="flex-1 h-px bg-red-400/70" />
    </div>
  );
}

interface GoogleEventBlockProps {
  ev: CalendarEvent;
}
function GoogleEventBlock({ ev }: GoogleEventBlockProps) {
  const startMin = isoToMinutes(ev.start_at);
  const endMin   = isoToMinutes(ev.end_at);
  const top      = ((startMin - START_H * 60) / 60) * HOUR_H;
  const height   = Math.max(((endMin - startMin) / 60) * HOUR_H, 20);
  if (top + height < 0 || top > (END_H - START_H) * HOUR_H) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute left-0 right-1 rounded-lg px-2 py-1 overflow-hidden cursor-default
        bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
      style={{ top, height: height - 2 }}
      title={`${ev.title}\n${formatTime(ev.start_at)} – ${formatTime(ev.end_at)}`}
    >
      <p className="text-[11px] font-medium text-violet-200 truncate leading-tight">{ev.title}</p>
      {height > 32 && (
        <p className="text-[10px] text-violet-300/60 mt-0.5">
          {formatTime(ev.start_at)} – {formatTime(ev.end_at)}
        </p>
      )}
    </motion.div>
  );
}

interface TimeBlockDisplayProps {
  block: TimeBlock;
}
function TimeBlockDisplay({ block }: TimeBlockDisplayProps) {
  const startMin = timeToMinutes(block.start_time);
  const endMin   = timeToMinutes(block.end_time);
  const top      = ((startMin - START_H * 60) / 60) * HOUR_H;
  const height   = Math.max(((endMin - startMin) / 60) * HOUR_H, 20);
  if (top + height < 0 || top > (END_H - START_H) * HOUR_H) return null;

  const statusColor =
    block.actual_status === "hit"     ? "bg-emerald-500/20 border-emerald-500/40" :
    block.actual_status === "partial" ? "bg-amber-500/20  border-amber-500/40"   :
    block.actual_status === "missed"  ? "bg-red-500/10    border-red-500/20"     :
                                        "bg-white/[0.06]  border-white/10";

  const textColor =
    block.actual_status === "hit"     ? "text-emerald-300" :
    block.actual_status === "partial" ? "text-amber-300"   :
    block.actual_status === "missed"  ? "text-red-400"     :
                                        "text-foreground/70";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute left-1 right-0 rounded-lg px-2 py-1 overflow-hidden border ${statusColor}`}
      style={{ top, height: height - 2 }}
      title={`${block.planned_label}\n${formatBlockTime(block.start_time)} – ${formatBlockTime(block.end_time)}`}
    >
      <p className={`text-[11px] font-medium truncate leading-tight ${textColor}`}>{block.planned_label}</p>
      {height > 32 && (
        <p className={`text-[10px] mt-0.5 ${textColor} opacity-60`}>
          {formatBlockTime(block.start_time)} – {formatBlockTime(block.end_time)}
        </p>
      )}
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface CalendarSyncProps {
  connected: boolean;
  events: CalendarEvent[];
  blocks: TimeBlock[];
  todayStr: string;
  initialError?: string;
}

export function CalendarSync({ connected, events, blocks, todayStr, initialError }: CalendarSyncProps) {
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [isSyncing, startSync]   = useTransition();
  const [selectedDay, setSelectedDay] = useState(todayStr);
  const scrollRef = useRef<HTMLDivElement>(null);

  const week      = buildWeek(todayStr);
  const eventMap  = groupEventsByDay(events);
  const dayEvents = (eventMap.get(selectedDay) ?? []);
  const dayBlocks = selectedDay === todayStr ? blocks : [];

  // Auto-scroll to current time (or 8am) on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const startMin = selectedDay === todayStr
      ? now.getHours() * 60 + now.getMinutes()
      : 8 * 60;
    const offset = Math.max(0, ((startMin - START_H * 60) / 60) * HOUR_H - 80);
    scrollRef.current.scrollTop = offset;
  }, [selectedDay, todayStr]);

  function handleSync() {
    setSyncState({ status: "idle" });
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    startSync(async () => {
      try {
        const resp = await fetch("/api/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeZone }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          setSyncState({ status: "error", message: json.error ?? `HTTP ${resp.status}` });
          return;
        }
        if (json.errors?.length) {
          setSyncState({ status: "partial", pulled: json.pulled, pushed: json.pushed, errors: json.errors });
        } else {
          setSyncState({ status: "success", pulled: json.pulled, pushed: json.pushed });
          setTimeout(() => window.location.reload(), 900);
        }
      } catch (err) {
        setSyncState({ status: "error", message: err instanceof Error ? err.message : "Network error" });
      }
    });
  }

  const totalH = (END_H - START_H) * HOUR_H;

  return (
    <div className="glass-card overflow-hidden flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            connected ? "bg-emerald-500/15 border border-emerald-500/20" : "bg-white/5 border border-white/10"
          }`}>
            <CalendarDays className={`h-3.5 w-3.5 ${connected ? "text-emerald-400" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Google Calendar</p>
            <p className={`text-[11px] mt-0.5 ${connected ? "text-emerald-400/70" : "text-muted-foreground"}`}>
              {connected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cadence-accent hover:bg-cadence-accent/85 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing…" : "Sync"}
              </motion.button>
              <a href="/api/calendar/connect" title="Reconnect"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground/60 transition-colors">
                <LinkIcon className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <a href="/api/calendar/connect"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cadence-accent hover:bg-cadence-accent/85 text-white text-sm font-medium transition-colors">
              <LinkIcon className="h-3.5 w-3.5" />
              Connect
            </a>
          )}
        </div>
      </div>

      {/* ── Status banner ── */}
      <AnimatePresence>
        {(initialError || syncState.status !== "idle") && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0">
            <div className="px-5 py-2.5 border-b border-white/[0.06]">
              {initialError && (
                <div className="flex items-start gap-2 text-red-400 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span className="break-all">{decodeURIComponent(initialError)}</span>
                </div>
              )}
              {syncState.status === "error" && (
                <div className="flex items-start gap-2 text-red-400 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div><p className="font-medium">Sync failed</p><p className="mt-0.5 text-red-400/70 break-all">{syncState.message}</p></div>
                </div>
              )}
              {syncState.status === "partial" && (
                <div className="flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-medium">Partial — {syncState.pulled} pulled · {syncState.pushed} pushed</span>
                  </div>
                  {syncState.errors.map((e, i) => <p key={i} className="text-amber-400/60 pl-5 break-all">{e}</p>)}
                </div>
              )}
              {syncState.status === "success" && (
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{syncState.pulled} pulled · {syncState.pushed} pushed to Google</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Day selector ── */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.06] overflow-x-auto flex-shrink-0 no-scrollbar">
        {week.map((d) => {
          const date     = new Date(d + "T00:00:00");
          const isToday  = d === todayStr;
          const isActive = d === selectedDay;
          const hasEvent = eventMap.has(d);

          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all flex-shrink-0 ${
                isActive
                  ? "bg-cadence-accent text-white"
                  : "hover:bg-white/[0.06] text-muted-foreground"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className={`text-base font-bold tabular-nums leading-tight ${isActive ? "text-white" : isToday ? "text-cadence-accent" : ""}`}>
                {date.getDate()}
              </span>
              {hasEvent && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${isActive ? "bg-white/60" : "bg-cadence-accent/60"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      {connected && (
        <div className="flex items-center gap-4 px-5 py-2 border-b border-white/[0.04] flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <div className="w-3 h-3 rounded-sm bg-violet-500/30 border border-violet-500/40" />
            Google events
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <div className="w-3 h-3 rounded-sm bg-white/[0.06] border border-white/10" />
            Time blocks
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1"
        style={{ maxHeight: 420 }}
      >
        <div className="relative" style={{ height: totalH, marginLeft: LABEL_W, marginRight: 12 }}>
          {/* Hour grid lines + labels */}
          <HourGrid />

          {/* Current time marker */}
          {selectedDay === todayStr && <CurrentTimeLine todayStr={todayStr} />}

          {/* Google Calendar events column */}
          {dayEvents.length > 0 && (
            <div className="absolute inset-0 pr-1" style={{ left: connected && dayBlocks.length > 0 ? "50%" : 0 }}>
              {dayEvents.map((ev) => <GoogleEventBlock key={ev.id} ev={ev} />)}
            </div>
          )}

          {/* Time blocks column */}
          {dayBlocks.length > 0 && (
            <div className="absolute inset-0 pl-1" style={{ right: connected && dayEvents.length > 0 ? "50%" : 0 }}>
              {dayBlocks.map((b) => <TimeBlockDisplay key={b.id} block={b} />)}
            </div>
          )}

          {/* Empty state */}
          {dayEvents.length === 0 && dayBlocks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <Clock className="h-6 w-6 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/40">
                {connected ? "No events or blocks" : "Connect Google Calendar to see events"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming agenda ── */}
      {connected && events.length > 0 && (
        <div className="border-t border-white/[0.06] flex-shrink-0">
          <p className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Upcoming
          </p>
          <div className="divide-y divide-white/[0.04]">
            {events.slice(0, 4).map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-2">
                <div className="w-0.5 h-6 rounded-full bg-cadence-accent/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80 truncate">{ev.title}</p>
                  <p className="text-[10px] text-muted-foreground/50">
                    {isoToDateStr(ev.start_at)} · {formatTime(ev.start_at)} – {formatTime(ev.end_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
