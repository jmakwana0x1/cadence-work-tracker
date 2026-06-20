import { createClient } from "@/lib/supabase/server";
import { Planner } from "./Planner";
import type { TimeBlock } from "@/types/database";

export async function PlannerLoader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("time_blocks")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("start_time");

  return <Planner blocks={(data ?? []) as TimeBlock[]} date={today} />;
}
