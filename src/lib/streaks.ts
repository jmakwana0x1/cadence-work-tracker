import type { HabitLog } from "@/types/database";

// Returns streak length for a habit given its logs.
// Rules:
//   - If today is logged done/partial → count back from today
//   - If today is NOT logged → count back from yesterday (streak still alive until EOD)
//   - skip logs do NOT break a streak (a freeze token may have been used, or we skip counting them)
//   - A day with no log at all breaks the streak
export function computeStreak(habitId: string, logs: HabitLog[]): number {
  const doneDays = new Set(
    logs
      .filter((l) => l.habit_id === habitId && l.status !== "skip")
      .map((l) => l.logged_at)
  );

  const today = new Date();
  const todayStr = toDateStr(today);
  const todayLogged = doneDays.has(todayStr);

  let streak = 0;
  // Start from today if logged, else from yesterday
  const startOffset = todayLogged ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = toDateStr(d);
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
  logs: HabitLog[]
): string | null {
  const today = new Date();
  const todayStr = toDateStr(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);

  const dayBefore = new Date(today);
  dayBefore.setDate(today.getDate() - 2);
  const dayBeforeStr = toDateStr(dayBefore);

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

export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function flameLevel(streak: number): 0 | 1 | 2 | 3 | 4 {
  if (streak === 0) return 0;
  if (streak < 4) return 1;
  if (streak < 7) return 2;
  if (streak < 14) return 3;
  return 4;
}
