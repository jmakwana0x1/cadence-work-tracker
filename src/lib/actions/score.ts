"use server";

import { createClient } from "@/lib/supabase/server";
import { computeDisciplineScore } from "@/lib/discipline";
import { toDateStr } from "@/lib/streaks";
import { revalidatePath } from "next/cache";
import type { HabitLog } from "@/types/database";

export async function upsertDailyScore(dateStr?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const date = dateStr ?? toDateStr(new Date());

  const [{ data: habits }, { data: habitLogs }, { data: tasks }, { data: blocks }] =
    await Promise.all([
      supabase.from("habits").select("id").eq("user_id", user.id),
      supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("logged_at", date),
      supabase
        .from("tasks")
        .select("completed_at")
        .eq("user_id", user.id),
      supabase
        .from("time_blocks")
        .select("actual_status")
        .eq("user_id", user.id)
        .eq("date", date),
    ]);

  const tasksTotal = tasks?.length ?? 0;
  const tasksCompleted = tasks?.filter((t) => t.completed_at !== null).length ?? 0;
  const blocksTotal = blocks?.length ?? 0;
  const blocksHit =
    blocks?.reduce((sum, b) => {
      if (b.actual_status === "hit") return sum + 1;
      if (b.actual_status === "partial") return sum + 0.5;
      return sum;
    }, 0) ?? 0;

  const { score, components } = computeDisciplineScore({
    habits: habits ?? [],
    habitLogs: (habitLogs ?? []) as HabitLog[],
    tasksTotal,
    tasksCompleted,
    blocksTotal,
    blocksHit,
  });

  await supabase.from("daily_scores").upsert(
    { user_id: user.id, date, discipline_score: score, components },
    { onConflict: "user_id,date" }
  );

  revalidatePath("/dashboard");
}
