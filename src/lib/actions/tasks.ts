"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { upsertDailyScore } from "@/lib/actions/score";
import type { TaskPriority } from "@/types/database";

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("Title is required");

  const category = (formData.get("category") as string) || "general";
  const priority = (formData.get("priority") as TaskPriority) || "medium";
  const due_at = (formData.get("due_at") as string) || null;

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    category,
    priority,
    due_at: due_at ? new Date(due_at).toISOString() : null,
  });

  if (error) throw new Error(error.message);
  void upsertDailyScore();
  revalidatePath("/dashboard");
}

export async function toggleTask(taskId: string, currentlyCompleted: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("tasks")
    .update({ completed_at: currentlyCompleted ? null : new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  void upsertDailyScore();
  revalidatePath("/dashboard");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  void upsertDailyScore();
  revalidatePath("/dashboard");
}
