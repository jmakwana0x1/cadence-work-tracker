"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Pulse, type PulseDay } from "./Pulse";
import { RHYTHM_STATE_META, acwrVerdict, type RhythmReading } from "@/lib/rhythm";

function CountUp({ to, decimals = 0, duration = 1.4 }: { to: number; decimals?: number; duration?: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(decimals));
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const controls = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [mv, to, duration]);
  return <motion.span>{display}</motion.span>;
}

// ─── The score ring (WHOOP/Oura-style) ───
const R = 84;
const STROKE = 12;
const C = 2 * Math.PI * R;

function ScoreRing({ value, hue }: { value: number; hue: number }) {
  const progress = Math.max(0, Math.min(1, value / 100));
  const accent = `oklch(0.74 0.17 ${hue})`;
  const offset = useMotionValue(C);
  useEffect(() => {
    const controls = animate(offset, C * (1 - progress), {
      duration: 1.5,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [offset, progress]);

  return (
    <div className="relative h-[200px] w-[200px] shrink-0">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="oklch(1 0 0 / 0.07)" strokeWidth={STROKE} />
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          style={{ strokeDashoffset: offset, filter: `drop-shadow(0 0 10px oklch(0.74 0.17 ${hue} / 0.5))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-6xl font-bold leading-none tabular-nums"
          style={{ color: `oklch(0.92 0.05 ${hue})` }}
        >
          <CountUp to={value} />
        </span>
        <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Cadence
        </span>
      </div>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

interface RhythmHeroProps {
  reading: RhythmReading;
  days: PulseDay[];
}

export function RhythmHero({ reading, days }: RhythmHeroProps) {
  const { cadence, delta, load, state } = reading;
  const meta = RHYTHM_STATE_META[state];
  const verdict = acwrVerdict(load.acwr);

  const DeltaIcon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.01] p-6 md:p-8">
      {/* state-colored glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: `oklch(0.72 0.18 ${meta.hue} / 0.18)` }}
      />

      <div className="relative flex flex-col gap-7">
        {/* Ring + readouts */}
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
          <ScoreRing value={cadence} hue={meta.hue} />

          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="text-2xl font-semibold tracking-tight md:text-3xl"
                style={{ color: `oklch(0.85 0.13 ${meta.hue})` }}
              >
                {meta.label}
              </span>
              <span className={`flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold ${deltaColor}`}>
                <DeltaIcon className="h-3.5 w-3.5" />
                {delta > 0 ? "+" : ""}
                {delta}
                <span className="font-normal text-muted-foreground">/wk</span>
              </span>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{meta.blurb}</p>

            <div className="mt-1 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4">
              <Metric label="Load">
                <span className={verdict.tone}>{load.acwr ? load.acwr.toFixed(2) : "—"}</span>{" "}
                <span className="text-muted-foreground">{verdict.label}</span>
              </Metric>
              <Metric label="Acute">
                {load.acute}
                <span className="text-muted-foreground"> /day</span>
              </Metric>
              <Metric label="Chronic">
                {load.chronic}
                <span className="text-muted-foreground"> avg</span>
              </Metric>
            </div>
          </div>
        </div>

        {/* The Pulse — signature waveform strip */}
        <div className="border-t border-white/[0.06] pt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              The Pulse · 28 days
            </span>
          </div>
          <div className="h-24 w-full md:h-28">
            <Pulse days={days} hue={meta.hue} className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
