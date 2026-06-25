"use client";

import { useEffect, useId, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type Variants } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Pulse, type PulseDay } from "./Pulse";
import { RHYTHM_STATE_META, acwrVerdict, type RhythmReading } from "@/lib/rhythm";

function CountUp({ to, decimals = 0, duration = 1.5 }: { to: number; decimals?: number; duration?: number }) {
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
const STROKE = 13;
const C = 2 * Math.PI * R;

function ScoreRing({ value, hue }: { value: number; hue: number }) {
  const uid = useId();
  const progress = Math.max(0, Math.min(1, value / 100));
  const offset = useMotionValue(C);

  useEffect(() => {
    const controls = animate(offset, C * (1 - progress), { duration: 1.6, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [offset, progress]);

  // Final position of the progress tip (local coords; the <svg> is rotated -90°).
  const theta = 2 * Math.PI * progress;
  const tipX = 100 + R * Math.cos(theta);
  const tipY = 100 + R * Math.sin(theta);

  return (
    <div className="relative h-[200px] w-[200px] shrink-0">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`oklch(0.85 0.14 ${hue})`} />
            <stop offset="100%" stopColor={`oklch(0.62 0.2 ${hue})`} />
          </linearGradient>
        </defs>

        {/* track */}
        <circle cx="100" cy="100" r={R} fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth={STROKE} />

        {/* progress arc */}
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={`url(#ring-${uid})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          style={{ strokeDashoffset: offset, filter: `drop-shadow(0 0 12px oklch(0.74 0.17 ${hue} / 0.55))` }}
        />

        {/* glowing tip, settles in as the arc finishes */}
        {progress > 0.01 && (
          <>
            <motion.circle
              cx={tipX}
              cy={tipY}
              r={STROKE / 2 + 1}
              fill={`oklch(0.92 0.06 ${hue})`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.5, type: "spring", stiffness: 260, damping: 18 }}
              style={{ filter: `drop-shadow(0 0 8px oklch(0.85 0.14 ${hue} / 0.9))` }}
            />
            <motion.circle
              cx={tipX}
              cy={tipY}
              r={STROKE / 2 + 1}
              fill="none"
              stroke={`oklch(0.85 0.14 ${hue})`}
              strokeWidth={1.5}
              animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1.6 }}
            />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl font-bold leading-none tabular-nums" style={{ color: `oklch(0.95 0.04 ${hue})` }}>
          <CountUp to={value} />
        </span>
        <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Cadence
        </span>
      </div>
    </div>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <motion.div variants={item} className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">{label}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </motion.div>
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
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-6 shadow-[0_1px_0_0_oklch(1_0_0/0.06)_inset] md:p-8">
      {/* state-colored glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full blur-3xl"
        style={{ background: `oklch(0.72 0.18 ${meta.hue} / 0.2)` }}
      />
      {/* top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative flex flex-col gap-7">
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-10">
          <ScoreRing value={cadence} hue={meta.hue} />

          <motion.div variants={container} initial="hidden" animate="show" className="flex w-full flex-col gap-4">
            <motion.div variants={item} className="flex flex-wrap items-center gap-3">
              <span
                className="text-2xl font-semibold tracking-tight md:text-[1.75rem]"
                style={{ color: `oklch(0.86 0.13 ${meta.hue})` }}
              >
                {meta.label}
              </span>
              <span className={`flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold ${deltaColor}`}>
                <DeltaIcon className="h-3.5 w-3.5" />
                {delta > 0 ? "+" : ""}
                {delta}
                <span className="font-normal text-muted-foreground">/wk</span>
              </span>
            </motion.div>

            <motion.p variants={item} className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {meta.blurb}
            </motion.p>

            <div className="mt-1 grid grid-cols-3 gap-4 border-t border-white/[0.07] pt-4">
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
          </motion.div>
        </div>

        {/* The Pulse — signature waveform strip */}
        <div className="border-t border-white/[0.07] pt-5">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
            The Pulse · 28 days
          </span>
          <div className="mt-2 h-24 w-full md:h-28">
            <Pulse days={days} hue={meta.hue} className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
