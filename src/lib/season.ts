// ─── Seasons (v2) ───
//
// A Season is a 12-week cycle with a title and theme — a narrative arc over the
// daily grind. Pure date math here; persistence is in supabase/migrations/003.

import { addDaysStr } from "./date";

export const SEASON_LENGTH_WEEKS = 12;
export const SEASON_LENGTH_DAYS = SEASON_LENGTH_WEEKS * 7; // 84

function toUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// Whole days from `a` to `b` (b - a). Negative if b precedes a.
export function dayDiff(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

// Inclusive end date for a 12-week season starting on `startStr`.
export function defaultSeasonEnd(startStr: string): string {
  return addDaysStr(startStr, SEASON_LENGTH_DAYS - 1);
}

export interface SeasonProgress {
  dayNumber: number; // 1-based day within the season (clamped)
  totalDays: number;
  weekNumber: number; // 1..totalWeeks
  totalWeeks: number;
  daysRemaining: number; // 0 once the final day has passed
  percent: number; // 0..100
  isComplete: boolean; // today is past the end date
  hasStarted: boolean; // today is on/after the start date
}

export function seasonProgress(
  startStr: string,
  endStr: string,
  todayStr: string
): SeasonProgress {
  const totalDays = dayDiff(startStr, endStr) + 1; // inclusive
  const totalWeeks = Math.max(Math.round(totalDays / 7), 1);
  const rawElapsed = dayDiff(startStr, todayStr); // 0-based; may be <0 or >=total

  const dayNumber = Math.min(Math.max(rawElapsed + 1, 1), totalDays);
  const weekNumber = Math.min(Math.ceil(dayNumber / 7), totalWeeks);
  const daysRemaining = Math.max(totalDays - dayNumber, 0);
  const percent = Math.round((dayNumber / totalDays) * 1000) / 10;

  return {
    dayNumber,
    totalDays,
    weekNumber,
    totalWeeks,
    daysRemaining,
    percent,
    isComplete: rawElapsed >= totalDays, // strictly after the last day
    hasStarted: rawElapsed >= 0,
  };
}
