import { createClient } from "@/lib/supabase/server";
import { localToday, userTimezone } from "@/lib/date";
import { seasonProgress } from "@/lib/season";
import { StartSeasonDialog } from "./StartSeasonDialog";
import { Flag, CalendarCheck } from "lucide-react";
import type { Season } from "@/types/database";

export async function SeasonCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("user_id", user.id)
    .order("started_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Table not migrated yet (or any read error): stay invisible rather than break
  // the dashboard. Run supabase/migrations/003_seasons.sql to enable Seasons.
  if (error) return null;

  const season = data as Season | null;
  const today = localToday(userTimezone(user));

  if (!season) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-6 text-center">
        <Flag className="h-6 w-6 text-cadence-accent" />
        <div>
          <p className="text-sm font-medium text-foreground">No season yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            Frame the next 12 weeks as a chapter with a name and a theme — it turns daily reps into a story.
          </p>
        </div>
        <StartSeasonDialog />
      </div>
    );
  }

  const p = seasonProgress(season.started_on, season.ends_on, today);

  return (
    <div className="glass-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Flag className="h-3 w-3 text-cadence-accent" />
            {p.isComplete ? "Season complete" : `Week ${p.weekNumber} of ${p.totalWeeks}`}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{season.title}</h2>
          {season.theme && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{season.theme}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums text-cadence-accent">{p.percent}%</p>
          <p className="text-[10px] text-muted-foreground">
            {p.isComplete ? "done" : `${p.daysRemaining} days left`}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-cadence-accent transition-[width] duration-700"
          style={{ width: `${p.percent}%` }}
        />
      </div>

      {p.isComplete && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-xs text-emerald-200/90">
            <CalendarCheck className="h-4 w-4" />
            12 weeks done. Name the next chapter.
          </span>
          <StartSeasonDialog variant="subtle" />
        </div>
      )}
    </div>
  );
}
