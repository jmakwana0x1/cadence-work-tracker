import { createClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google/calendar";
import { CalendarSync } from "./CalendarSync";
import type { CalendarEvent, TimeBlock } from "@/types/database";

interface CalendarLoaderProps {
  calendarError?: string;
}

export async function CalendarLoader({ calendarError }: CalendarLoaderProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const connected = await isCalendarConnected(user.id);
  const todayStr  = new Date().toISOString().split("T")[0];

  const startOfDay = `${todayStr}T00:00:00.000Z`;
  const endOf7Days = new Date(Date.now() + 7 * 86400000).toISOString();

  const [eventsResult, blocksResult] = await Promise.all([
    connected
      ? supabase
          .from("events")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_at", startOfDay)
          .lte("start_at", endOf7Days)
          .order("start_at")
          .limit(50)
      : Promise.resolve({ data: null }),

    supabase
      .from("time_blocks")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .order("start_time"),
  ]);

  return (
    <CalendarSync
      connected={connected}
      events={(eventsResult.data ?? []) as CalendarEvent[]}
      blocks={(blocksResult.data ?? []) as TimeBlock[]}
      todayStr={todayStr}
      initialError={calendarError}
    />
  );
}
