import { createClient } from "@/lib/supabase/server";
import { Planner } from "./Planner";
import { addDaysStr, localToday, userTimezone } from "@/lib/date";
import type { TimeBlock } from "@/types/database";

export async function PlannerLoader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = localToday(userTimezone(user));
  const yesterday = addDaysStr(today, -1);

  // Fetch today's blocks plus yesterday's, so an overnight block started
  // yesterday can show its after-midnight tail at the top of today's timeline.
  const { data } = await supabase
    .from("time_blocks")
    .select("*")
    .eq("user_id", user.id)
    .in("date", [yesterday, today])
    .order("start_time");

  return <Planner blocks={(data ?? []) as TimeBlock[]} date={today} />;
}
