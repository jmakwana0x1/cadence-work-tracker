import { createClient } from "@/lib/supabase/server";
import { computeDisciplineScore } from "@/lib/discipline";
import { localToday, localDateStr, addDaysStr, userTimezone } from "@/lib/date";
import { ScoreHero } from "./ScoreHero";
import { ScoreTrend } from "./ScoreTrend";
import type { HabitLog, ScoreComponents } from "@/types/database";

export async function DisciplineScoreCard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tz = userTimezone(user);
  const today = localToday(tz);
  const yesterday = addDaysStr(today, -1);
  const thirtyDaysAgo = addDaysStr(today, -30);

  const [
    { data: habits },
    { data: todayLogs },
    { data: scores },
    { data: dueTasks },
    { data: todayBlocks },
  ] = await Promise.all([
    supabase.from("habits").select("id").eq("user_id", user.id),
    supabase.from("habit_logs").select("*").eq("user_id", user.id).eq("logged_at", today),
    supabase
      .from("daily_scores")
      .select("date, discipline_score, components")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo)
      .order("date"),
    // Only tasks due today (in the user's timezone) drive the live score —
    // mirrors upsertDailyScore so the live and persisted numbers agree.
    supabase
      .from("tasks")
      .select("due_at, completed_at")
      .eq("user_id", user.id)
      .not("due_at", "is", null),
    supabase
      .from("time_blocks")
      .select("actual_status")
      .eq("user_id", user.id)
      .eq("date", today),
  ]);

  const dueToday = (dueTasks ?? []).filter(
    (t) => t.due_at && localDateStr(new Date(t.due_at), tz) === today
  );
  const tasksTotal = dueToday.length;
  const tasksCompleted = dueToday.filter((t) => t.completed_at !== null).length;
  const blocksTotal = todayBlocks?.length ?? 0;
  const blocksHit =
    todayBlocks?.reduce((sum, b) => {
      if (b.actual_status === "hit") return sum + 1;
      if (b.actual_status === "partial") return sum + 0.5;
      return sum;
    }, 0) ?? 0;

  const { score: liveScore, components: liveComponents } = computeDisciplineScore({
    habits: habits ?? [],
    habitLogs: (todayLogs ?? []) as HabitLog[],
    tasksTotal,
    tasksCompleted,
    blocksTotal,
    blocksHit,
  });

  const yesterdayRow = scores?.find((s) => s.date === yesterday);
  const yesterdayScore = yesterdayRow?.discipline_score ?? null;

  const historicalDates = new Set(scores?.map((s) => s.date) ?? []);
  const trendData = [
    ...(scores?.map((s) => ({
      date: s.date,
      score: Number(s.discipline_score),
      label: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    })) ?? []),
    ...(!historicalDates.has(today) && liveScore > 0
      ? [{ date: today, score: liveScore, label: "Today" }]
      : []),
  ];

  const displayComponents: ScoreComponents =
    (scores?.find((s) => s.date === today)?.components as ScoreComponents) ?? liveComponents;

  return (
    <div className="flex flex-col gap-3">
      <ScoreHero score={liveScore} yesterday={yesterdayScore} components={displayComponents} />
      <ScoreTrend data={trendData} />
    </div>
  );
}
