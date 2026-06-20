import { describe, it, expect } from "vitest";
import { computeDisciplineScore } from "../discipline";
import type { HabitLog } from "@/types/database";

function hlog(habit_id: string, status: HabitLog["status"]): HabitLog {
  return { id: habit_id, habit_id, user_id: "u1", logged_at: "2026-06-20", status };
}

describe("computeDisciplineScore", () => {
  it("is 100 when everything is done", () => {
    const { score, components } = computeDisciplineScore({
      habits: [{ id: "a" }, { id: "b" }],
      habitLogs: [hlog("a", "done"), hlog("b", "done")],
      tasksTotal: 2,
      tasksCompleted: 2,
      blocksTotal: 1,
      blocksHit: 1,
    });
    expect(score).toBe(100);
    expect(components.habit_pct).toBe(100);
    expect(components.task_pct).toBe(100);
    expect(components.schedule_pct).toBe(100);
  });

  it("counts partial habits as half", () => {
    const { components } = computeDisciplineScore({
      habits: [{ id: "a" }, { id: "b" }],
      habitLogs: [hlog("a", "done"), hlog("b", "partial")],
      tasksTotal: 0,
      tasksCompleted: 0,
      blocksTotal: 0,
      blocksHit: 0,
    });
    expect(components.habit_pct).toBe(75); // (1 + 0.5) / 2
  });

  it("redistributes weight when tasks and schedule have no data", () => {
    // Only habits present → habit pct becomes the whole score
    const { score, components } = computeDisciplineScore({
      habits: [{ id: "a" }],
      habitLogs: [hlog("a", "done")],
      tasksTotal: 0,
      tasksCompleted: 0,
      blocksTotal: 0,
      blocksHit: 0,
    });
    expect(score).toBe(100);
    expect(components.task_pct).toBe(-1); // sentinel for "no data"
    expect(components.schedule_pct).toBe(-1);
  });

  it("weights habits at 0.5 relative to tasks at 0.3", () => {
    // habits perfect, tasks zero, no schedule.
    // weighted = (1*0.5 + 0*0.3) / (0.5+0.3) = 0.5/0.8 = 62.5
    const { score } = computeDisciplineScore({
      habits: [{ id: "a" }],
      habitLogs: [hlog("a", "done")],
      tasksTotal: 4,
      tasksCompleted: 0,
      blocksTotal: 0,
      blocksHit: 0,
    });
    expect(score).toBe(62.5);
  });

  it("returns 0 habit pct when there are no habits", () => {
    const { components } = computeDisciplineScore({
      habits: [],
      habitLogs: [],
      tasksTotal: 1,
      tasksCompleted: 1,
      blocksTotal: 0,
      blocksHit: 0,
    });
    expect(components.habit_pct).toBe(0);
  });
});
