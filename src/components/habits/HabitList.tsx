import { createClient } from "@/lib/supabase/server";
import { HabitCard } from "./HabitCard";
import { CreateHabitDialog } from "./CreateHabitDialog";
import { computeStreak, getMissedDayToFreeze } from "@/lib/streaks";
import { localToday, addDaysStr, userTimezone } from "@/lib/date";
import type { Habit, HabitLog, HabitWithTodayLog } from "@/types/database";

export async function HabitList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tz = userTimezone(user);
  const today = localToday(tz);
  const ninetyDaysAgo = addDaysStr(today, -90);

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).order("created_at"),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", ninetyDaysAgo),
  ]);

  if (!habits || habits.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Habits</h2>
          <CreateHabitDialog />
        </div>
        <div className="glass-card p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-2xl">🌱</p>
          <p className="text-sm font-medium text-foreground">No habits yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add your first habit and start showing up as the person you&apos;re becoming.
          </p>
        </div>
      </div>
    );
  }

  const allLogs = (logs ?? []) as HabitLog[];
  const todayLogMap = new Map(
    allLogs.filter((l) => l.logged_at === today).map((l) => [l.habit_id, l])
  );

  const habitsWithLogs: HabitWithTodayLog[] = (habits as Habit[]).map((h) => ({
    ...h,
    today_log: todayLogMap.get(h.id) ?? null,
  }));

  const streaks = habitsWithLogs.map((h) => computeStreak(h.id, allLogs, today));
  const missedDays = habitsWithLogs.map((h) => getMissedDayToFreeze(h.id, allLogs, today));

  const doneCount = allLogs.filter((l) => l.logged_at === today && l.status === "done").length;
  const partialCount = allLogs.filter((l) => l.logged_at === today && l.status === "partial").length;

  // Streaks the user still has time to save today: a live streak (≥2 days)
  // on a habit that hasn't been logged yet. This is the core daily nudge.
  const atRisk = habitsWithLogs
    .map((h, i) => ({ name: h.name, streak: streaks[i], logged: h.today_log !== null }))
    .filter((h) => h.streak >= 2 && !h.logged)
    .sort((a, b) => b.streak - a.streak);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Habits</h2>
          <p className="text-xs text-muted-foreground">
            {doneCount + partialCount} / {habits.length} logged today
          </p>
        </div>
        <CreateHabitDialog />
      </div>

      {atRisk.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-2.5">
          <span className="text-base leading-none mt-0.5">🔥</span>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {atRisk.length === 1 ? (
              <>
                Your <span className="font-semibold">{atRisk[0].streak}-day</span>{" "}
                <span className="font-medium">{atRisk[0].name}</span> streak is still
                unlogged today — don&apos;t let it slip.
              </>
            ) : (
              <>
                <span className="font-semibold">{atRisk.length} streaks</span> are still
                unlogged today
                {atRisk[0].streak >= 7 && (
                  <> — including {atRisk[0].streak} days of {atRisk[0].name}</>
                )}
                . Keep them alive.
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {habitsWithLogs.map((habit, i) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            streak={streaks[i]}
            missedDayToFreeze={missedDays[i]}
          />
        ))}
      </div>
    </div>
  );
}
