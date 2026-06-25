"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Pulse, type PulseDay } from "./Pulse";
import {
  RHYTHM_STATE_META,
  acwrVerdict,
  type RhythmReading,
} from "@/lib/rhythm";

function CountUp({ to, duration = 1.3 }: { to: number; duration?: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(1));
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const controls = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [mv, to, duration]);
  return <motion.span>{display}</motion.span>;
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
  const deltaColor =
    delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="glass-card relative overflow-hidden p-6">
      {/* The Pulse, bled into the background */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-90">
        <Pulse days={days} hue={meta.hue} className="h-full w-full" />
      </div>

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              <Activity className="h-3.5 w-3.5" style={{ color: `oklch(0.72 0.18 ${meta.hue})` }} />
              Cadence
            </p>
            <div
              className="text-7xl font-bold leading-none tabular-nums"
              style={{ color: `oklch(0.78 0.16 ${meta.hue})` }}
            >
              <CountUp to={cadence} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  color: `oklch(0.82 0.14 ${meta.hue})`,
                  backgroundColor: `oklch(0.72 0.18 ${meta.hue} / 0.16)`,
                }}
              >
                {meta.label}
              </span>
              <span className={`flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
                <DeltaIcon className="h-3.5 w-3.5" />
                {delta > 0 ? "+" : ""}
                {delta} <span className="font-normal text-muted-foreground">/wk</span>
              </span>
            </div>
          </div>

          {/* Load readout */}
          <div className="flex flex-col items-end gap-1 text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Load</p>
            <p className={`text-2xl font-bold tabular-nums ${verdict.tone}`}>
              {load.acwr ? load.acwr.toFixed(2) : "—"}
            </p>
            <p className={`text-xs font-medium ${verdict.tone}`}>{verdict.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {load.acute} now · {load.chronic} avg
            </p>
          </div>
        </div>

        <p className="max-w-md text-sm text-muted-foreground">{meta.blurb}</p>
      </div>
    </div>
  );
}
