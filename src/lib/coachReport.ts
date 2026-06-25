// Server-side assembly of a Coach report for a user. Shared by the dashboard
// CoachCard and the Telegram sender so the on-screen and pushed briefs match.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { localToday, addDaysStr, dowOf, userTimezone } from "@/lib/date";
import { activityValue } from "@/lib/insights";
import { buildRhythm } from "@/lib/rhythmData";
import {
  buildCoachReport,
  type WeekdayRate,
  type HabitAdherence,
  type CoachReport,
} from "@/lib/coach";
import type { Habit, HabitLog } from "@/types/database";

const RHYTHM_WINDOW = 28;
const HISTORY = 90;

export async function getCoachReportForUser(
  supabase: SupabaseClient,
  user: User
): Promise<CoachReport> {
  const tz = userTimezone(user);
  const today = localToday(tz);
  const historyStart = addDaysStr(today, -(HISTORY - 1));
  const rhythmStart = addDaysStr(today, -(RHYTHM_WINDOW - 1));

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("id, name").eq("user_id", user.id),
    supabase
      .from("habit_logs")
      .select("logged_at, status, habit_id")
      .eq("user_id", user.id)
      .gte("logged_at", historyStart),
  ]);

  const allLogs = (logs ?? []) as Pick<HabitLog, "logged_at" | "status" | "habit_id">[];
  const habitList = (habits ?? []) as Pick<Habit, "id" | "name">[];

  const { reading } = buildRhythm(allLogs, habitList.length, rhythmStart, RHYTHM_WINDOW);

  // Per-weekday adherence (Sun..Sat).
  const weekdayAgg = Array.from({ length: 7 }, () => ({ value: 0, count: 0 }));
  for (const log of allLogs) {
    const dow = dowOf(log.logged_at);
    weekdayAgg[dow].value += activityValue(log.status);
    weekdayAgg[dow].count += 1;
  }
  const weekday: WeekdayRate[] = weekdayAgg.map((w) => ({
    rate: w.count === 0 ? 0 : w.value / w.count,
    count: w.count,
  }));

  // Per-habit adherence.
  const nameOf = new Map(habitList.map((h) => [h.id, h.name]));
  const habitAgg = new Map<string, { value: number; count: number }>();
  for (const log of allLogs) {
    const e = habitAgg.get(log.habit_id) ?? { value: 0, count: 0 };
    e.value += activityValue(log.status);
    e.count += 1;
    habitAgg.set(log.habit_id, e);
  }
  const habitAdherence: HabitAdherence[] = [...habitAgg.entries()]
    .filter(([id]) => nameOf.has(id))
    .map(([id, { value, count }]) => ({
      id,
      name: nameOf.get(id) ?? "Habit",
      rate: count === 0 ? 0 : value / count,
      logs: count,
    }));

  const loggedToday = new Set(
    allLogs.filter((l) => l.logged_at === today).map((l) => l.habit_id)
  );
  const remainingToday = Math.max(habitList.length - loggedToday.size, 0);

  return buildCoachReport({
    reading,
    weekday,
    habits: habitAdherence,
    todayDow: dowOf(today),
    remainingToday,
    seed: today,
  });
}
