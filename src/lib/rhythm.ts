// ─── The Rhythm Engine (v2) ───
//
// v1's Discipline Score (see `discipline.ts`) is a flat same-day average with no
// memory. The Rhythm Engine models three *living* signals borrowed from
// athletic-training science:
//
//   • Cadence       — a momentum-weighted EMA of daily completion (remembers, but
//                     forgives: one miss dents it, a good run heals it fast).
//   • Load / ACWR   — acute-vs-chronic workload ratio: are you ramping
//                     sustainably or about to burn out?
//   • Rhythm state  — a small state machine derived from cadence trend + ACWR
//                     that drives the coach's tone and the reactive accent.
//
// Everything here is pure and deterministic — no paid AI, fully unit-testable.

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const round1 = (n: number): number => Math.round(n * 10) / 10;

// ─── Cadence ───

export const CADENCE_HALF_LIFE = 7; // days

// EMA smoothing constant for a given half-life: the weight applied to *today*.
// halfLife=7 → a day's influence halves every 7 days.
export function emaAlpha(halfLife: number): number {
  return 1 - Math.pow(0.5, 1 / halfLife);
}

// Cadence series (0..100), oldest → newest. `completions` are daily ratios 0..1.
// Seeded with the first observation so a brand-new series doesn't ramp from 0.
export function cadenceSeries(
  completions: number[],
  halfLife: number = CADENCE_HALF_LIFE
): number[] {
  const a = emaAlpha(halfLife);
  const out: number[] = [];
  let ema = 0;
  for (let i = 0; i < completions.length; i++) {
    const c = clamp01(completions[i]);
    ema = i === 0 ? c : a * c + (1 - a) * ema;
    out.push(round1(ema * 100));
  }
  return out;
}

// Convenience: the latest cadence value, or 0 for an empty series.
export function currentCadence(
  completions: number[],
  halfLife: number = CADENCE_HALF_LIFE
): number {
  const s = cadenceSeries(completions, halfLife);
  return s.length ? s[s.length - 1] : 0;
}

// ─── Load & ACWR ───

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export interface LoadReading {
  acute: number; // mean daily attempt volume over the last 7 days
  chronic: number; // mean daily attempt volume over the last 28 days
  acwr: number; // acute : chronic workload ratio
}

// `attempts` is daily "attempt volume" (how much you took on), oldest → newest.
// ACWR sweet spot ≈ 0.8–1.3; > 1.5 signals an unsustainable spike (burnout risk).
export function loadReading(attempts: number[]): LoadReading {
  const acute = mean(attempts.slice(-7));
  const chronic = mean(attempts.slice(-28));
  return {
    acute: round1(acute),
    chronic: round1(chronic),
    acwr: chronic === 0 ? 0 : Math.round((acute / chronic) * 100) / 100,
  };
}

// ─── Rhythm state machine ───

export type RhythmState =
  | "in-rhythm"
  | "building"
  | "slipping"
  | "recovering"
  | "overreaching"
  | "dormant";

// `delta` is cadence-now minus cadence-a-week-ago (momentum direction).
// `hasHistory` guards the empty / never-active case.
export function rhythmState(
  cadence: number,
  delta: number,
  acwr: number,
  hasHistory: boolean
): RhythmState {
  if (!hasHistory) return "dormant";
  if (acwr >= 1.5) return "overreaching"; // ramping too fast — crash risk
  if (delta <= -5) return "slipping"; // falling fast
  if (cadence < 40 && delta < 3) return "slipping"; // low and not climbing
  if (cadence < 60 && delta >= 3) return "recovering"; // climbing out of a dip
  if (cadence >= 70) return "in-rhythm"; // steady and high
  return "building";
}

export interface RhythmReading {
  cadence: number;
  delta: number;
  load: LoadReading;
  state: RhythmState;
}

// Top-level: turn raw daily completion + attempt series into a full reading.
export function computeRhythm(
  completions: number[],
  attempts: number[],
  halfLife: number = CADENCE_HALF_LIFE
): RhythmReading {
  const series = cadenceSeries(completions, halfLife);
  const cadence = series.length ? series[series.length - 1] : 0;
  // Compare against ~a week ago for momentum; fall back to the series start.
  const prior =
    series.length > 7
      ? series[series.length - 8]
      : series.length
        ? series[0]
        : 0;
  const delta = round1(cadence - prior);
  const load = loadReading(attempts);
  const hasHistory = completions.some((c) => c > 0) || attempts.some((a) => a > 0);
  return { cadence, delta, load, state: rhythmState(cadence, delta, load.acwr, hasHistory) };
}

// ─── UI metadata ───
//
// `hue` feeds the reactive accent (oklch): violet when steady, warming toward
// amber/red as rhythm degrades.
export interface RhythmStateMeta {
  label: string;
  blurb: string;
  hue: number;
  tone: string; // tailwind text color class
}

export const RHYTHM_STATE_META: Record<RhythmState, RhythmStateMeta> = {
  "in-rhythm": {
    label: "In Rhythm",
    blurb: "Steady and strong. This is who you are now.",
    hue: 263,
    tone: "text-violet-300",
  },
  building: {
    label: "Building",
    blurb: "Momentum is gathering. Keep stacking days.",
    hue: 210,
    tone: "text-sky-300",
  },
  recovering: {
    label: "Recovering",
    blurb: "Climbing back. The dip is already behind you.",
    hue: 160,
    tone: "text-emerald-300",
  },
  slipping: {
    label: "Slipping",
    blurb: "The rhythm is fading. One honest day turns it around.",
    hue: 45,
    tone: "text-amber-300",
  },
  overreaching: {
    label: "Overreaching",
    blurb: "You're ramping faster than you can sustain. Plan a recovery day.",
    hue: 25,
    tone: "text-orange-300",
  },
  dormant: {
    label: "Dormant",
    blurb: "No rhythm yet. Log a day to start the pulse.",
    hue: 263,
    tone: "text-muted-foreground",
  },
};

// Human-readable verdict on the load ratio, for the coach / readouts.
export function acwrVerdict(acwr: number): { label: string; tone: string } {
  if (acwr === 0) return { label: "—", tone: "text-muted-foreground" };
  if (acwr >= 1.5) return { label: "Spiking", tone: "text-orange-300" };
  if (acwr > 1.3) return { label: "Ramping", tone: "text-amber-300" };
  if (acwr >= 0.8) return { label: "Sustainable", tone: "text-emerald-300" };
  return { label: "Coasting", tone: "text-sky-300" };
}
