import { createClient } from "@/lib/supabase/server";
import { localToday, addDaysStr, dowOf, userTimezone } from "@/lib/date";
import { activityValue } from "@/lib/insights";
import { buildRhythm } from "@/lib/rhythmData";
import { buildCoachReport, type WeekdayRate, type HabitAdherence, type CoachNote } from "@/lib/coach";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";
import type { Habit, HabitLog } from "@/types/database";

const RHYTHM_WINDOW = 28;
const HISTORY = 90;

const TONE_STYLES = {
  good: { wrap: "border-emerald-500/15 bg-emerald-500/[0.06]", text: "text-emerald-200/90", Icon: TrendingUp },
  warn: { wrap: "border-amber-500/15 bg-amber-500/[0.06]", text: "text-amber-200/90", Icon: AlertTriangle },
  info: { wrap: "border-white/10 bg-white/[0.04]", text: "text-muted-foreground", Icon: Lightbulb },
} as const;

function Note({ note }: { note: CoachNote }) {
  const s = TONE_STYLES[note.tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${s.wrap}`}>
      <s.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} />
      <p className={`text-xs leading-relaxed ${s.text}`}>{note.text}</p>
    </div>
  );
}

export async function CoachCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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

  // Rhythm reading (reuses the shared engine; only the 28-day window is read).
  const { reading } = buildRhythm(allLogs, habitList.length, rhythmStart, RHYTHM_WINDOW);

  // Per-weekday adherence (Sun..Sat) across the full history.
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

  // Per-habit adherence across the full history.
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

  const loggedToday = new Set(allLogs.filter((l) => l.logged_at === today).map((l) => l.habit_id));
  const remainingToday = Math.max(habitList.length - loggedToday.size, 0);

  const report = buildCoachReport({
    reading,
    weekday,
    habits: habitAdherence,
    todayDow: dowOf(today),
    remainingToday,
    seed: today,
  });

  const hasNotes = report.insights.length > 0 || report.recommendations.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cadence-accent" />
        <h2 className="text-base font-semibold text-foreground">Coach</h2>
      </div>

      <div className="glass-card flex flex-col gap-4 p-5">
        <p className="text-sm font-medium leading-relaxed text-foreground">{report.headline}</p>

        {report.insights.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">What I&apos;m seeing</p>
            {report.insights.map((n) => (
              <Note key={n.id} note={n} />
            ))}
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">What to do</p>
            {report.recommendations.map((n) => (
              <Note key={n.id} note={n} />
            ))}
          </div>
        )}

        {!hasNotes && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Log a few days and the coach will start spotting your patterns.
          </div>
        )}
      </div>
    </div>
  );
}
