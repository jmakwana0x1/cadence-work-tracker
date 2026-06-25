// Shared bridge between raw habit_logs and the pure Rhythm Engine (rhythm.ts).
// Used by both the dashboard hero (RhythmCard) and the Coach (CoachCard) so the
// windowing logic lives in exactly one place.

import { addDaysStr } from "./date";
import { cadenceSeries, computeRhythm, type RhythmReading } from "./rhythm";

export interface RhythmDay {
  date: string;
  completion: number; // 0..1 raw activity that day
  attempts: number; // engagement volume that day
  cadence: number; // 0..100 momentum at that day
}

export interface RhythmResult {
  days: RhythmDay[];
  reading: RhythmReading;
}

type MinimalLog = { logged_at: string; status: string };

// Turn a window of logs into per-day series + a current reading. Leading days
// before the user's first-ever activity are trimmed so a fresh account isn't
// punished for days it didn't exist.
export function buildRhythm(
  logs: MinimalLog[],
  habitCount: number,
  startDate: string,
  windowDays: number
): RhythmResult {
  const denom = Math.max(habitCount, 1);

  const dayMap = new Map<string, { value: number; attempts: number }>();
  for (const log of logs) {
    const entry = dayMap.get(log.logged_at) ?? { value: 0, attempts: 0 };
    if (log.status === "done") entry.value += 1;
    else if (log.status === "partial") entry.value += 0.5;
    entry.attempts += 1; // any log = you engaged that day
    dayMap.set(log.logged_at, entry);
  }

  const all = Array.from({ length: windowDays }, (_, i) => {
    const date = addDaysStr(startDate, i);
    const e = dayMap.get(date);
    return {
      date,
      completion: e ? Math.min(e.value / denom, 1) : 0,
      attempts: e?.attempts ?? 0,
    };
  });

  const firstActive = all.findIndex((d) => d.attempts > 0);
  const trimmed = firstActive === -1 ? all.slice(-7) : all.slice(firstActive);

  const completions = trimmed.map((d) => d.completion);
  const attempts = trimmed.map((d) => d.attempts);
  const reading = computeRhythm(completions, attempts);
  const cadences = cadenceSeries(completions);

  const days: RhythmDay[] = trimmed.map((d, i) => ({
    date: d.date,
    completion: d.completion,
    attempts: d.attempts,
    cadence: cadences[i] ?? 0,
  }));

  return { days, reading };
}
