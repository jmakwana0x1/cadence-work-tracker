import { createClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google/calendar";
import { localToday, localTimeParts, userTimezone } from "@/lib/date";
import { TodayTimeline, type TimelineItem } from "./TodayTimeline";
import type { TimeBlock, CalendarEvent } from "@/types/database";

// Parse a "HH:MM[:SS]" time-block string into a fractional hour.
function parseClock(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) + Number(m ?? 0) / 60;
}

export async function TodayTimelineLoader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const tz = userTimezone(user);
  const today = localToday(tz);

  const connected = await isCalendarConnected(user.id);

  // Pull today's planner blocks and a generous Google window (filtered to today
  // in the user's tz below).
  const nowMs = new Date().getTime();
  const startWindow = new Date(nowMs - 86400000).toISOString();
  const endWindow = new Date(nowMs + 2 * 86400000).toISOString();

  const [{ data: blockData }, eventRes] = await Promise.all([
    supabase.from("time_blocks").select("*").eq("user_id", user.id).eq("date", today).order("start_time"),
    connected
      ? supabase
          .from("events")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_at", startWindow)
          .lte("start_at", endWindow)
          .order("start_at")
          .limit(100)
      : Promise.resolve({ data: [] as CalendarEvent[] }),
  ]);

  const blocks = (blockData ?? []) as TimeBlock[];
  const events = (eventRes.data ?? []) as CalendarEvent[];

  const plannerItems: TimelineItem[] = blocks.map((b) => ({
    id: b.id,
    label: b.planned_label,
    sub: b.category,
    start: parseClock(b.start_time),
    end: parseClock(b.end_time),
    source: "planner",
    status: b.actual_status,
  }));

  const googleItems: TimelineItem[] = events
    .map((e): TimelineItem | null => {
      const s = localTimeParts(new Date(e.start_at), tz);
      if (s.dateStr !== today) return null;
      const en = localTimeParts(new Date(e.end_at), tz);
      const endHour = en.dateStr === today ? en.minutes / 60 : 24;
      return {
        id: e.id,
        label: e.title,
        sub: "Google Calendar",
        start: s.minutes / 60,
        end: endHour,
        source: "google",
        status: null,
      };
    })
    .filter((x): x is TimelineItem => x !== null);

  const items = [...plannerItems, ...googleItems].sort((a, b) => a.start - b.start);

  const nowParts = localTimeParts(new Date(), tz);
  const nowHour = nowParts.dateStr === today ? nowParts.minutes / 60 : null;
  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return <TodayTimeline items={items} nowHour={nowHour} dateLabel={dateLabel} date={today} />;
}
