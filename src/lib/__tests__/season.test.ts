import { describe, it, expect } from "vitest";
import {
  dayDiff,
  defaultSeasonEnd,
  seasonProgress,
  SEASON_LENGTH_DAYS,
} from "@/lib/season";

describe("dayDiff", () => {
  it("counts whole days, signed", () => {
    expect(dayDiff("2026-01-01", "2026-01-08")).toBe(7);
    expect(dayDiff("2026-01-08", "2026-01-01")).toBe(-7);
    expect(dayDiff("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("handles month/year boundaries", () => {
    expect(dayDiff("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("defaultSeasonEnd", () => {
  it("spans 84 inclusive days (12 weeks)", () => {
    const start = "2026-01-01";
    const end = defaultSeasonEnd(start);
    expect(dayDiff(start, end) + 1).toBe(SEASON_LENGTH_DAYS);
  });
});

describe("seasonProgress", () => {
  const start = "2026-01-01";
  const end = defaultSeasonEnd(start); // 2026-03-25

  it("reports day 1 / week 1 on the first day", () => {
    const p = seasonProgress(start, end, start);
    expect(p.dayNumber).toBe(1);
    expect(p.weekNumber).toBe(1);
    expect(p.totalWeeks).toBe(12);
    expect(p.daysRemaining).toBe(83);
    expect(p.hasStarted).toBe(true);
    expect(p.isComplete).toBe(false);
  });

  it("advances week number with elapsed days", () => {
    const p = seasonProgress(start, end, "2026-01-08"); // day 8
    expect(p.dayNumber).toBe(8);
    expect(p.weekNumber).toBe(2);
  });

  it("clamps before the start (not yet begun)", () => {
    const p = seasonProgress(start, end, "2025-12-20");
    expect(p.dayNumber).toBe(1);
    expect(p.hasStarted).toBe(false);
    expect(p.isComplete).toBe(false);
  });

  it("marks the final day as the last day, not complete", () => {
    const p = seasonProgress(start, end, end);
    expect(p.dayNumber).toBe(SEASON_LENGTH_DAYS);
    expect(p.weekNumber).toBe(12);
    expect(p.daysRemaining).toBe(0);
    expect(p.isComplete).toBe(false);
    expect(p.percent).toBe(100);
  });

  it("is complete once today is past the end", () => {
    const p = seasonProgress(start, end, "2026-03-26");
    expect(p.isComplete).toBe(true);
    expect(p.daysRemaining).toBe(0);
  });
});
