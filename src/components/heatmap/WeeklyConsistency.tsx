import { createClient } from "@/lib/supabase/server";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocal(date: Date) {
  return date.toISOString().split("T")[0];
}

export async function WeeklyConsistency() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Build last 7 days ending today
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: toLocal(d), dow: d.getDay(), dayNum: d.getDate(), month: d.getMonth() };
  });

  const startDate = days[0].date;

  const [{ data: logs }, { data: habits }] = await Promise.all([
    supabase
      .from("habit_logs")
      .select("logged_at, status, habit_id")
      .eq("user_id", user.id)
      .gte("logged_at", startDate),
    supabase
      .from("habits")
      .select("id")
      .eq("user_id", user.id),
  ]);

  const totalHabits = habits?.length ?? 0;

  // Per-day: count done (1.0) + partial (0.5), ignore skip
  const activityMap = new Map<string, number>();
  for (const log of logs ?? []) {
    if (log.status === "skip") continue;
    const prev = activityMap.get(log.logged_at) ?? 0;
    activityMap.set(log.logged_at, prev + (log.status === "done" ? 1 : 0.5));
  }

  const todayStr = toLocal(today);
  const activeDays = days.filter((d) => activityMap.has(d.date) && d.date <= todayStr).length;

  // Streak: consecutive days ending today with activity
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].date > todayStr) continue;
    if (activityMap.has(days[i].date)) streak++;
    else break;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Weekly Consistency</h2>
          <p className="text-xs text-muted-foreground">
            {activeDays}/7 days active this week
            {streak > 1 && ` · ${streak}-day streak 🔥`}
          </p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map(({ date, dow, dayNum, month }) => {
            const activity = activityMap.get(date) ?? 0;
            const isFuture = date > todayStr;
            const isToday  = date === todayStr;
            const pct      = totalHabits > 0 ? activity / totalHabits : 0;

            // Intensity bucket
            const intensity =
              isFuture ? "future" :
              pct === 0 ? "none" :
              pct < 0.4 ? "low" :
              pct < 0.75 ? "mid" : "high";

            const bgStyle: Record<string, string> = {
              future: "bg-white/[0.03] border-white/[0.05]",
              none:   "bg-white/[0.05] border-white/[0.08]",
              low:    "bg-violet-500/20 border-violet-500/25",
              mid:    "bg-violet-500/45 border-violet-500/50",
              high:   "bg-violet-500/80 border-violet-500",
            };

            const textStyle: Record<string, string> = {
              future: "text-muted-foreground/30",
              none:   "text-muted-foreground/50",
              low:    "text-violet-300",
              mid:    "text-violet-200",
              high:   "text-white",
            };

            return (
              <div
                key={date}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition-all ${bgStyle[intensity]} ${
                  isToday ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-background" : ""
                }`}
              >
                <span className={`text-[10px] font-medium uppercase tracking-wide select-none ${
                  isToday ? "text-violet-300" : "text-muted-foreground/60"
                }`}>
                  {DAY_LABELS[dow]}
                </span>

                <span className={`text-lg font-bold tabular-nums leading-none ${textStyle[intensity]}`}>
                  {dayNum}
                </span>

                {/* Habit dot indicators */}
                <div className="flex items-center gap-0.5 h-2">
                  {isFuture ? null : totalHabits === 0 ? null : (
                    Array.from({ length: Math.min(totalHabits, 5) }).map((_, i) => {
                      const filled = i < activity;
                      return (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            filled ? "bg-violet-400" : "bg-white/10"
                          }`}
                        />
                      );
                    })
                  )}
                </div>

                {/* Activity label */}
                {!isFuture && activity > 0 && (
                  <span className={`text-[9px] select-none ${textStyle[intensity]}`}>
                    {activity}/{totalHabits}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
