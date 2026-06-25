import { createClient } from "@/lib/supabase/server";
import { localToday, addDaysStr, userTimezone } from "@/lib/date";
import { cadenceSeries, computeRhythm } from "@/lib/rhythm";
import { RhythmHero } from "./RhythmHero";
import type { PulseDay } from "./Pulse";

const WINDOW = 28; // days of history the Rhythm Engine reads

export async function RhythmCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const tz = userTimezone(user);
  const today = localToday(tz);
  const startDate = addDaysStr(today, -(WINDOW - 1));

  const [{ data: logs }, { data: habits }] = await Promise.all([
    supabase
      .from("habit_logs")
      .select("logged_at, status")
      .eq("user_id", user.id)
      .gte("logged_at", startDate),
    supabase.from("habits").select("id").eq("user_id", user.id),
  ]);

  const habitCount = Math.max(habits?.length ?? 0, 1);

  // Per-day completion (0..1) and attempt volume (engagement count).
  type Day = { date: string; completion: number; attempts: number };
  const dayMap = new Map<string, { value: number; attempts: number }>();
  for (const log of logs ?? []) {
    const entry = dayMap.get(log.logged_at) ?? { value: 0, attempts: 0 };
    if (log.status === "done") entry.value += 1;
    else if (log.status === "partial") entry.value += 0.5;
    entry.attempts += 1; // any log = you engaged that day
    dayMap.set(log.logged_at, entry);
  }

  const allDays: Day[] = Array.from({ length: WINDOW }, (_, i) => {
    const date = addDaysStr(startDate, i);
    const e = dayMap.get(date);
    return {
      date,
      completion: e ? Math.min(e.value / habitCount, 1) : 0,
      attempts: e?.attempts ?? 0,
    };
  });

  // Trim leading days before the user's first-ever activity so a fresh account
  // doesn't get punished for days it didn't exist.
  const firstActive = allDays.findIndex((d) => d.attempts > 0);
  const days = firstActive === -1 ? allDays.slice(-7) : allDays.slice(firstActive);

  const completions = days.map((d) => d.completion);
  const attempts = days.map((d) => d.attempts);
  const reading = computeRhythm(completions, attempts);

  const cadences = cadenceSeries(completions);
  const pulseDays: PulseDay[] = days.map((d, i) => ({
    date: d.date,
    completion: d.completion,
    cadence: cadences[i] ?? 0,
  }));

  return <RhythmHero reading={reading} days={pulseDays} />;
}
