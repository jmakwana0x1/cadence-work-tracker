import { describe, it, expect } from "vitest";
import {
  emaAlpha,
  cadenceSeries,
  currentCadence,
  mean,
  loadReading,
  rhythmState,
  computeRhythm,
  CADENCE_HALF_LIFE,
} from "@/lib/rhythm";

describe("emaAlpha", () => {
  it("derives alpha from a half-life", () => {
    // After `halfLife` days a single pulse should have decayed to ~half.
    const a = emaAlpha(7);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(Math.pow(1 - a, 7)).toBeCloseTo(0.5, 5);
  });
});

describe("cadenceSeries", () => {
  it("returns empty for no input", () => {
    expect(cadenceSeries([])).toEqual([]);
  });

  it("holds steady at 100 for perfect completion", () => {
    const s = cadenceSeries(Array(30).fill(1));
    expect(s[s.length - 1]).toBe(100);
  });

  it("holds at 0 for no completion", () => {
    const s = cadenceSeries(Array(30).fill(0));
    expect(s[s.length - 1]).toBe(0);
  });

  it("dents on a single miss but does not collapse", () => {
    const before = cadenceSeries(Array(20).fill(1));
    const withMiss = cadenceSeries([...Array(20).fill(1), 0]);
    const last = withMiss[withMiss.length - 1];
    expect(last).toBeLessThan(before[before.length - 1]);
    expect(last).toBeGreaterThan(80); // one miss shouldn't wipe momentum
  });

  it("recovers faster than it would under a flat average", () => {
    // Long perfect run, one bad day, then resume — cadence should climb back up.
    const series = cadenceSeries([...Array(20).fill(1), 0, 1, 1, 1]);
    const dip = cadenceSeries([...Array(20).fill(1), 0]);
    expect(series[series.length - 1]).toBeGreaterThan(dip[dip.length - 1]);
  });
});

describe("currentCadence", () => {
  it("is 0 for empty input", () => {
    expect(currentCadence([])).toBe(0);
  });
  it("matches the tail of the series", () => {
    const completions = [1, 0.5, 1, 1, 0];
    const s = cadenceSeries(completions, CADENCE_HALF_LIFE);
    expect(currentCadence(completions)).toBe(s[s.length - 1]);
  });
});

describe("mean", () => {
  it("is 0 for empty", () => expect(mean([])).toBe(0));
  it("averages", () => expect(mean([2, 4, 6])).toBe(4));
});

describe("loadReading / ACWR", () => {
  it("is zero with no history", () => {
    expect(loadReading([])).toEqual({ acute: 0, chronic: 0, acwr: 0 });
  });

  it("reports ~1.0 for steady load", () => {
    const { acwr } = loadReading(Array(28).fill(3));
    expect(acwr).toBeCloseTo(1, 2);
  });

  it("reports a spike (>1.5) when recent load jumps", () => {
    // 21 quiet days, then 7 heavy days.
    const attempts = [...Array(21).fill(1), ...Array(7).fill(6)];
    const { acwr } = loadReading(attempts);
    expect(acwr).toBeGreaterThan(1.5);
  });
});

describe("rhythmState", () => {
  it("is dormant without history", () => {
    expect(rhythmState(0, 0, 0, false)).toBe("dormant");
  });
  it("flags overreaching on a load spike", () => {
    expect(rhythmState(85, 2, 1.6, true)).toBe("overreaching");
  });
  it("is in-rhythm when high and steady", () => {
    expect(rhythmState(82, 1, 1.0, true)).toBe("in-rhythm");
  });
  it("slips when falling fast", () => {
    expect(rhythmState(70, -8, 1.0, true)).toBe("slipping");
  });
  it("recovers when climbing out of a dip", () => {
    expect(rhythmState(50, 6, 1.0, true)).toBe("recovering");
  });
  it("builds in the middle band", () => {
    expect(rhythmState(55, 1, 1.0, true)).toBe("building");
  });
});

describe("computeRhythm", () => {
  it("is dormant for empty input", () => {
    const r = computeRhythm([], []);
    expect(r.state).toBe("dormant");
    expect(r.cadence).toBe(0);
  });

  it("produces an in-rhythm reading for a strong sustained run", () => {
    const r = computeRhythm(Array(28).fill(1), Array(28).fill(3));
    expect(r.cadence).toBe(100);
    expect(r.state).toBe("in-rhythm");
    expect(r.load.acwr).toBeCloseTo(1, 2);
  });

  it("computes a positive delta when momentum is rising", () => {
    // Bad start, strong finish → cadence now > cadence a week ago.
    const completions = [...Array(14).fill(0.2), ...Array(14).fill(1)];
    const r = computeRhythm(completions, Array(28).fill(2));
    expect(r.delta).toBeGreaterThan(0);
  });
});
