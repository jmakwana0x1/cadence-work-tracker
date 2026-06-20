import { createClient } from "@/lib/supabase/server";
import { HabitCard } from "./HabitCard";
import { CreateHabitDialog } from "./CreateHabitDialog";
import { computeStreak, getMissedDayToFreeze } from "@/lib/streaks";
import type { Habit, HabitLog, HabitWithTodayLog } from "@/types/database";

export async function HabitList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).order("created_at"),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", ninetyDaysAgo.toISOString().split("T")[0]),
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

  const streaks = habitsWithLogs.map((h) => computeStreak(h.id, allLogs));
  const missedDays = habitsWithLogs.map((h) => getMissedDayToFreeze(h.id, allLogs));

  const doneCount = allLogs.filter((l) => l.logged_at === today && l.status === "done").length;
  const partialCount = allLogs.filter((l) => l.logged_at === today && l.status === "partial").length;

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
