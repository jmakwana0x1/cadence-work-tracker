"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { localToday, userTimezone } from "@/lib/date";
import { defaultSeasonEnd } from "@/lib/season";

export async function startSeason(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("A season needs a title");
  const theme = (formData.get("theme") as string)?.trim() || null;

  const start = localToday(userTimezone(user));
  const end = defaultSeasonEnd(start);

  const { error } = await supabase.from("seasons").insert({
    user_id: user.id,
    title,
    theme,
    started_on: start,
    ends_on: end,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
