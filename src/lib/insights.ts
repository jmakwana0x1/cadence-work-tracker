import type { HabitLog } from "@/types/database";
import { dowOf } from "./date";

// Activity weight of a log: a full day counts 1, a partial counts a half,
// a skip counts nothing. Mirrors the heatmap / discipline-score convention.
export function activityValue(status: HabitLog["status"]): number {
  return status === "done" ? 1 : status === "partial" ? 0.5 : 0;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeekdayStat {
  dow: number;
  label: string;
  value: number; // total activity logged on that weekday
  count: number; // number of non-skip logs
}

// Total activity grouped by day of week. Answers "which days do I show up?".
export function weekdayBreakdown(logs: HabitLog[]): WeekdayStat[] {
  const stats: WeekdayStat[] = DAY_LABELS.map((label, dow) => ({
    dow,
    label,
    value: 0,
    count: 0,
  }));
  for (const log of logs) {
    const v = activityValue(log.status);
    if (v === 0) continue;
    const dow = dowOf(log.logged_at);
    stats[dow].value += v;
    stats[dow].count += 1;
  }
  return stats;
}

// The most- and least-active weekdays (ignoring days with no activity at all
// for "worst", so a brand-new user doesn't get told Tuesday is their weakness).
export function bestWorstWeekday(stats: WeekdayStat[]): {
  best: WeekdayStat | null;
  worst: WeekdayStat | null;
} {
  const active = stats.filter((s) => s.value > 0);
  if (active.length === 0) return { best: null, worst: null };
  const best = active.reduce((a, b) => (b.value > a.value ? b : a));
  const worst = active.reduce((a, b) => (b.value < a.value ? b : a));
  return { best, worst: active.length > 1 ? worst : null };
}

export interface CategoryStat {
  category: string;
  adherencePct: number; // (done + 0.5*partial) / totalLogs, as 0..100
  logs: number;
}

// Per-category adherence: of the times you engaged with this category, how
// solidly did you hit it? Sorted strongest first.
export function categoryBreakdown(
  logs: HabitLog[],
  categoryOf: Map<string, string>
): CategoryStat[] {
  const acc = new Map<string, { value: number; total: number }>();
  for (const log of logs) {
    const category = categoryOf.get(log.habit_id) ?? "general";
    const entry = acc.get(category) ?? { value: 0, total: 0 };
    entry.value += activityValue(log.status);
    entry.total += 1;
    acc.set(category, entry);
  }
  return [...acc.entries()]
    .map(([category, { value, total }]) => ({
      category,
      adherencePct: total === 0 ? 0 : Math.round((value / total) * 100),
      logs: total,
    }))
    .sort((a, b) => b.adherencePct - a.adherencePct);
}

// Longest run of consecutive active days within a set of active date strings.
export function longestStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0;
  const sorted = [...activeDates].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00Z").getTime();
    const cur = new Date(sorted[i] + "T00:00:00Z").getTime();
    if (cur - prev === 86400000) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}
