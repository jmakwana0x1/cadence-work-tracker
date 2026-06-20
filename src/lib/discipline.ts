import type { HabitLog, ScoreComponents } from "@/types/database";

interface ComputeInput {
  habits: { id: string }[];
  habitLogs: HabitLog[];       // today's logs only
  tasksTotal: number;          // tasks due today
  tasksCompleted: number;      // tasks completed today
  blocksTotal: number;         // time blocks today
  blocksHit: number;           // hit + 0.5 * partial
}

// Weights per component. If a category has no data, its weight is redistributed.
const BASE_WEIGHTS = { habit: 0.5, task: 0.3, schedule: 0.2 };

export function computeDisciplineScore(input: ComputeInput): {
  score: number;
  components: ScoreComponents;
} {
  const { habits, habitLogs, tasksTotal, tasksCompleted, blocksTotal, blocksHit } = input;

  // Habit consistency: done=1, partial=0.5, skip/unlogged=0
  const habitPct =
    habits.length === 0
      ? 0
      : habitLogs.reduce((sum, l) => {
          if (l.status === "done") return sum + 1;
          if (l.status === "partial") return sum + 0.5;
          return sum;
        }, 0) / habits.length;

  const taskPct = tasksTotal === 0 ? null : tasksCompleted / tasksTotal;
  const schedulePct = blocksTotal === 0 ? null : blocksHit / blocksTotal;

  // Redistribute weights for missing components
  let totalWeight = BASE_WEIGHTS.habit;
  if (taskPct !== null) totalWeight += BASE_WEIGHTS.task;
  if (schedulePct !== null) totalWeight += BASE_WEIGHTS.schedule;

  const score =
    totalWeight === 0
      ? 0
      : ((habitPct * BASE_WEIGHTS.habit +
          (taskPct ?? 0) * (taskPct !== null ? BASE_WEIGHTS.task : 0) +
          (schedulePct ?? 0) * (schedulePct !== null ? BASE_WEIGHTS.schedule : 0)) /
          totalWeight) *
        100;

  return {
    score: Math.round(score * 10) / 10,
    components: {
      habit_pct: Math.round(habitPct * 1000) / 10,
      task_pct: taskPct !== null ? Math.round(taskPct * 1000) / 10 : -1,
      schedule_pct: schedulePct !== null ? Math.round(schedulePct * 1000) / 10 : -1,
    },
  };
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-cadence-accent";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

export function scoreDeltaColor(delta: number): string {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-muted-foreground";
}
