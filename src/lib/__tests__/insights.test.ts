import { describe, it, expect } from "vitest";
import {
  activityValue,
  weekdayBreakdown,
  bestWorstWeekday,
  categoryBreakdown,
  longestStreak,
} from "../insights";
import type { HabitLog } from "@/types/database";

function log(logged_at: string, status: HabitLog["status"], habit_id = "h1"): HabitLog {
  return { id: logged_at + habit_id, habit_id, user_id: "u1", logged_at, status };
}

describe("activityValue", () => {
  it("weights done/partial/skip", () => {
    expect(activityValue("done")).toBe(1);
    expect(activityValue("partial")).toBe(0.5);
    expect(activityValue("skip")).toBe(0);
  });
});

describe("weekdayBreakdown + bestWorstWeekday", () => {
  it("buckets activity by weekday and ignores skips", () => {
    // 2026-06-20 is Saturday(6), 2026-06-21 Sunday(0), 2026-06-22 Monday(1)
    const logs = [
      log("2026-06-20", "done"),
      log("2026-06-20", "partial", "h2"),
      log("2026-06-22", "done"),
      log("2026-06-21", "skip"),
    ];
    const stats = weekdayBreakdown(logs);
    expect(stats[6].value).toBe(1.5); // Saturday: 1 + 0.5
    expect(stats[1].value).toBe(1); // Monday
    expect(stats[0].value).toBe(0); // Sunday skip ignored

    const { best, worst } = bestWorstWeekday(stats);
    expect(best?.dow).toBe(6);
    expect(worst?.dow).toBe(1);
  });

  it("returns nulls with no activity", () => {
    const { best, worst } = bestWorstWeekday(weekdayBreakdown([log("2026-06-20", "skip")]));
    expect(best).toBeNull();
    expect(worst).toBeNull();
  });
});

describe("categoryBreakdown", () => {
  it("computes adherence per category sorted strongest first", () => {
    const categoryOf = new Map([
      ["h1", "fitness"],
      ["h2", "mind"],
    ]);
    const logs = [
      log("2026-06-20", "done", "h1"),
      log("2026-06-19", "done", "h1"),
      log("2026-06-20", "partial", "h2"),
      log("2026-06-19", "skip", "h2"),
    ];
    const result = categoryBreakdown(logs, categoryOf);
    expect(result[0]).toEqual({ category: "fitness", adherencePct: 100, logs: 2 });
    expect(result[1]).toEqual({ category: "mind", adherencePct: 25, logs: 2 }); // (0.5+0)/2
  });

  it("falls back to 'general' for unknown habits", () => {
    const result = categoryBreakdown([log("2026-06-20", "done", "ghost")], new Map());
    expect(result[0].category).toBe("general");
  });
});

describe("longestStreak", () => {
  it("finds the longest consecutive run", () => {
    const dates = new Set([
      "2026-06-10",
      "2026-06-11",
      "2026-06-12", // run of 3
      "2026-06-20",
      "2026-06-21", // run of 2
    ]);
    expect(longestStreak(dates)).toBe(3);
  });

  it("handles empty and singletons", () => {
    expect(longestStreak(new Set())).toBe(0);
    expect(longestStreak(new Set(["2026-06-20"]))).toBe(1);
  });
});
