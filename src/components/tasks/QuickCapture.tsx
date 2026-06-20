"use client";

import { useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, ChevronDown } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import { toast } from "sonner";
import type { TaskPriority } from "@/types/database";

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "high",   label: "High",   color: "text-red-400" },
  { value: "medium", label: "Med",    color: "text-amber-400" },
  { value: "low",    label: "Low",    color: "text-slate-400" },
];

const CATEGORIES = ["general", "work", "health", "learning", "personal"];

export function QuickCapture() {
  const [expanded, setExpanded] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [category, setCategory] = useState("general");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("priority", priority);
    fd.set("category", category);

    const title = (fd.get("title") as string)?.trim();
    if (!title) return;

    startTransition(async () => {
      try {
        await createTask(fd);
        toast.success("Task added", { description: title });
        formRef.current?.reset();
        setExpanded(false);
        setPriority("medium");
        setCategory("general");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add task");
      }
    });
  }

  const priorityCfg = PRIORITIES.find((p) => p.value === priority)!;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="glass-card p-3 flex flex-col gap-2">
      {/* Main input row */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-shrink-0 w-6 h-6 rounded-full border border-white/20 hover:border-cadence-accent/60 hover:bg-cadence-accent/10 flex items-center justify-center transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <input
          ref={inputRef}
          name="title"
          placeholder="Add a task…"
          autoComplete="off"
          disabled={isPending}
          onFocus={() => setExpanded(true)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
        />

        {/* Priority quick-toggle */}
        <button
          type="button"
          onClick={() => {
            const idx = PRIORITIES.findIndex((p) => p.value === priority);
            setPriority(PRIORITIES[(idx + 1) % PRIORITIES.length].value);
          }}
          className={`text-xs font-medium px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors ${priorityCfg.color}`}
        >
          {priorityCfg.label}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Expanded options */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
              {/* Category */}
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2 py-0.5 rounded-md text-xs capitalize transition-colors ${
                      category === cat
                        ? "bg-cadence-accent/20 text-cadence-accent"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Due date */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Calendar className="h-3 w-3 text-muted-foreground/50" />
                <input
                  type="date"
                  name="due_at"
                  className="bg-transparent text-xs text-muted-foreground outline-none [color-scheme:dark]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
