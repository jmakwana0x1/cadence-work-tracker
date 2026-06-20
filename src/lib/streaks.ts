import type { HabitLog } from "@/types/database";
import { addDaysStr, localToday } from "@/lib/date";

// Returns streak length for a habit given its logs.
// Rules:
//   - If today is logged done/partial → count back from today
//   - If today is NOT logged → count back from yesterday (streak still alive until EOD)
//   - skip logs do NOT break a streak (a freeze token may have been used, or we skip counting them)
//   - A day with no log at all breaks the streak
//
// `todayStr` is the user's local "today" (YYYY-MM-DD). It is passed in so the
// calculation matches the timezone the logs were recorded in.
export function computeStreak(
  habitId: string,
  logs: HabitLog[],
  todayStr: string = localToday()
): number {
  const doneDays = new Set(
    logs
      .filter((l) => l.habit_id === habitId && l.status !== "skip")
      .map((l) => l.logged_at)
  );

  const todayLogged = doneDays.has(todayStr);

  let streak = 0;
  // Start from today if logged, else from yesterday
  const startOffset = todayLogged ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const ds = addDaysStr(todayStr, -i);
    if (doneDays.has(ds)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// Milestones at which we award a freeze token
const FREEZE_MILESTONES = new Set([7, 14, 21, 30, 60, 90, 180, 365]);

export function shouldAwardFreezeToken(streak: number): boolean {
  return FREEZE_MILESTONES.has(streak);
}

// The missed day eligible for a freeze: yesterday, if it has no log
// and the day before yesterday was active (i.e. there was a streak to protect)
export function getMissedDayToFreeze(
  habitId: string,
  logs: HabitLog[],
  todayStr: string = localToday()
): string | null {
  const yesterdayStr = addDaysStr(todayStr, -1);
  const dayBeforeStr = addDaysStr(todayStr, -2);

  const logMap = new Map(
    logs.filter((l) => l.habit_id === habitId).map((l) => [l.logged_at, l.status])
  );

  // Only offer freeze if:
  // - today hasn't been logged (still deciding)
  // - yesterday wasn't logged (the gap)
  // - day before yesterday was done/partial (there was a streak)
  const todayLogged = logMap.has(todayStr);
  const yesterdayLogged = logMap.has(yesterdayStr);
  const dayBeforeActive =
    logMap.get(dayBeforeStr) === "done" || logMap.get(dayBeforeStr) === "partial";

  if (!todayLogged && !yesterdayLogged && dayBeforeActive) {
    return yesterdayStr;
  }

  return null;
}

// Backwards-compatible alias. Prefer importing from "@/lib/date".
export { localDateStr as toDateStr } from "@/lib/date";

export function flameLevel(streak: number): 0 | 1 | 2 | 3 | 4 {
  if (streak === 0) return 0;
  if (streak < 4) return 1;
  if (streak < 7) return 2;
  if (streak < 14) return 3;
  return 4;
}
