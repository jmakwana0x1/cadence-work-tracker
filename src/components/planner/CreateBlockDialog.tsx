"use client";

import { useRef, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlock } from "@/lib/actions/blocks";
import { toast } from "sonner";

const CATEGORIES = ["work", "health", "learning", "fitness", "mindfulness", "personal", "general"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function defaultTimes(hour?: number) {
  const h = hour ?? new Date().getHours();
  return {
    start: `${pad(h)}:00`,
    end:   `${pad(Math.min(h + 1, 23))}:00`,
  };
}

interface CreateBlockDialogProps {
  open: boolean;
  defaultHour?: number;
  date: string;
  onClose: () => void;
}

export function CreateBlockDialog({ open, defaultHour, date, onClose }: CreateBlockDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const times = defaultTimes(defaultHour);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("date", date);

    startTransition(async () => {
      try {
        await createBlock(fd);
        toast.success("Block added");
        onClose();
        formRef.current?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create block");
      }
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-card relative z-10 w-full max-w-sm p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Time Block</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="planned_label" className="text-sm text-muted-foreground">Label</Label>
                <Input
                  id="planned_label"
                  name="planned_label"
                  placeholder="e.g. Deep work, Gym, Reading"
                  required
                  className="bg-white/5 border-white/10 focus:border-cadence-accent/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start_time" className="text-sm text-muted-foreground">Start</Label>
                  <Input
                    id="start_time"
                    name="start_time"
                    type="time"
                    defaultValue={times.start}
                    required
                    className="bg-white/5 border-white/10 [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end_time" className="text-sm text-muted-foreground">End</Label>
                  <Input
                    id="end_time"
                    name="end_time"
                    type="time"
                    defaultValue={times.end}
                    required
                    className="bg-white/5 border-white/10 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm text-muted-foreground">Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat, i) => (
                    <label key={cat} className="cursor-pointer">
                      <input type="radio" name="category" value={cat} defaultChecked={i === 0} className="sr-only peer" />
                      <span className="px-2.5 py-1 rounded-lg text-xs capitalize transition-all bg-white/5 text-muted-foreground peer-checked:bg-cadence-accent/20 peer-checked:text-cadence-accent peer-checked:ring-1 peer-checked:ring-cadence-accent/40">
                        {cat}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="bg-cadence-accent hover:bg-cadence-accent/90 text-white rounded-xl"
              >
                {isPending ? "Adding…" : "Add Block"}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
