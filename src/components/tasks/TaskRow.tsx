"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { toggleTask, deleteTask } from "@/lib/actions/tasks";
import { toast } from "sonner";
import type { Task, TaskPriority } from "@/types/database";

const PRIORITY_CONFIG: Record<TaskPriority, { dot: string; label: string }> = {
  high:   { dot: "bg-red-400",   label: "text-red-400/70" },
  medium: { dot: "bg-amber-400", label: "text-amber-400/70" },
  low:    { dot: "bg-slate-400", label: "text-slate-400/70" },
};

function dueDateDisplay(due_at: string | null): { label: string; color: string } | null {
  if (!due_at) return null;
  const due = new Date(due_at);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: "text-red-400" };
  if (diff === 0) return { label: "Today", color: "text-amber-400" };
  if (diff === 1) return { label: "Tomorrow", color: "text-muted-foreground" };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    color: "text-muted-foreground",
  };
}

interface TaskRowProps {
  task: Task;
}

export function TaskRow({ task }: TaskRowProps) {
  const [isPending, startTransition] = useTransition();
  const done = task.completed_at !== null;
  const pCfg = PRIORITY_CONFIG[task.priority];
  const due = dueDateDisplay(task.due_at);

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleTask(task.id, done);
      } catch {
        toast.error("Failed to update task");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        toast.success("Task removed");
      } catch {
        toast.error("Failed to delete task");
      }
    });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isPending ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 py-2.5 px-1 group border-b border-white/[0.04] last:border-0"
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="flex-shrink-0 w-4 h-4 rounded-full border border-white/20 hover:border-cadence-accent/60 flex items-center justify-center transition-all"
        style={done ? { background: "var(--cadence-accent)", borderColor: "var(--cadence-accent)" } : {}}
      >
        {done && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            viewBox="0 0 8 8"
            className="w-2.5 h-2.5"
          >
            <polyline points="1,4 3,6 7,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </button>

      {/* Priority dot */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pCfg.dot} ${done ? "opacity-30" : ""}`} />

      {/* Title */}
      <span className={`flex-1 text-sm transition-all ${done ? "line-through text-muted-foreground/40" : "text-foreground"}`}>
        {task.title}
      </span>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {due && !done && (
          <span className={`text-xs ${due.color}`}>{due.label}</span>
        )}
        <span className={`text-xs capitalize hidden sm:block ${pCfg.label} ${done ? "opacity-30" : ""}`}>
          {task.category}
        </span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-400/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
