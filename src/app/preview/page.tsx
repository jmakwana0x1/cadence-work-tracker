// EDITORIAL-LIGHT PROTOTYPE — isolated direction preview, not wired into the app.
// Renders the hero + header in the new "editorial light" look (cream canvas, ink
// type, oversized serif numerals, hairlines instead of glass cards) so the
// direction can be judged on a real Vercel preview without touching the global
// dark theme. If approved, these tokens/components get promoted app-wide.

import { Fraunces } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { localToday, addDaysStr, userTimezone } from "@/lib/date";
import { buildRhythm } from "@/lib/rhythmData";
import { acwrVerdict } from "@/lib/rhythm";
import { getCoachReportForUser } from "@/lib/coachReport";
import { Pulse, type PulseDay } from "@/components/rhythm/Pulse";

// Editorial display serif (build-time Google font via next/font — no npm dep).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const WINDOW = 28;

// Editorial palette (kept local to the prototype).
const CREAM = "#F6F2EA";
const INK = "#1B1714";
const MUTED = "#6E665B";
const HAIRLINE = "rgba(27,23,20,0.12)";
const HUE = 263; // single violet identity, kept calm on the cream canvas

export default async function PreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const tz = userTimezone(user);
  const today = localToday(tz);
  const startDate = addDaysStr(today, -(WINDOW - 1));

  const [{ data: logs }, { data: habits }] = await Promise.all([
    supabase
      .from("habit_logs")
      .select("logged_at, status")
      .eq("user_id", user.id)
      .gte("logged_at", startDate),
    supabase.from("habits").select("id").eq("user_id", user.id),
  ]);

  const { days, reading } = buildRhythm(logs ?? [], habits?.length ?? 0, startDate, WINDOW);
  const report = await getCoachReportForUser(supabase, user);

  const pulseDays: PulseDay[] = days.map((d) => ({
    date: d.date,
    completion: d.completion,
    cadence: d.cadence,
  }));

  const hue = HUE;
  const verdict = acwrVerdict(reading.load.acwr);
  const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? null;
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Ink-violet for the numeral; a brighter violet for accents/line on cream.
  const numeralColor = `oklch(0.32 0.09 ${hue})`;
  const accentViolet = `oklch(0.52 0.21 ${hue})`;
  const delta = reading.delta;
  const deltaLabel = `${delta > 0 ? "↗ +" : delta < 0 ? "↘ " : "→ "}${delta === 0 ? "0" : Math.abs(delta)}`;

  return (
    <main
      className="min-h-dvh px-6 py-10 md:px-10 md:py-16"
      style={{ backgroundColor: CREAM, color: INK }}
    >
      <div className="mx-auto flex max-w-3xl flex-col">
        {/* Wordmark / header */}
        <header className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: INK }}>
            Cadence
          </span>
          <span className="text-xs uppercase tracking-[0.18em]" style={{ color: MUTED }}>
            {dateLabel}
          </span>
        </header>

        {/* Greeting */}
        <h1
          className={`${fraunces.className} mt-16 text-5xl leading-[1.05] tracking-tight md:text-6xl`}
          style={{ color: INK, fontWeight: 500 }}
        >
          {firstName ? `Hey, ${firstName}.` : "Welcome back."}
        </h1>
        <p className="mt-3 text-sm" style={{ color: MUTED }}>
          Here&apos;s where your rhythm stands today.
        </p>

        <hr className="mt-12 border-0 border-t" style={{ borderColor: HAIRLINE }} />

        {/* The number */}
        <section className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: MUTED }}>
            Cadence
          </p>

          <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div
              className={`${fraunces.className} text-[7.5rem] leading-[0.85] tabular-nums md:text-[10rem]`}
              style={{ color: numeralColor, fontWeight: 500 }}
            >
              {Math.round(reading.cadence)}
            </div>

            <div className="flex flex-col gap-2 pb-3">
              <span
                className={`${fraunces.className} text-2xl italic md:text-3xl`}
                style={{ color: accentViolet, fontWeight: 500 }}
              >
                {report.rhythm?.stateLabel ?? "—"}
              </span>
              <span className="text-sm tracking-wide" style={{ color: MUTED }}>
                {deltaLabel} <span className="opacity-70">this week</span>
              </span>
            </div>
          </div>

          {/* Thin pulse line — no fill, ink-violet stroke */}
          <div className="mt-10 h-24 w-full md:h-28">
            <Pulse days={pulseDays} hue={hue} color={accentViolet} area={false} strokeWidth={2} className="h-full w-full" />
          </div>

          {/* Load readout, as a hairline-separated row */}
          <div
            className="mt-8 flex flex-wrap items-baseline gap-x-10 gap-y-2 border-t pt-5 text-sm"
            style={{ borderColor: HAIRLINE }}
          >
            <span style={{ color: MUTED }}>
              Load{" "}
              <span className="ml-1 font-semibold tabular-nums" style={{ color: INK }}>
                {reading.load.acwr ? reading.load.acwr.toFixed(2) : "—"}
              </span>{" "}
              <span style={{ color: accentViolet }}>{verdict.label}</span>
            </span>
            <span style={{ color: MUTED }}>
              {reading.load.acute} now · {reading.load.chronic} avg
            </span>
          </div>
        </section>

        {/* Coach headline as an editorial pull-quote */}
        <hr className="mt-14 border-0 border-t" style={{ borderColor: HAIRLINE }} />
        <blockquote
          className={`${fraunces.className} mt-12 text-2xl leading-snug italic md:text-[2rem]`}
          style={{ color: INK, fontWeight: 400 }}
        >
          “{report.headline}”
        </blockquote>
        <p className="mt-4 text-xs uppercase tracking-[0.2em]" style={{ color: MUTED }}>
          Your coach
        </p>

        <p className="mt-20 text-xs" style={{ color: MUTED }}>
          Editorial-light prototype · the rest of the app is unchanged.
        </p>
      </div>
    </main>
  );
}
