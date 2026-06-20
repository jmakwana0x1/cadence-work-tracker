"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDaysStr,
  domOf,
  dowOf,
  weekdayLabel,
  minuteLabel,
  localTimeParts,
} from "@/lib/date";
import type { CalendarEvent } from "@/types/database";

const HOUR_HEIGHT = 48; // px per hour

// A small Google-Calendar-like palette; picked deterministically per event so
// the same event keeps its color across renders.
const PALETTE = [
  { bar: "#7c6cf5", bg: "rgba(124,108,245,0.18)", text: "#c5bdfb" }, // violet
  { bar: "#4a90e2", bg: "rgba(74,144,226,0.18)", text: "#aacdf6" }, // blue
  { bar: "#1bb89a", bg: "rgba(27,184,154,0.18)", text: "#8fe3d2" }, // teal
  { bar: "#e2a23b", bg: "rgba(226,162,59,0.18)", text: "#f3d49b" }, // amber
  { bar: "#e0556e", bg: "rgba(224,85,110,0.18)", text: "#f4aab7" }, // rose
  { bar: "#46b3d6", bg: "rgba(70,179,214,0.18)", text: "#a7dcec" }, // cyan
];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function hourLabel(h: number) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

interface Positioned {
  ev: CalendarEvent;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

// Greedy lane assignment so overlapping events sit side-by-side.
function layout(dayEvents: { ev: CalendarEvent; startMin: number; endMin: number }[]): Positioned[] {
  const sorted = [...dayEvents].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnds: number[] = [];
  const placed = sorted.map((e) => {
    let lane = laneEnds.findIndex((end) => end <= e.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.endMin);
    } else {
      laneEnds[lane] = e.endMin;
    }
    return { ...e, lane, lanes: 1 };
  });
  // Resolve cluster width: events that share time get the same lane count.
  for (const p of placed) {
    const overlapping = placed.filter((o) => o.startMin < p.endMin && o.endMin > p.startMin);
    const lanes = Math.max(...overlapping.map((o) => o.lane)) + 1;
    for (const o of overlapping) o.lanes = Math.max(o.lanes, lanes);
  }
  return placed;
}

interface CalendarGridProps {
  events: CalendarEvent[];
  // User's IANA timezone — all day/time math is resolved through it so the
  // server (UTC) and client (user-local) render byte-identical markup.
  tz: string;
  // User's local "today" as YYYY-MM-DD; the 7-day window starts here.
  today: string;
}

