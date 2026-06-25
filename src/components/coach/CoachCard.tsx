import { createClient } from "@/lib/supabase/server";
import { getCoachReportForUser } from "@/lib/coachReport";
import { type CoachNote } from "@/lib/coach";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";

const TONE_STYLES = {
  good: { wrap: "border-emerald-500/15 bg-emerald-500/[0.06]", text: "text-emerald-200/90", Icon: TrendingUp },
  warn: { wrap: "border-amber-500/15 bg-amber-500/[0.06]", text: "text-amber-200/90", Icon: AlertTriangle },
  info: { wrap: "border-white/10 bg-white/[0.04]", text: "text-muted-foreground", Icon: Lightbulb },
} as const;

function Note({ note }: { note: CoachNote }) {
  const s = TONE_STYLES[note.tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${s.wrap}`}>
      <s.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} />
      <p className={`text-xs leading-relaxed ${s.text}`}>{note.text}</p>
    </div>
  );
}

export async function CoachCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const report = await getCoachReportForUser(supabase, user);

  const hasNotes = report.insights.length > 0 || report.recommendations.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cadence-accent" />
        <h2 className="text-base font-semibold text-foreground">Coach</h2>
      </div>

      <div className="glass-card flex flex-col gap-4 p-5">
        <p className="text-sm font-medium leading-relaxed text-foreground">{report.headline}</p>

        {report.insights.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">What I&apos;m seeing</p>
            {report.insights.map((n) => (
              <Note key={n.id} note={n} />
            ))}
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">What to do</p>
            {report.recommendations.map((n) => (
              <Note key={n.id} note={n} />
            ))}
          </div>
        )}

        {!hasNotes && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Log a few days and the coach will start spotting your patterns.
          </div>
        )}
      </div>
    </div>
  );
}
