import { createClient } from "@/lib/supabase/server";
import { localToday, addDaysStr, dowOf, userTimezone } from "@/lib/date";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function WeeklyConsistency() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Build last 7 days ending today (in the user's timezone)
  const todayStr = localToday(userTimezone(user));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysStr(todayStr, -(6 - i));
    return { date, dow: dowOf(date) };
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

  const activeDays = days.filter((d) => activityMap.has(d.date) && d.date <= todayStr).length;

  // Streak: consecutive days ending today with activity
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].date > todayStr) continue;
    if (activityMap.has(days[i].date)) streak++;
    else break;
  }

  // Warm intensity tints (Claude palette): none → low → mid → high(clay).
  const TINTS = ["#F1ECE3", "#EDD8C8", "#DCAF92", "#C15F3C"] as const;

  return (
    <div className="glass-card px-[26px] py-[22px]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground-2">
          Weekly consistency
        </span>
        <span className="text-[13px] font-medium text-muted-foreground">
          {activeDays} of 7 days active
          {streak > 1 && ` · ${streak}-day streak`}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        {days.map(({ date, dow }) => {
          const activity = activityMap.get(date) ?? 0;
          const isFuture = date > todayStr;
          const isToday = date === todayStr;
          const pct = totalHabits > 0 ? activity / totalHabits : 0;

          const bucket = isFuture || pct === 0 ? 0 : pct < 0.4 ? 1 : pct < 0.75 ? 2 : 3;

          return (
            <div key={date} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="h-[46px] w-full rounded-[13px]"
                style={{
                  background: TINTS[bucket],
                  border: bucket === 0 ? "1px solid #EAE4D8" : undefined,
                  boxShadow: isToday ? "0 0 0 2px #FFFFFF, 0 0 0 4px #C15F3C" : undefined,
                }}
              />
              <span
                className="text-[11px]"
                style={{ fontWeight: isToday ? 600 : 500, color: isToday ? "#2B2926" : "#9A958B" }}
              >
                {DAY_LABELS[dow]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
