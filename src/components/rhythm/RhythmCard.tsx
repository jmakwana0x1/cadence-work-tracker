import { createClient } from "@/lib/supabase/server";
import { localToday, addDaysStr, userTimezone } from "@/lib/date";
import { buildRhythm } from "@/lib/rhythmData";
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

  const { days, reading } = buildRhythm(logs ?? [], habits?.length ?? 0, startDate, WINDOW);

  const pulseDays: PulseDay[] = days.map((d) => ({
    date: d.date,
    completion: d.completion,
    cadence: d.cadence,
  }));

  return <RhythmHero reading={reading} days={pulseDays} />;
}
