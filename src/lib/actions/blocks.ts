"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { upsertDailyScore } from "@/lib/actions/score";
import { localToday, userTimezone } from "@/lib/date";
import type { BlockStatus } from "@/types/database";

export async function createBlock(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const planned_label = (formData.get("planned_label") as string)?.trim();
  const category = (formData.get("category") as string) || "general";
  const date = (formData.get("date") as string) || localToday(userTimezone(user));
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;

  if (!planned_label) throw new Error("Label required");
  if (!start_time || !end_time) throw new Error("Start and end time required");
  if (start_time >= end_time) throw new Error("End time must be after start time");

  const { error } = await supabase.from("time_blocks").insert({
    user_id: user.id,
    date,
    start_time,
    end_time,
    category,
    planned_label,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function updateBlockTimes(
  blockId: string,
  start_time: string,
  end_time: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("time_blocks")
    .update({ start_time, end_time })
    .eq("id", blockId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function markBlock(blockId: string, status: BlockStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("time_blocks")
    .update({ actual_status: status })
    .eq("id", blockId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  void upsertDailyScore();
  revalidatePath("/dashboard");
}

export async function deleteBlock(blockId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("time_blocks")
    .delete()
    .eq("id", blockId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
