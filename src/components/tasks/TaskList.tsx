import { createClient } from "@/lib/supabase/server";
import { QuickCapture } from "./QuickCapture";
import { TaskRow } from "./TaskRow";
import type { Task } from "@/types/database";

export async function TaskList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true }) // high < low alphabetically, handle in sort
    .limit(50);

  const tasks = (data ?? []) as Task[];

  // Sort: incomplete first (high → med → low priority), then completed
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const sorted = [...tasks].sort((a, b) => {
    const aDone = a.completed_at !== null ? 1 : 0;
    const bDone = b.completed_at !== null ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  const incomplete = sorted.filter((t) => !t.completed_at);
  const completed = sorted.filter((t) => t.completed_at);

  const overdueCount = incomplete.filter((t) => {
    if (!t.due_at) return false;
    return new Date(t.due_at) < new Date(new Date().toDateString());
  }).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tasks</h2>
          <p className="text-xs text-muted-foreground">
            {incomplete.length} remaining
            {overdueCount > 0 && (
              <span className="text-red-400 ml-1">· {overdueCount} overdue</span>
            )}
          </p>
        </div>
      </div>

      <QuickCapture />

      {tasks.length === 0 ? (
        <div className="glass-card p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-2xl">✅</p>
          <p className="text-sm font-medium text-foreground">No tasks yet</p>
          <p className="text-xs text-muted-foreground">Capture what you need to do above.</p>
        </div>
      ) : (
        <div className="glass-card px-4 py-1">
          {incomplete.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}

          {completed.length > 0 && (
            <>
              {incomplete.length > 0 && <div className="h-px bg-white/5 my-1" />}
              {completed.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