export function CalendarGrid({ events, tz, today }: CalendarGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // `now` is intentionally null until mount: the live time indicator depends on
  // the wall clock and must stay out of SSR to avoid hydration drift.
  const [now, setNow] = useState<{ dateStr: string; minutes: number } | null>(null);

  // Tick the "now" indicator every minute (client-only).
  useEffect(() => {
    const tick = () => setNow(localTimeParts(new Date(), tz));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [tz]);

  // Auto-scroll so the working day (around 7am) is visible on mount.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR_HEIGHT * 6.5;
  }, []);

  // The 7 visible days, as YYYY-MM-DD strings starting at the user's today.
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysStr(today, i)),
    [today]
  );

  // Bucket events by their local day, splitting all-day from timed.
  const { timedByDay, allDayByDay } = useMemo(() => {
    const timed = new Map<string, { ev: CalendarEvent; startMin: number; endMin: number }[]>();
    const allDay = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const start = localTimeParts(new Date(ev.start_at), tz);
      const end = localTimeParts(new Date(ev.end_at), tz);
      const durationH = (new Date(ev.end_at).getTime() - new Date(ev.start_at).getTime()) / 3_600_000;
      const key = start.dateStr;
      if (durationH >= 23) {
        (allDay.get(key) ?? allDay.set(key, []).get(key)!).push(ev);
        continue;
      }
      const startMin = start.minutes;
      // If the event ends on a later day, clamp it to midnight of the start day.
      const rawEndMin = end.dateStr === start.dateStr ? end.minutes : 24 * 60;
      const endMin = Math.max(startMin + 15, Math.min(24 * 60, rawEndMin || 24 * 60));
      (timed.get(key) ?? timed.set(key, []).get(key)!).push({ ev, startMin, endMin });
    }
    return { timedByDay: timed, allDayByDay: allDay };
  }, [events, tz]);

  const fmtTime = (iso: string) => minuteLabel(localTimeParts(new Date(iso), tz).minutes);
  const hasAllDay = allDayByDay.size > 0;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Day header */}
        <div
          className="grid sticky top-0 z-20 bg-[var(--glass)] backdrop-blur"
          style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}
        >
          <div className="border-b border-white/[0.06]" />
          {days.map((dayStr) => {
            const isToday = dayStr === today;
            const isWeekend = dowOf(dayStr) === 0 || dowOf(dayStr) === 6;
            return (
              <div
                key={dayStr}
                className={`flex flex-col items-center gap-1 py-2 border-b border-l border-white/[0.06] ${
                  isToday ? "bg-cadence-accent/[0.06]" : ""
                }`}
              >
                <span
                  className={`text-[10px] uppercase tracking-wide ${
                    isToday
                      ? "text-cadence-accent font-medium"
                      : isWeekend
                      ? "text-muted-foreground/40"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {weekdayLabel(dayStr)}
                </span>
                <span
                  className={`flex items-center justify-center text-sm font-semibold tabular-nums h-7 w-7 rounded-full ${
                    isToday ? "bg-cadence-accent text-white" : "text-foreground"
                  }`}
                >
                  {domOf(dayStr)}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        {hasAllDay && (
          <div className="grid border-b border-white/[0.06]" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
            <div className="text-[9px] text-muted-foreground/50 text-right pr-2 py-1.5 uppercase tracking-wide">
              All day
            </div>
            {days.map((dayStr) => (
              <div
                key={dayStr}
                className={`border-l border-white/[0.06] p-1 flex flex-col gap-1 ${
                  dayStr === today ? "bg-cadence-accent/[0.04]" : ""
                }`}
              >
                {(allDayByDay.get(dayStr) ?? []).map((ev) => {
                  const c = colorFor(ev.id);
                  return (
                    <div
                      key={ev.id}
                      className="text-[10px] leading-tight rounded px-1.5 py-1 truncate"
                      style={{ background: c.bg, color: c.text, borderLeft: `2px solid ${c.bar}` }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div ref={scrollRef} className="max-h-[460px] overflow-y-auto">
          <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
            {/* Hour gutter */}
            <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[9px] text-muted-foreground/50 tabular-nums"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  {h === 0 ? "" : hourLabel(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((dayStr) => {
              const positioned = layout(timedByDay.get(dayStr) ?? []);
              const isToday = dayStr === today;
              const showNow = now != null && now.dateStr === dayStr;
              return (
                <div
                  key={dayStr}
                  className="relative border-l border-white/[0.06]"
                  style={{
                    height: HOUR_HEIGHT * 24,
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, transparent, transparent 47px, rgba(255,255,255,0.05) 47px, rgba(255,255,255,0.05) 48px)",
                    ...(isToday ? { backgroundColor: "rgba(124,108,245,0.04)" } : null),
                  }}
                >
                  {/* Live now indicator (client-only) */}
                  {showNow && (
                    <div
                      className="absolute left-0 right-0 z-10 pointer-events-none"
                      style={{ top: (now.minutes / 60) * HOUR_HEIGHT }}
                    >
                      <div className="h-px bg-red-500" />
                      <div className="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-red-500" />
                    </div>
                  )}

                  {positioned.map((p) => {
                    const c = colorFor(p.ev.id);
                    const top = (p.startMin / 60) * HOUR_HEIGHT;
                    const height = ((p.endMin - p.startMin) / 60) * HOUR_HEIGHT;
                    const widthPct = 100 / p.lanes;
                    return (
                      <div
                        key={p.ev.id}
                        className="absolute rounded-md px-1.5 py-0.5 overflow-hidden cursor-default transition-[filter] hover:brightness-125 hover:z-20"
                        style={{
                          top,
                          height: Math.max(height - 2, 16),
                          left: `calc(${p.lane * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          background: c.bg,
                          borderLeft: `2px solid ${c.bar}`,
                        }}
                        title={`${p.ev.title} · ${fmtTime(p.ev.start_at)}–${fmtTime(p.ev.end_at)}`}
                      >
                        <p className="text-[10px] font-medium leading-tight truncate" style={{ color: c.text }}>
                          {p.ev.title}
                        </p>
                        {height > 28 && (
                          <p className="text-[9px] leading-tight truncate" style={{ color: c.text, opacity: 0.7 }}>
                            {fmtTime(p.ev.start_at)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
