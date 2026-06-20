import { createClient } from "@/lib/supabase/server";
import { computeDisciplineScore } from "@/lib/discipline";
import { toDateStr } from "@/lib/streaks";
import { ScoreHero } from "./ScoreHero";
import { ScoreTrend } from "./ScoreTrend";
import type { HabitLog, ScoreComponents } from "@/types/database";

export async function DisciplineScoreCard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  const thirtyDaysAgo = toDateStr(new Date(Date.now() - 30 * 86400000));

  const [
    { data: habits },
    { data: todayLogs },
    { data: scores },
    { data: todayTasks },
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
    // All tasks — completion rate across entire backlog drives the score
    supabase
      .from("tasks")
      .select("completed_at")
      .eq("user_id", user.id),
    supabase
      .from("time_blocks")
      .select("actual_status")
      .eq("user_id", user.id)
      .eq("date", today),
  ]);

  const tasksTotal = todayTasks?.length ?? 0;
  const tasksCompleted = todayTasks?.filter((t) => t.completed_at !== null).length ?? 0;
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
