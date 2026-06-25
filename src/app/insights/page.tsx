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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="glass-card px-[22px] py-5">
      <div className="flex items-center gap-2">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-cadence-accent-tint text-cadence-accent">
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground-2">{label}</span>
      </div>
      <div className="mt-3.5 flex items-baseline gap-2">
        <span className="text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-foreground">{value}</span>
        {sub && <span className="text-[13px] font-medium text-muted-foreground-2">{sub}</span>}
      </div>
    </div>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground-2">{children}</div>
);

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

  // --- Cadence trend ---
  const historyData = (scoreRows ?? []).map((s) => ({
    date: s.date,
    score: Number(s.discipline_score),
    label: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  const average =
    historyData.length > 0 ? historyData.reduce((sum, p) => sum + p.score, 0) / historyData.length : null;
  const latest = historyData.length > 0 ? historyData[historyData.length - 1].score : null;
  const trendUp = historyData.length > 1 && historyData[historyData.length - 1].score >= historyData[0].score;

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

  const rangeLabel = `${new Date(windowStart + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${new Date(today + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <main className="min-h-dvh p-6 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {/* Header */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Insights</h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">Your last 90 days, at a glance.</p>
            </div>
            <span className="text-[13px] font-medium text-muted-foreground-2">{rangeLabel}</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg cadence" value={average !== null ? average.toFixed(0) : "—"} sub={latest !== null ? `latest ${latest.toFixed(0)}` : "no data yet"} />
          <StatCard icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${currentStreak}`} sub={currentStreak === 1 ? "day" : "days"} />
          <StatCard icon={<Trophy className="h-4 w-4" />} label="Longest streak" value={`${longest}`} sub={longest === 1 ? "day" : "days"} />
          <StatCard icon={<CalendarCheck className="h-4 w-4" />} label="Active days" value={`${totalActive}`} sub="in 90 days" />
        </div>

        {/* Cadence trend */}
        <div className="glass-card px-[26px] py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionLabel>Cadence trend</SectionLabel>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Daily score across 90 days{trendUp ? " · trending up" : ""}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="h-0.5 w-3.5 rounded bg-cadence-accent" />
                Cadence
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="w-3.5 border-t-2 border-dashed border-[#B5AFA3]" />
                90-day avg
              </span>
            </div>
          </div>
          <div className="mt-3">
            <ScoreHistoryChart data={historyData} average={average} />
          </div>
        </div>

        {/* Weekday + categories */}
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="glass-card flex-1 px-[26px] py-6">
            <SectionLabel>When you show up</SectionLabel>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Completion rate by weekday</p>
            <div className="mt-5">
              <WeekdayChart data={weekday} bestDow={best?.dow ?? null} />
            </div>
            <div className="mt-[18px] border-t border-[#EEE9DF] pt-4 text-[13px] leading-relaxed text-muted-foreground">
              {best ? (
                <>
                  Strongest on <span className="font-semibold text-cadence-accent">{best.label}</span>
                  {worst && <> · weakest on {worst.label}</>}
                </>
              ) : (
                "Log a few more days to spot your patterns"
              )}
            </div>
          </div>

          <div className="glass-card flex-1 px-[26px] py-6">
            <SectionLabel>By category</SectionLabel>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Completion across your tracked areas</p>
            <div className="mt-5 flex flex-col gap-[18px]">
              {categories.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No habit logs yet</p>
              ) : (
                categories.map((c) => (
                  <div key={c.category}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm font-medium capitalize text-foreground">{c.category}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold tabular-nums text-foreground">{c.adherencePct}%</span>
                        <span className="text-xs text-muted-foreground-2">{c.logs} logs</span>
                      </span>
                    </div>
                    <div className="h-[9px] overflow-hidden rounded-full bg-[#F1ECE3]">
                      <div className="h-full rounded-full bg-cadence-accent transition-all" style={{ width: `${c.adherencePct}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Year heatmap */}
        <ConsistencyHeatmap />
      </div>
    </main>
  );
}
