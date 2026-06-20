"use server";

import { createClient } from "@/lib/supabase/server";
import { computeDisciplineScore } from "@/lib/discipline";
import { localToday, localDateStr, userTimezone } from "@/lib/date";
import { revalidatePath } from "next/cache";
import type { HabitLog } from "@/types/database";

export async function upsertDailyScore(dateStr?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tz = userTimezone(user);
  const date = dateStr ?? localToday(tz);

  const [{ data: habits }, { data: habitLogs }, { data: tasks }, { data: blocks }] =
    await Promise.all([
      supabase.from("habits").select("id").eq("user_id", user.id),
      supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("logged_at", date),
      // Tasks carry a timestamptz due date; scope to those *due on `date`* in the
      // user's timezone. Without this the score counts the entire backlog.
      supabase
        .from("tasks")
        .select("due_at, completed_at")
        .eq("user_id", user.id)
        .not("due_at", "is", null),
      supabase
        .from("time_blocks")
        .select("actual_status")
        .eq("user_id", user.id)
        .eq("date", date),
    ]);

  const dueToday = (tasks ?? []).filter(
    (t) => t.due_at && localDateStr(new Date(t.due_at), tz) === date
  );
  const tasksTotal = dueToday.length;
  const tasksCompleted = dueToday.filter((t) => t.completed_at !== null).length;

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
