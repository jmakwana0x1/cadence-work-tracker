// ─── The Cadence Coach (deterministic) ───
//
// "Intelligence" here is statistics + a rotating library of identity-framed copy
// — NO paid AI. Given a rhythm reading plus simple per-weekday / per-habit
// aggregates, it surfaces honest observations and concrete next actions.
//
// Everything is pure and deterministic (template choice is seeded by the date so
// it varies day-to-day but stays hydration-stable). Fully unit-testable.

import type { RhythmReading, RhythmState } from "./rhythm";
import { RHYTHM_STATE_META, acwrVerdict } from "./rhythm";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pct = (rate: number): number => Math.round(rate * 100);

// Deterministic, hydration-stable index from a seed string.
function seededIndex(seed: string, len: number): number {
  if (len <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

function pick<T>(arr: readonly T[], seed: string): T {
  return arr[seededIndex(seed, arr.length)];
}

// ─── Weekday analysis ───

export interface WeekdayRate {
  rate: number; // 0..1 mean activity on that weekday
  count: number; // number of logs observed
}

// Smallest sample we'll trust before calling a weekday strong or weak.
const MIN_WEEKDAY_SAMPLE = 4;

export function weakestWeekday(weekday: WeekdayRate[]): { dow: number; rate: number } | null {
  let worst: { dow: number; rate: number } | null = null;
  for (let dow = 0; dow < weekday.length; dow++) {
    const w = weekday[dow];
    if (w.count < MIN_WEEKDAY_SAMPLE) continue;
    if (worst === null || w.rate < worst.rate) worst = { dow, rate: w.rate };
  }
  return worst;
}

export function strongestWeekday(weekday: WeekdayRate[]): { dow: number; rate: number } | null {
  let best: { dow: number; rate: number } | null = null;
  for (let dow = 0; dow < weekday.length; dow++) {
    const w = weekday[dow];
    if (w.count < MIN_WEEKDAY_SAMPLE) continue;
    if (best === null || w.rate > best.rate) best = { dow, rate: w.rate };
  }
  return best;
}

// ─── Report shape ───

export interface HabitAdherence {
  id: string;
  name: string;
  rate: number; // 0..1
  logs: number;
}

export interface CoachInput {
  reading: RhythmReading;
  weekday: WeekdayRate[]; // length 7, Sun..Sat
  habits: HabitAdherence[];
  todayDow: number; // 0..6
  remainingToday: number; // habits not yet logged today
  seed: string; // typically today's date string
}

export type CoachTone = "good" | "warn" | "info";

export interface CoachNote {
  id: string;
  text: string;
  tone: CoachTone;
}

// Compact, at-a-glance rhythm header — the numbers the briefs (on-screen and
// pushed) lead with, so the message opens with substance, not just copy.
export interface RhythmSummary {
  cadence: number; // 0..100, rounded
  state: RhythmState;
  stateLabel: string; // e.g. "In Rhythm"
  delta: number; // week-over-week cadence change
  acwr: number; // acute:chronic load ratio
  acwrLabel: string; // e.g. "Sustainable", "Spiking", "—"
}

export interface CoachReport {
  rhythm?: RhythmSummary; // populated by buildCoachReport; optional for test fixtures
  headline: string;
  insights: CoachNote[]; // what the data shows
  recommendations: CoachNote[]; // what to do about it
}

// Identity-framed headlines per rhythm state. Rotated by seed.
const HEADLINES: Record<RhythmState, readonly string[]> = {
  "in-rhythm": [
    "You're in rhythm. This is just who you are now.",
    "Steady hands. The streak isn't luck — it's identity.",
    "This is what consistency feels like from the inside.",
  ],
  building: [
    "Momentum is gathering. Stack one more day.",
    "You're building something. Don't break the chain now.",
    "The hard part is behind you — keep laying bricks.",
  ],
  recovering: [
    "You're climbing back. The dip is already history.",
    "Recovery counts double. You showed up after a miss.",
    "This is the comeback. Quietly, it's working.",
  ],
  slipping: [
    "The rhythm is fading — one honest day turns it around.",
    "You're slipping. Not failing. Pick one thing and do it.",
    "Catch it now. The smallest win resets the pulse.",
  ],
  overreaching: [
    "You're ramping faster than you can hold. Ease off.",
    "Overreaching. Plan a recovery day before it plans you.",
    "More isn't the answer right now — sustainable is.",
  ],
  dormant: [
    "No rhythm yet. Log a single day to start the pulse.",
    "Every cadence starts with one beat. Take it today.",
    "Blank slate. Show up once and the engine wakes up.",
  ],
};

// Build the full coach report. Insights and recommendations are capped at 3 each,
// ordered by importance (warnings first).
export function buildCoachReport(input: CoachInput): CoachReport {
  const { reading, weekday, habits, todayDow, remainingToday, seed } = input;
  const { state, delta, load } = reading;

  const headline = pick(HEADLINES[state], seed);

  const insights: CoachNote[] = [];
  const recommendations: CoachNote[] = [];

  // ── Load / burnout ──
  if (load.acwr >= 1.5) {
    insights.push({
      id: "load-spike",
      tone: "warn",
      text: `Your recent load (${load.acute}/day) is ${load.acwr.toFixed(2)}× your usual — a spike that tends to precede a crash.`,
    });
    recommendations.push({
      id: "rec-recovery",
      tone: "warn",
      text: "Schedule a recovery day this week. Planned rest protects your cadence; collapse doesn't.",
    });
  } else if (load.acwr > 0 && load.acwr < 0.8) {
    insights.push({
      id: "load-coasting",
      tone: "info",
      text: `Your load has eased off (${load.acwr.toFixed(2)}× your baseline) — there's room to add back.`,
    });
  }

  // ── Momentum ──
  if (delta >= 5) {
    insights.push({
      id: "momentum-up",
      tone: "good",
      text: `Cadence is up +${delta} this week. Whatever you changed, keep it.`,
    });
  } else if (delta <= -5) {
    insights.push({
      id: "momentum-down",
      tone: "warn",
      text: `Cadence is down ${delta} this week. It's recoverable — but only if you act on it.`,
    });
  }

  // ── Weekday patterns ──
  const weak = weakestWeekday(weekday);
  const strong = strongestWeekday(weekday);
  if (strong && strong.rate >= 0.8) {
    insights.push({
      id: "weekday-strong",
      tone: "good",
      text: `${DAY_LABELS[strong.dow]}s are your anchor — you hit ${pct(strong.rate)}% of your habits.`,
    });
  }
  if (weak && weak.rate < 0.6 && (!strong || weak.dow !== strong.dow)) {
    insights.push({
      id: "weekday-weak",
      tone: "warn",
      text: `${DAY_LABELS[weak.dow]}s are your softest day — only ${pct(weak.rate)}% completion.`,
    });
    if (weak.dow === todayDow) {
      recommendations.push({
        id: "rec-weak-today",
        tone: "warn",
        text: `Today's a ${DAY_LABELS[weak.dow]} — historically your weakest. Front-load one habit now, before the day gets away.`,
      });
    }
  }

  // ── Adaptive targets ──
  const ripe = habits.find((h) => h.logs >= 10 && h.rate >= 0.9);
  if (ripe) {
    recommendations.push({
      id: "rec-raise",
      tone: "good",
      text: `You hit "${ripe.name}" ${pct(ripe.rate)}% of the time — it may be time to raise the bar.`,
    });
  }
  const struggling = habits.find((h) => h.logs >= 8 && h.rate < 0.4);
  if (struggling) {
    recommendations.push({
      id: "rec-shrink",
      tone: "warn",
      text: `"${struggling.name}" is sticking only ${pct(struggling.rate)}% of the time. Shrink it until it's impossible to skip.`,
    });
  }

  // ── Fallback nudge ──
  if (recommendations.length === 0) {
    if (remainingToday > 0) {
      recommendations.push({
        id: "rec-finish-today",
        tone: "info",
        text: `${remainingToday} habit${remainingToday === 1 ? "" : "s"} still unlogged today. Close them out to keep the pulse steady.`,
      });
    } else if (state !== "dormant") {
      recommendations.push({
        id: "rec-all-clear",
        tone: "good",
        text: "Everything's logged for today. This is exactly what showing up looks like.",
      });
    }
  }

  return {
    rhythm: summarizeRhythm(reading),
    headline,
    insights: insights.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

// The at-a-glance header both briefs lead with.
function summarizeRhythm(reading: RhythmReading): RhythmSummary {
  return {
    cadence: Math.round(reading.cadence),
    state: reading.state,
    stateLabel: RHYTHM_STATE_META[reading.state].label,
    delta: reading.delta,
    acwr: reading.load.acwr,
    acwrLabel: acwrVerdict(reading.load.acwr).label,
  };
}

// ─── Evening reflection ───
//
// The "reflect" brief: plan-vs-actual for today with an honest verdict (no
// vanity inflation) and a single forward nudge for tomorrow. Reuses CoachReport
// so the same renderers (CoachCard, Telegram) work unchanged.

export interface EveningInput {
  reading: RhythmReading;
  weekday: WeekdayRate[]; // length 7, Sun..Sat — to flag a weak tomorrow
  planned: number; // habits on the board today
  done: number; // logged "done" today
  partial: number; // logged "partial" today
  todayDow: number; // 0..6
  seed: string;
}

type Verdict = "full" | "strong" | "partial" | "minimal" | "missed" | "none";

// Honest verdict tiers. Earned, not inflated.
const EVENING_HEADLINES: Record<Verdict, readonly string[]> = {
  full: [
    "Full sweep. Every habit logged — this is the day that compounds.",
    "Clean slate, all done. This is what showing up looks like.",
    "You closed every loop today. The identity is in the reps.",
  ],
  strong: [
    "Strong day. You did the work that matters.",
    "Most of it, done. A day you can stack on.",
    "Solid — not perfect, but perfect was never the job. Showing up is.",
  ],
  partial: [
    "A partial day. Half-kept is still kept — log it and move on.",
    "You got some of it. That beats the all-or-nothing trap.",
    "Mixed day. Tomorrow's a clean rep — no guilt carried over.",
  ],
  minimal: [
    "Thin day. One beat is still a beat in the rhythm.",
    "Barely there — but you showed up honestly. That's the win.",
    "Light day. Don't spiral; just set up tomorrow.",
  ],
  missed: [
    "Nothing logged today. No spin on it — tomorrow you reset.",
    "A blank day. It happens. The streak survives one honest miss.",
    "Empty board. The comeback counts double — start it tomorrow.",
  ],
  none: [
    "Nothing on the board today. Add a habit and the pulse starts.",
    "Quiet day, nothing planned. Tomorrow, pick one thing.",
  ],
};

function verdictOf(planned: number, ratio: number): Verdict {
  if (planned === 0) return "none";
  if (ratio >= 0.999) return "full";
  if (ratio >= 0.7) return "strong";
  if (ratio >= 0.4) return "partial";
  if (ratio > 0) return "minimal";
  return "missed";
}

export function buildEveningReflection(input: EveningInput): CoachReport {
  const { reading, weekday, planned, done, partial, todayDow, seed } = input;

  const completed = done + partial * 0.5;
  const ratio = planned === 0 ? 0 : completed / planned;
  const verdict = verdictOf(planned, ratio);
  const headline = pick(EVENING_HEADLINES[verdict], seed);

  const insights: CoachNote[] = [];
  const recommendations: CoachNote[] = [];

  // ── Plan vs. actual ──
  if (planned > 0) {
    const tail = partial > 0 ? ` (+${partial} partial)` : "";
    insights.push({
      id: "evening-plan-actual",
      tone: verdict === "full" ? "good" : verdict === "missed" ? "warn" : "info",
      text: `Planned ${planned}, finished ${done}${tail}.`,
    });
  }

  // ── Cadence movement today ──
  const delta = reading.delta;
  if (delta >= 5) {
    insights.push({
      id: "evening-momentum-up",
      tone: "good",
      text: `Cadence is up +${delta} this week — today added to that.`,
    });
  } else if (delta <= -5) {
    insights.push({
      id: "evening-momentum-down",
      tone: "warn",
      text: `Cadence is down ${delta} this week. One honest tomorrow turns it.`,
    });
  }

  // ── One nudge for tomorrow ──
  if (reading.load.acwr >= 1.5) {
    recommendations.push({
      id: "evening-rest",
      tone: "warn",
      text: "You've been ramping hard. Make tomorrow a recovery day on purpose — planned rest protects the streak.",
    });
  } else {
    const tomorrowDow = (todayDow + 1) % 7;
    const t = weekday[tomorrowDow];
    if (t && t.count >= MIN_WEEKDAY_SAMPLE && t.rate < 0.6) {
      recommendations.push({
        id: "evening-weak-tomorrow",
        tone: "warn",
        text: `Tomorrow's a ${DAY_LABELS[tomorrowDow]} — historically your softest (${pct(t.rate)}%). Pick one habit to front-load.`,
      });
    } else if (verdict === "full") {
      recommendations.push({
        id: "evening-protect",
        tone: "good",
        text: "Everything's logged. Set tomorrow up tonight so the streak runs itself.",
      });
    } else if (verdict === "missed" || verdict === "minimal") {
      recommendations.push({
        id: "evening-reset",
        tone: "info",
        text: "Pick the single most important habit for tomorrow and do it first. Momentum restarts with one rep.",
      });
    }
  }

  return {
    rhythm: summarizeRhythm(reading),
    headline,
    insights: insights.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}
