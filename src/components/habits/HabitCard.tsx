"use client";

import { useOptimistic, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Minus, X, Snowflake } from "lucide-react";
import { logHabit, deleteHabit, useFreezeToken } from "@/lib/actions/habits";
import { flameLevel } from "@/lib/streaks";
import { toast } from "sonner";
import type { HabitWithTodayLog, HabitStatus } from "@/types/database";

interface HabitCardProps {
  habit: HabitWithTodayLog;
  streak: number;
  missedDayToFreeze: string | null;
}

const STATUS_CONFIG = {
  done:    { icon: Check, label: "Done",    bg: "bg-emerald-500/20", ring: "ring-emerald-500/40", text: "text-emerald-400" },
  partial: { icon: Minus, label: "Partial", bg: "bg-amber-500/20",   ring: "ring-amber-500/40",   text: "text-amber-400"  },
  skip:    { icon: X,     label: "Skip",    bg: "bg-red-500/20",     ring: "ring-red-500/40",     text: "text-red-400"    },
} as const;

// Flame emoji grows with streak level
const FLAME_CONFIG = {
  0: { emoji: null,  glow: "" },
  1: { emoji: "🔥",  glow: "" },
  2: { emoji: "🔥",  glow: "drop-shadow(0 0 4px #f97316)" },
  3: { emoji: "🔥",  glow: "drop-shadow(0 0 8px #f97316)" },
  4: { emoji: "🔥",  glow: "drop-shadow(0 0 14px #fb923c)" },
} as const;

const FLAME_SCALE = [1, 1, 1.15, 1.3, 1.5] as const;

export function HabitCard({ habit, streak, missedDayToFreeze }: HabitCardProps) {
  const [isPending, startTransition] = useTransition();
  const serverStatus = habit.today_log?.status ?? null;
  // Optimistic status so the card flips the moment you tap, before the server
  // round-trip + revalidation completes.
  const [todayStatus, setOptimisticStatus] = useOptimistic<HabitStatus | null, HabitStatus | null>(
    serverStatus,
    (_, next) => next
  );
  const level = flameLevel(streak);
  const flame = FLAME_CONFIG[level];

  function handleLog(status: HabitStatus) {
    startTransition(async () => {
      setOptimisticStatus(status);
      try {
        const result = await logHabit(habit.id, status);
        const labels = { done: "Logged ✓", partial: "Partial logged", skip: "Skipped" };
        toast.success(labels[status], { description: habit.name });
        if (result.awardedToken) {
          toast("🧊 Freeze token earned!", {
            description: `${result.newStreak}-day streak milestone — one token added.`,
          });
        }
      } catch {
        toast.error("Failed to log");
      }
    });
  }

  function handleFreeze() {
    if (!missedDayToFreeze) return;
    startTransition(async () => {
      try {
        await useFreezeToken(habit.id, missedDayToFreeze);
        toast.success("🧊 Streak protected!", {
          description: `Freeze token used for ${missedDayToFreeze}. Streak continues.`,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to use freeze token");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteHabit(habit.id);
        toast.success("Habit removed");
      } catch {
        toast.error("Failed to delete habit");
      }
    });
  }

  const logged = todayStatus !== null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-4 flex flex-col gap-3 transition-opacity ${isPending ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
            style={{ backgroundColor: habit.color, boxShadow: `0 0 6px ${habit.color}80` }}
          />
          <div>
            <p className="font-medium text-sm text-foreground leading-tight">{habit.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{habit.category} · {habit.target_frequency}×/wk</p>
          </div>
        </div>

        {/* Streak + tokens */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {streak > 0 && flame.emoji && (
            <motion.span
              key={streak}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: FLAME_SCALE[level], opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="flex items-center gap-0.5 text-xs font-semibold tabular-nums"
              style={{ filter: flame.glow }}
            >
              {flame.emoji} {streak}
            </motion.span>
          )}
          {habit.freeze_tokens > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-sky-400">
              {Array.from({ length: Math.min(habit.freeze_tokens, 3) }).map((_, i) => (
                <Snowflake key={i} className="h-3 w-3" />
              ))}
              {habit.freeze_tokens > 3 && <span className="text-[10px]">+{habit.freeze_tokens - 3}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Freeze token offer */}
      <AnimatePresence>
        {missedDayToFreeze && habit.freeze_tokens > 0 && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onClick={handleFreeze}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-xs font-medium transition-colors text-left"
          >
            <Snowflake className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Yesterday missed — use a freeze token to protect your streak?</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Log buttons */}
      {logged ? (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ${STATUS_CONFIG[todayStatus!].bg} ${STATUS_CONFIG[todayStatus!].ring}`}>
          {(() => { const Icon = STATUS_CONFIG[todayStatus!].icon; return <Icon className={`h-4 w-4 ${STATUS_CONFIG[todayStatus!].text}`} />; })()}
          <span className={`text-sm font-medium ${STATUS_CONFIG[todayStatus!].text}`}>
            {STATUS_CONFIG[todayStatus!].label} today
          </span>
          <button
            onClick={() => handleLog("done")}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            change
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {(["done", "partial", "skip"] as const).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <motion.button
                key={s}
                whileTap={{ scale: 0.93 }}
                onClick={() => handleLog(s)}
                disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors
                  ${s === "done"    ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400" : ""}
                  ${s === "partial" ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"       : ""}
                  ${s === "skip"    ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"             : ""}
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-muted-foreground/40 hover:text-red-400/60 transition-colors text-right"
      >
        remove
      </button>
    </motion.div>
  );
}
