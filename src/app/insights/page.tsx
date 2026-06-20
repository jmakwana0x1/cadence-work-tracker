import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, CalendarCheck, TrendingUp, Trophy } from "lucide-react";
import { localToday, addDaysStr, userTimezone } from "@/lib/date";
import {
  weekdayBreakdown,
  bestWorstWeekday,
  categoryBreakdown,
  longestStreak,
  activityValue,
} from "@/lib/insights";
import { scoreColor } from "@/lib/discipline";
import { ScoreHistoryChart } from "@/components/insights/ScoreHistoryChart";
import { WeekdayChart } from "@/components/insights/WeekdayChart";
import { ConsistencyHeatmap } from "@/components/heatmap/ConsistencyHeatmap";
import type { Habit, HabitLog } from "@/types/database";

export const metadata = {
  title: "Insights — Cadence",
};

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="glass-card card-lift p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${valueClass ?? "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const tz = userTimezone(user);
  const today = localToday(tz);
  const windowStart = addDaysStr(today, -90);

  const [{ data: habitRows }, { data: logRows }, { data: scoreRows }] = await Promise.all([
    supabase.from("habits").select("id, category").eq("user_id", user.id),
    supabase
      .from("habit_logs")
      .select("habit_id, logged_at, status")
      .eq("user_id", user.id)
      .gte("logged_at", windowStart),
    supabase
      .from("daily_scores")
      .select("date, discipline_score")
      .eq("user_id", user.id)
      .gte("date", windowStart)
      .order("date"),
  ]);

  const habits = (habitRows ?? []) as Pick<Habit, "id" | "category">[];
  const logs = (logRows ?? []) as HabitLog[];
  const categoryOf = new Map(habits.map((h) => [h.id, h.category]));

  // --- Score history ---
  const historyData = (scoreRows ?? []).map((s) => ({
    date: s.date,
    score: Number(s.discipline_score),
    label: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));
  const average =
    historyData.length > 0
      ? historyData.reduce((sum, p) => sum + p.score, 0) / historyData.length
      : null;
  const latest = historyData.length > 0 ? historyData[historyData.length - 1].score : null;

  // --- Weekday + category ---
  const weekday = weekdayBreakdown(logs);
  const { best, worst } = bestWorstWeekday(weekday);
  const categories = categoryBreakdown(logs, categoryOf);

  // --- Streaks / active days ---
  const activeDates = new Set(logs.filter((l) => activityValue(l.status) > 0).map((l) => l.logged_at));
  const totalActive = activeDates.size;
  const longest = longestStreak(activeDates);
  const currentStreak = (() => {
    let streak = 0;
    let cursor = activeDates.has(today) ? today : addDaysStr(today, -1);
    while (activeDates.has(cursor)) {
      streak += 1;
      cursor = addDaysStr(cursor, -1);
    }
    return streak;
  })();

  return (
    <main className="min-h-dvh p-6 md:p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Insights</h1>
            <p className="text-muted-foreground mt-1 text-sm">Your last 90 days, at a glance.</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Avg score"
            value={average !== null ? average.toFixed(0) : "—"}
            sub={latest !== null ? `latest ${latest.toFixed(0)}` : "no data yet"}
            valueClass={average !== null ? scoreColor(average) : undefined}
          />
          <StatCard
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Current streak"
            value={`${currentStreak}`}
            sub={currentStreak === 1 ? "day" : "days"}
          />
          <StatCard
            icon={<Trophy className="h-3.5 w-3.5" />}
            label="Longest streak"
            value={`${longest}`}
            sub={longest === 1 ? "day" : "days"}
          />
          <StatCard
            icon={<CalendarCheck className="h-3.5 w-3.5" />}
            label="Active days"
            value={`${totalActive}`}
            sub="in 90 days"
          />
        </div>

        {/* Score history */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-foreground">Discipline trend</h2>
          <div className="glass-card p-5">
            <ScoreHistoryChart data={historyData} average={average} />
          </div>
        </section>

        {/* Weekday + categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">When you show up</h2>
              <p className="text-xs text-muted-foreground">
                {best ? (
                  <>
                    Strongest on <span className="text-foreground font-medium">{best.label}</span>
                    {worst && (
                      <>
                        {" "}· weakest on{" "}
                        <span className="text-foreground font-medium">{worst.label}</span>
                      </>
                    )}
                  </>
                ) : (
                  "Log a few more days to spot your patterns"
                )}
              </p>
            </div>
            <div className="glass-card p-5">
              <WeekdayChart data={weekday} bestDow={best?.dow ?? null} />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">By category</h2>
              <p className="text-xs text-muted-foreground">How solidly you hit each area</p>
            </div>
            <div className="glass-card p-5 flex flex-col gap-3.5">
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No habit logs yet</p>
              ) : (
                categories.map((c) => (
                  <div key={c.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground font-medium">{c.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.adherencePct}% · {c.logs} logs
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cadence-accent transition-all"
                        style={{ width: `${c.adherencePct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Year heatmap */}
        <section className="flex flex-col gap-4">
          <ConsistencyHeatmap />
        </section>
      </div>
    </main>
  );
}
