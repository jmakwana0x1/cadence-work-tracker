import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { HabitList } from "@/components/habits/HabitList";
import { WeeklyConsistency } from "@/components/heatmap/WeeklyConsistency";
import { RhythmCard } from "@/components/rhythm/RhythmCard";
import { CoachCard } from "@/components/coach/CoachCard";
import { CommandPalette, CommandButton } from "@/components/command/CommandPalette";
import { SeasonCard } from "@/components/season/SeasonCard";
import { PushToggle } from "@/components/pwa/PushToggle";
import { TelegramConnect } from "@/components/notify/TelegramConnect";
import { TaskList } from "@/components/tasks/TaskList";
import { PlannerLoader } from "@/components/planner/PlannerLoader";
import { CalendarLoader } from "@/components/calendar/CalendarLoader";
import { TimezoneSync } from "@/components/TimezoneSync";

function HeatmapSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-5 w-32 bg-white/5 rounded animate-pulse" />
      <div className="glass-card p-5 h-36 animate-pulse" />
    </div>
  );
}

function HabitSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
        <div className="h-9 w-28 bg-white/5 rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-4 h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

interface DashboardPageProps {
  searchParams: Promise<{ calendar_connected?: string; calendar_error?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const calendarError = params.calendar_error;

  if (params.calendar_connected) {
    // Show toast on next render via URL — handled client-side in CalendarSync
  }

  const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? null;

  return (
    <main className="min-h-dvh p-6 md:p-8">
      <TimezoneSync current={user.user_metadata?.timezone ?? null} />
      <CommandPalette />
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {firstName ? `Hey, ${firstName}.` : "Welcome back."}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TelegramConnect />
            <PushToggle />
            <CommandButton />
            <Link
              href="/insights"
              className="inline-flex items-center gap-1.5 rounded-xl border border-cadence-accent bg-cadence-accent px-3.5 py-2 text-sm font-medium text-white transition-[filter] hover:brightness-105"
            >
              <BarChart3 className="h-4 w-4" />
              Insights
            </Link>
          </div>
        </div>

        {/* Season (v2) */}
        <Suspense fallback={<div className="glass-card p-5 h-24 animate-pulse" />}>
          <SeasonCard />
        </Suspense>

        {/* The Pulse — the single hero (v2 Rhythm Engine) */}
        <Suspense fallback={<div className="glass-card p-6 h-52 animate-pulse" />}>
          <RhythmCard />
        </Suspense>

        {/* Coach (v2, deterministic) */}
        <Suspense fallback={<div className="glass-card p-5 h-40 animate-pulse" />}>
          <CoachCard />
        </Suspense>

        {/* Weekly consistency — demoted to a detail strip under the hero */}
        <Suspense fallback={<HeatmapSkeleton />}>
          <WeeklyConsistency />
        </Suspense>

        {/* Habits + Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<HabitSkeleton />}>
            <HabitList />
          </Suspense>
          <Suspense fallback={<div className="glass-card p-4 h-48 animate-pulse" />}>
            <TaskList />
          </Suspense>
        </div>

        {/* Day Planner */}
        <Suspense fallback={<div className="glass-card p-4 h-64 animate-pulse" />}>
          <PlannerLoader />
        </Suspense>

        {/* Google Calendar */}
        <Suspense fallback={<div className="glass-card p-4 h-24 animate-pulse" />}>
          <CalendarLoader calendarError={calendarError} />
        </Suspense>

      </div>
    </main>
  );
}
