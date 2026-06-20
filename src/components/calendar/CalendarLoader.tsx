import { createClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google/calendar";
import { userTimezone, localToday } from "@/lib/date";
import { CalendarSync } from "./CalendarSync";
import type { CalendarEvent } from "@/types/database";

interface CalendarLoaderProps {
  calendarError?: string;
}

export async function CalendarLoader({ calendarError }: CalendarLoaderProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const connected = await isCalendarConnected(user.id);
  const tz = userTimezone(user);
  const today = localToday(tz);

  let events: CalendarEvent[] = [];
  if (connected) {
    // Pull a generous window; the grid renders a 7-day view starting today.
    // Start a day back so events earlier *today* still appear in the grid.
    const nowMs = new Date().getTime();
    const startWindow = new Date(nowMs - 86400000).toISOString();
    const endOf7Days = new Date(nowMs + 8 * 86400000).toISOString();
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_at", startWindow)
      .lte("start_at", endOf7Days)
      .order("start_at")
      .limit(100);
    events = (data ?? []) as CalendarEvent[];
  }

  return (
    <CalendarSync
      connected={connected}
      events={events}
      tz={tz}
      today={today}
      initialError={calendarError}
    />
  );
}
