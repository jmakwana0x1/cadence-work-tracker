"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ListPlus,
  Repeat,
  LayoutDashboard,
  BarChart3,
  ArrowLeft,
  CornerDownLeft,
} from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/lib/actions/tasks";
import { createHabit } from "@/lib/actions/habits";

const OPEN_EVENT = "cadence:command";

// Any component can open the palette without prop-drilling.
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const noopSubscribe = () => () => {};

// Resolve the OS via an external store: the server snapshot is false so SSR and
// first client render agree (no hydration mismatch), then the client snapshot
// applies. Defaults to "Ctrl" on the server.
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false
  );
}

// Header trigger that mirrors the platform's ⌘K / Ctrl+K shortcut.
export function CommandButton() {
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
      aria-label="Open command palette"
    >
      <Search className="h-4 w-4 text-cadence-accent" />
      <span className="hidden sm:inline">Quick add</span>
      <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}

type Mode = "root" | "task" | "habit";

interface RootCommand {
  id: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  run: "task" | "habit" | string; // mode id, or a nav href
  kind: "mode" | "nav";
}

const COMMANDS: RootCommand[] = [
  { id: "task", label: "New task", hint: "Capture a to-do", icon: ListPlus, run: "task", kind: "mode" },
  { id: "habit", label: "New habit", hint: "Start tracking something", icon: Repeat, run: "habit", kind: "mode" },
  { id: "dashboard", label: "Go to Dashboard", hint: "Today's overview", icon: LayoutDashboard, run: "/dashboard", kind: "nav" },
  { id: "insights", label: "Go to Insights", hint: "Trends & patterns", icon: BarChart3, run: "/insights", kind: "nav" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("root");
  const [query, setQuery] = useState("");
  const [capture, setCapture] = useState("");
  const [selected, setSelected] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    mode === "root"
      ? COMMANDS.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
      : [];

  // Derived (never out of range) selection — avoids clamping via an effect.
  const sel = filtered.length ? Math.min(selected, filtered.length - 1) : 0;

  function reset() {
    setMode("root");
    setQuery("");
    setCapture("");
    setSelected(0);
  }

  function close() {
    setOpen(false);
    reset();
  }

  // Global open: Cmd/Ctrl+K and the custom event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Focus the field whenever the palette opens or switches mode.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, mode]);

  function runCommand(cmd: RootCommand) {
    if (cmd.kind === "mode") {
      setMode(cmd.run as Mode);
      setQuery("");
      return;
    }
    close();
    router.push(cmd.run);
  }

  function submitCapture() {
    const value = capture.trim();
    if (!value) return;
    const fd = new FormData();
    const action = mode === "task" ? createTask : createHabit;
    fd.set(mode === "task" ? "title" : "name", value);

    startTransition(async () => {
      try {
        await action(fd);
        toast.success(mode === "task" ? "Task added" : "Habit created", { description: value });
        close();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function onFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (mode === "root") close();
      else reset();
      return;
    }
    if (mode === "root") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(Math.min(sel + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(Math.max(sel - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[sel];
        if (cmd) runCommand(cmd);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      submitCapture();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ scale: 0.97, y: -8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: -8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-card relative w-full max-w-lg overflow-hidden p-0 shadow-2xl"
          >
            {/* Field */}
            <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3.5">
              {mode === "root" ? (
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <input
                ref={inputRef}
                value={mode === "root" ? query : capture}
                onChange={(e) => (mode === "root" ? setQuery(e.target.value) : setCapture(e.target.value))}
                onKeyDown={onFieldKeyDown}
                disabled={isPending}
                autoComplete="off"
                placeholder={
                  mode === "root"
                    ? "Type a command or search…"
                    : mode === "task"
                      ? "What needs doing?"
                      : "Name the habit you're building…"
                }
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              {mode !== "root" && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <CornerDownLeft className="h-3 w-3" /> enter
                </span>
              )}
            </div>

            {/* Body */}
            {mode === "root" ? (
              <div className="max-h-72 overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No commands found</p>
                ) : (
                  filtered.map((cmd, i) => {
                    const active = i === sel;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => runCommand(cmd)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          active ? "bg-cadence-accent/15" : "hover:bg-white/5"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cadence-accent" : "text-muted-foreground"}`} />
                        <span className="flex-1">
                          <span className="block text-sm text-foreground">{cmd.label}</span>
                          <span className="block text-xs text-muted-foreground">{cmd.hint}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                Press <span className="text-foreground">Enter</span> to{" "}
                {mode === "task" ? "add the task" : "create the habit"}, or{" "}
                <span className="text-foreground">Esc</span> to go back.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
