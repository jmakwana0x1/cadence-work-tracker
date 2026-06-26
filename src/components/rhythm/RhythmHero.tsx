"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Pulse, type PulseDay } from "./Pulse";
import { acwrVerdict, type RhythmReading, type RhythmState } from "@/lib/rhythm";
import { RHYTHM_STATE_META } from "@/lib/rhythm";

function CountUp({ to, duration = 1.3 }: { to: number; duration?: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toString());
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const controls = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [mv, to, duration]);
  return <motion.span>{display}</motion.span>;
}

const STATE_COLOR: Record<RhythmState, string> = {
  "in-rhythm": "#5B8A5A",
  building: "#5B8A5A",
  recovering: "#5B8A5A",
  slipping: "#C99A3A",
  overreaching: "#C0563F",
  dormant: "#9A958B",
};

function verdictColor(label: string): string {
  switch (label) {
    case "Sustainable":
      return "#5B8A5A";
    case "Ramping":
      return "#C99A3A";
    case "Spiking":
      return "#C0563F";
    case "Coasting":
      return "#76726A";
    default:
      return "#9A958B";
  }
}

interface RhythmHeroProps {
  reading: RhythmReading;
  days: PulseDay[];
}

export function RhythmHero({ reading, days }: RhythmHeroProps) {
  const { cadence, delta, load, state } = reading;
  const meta = RHYTHM_STATE_META[state];
  const verdict = acwrVerdict(load.acwr);
  const stateColor = STATE_COLOR[state];

  const DeltaIcon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  const cadences = days.map((d) => Math.round(d.cadence)).filter((v) => v > 0);
  const low = cadences.length ? Math.min(...cadences) : 0;
  const high = cadences.length ? Math.max(...cadences) : 0;
  const activeDays = days.filter((d) => d.completion > 0).length;
  const consistency = days.length ? Math.round((activeDays / days.length) * 100) : 0;

  const metrics = [
    { label: "Load · ACWR", value: load.acwr ? load.acwr.toFixed(2) : "—", note: verdict.label, noteColor: verdictColor(verdict.label) },
    { label: "Acute", value: String(load.acute), note: "/day", noteColor: "#9A958B" },
    { label: "Chronic", value: String(load.chronic), note: "avg", noteColor: "#9A958B" },
    { label: "Consistency", value: `${consistency}%`, note: "28-day", noteColor: "#9A958B" },
  ];

  return (
    <div className="glass-card p-6 md:p-7">
      {/* Top: number + state, momentum */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground-2">Cadence · habit momentum</div>
          <div className="mt-2 flex items-end gap-4">
            <div className="flex items-end">
              <div
                className="font-semibold tabular-nums text-foreground"
                style={{ fontSize: "clamp(64px, 12vw, 92px)", lineHeight: 0.86, letterSpacing: "-0.04em" }}
              >
                <CountUp to={cadence} />
              </div>
              <span className="pb-2 pl-1 text-lg font-medium text-muted-foreground-2">/ 100</span>
            </div>
            <div className="pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: stateColor }} />
                <span className="text-[15px] font-semibold text-foreground">{meta.label}</span>
              </div>
              <p className="mt-1.5 max-w-[180px] text-[13px] leading-snug text-muted-foreground">{meta.blurb}</p>
            </div>
          </div>
          <p className="mt-2.5 max-w-sm text-[12px] leading-snug text-muted-foreground-2">
            How consistently you&apos;re hitting your habits, smoothed over the last week — recent days count most, so one miss only dents it.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold"
            style={{ background: "var(--cadence-accent-tint)", color: "var(--cadence-accent)" }}
          >
            <DeltaIcon className="h-3.5 w-3.5" />
            {delta > 0 ? "+" : ""}
            {delta} / wk
          </span>
          <span className="text-xs text-muted-foreground-2">28-day momentum</span>
        </div>
      </div>

      {/* The Pulse */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground-2">The Pulse · 28 days</span>
          {high > 0 && (
            <span className="text-xs text-muted-foreground-2">
              low {low} · high {high}
            </span>
          )}
        </div>
        <div className="h-[182px] w-full">
          <Pulse days={days} className="h-full w-full" />
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-[18px] flex flex-wrap gap-2 border-t border-[#EEE9DF] pt-[18px]">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-[96px] flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground-2">{m.label}</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{m.value}</span>
              <span className="text-xs font-medium" style={{ color: m.noteColor }}>
                {m.note}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
