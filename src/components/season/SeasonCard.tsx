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

  if (p.isComplete) {
    return (
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-5 py-3.5">
        <span className="flex items-center gap-2 text-sm text-foreground">
          <CalendarCheck className="h-4 w-4 text-cadence-accent" />
          <span className="font-semibold">{season.title}</span> — 12 weeks done. Name the next chapter.
        </span>
        <StartSeasonDialog variant="subtle" />
      </div>
    );
  }

  // Slim horizontal strip (Claude design). Wraps to two rows on mobile so the
  // progress bar drops to its own full-width line instead of overflowing.
  return (
    <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[14px] px-5 py-3.5">
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground-2">
          <Flag className="h-3 w-3 text-cadence-accent" />
          Season
        </span>
        <span className="text-sm font-semibold text-foreground">
          Week {p.weekNumber} of {p.totalWeeks}
        </span>
      </div>
      <div className="hidden h-[18px] w-px bg-border sm:block" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground sm:flex-none">
        {season.theme || season.title}
      </span>
      <div className="flex w-full items-center gap-3 sm:w-auto sm:flex-1">
        <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-[#F1ECE3]">
          <div
            className="h-full rounded-full bg-cadence-accent transition-[width] duration-700"
            style={{ width: `${p.percent}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-[13px] font-semibold text-foreground">{p.percent}%</span>
      </div>
    </div>
  );
}
