import { describe, it, expect } from "vitest";
import {
  computeStreak,
  getMissedDayToFreeze,
  shouldAwardFreezeToken,
  flameLevel,
} from "../streaks";
import type { HabitLog } from "@/types/database";

const TODAY = "2026-06-20";

function log(logged_at: string, status: HabitLog["status"] = "done"): HabitLog {
  return { id: logged_at, habit_id: "h1", user_id: "u1", logged_at, status };
}

describe("computeStreak", () => {
  it("counts back from today when today is logged", () => {
    const logs = [log("2026-06-20"), log("2026-06-19"), log("2026-06-18")];
    expect(computeStreak("h1", logs, TODAY)).toBe(3);
  });

  it("keeps the streak alive when today is not yet logged", () => {
    // Today unlogged, but yesterday + before are done — streak still 2
    const logs = [log("2026-06-19"), log("2026-06-18")];
    expect(computeStreak("h1", logs, TODAY)).toBe(2);
  });

  it("breaks on a gap day", () => {
    const logs = [log("2026-06-20"), log("2026-06-18")]; // 19th missing
    expect(computeStreak("h1", logs, TODAY)).toBe(1);
  });

  it("counts partial days but ignores skip days", () => {
    const logs = [log("2026-06-20", "partial"), log("2026-06-19", "skip"), log("2026-06-18")];
    // skip is excluded from doneDays → 19th is a gap → streak is just today
    expect(computeStreak("h1", logs, TODAY)).toBe(1);
  });

  it("returns 0 when nothing recent is logged", () => {
    expect(computeStreak("h1", [log("2026-06-01")], TODAY)).toBe(0);
  });

  it("only counts the requested habit", () => {
    const other: HabitLog = { ...log("2026-06-20"), habit_id: "h2" };
    expect(computeStreak("h1", [other], TODAY)).toBe(0);
  });
});

describe("getMissedDayToFreeze", () => {
  it("offers yesterday when there's a gap protecting a prior streak", () => {
    // today unlogged, yesterday (19th) unlogged, day-before (18th) active
    const logs = [log("2026-06-18"), log("2026-06-17")];
    expect(getMissedDayToFreeze("h1", logs, TODAY)).toBe("2026-06-19");
  });

  it("offers nothing once today is logged", () => {
    const logs = [log("2026-06-20"), log("2026-06-18")];
    expect(getMissedDayToFreeze("h1", logs, TODAY)).toBeNull();
  });

  it("offers nothing when yesterday was logged", () => {
    const logs = [log("2026-06-19"), log("2026-06-18")];
    expect(getMissedDayToFreeze("h1", logs, TODAY)).toBeNull();
  });

  it("offers nothing when there was no streak to protect", () => {
    const logs = [log("2026-06-15")]; // day-before-yesterday inactive
    expect(getMissedDayToFreeze("h1", logs, TODAY)).toBeNull();
  });
});

describe("shouldAwardFreezeToken", () => {
  it("awards exactly at milestones", () => {
    expect(shouldAwardFreezeToken(7)).toBe(true);
    expect(shouldAwardFreezeToken(30)).toBe(true);
    expect(shouldAwardFreezeToken(365)).toBe(true);
  });
  it("does not award off-milestone", () => {
    expect(shouldAwardFreezeToken(6)).toBe(false);
    expect(shouldAwardFreezeToken(8)).toBe(false);
    expect(shouldAwardFreezeToken(0)).toBe(false);
  });
});

describe("flameLevel", () => {
  it("buckets streak length into flame levels", () => {
    expect(flameLevel(0)).toBe(0);
    expect(flameLevel(3)).toBe(1);
    expect(flameLevel(6)).toBe(2);
    expect(flameLevel(13)).toBe(3);
    expect(flameLevel(14)).toBe(4);
  });
});
