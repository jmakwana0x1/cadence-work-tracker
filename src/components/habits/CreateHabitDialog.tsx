"use client";

import { useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHabit } from "@/lib/actions/habits";
import { toast } from "sonner";

const CATEGORIES = ["general", "health", "learning", "work", "mindfulness", "fitness"];
const COLORS = [
  "#8b5cf6", // violet (default)
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f43f5e", // rose
  "#3b82f6", // blue
];
const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7];

export function CreateHabitDialog() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [freq, setFreq] = useState(7);
  const [category, setCategory] = useState("general");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("color", color);
    fd.set("target_frequency", String(freq));
    fd.set("category", category);

    startTransition(async () => {
      try {
        await createHabit(fd);
        toast.success("Habit created");
        setOpen(false);
        formRef.current?.reset();
        setColor(COLORS[0]);
        setFreq(7);
        setCategory("general");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create habit");
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-cadence-accent hover:bg-cadence-accent/90 text-white rounded-xl"
      >
        <Plus className="h-4 w-4" />
        New Habit
      </Button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="glass-card relative z-10 w-full max-w-md p-6 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">New Habit</h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name" className="text-sm text-muted-foreground">Habit name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Morning run"
                    required
                    className="bg-white/5 border-white/10 focus:border-cadence-accent/50 focus:ring-cadence-accent/20"
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                          category === cat
                            ? "bg-cadence-accent text-white"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target frequency */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm text-muted-foreground">
                    Target — <span className="text-foreground">{freq}×/week</span>
                  </Label>
                  <div className="flex gap-1.5">
                    {FREQUENCIES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFreq(f)}
                        className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                          freq === f
                            ? "bg-cadence-accent text-white"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm text-muted-foreground">Color</Label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="w-7 h-7 rounded-full transition-all focus:outline-none"
                        style={{
                          backgroundColor: c,
                          boxShadow: color === c ? `0 0 0 2px ${c}40, 0 0 0 3px white` : undefined,
                          transform: color === c ? "scale(1.2)" : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="mt-1 bg-cadence-accent hover:bg-cadence-accent/90 text-white rounded-xl h-10"
                >
                  {isPending ? "Creating…" : "Create Habit"}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
