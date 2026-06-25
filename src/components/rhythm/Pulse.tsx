"use client";

import { motion } from "framer-motion";
import { useId } from "react";

// The Pulse — Cadence's signature visual. A calm 28-day line of your cadence
// (momentum) over time, auto-scaled to its own range so the rhythm reads
// clearly. Claude warm-light styling: clay line, soft area fill, hairline grid,
// a dot on the latest beat. Pure SVG.

export interface PulseDay {
  date: string;
  completion: number; // 0..1, that day's raw activity (unused here; kept for callers)
  cadence: number; // 0..100, momentum at that day
}

interface PulseProps {
  days: PulseDay[];
  className?: string;
}

const ACCENT = "#C15F3C";
const GRID = "#EEE9DF";
const W = 840;
const H = 178;
const PAD_T = 14;
const PAD_B = 14;

// Catmull-Rom → cubic-bezier smoothing.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function Pulse({ days, className }: PulseProps) {
  const uid = useId();
  const n = days.length;

  const vals = days.map((d) => d.cadence);
  const rawMin = vals.length ? Math.min(...vals) : 0;
  const rawMax = vals.length ? Math.max(...vals) : 100;
  // Pad the range so a gently-varying line still uses the height.
  const span = Math.max(rawMax - rawMin, 1);
  const lo = rawMin - span * 0.25 - 1;
  const hi = rawMax + span * 0.25 + 1;

  const xOf = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const yOf = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  const points = days.map((d, i) => ({ x: xOf(i), y: yOf(d.cadence) }));
  const linePath = smoothPath(points);
  const areaPath = linePath ? `${linePath} L ${W} ${H} L 0 ${H} Z` : "";
  const last = points[points.length - 1];

  const gridYs = [0.25, 0.5, 0.75].map((f) => PAD_T + (H - PAD_T - PAD_B) * f);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ overflow: "visible" }}
      role="img"
      aria-label="Your cadence over the last 28 days"
    >
      <defs>
        <linearGradient id={`pulse-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.16} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
      </defs>

      {gridYs.map((y, i) => (
        <line key={i} x1={0} y1={y} x2={W} y2={y} stroke={GRID} strokeWidth={1} />
      ))}

      {areaPath && <path d={areaPath} fill={`url(#pulse-fill-${uid})`} />}

      {linePath && (
        <motion.path
          d={linePath}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0.5 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        />
      )}

      {last && (
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={5.5}
          fill={ACCENT}
          stroke="#FFFFFF"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 300, damping: 18 }}
        />
      )}
    </svg>
  );
}
