"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computeStreak, shouldAwardFreezeToken, toDateStr } from "@/lib/streaks";
import { upsertDailyScore } from "@/lib/actions/score";
import type { HabitLog, HabitStatus } from "@/types/database";

export async function createHabit(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const target_frequency = parseInt(formData.get("target_frequency") as string, 10);
  const color = formData.get("color") as string;

  if (!name?.trim()) throw new Error("Name is required");

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name: name.trim(),
    category: category || "general",
    target_frequency: isNaN(target_frequency) ? 7 : target_frequency,
    color: color || "#8b5cf6",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function logHabit(
  habitId: string,
  status: HabitStatus
): Promise<{ awardedToken: boolean; newStreak: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const today = toDateStr(new Date());

  const { error } = await supabase.from("habit_logs").upsert(
    { habit_id: habitId, user_id: user.id, logged_at: today, status },
    { onConflict: "habit_id,logged_at" }
  );
  if (error) throw new Error(error.message);

  // Recompute streak to check for milestone
  const { data: logs } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("habit_id", habitId)
    .eq("user_id", user.id);

  const streak = computeStreak(habitId, (logs ?? []) as HabitLog[]);
  const awardToken = status !== "skip" && shouldAwardFreezeToken(streak);

  if (awardToken) {
    await supabase.rpc("increment_freeze_tokens", {
      p_habit_id: habitId,
      p_user_id: user.id,
    });
  }

  // Update today's discipline score in background (non-blocking)
  void upsertDailyScore();

  revalidatePath("/dashboard");
  return { awardedToken: awardToken, newStreak: streak };
}

export async function useFreezeToken(habitId: string, missedDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify the habit belongs to user and has tokens
  const { data: habit } = await supabase
    .from("habits")
    .select("freeze_tokens")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();

  if (!habit) throw new Error("Habit not found");
  if (habit.freeze_tokens <= 0) throw new Error("No freeze tokens remaining");

  // Insert a "done" log for the missed date to bridge the streak
  const { error: logError } = await supabase.from("habit_logs").upsert(
    { habit_id: habitId, user_id: user.id, logged_at: missedDate, status: "done" },
    { onConflict: "habit_id,logged_at" }
  );
  if (logError) throw new Error(logError.message);

  // Decrement token
  const { error: tokenError } = await supabase
    .from("habits")
    .update({ freeze_tokens: habit.freeze_tokens - 1 })
    .eq("id", habitId)
    .eq("user_id", user.id);
  if (tokenError) throw new Error(tokenError.message);

  void upsertDailyScore();
  revalidatePath("/dashboard");
}

export async function deleteHabit(habitId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
