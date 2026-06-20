"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { scoreColor, scoreDeltaColor } from "@/lib/discipline";
import type { ScoreComponents } from "@/types/database";

interface ScoreHeroProps {
  score: number;
  yesterday: number | null;
  components: ScoreComponents;
}

function CountUp({ to, duration = 1.2 }: { to: number; duration?: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(1));
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const controls = animate(mv, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [mv, to, duration]);

  return <motion.span>{display}</motion.span>;
}

const COMPONENT_LABELS = {
  habit_pct: "Habits",
  task_pct: "Tasks",
  schedule_pct: "Schedule",
} as const;

const COMPONENT_WEIGHTS = {
  habit_pct: 50,
  task_pct: 30,
  schedule_pct: 20,
} as const;

export function ScoreHero({ score, yesterday, components }: ScoreHeroProps) {
  const delta = yesterday !== null ? Math.round((score - yesterday) * 10) / 10 : null;
  const color = scoreColor(score);

  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta !== null ? scoreDeltaColor(delta) : "text-muted-foreground";

  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      {/* Hero number */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Discipline Score</p>
          <div className={`text-7xl font-bold tabular-nums leading-none ${color}`}>
            <CountUp to={score} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">out of 100</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {delta !== null && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${deltaColor}`}>
              <DeltaIcon className="h-4 w-4" />
              <span>{delta > 0 ? "+" : ""}{delta}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">vs yesterday</p>
        </div>
      </div>

      {/* Formula breakdown */}
      <div className="flex flex-col gap-2.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Formula</p>
        {(Object.keys(COMPONENT_LABELS) as (keyof typeof COMPONENT_LABELS)[]).map((key) => {
          const pct = components[key];
          const unavailable = pct === -1;
          const displayPct = unavailable ? 0 : pct;
          const weight = COMPONENT_WEIGHTS[key];

          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {COMPONENT_LABELS[key]}{" "}
                  <span className="text-muted-foreground/50">({weight}%)</span>
                </span>
                <span className={unavailable ? "text-muted-foreground/30 italic" : "text-foreground font-medium tabular-nums"}>
                  {unavailable ? "no data" : `${displayPct}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${displayPct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                  className="h-full rounded-full bg-cadence-accent"
                  style={{ opacity: unavailable ? 0.15 : 1 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
