import { describe, it, expect } from "vitest";
import {
  weakestWeekday,
  strongestWeekday,
  buildCoachReport,
  type WeekdayRate,
  type CoachInput,
} from "@/lib/coach";
import type { RhythmReading } from "@/lib/rhythm";

const flatWeekday = (rate: number, count = 10): WeekdayRate[] =>
  Array.from({ length: 7 }, () => ({ rate, count }));

const reading = (over: Partial<RhythmReading> = {}): RhythmReading => ({
  cadence: 75,
  delta: 0,
  load: { acute: 3, chronic: 3, acwr: 1 },
  state: "in-rhythm",
  ...over,
});

const baseInput = (over: Partial<CoachInput> = {}): CoachInput => ({
  reading: reading(),
  weekday: flatWeekday(0.8),
  habits: [],
  todayDow: 3,
  remainingToday: 0,
  seed: "2026-06-25",
  ...over,
});

describe("weekday extremes", () => {
  it("ignores under-sampled weekdays", () => {
    const w = flatWeekday(0.9);
    w[2] = { rate: 0.1, count: 1 }; // too few samples to trust
    expect(weakestWeekday(w)?.dow).not.toBe(2);
  });

  it("finds the weakest and strongest sufficiently-sampled day", () => {
    const w = flatWeekday(0.7);
    w[1] = { rate: 0.2, count: 8 };
    w[5] = { rate: 0.95, count: 8 };
    expect(weakestWeekday(w)?.dow).toBe(1);
    expect(strongestWeekday(w)?.dow).toBe(5);
  });

  it("returns null when nothing is sampled enough", () => {
    expect(weakestWeekday(flatWeekday(0.5, 1))).toBeNull();
  });
});

describe("buildCoachReport", () => {
  it("always produces a headline for the state", () => {
    const r = buildCoachReport(baseInput({ reading: reading({ state: "dormant" }) }));
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", () => {
    const a = buildCoachReport(baseInput());
    const b = buildCoachReport(baseInput());
    expect(a.headline).toBe(b.headline);
  });

  it("warns about a load spike and recommends recovery", () => {
    const r = buildCoachReport(
      baseInput({ reading: reading({ state: "overreaching", load: { acute: 6, chronic: 3, acwr: 2 } }) })
    );
    expect(r.insights.some((n) => n.id === "load-spike")).toBe(true);
    expect(r.recommendations.some((n) => n.id === "rec-recovery")).toBe(true);
  });

  it("flags a weak weekday and warns when today is that day", () => {
    const w = flatWeekday(0.85);
    w[3] = { rate: 0.3, count: 8 };
    const r = buildCoachReport(baseInput({ weekday: w, todayDow: 3 }));
    expect(r.insights.some((n) => n.id === "weekday-weak")).toBe(true);
    expect(r.recommendations.some((n) => n.id === "rec-weak-today")).toBe(true);
  });

  it("suggests raising the bar on a near-perfect habit", () => {
    const r = buildCoachReport(
      baseInput({ habits: [{ id: "h1", name: "Read", rate: 0.95, logs: 20 }] })
    );
    expect(r.recommendations.some((n) => n.id === "rec-raise")).toBe(true);
  });

  it("suggests shrinking a failing habit", () => {
    const r = buildCoachReport(
      baseInput({ habits: [{ id: "h2", name: "Run", rate: 0.2, logs: 12 }] })
    );
    expect(r.recommendations.some((n) => n.id === "rec-shrink")).toBe(true);
  });

  it("falls back to a finish-today nudge when nothing else applies", () => {
    const r = buildCoachReport(baseInput({ remainingToday: 2 }));
    expect(r.recommendations.some((n) => n.id === "rec-finish-today")).toBe(true);
  });

  it("caps insights and recommendations at 3", () => {
    const w = flatWeekday(0.3, 8); // weak everywhere
    const r = buildCoachReport(
      baseInput({
        reading: reading({ state: "slipping", delta: -10, load: { acute: 6, chronic: 3, acwr: 2 } }),
        weekday: w,
        todayDow: 3,
        habits: [
          { id: "a", name: "A", rate: 0.95, logs: 20 },
          { id: "b", name: "B", rate: 0.2, logs: 12 },
        ],
      })
    );
    expect(r.insights.length).toBeLessThanOrEqual(3);
    expect(r.recommendations.length).toBeLessThanOrEqual(3);
  });
});
