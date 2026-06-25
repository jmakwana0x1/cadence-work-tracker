"use client";

import { motion } from "framer-motion";
import { useId } from "react";

// The Pulse — Cadence's signature visual. An EKG-style waveform of your recent
// days: the smooth line is Cadence (momentum), the spikes are each day's raw
// activity. A steady, even pulse = in rhythm; a flatline = dormant. Pure SVG.

export interface PulseDay {
  date: string;
  completion: number; // 0..1, that day's raw activity
  cadence: number; // 0..100, momentum at that day
}

interface PulseProps {
  days: PulseDay[];
  hue: number; // accent hue (oklch) from the rhythm state
  className?: string;
  // Editorial overrides (all optional — defaults preserve the original look).
  color?: string; // stroke/beat color; defaults to the light oklch accent
  area?: boolean; // fill under the cadence line (default true)
  strokeWidth?: number; // cadence line width (default 2.5)
}

const W = 720;
const H = 180;
const PAD_X = 8;
const PAD_Y = 16;

// Catmull-Rom → cubic-bezier smoothing for a set of points.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function Pulse({ days, hue, className, color, area = true, strokeWidth = 2.5 }: PulseProps) {
  const uid = useId();
  const accent = color ?? `oklch(0.72 0.18 ${hue})`;
  const accentSoft = `oklch(0.72 0.18 ${hue} / 0.35)`;

  const n = days.length;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const baseline = H - PAD_Y;

  const xOf = (i: number) => PAD_X + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (cadence: number) => PAD_Y + innerH * (1 - cadence / 100);

  const points = days.map((d, i) => ({ x: xOf(i), y: yOf(d.cadence) }));
  const linePath = smoothPath(points);
  const areaPath = linePath
    ? `${linePath} L ${xOf(n - 1)} ${baseline} L ${xOf(0)} ${baseline} Z`
    : "";

  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Your cadence over the recent period"
    >
      <defs>
        <linearGradient id={`pulse-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentSoft} />
          <stop offset="100%" stopColor="oklch(0.72 0.18 263 / 0)" />
        </linearGradient>
      </defs>

      {/* per-day activity beats */}
      {days.map((d, i) => {
        const x = xOf(i);
        const h = d.completion * innerH * 0.9;
        return (
          <line
            key={d.date}
            x1={x}
            x2={x}
            y1={baseline}
            y2={baseline - h}
            stroke={accent}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.12 + d.completion * 0.18}
          />
        );
      })}

      {/* cadence area */}
      {area && areaPath && <path d={areaPath} fill={`url(#pulse-fill-${uid})`} />}

      {/* cadence line, drawn on mount */}
      {linePath && (
        <motion.path
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      )}

      {/* live beat at the latest point */}
      {last && (
        <>
          <motion.circle
            cx={last.x}
            cy={last.y}
            r={4}
            fill={accent}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.3, type: "spring", stiffness: 300, damping: 18 }}
          />
          <motion.circle
            cx={last.x}
            cy={last.y}
            r={4}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            animate={{ scale: [1, 3], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 1.3 }}
          />
        </>
      )}
    </svg>
  );
}
