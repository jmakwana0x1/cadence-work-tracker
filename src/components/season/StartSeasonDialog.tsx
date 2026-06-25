"use client";

import { useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startSeason } from "@/lib/actions/seasons";
import { toast } from "sonner";

interface StartSeasonDialogProps {
  // Label varies: starting your first season vs. beginning a new one.
  variant?: "primary" | "subtle";
  children?: React.ReactNode;
}

export function StartSeasonDialog({ variant = "primary", children }: StartSeasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!(fd.get("title") as string)?.trim()) return;

    startTransition(async () => {
      try {
        await startSeason(fd);
        toast.success("Season started", { description: "12 weeks. Make them count." });
        setOpen(false);
        formRef.current?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start season");
      }
    });
  }

  return (
    <>
      {children ? (
        <button type="button" onClick={() => setOpen(true)} className="contents">
          {children}
        </button>
      ) : variant === "primary" ? (
        <Button
          onClick={() => setOpen(true)}
          className="gap-2 rounded-xl bg-cadence-accent text-white hover:bg-cadence-accent/90"
        >
          <Flag className="h-4 w-4" />
          Start a season
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.08]"
        >
          <Flag className="h-3.5 w-3.5 text-cadence-accent" />
          New season
        </button>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="glass-card relative z-10 flex w-full max-w-md flex-col gap-5 p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Start a season</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="-mt-2 text-xs text-muted-foreground">
                A season is 12 weeks. Name the chapter you&apos;re entering and what it&apos;s about.
              </p>

              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title" className="text-sm text-muted-foreground">
                    Title
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g. Summer of Strength"
                    required
                    autoComplete="off"
                    className="border-white/10 bg-white/5 focus:border-cadence-accent/50 focus:ring-cadence-accent/20"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="theme" className="text-sm text-muted-foreground">
                    Theme <span className="text-muted-foreground/50">(optional)</span>
                  </Label>
                  <Input
                    id="theme"
                    name="theme"
                    placeholder="e.g. Show up before sunrise, every day"
                    autoComplete="off"
                    className="border-white/10 bg-white/5 focus:border-cadence-accent/50 focus:ring-cadence-accent/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="mt-1 h-10 rounded-xl bg-cadence-accent text-white hover:bg-cadence-accent/90"
                >
                  {isPending ? "Starting…" : "Begin 12 weeks"}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
