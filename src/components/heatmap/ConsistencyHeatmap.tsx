import { createClient } from "@/lib/supabase/server";
import { HeatmapGrid } from "./HeatmapGrid";

// Build a 52-week × 7-day grid ending today
function buildGrid(today: Date) {
  const days: { date: string; dow: number }[] = [];
  // Start from the Sunday 52 weeks ago
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  // Rewind to the previous Sunday
  start.setDate(start.getDate() - start.getDay());

  for (let i = 0; i < 371; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > today) break;
    days.push({
      date: d.toISOString().split("T")[0],
      dow: d.getDay(),
    });
  }
  return days;
}

export async function ConsistencyHeatmap() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const grid = buildGrid(today);
  const startDate = grid[0].date;

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("logged_at, status")
    .eq("user_id", user.id)
    .gte("logged_at", startDate);

  // Count done/partial per day (skip doesn't count as activity)
  const activityMap = new Map<string, number>();
  for (const log of logs ?? []) {
    if (log.status === "skip") continue;
    const prev = activityMap.get(log.logged_at) ?? 0;
    activityMap.set(log.logged_at, prev + (log.status === "done" ? 1 : 0.5));
  }

  // Find max activity for intensity scaling
  const maxActivity = Math.max(1, ...activityMap.values());

  const cells = grid.map(({ date }) => ({
    date,
    activity: activityMap.get(date) ?? 0,
    intensity: Math.min(4, Math.ceil(((activityMap.get(date) ?? 0) / maxActivity) * 4)) as 0 | 1 | 2 | 3 | 4,
  }));

  const totalActive = cells.filter((c) => c.activity > 0).length;
  const currentStreakDays = (() => {
    let streak = 0;
    const reversed = [...cells].reverse();
    for (const cell of reversed) {
      if (cell.activity > 0) streak++;
      else if (streak > 0) break;
    }
    return streak;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Consistency</h2>
          <p className="text-xs text-muted-foreground">
            {totalActive} active {totalActive === 1 ? "day" : "days"} in the last year
            {currentStreakDays > 0 && ` · ${currentStreakDays}-day streak`}
          </p>
        </div>
      </div>
      <HeatmapGrid cells={cells} today={today.toISOString().split("T")[0]} />
    </div>
  );
}
