"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  telegramStatus,
  connectTelegram,
  disconnectTelegram,
  sendMyBrief,
  type TelegramStatus,
} from "@/lib/actions/telegram";

export function TelegramConnect() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setStatus(null);
    setLoading(true);
    telegramStatus()
      .then(setStatus)
      .finally(() => setLoading(false));
  }

  function refresh() {
    telegramStatus().then(setStatus);
  }

  function handleConnect() {
    startTransition(async () => {
      const res = await connectTelegram();
      if (res.ok) {
        toast.success(`Connected${res.name ? ` as ${res.name}` : ""}`);
        refresh();
      } else {
        toast.error(res.error ?? "Couldn't connect");
      }
    });
  }

  function handleSend() {
    startTransition(async () => {
      const res = await sendMyBrief();
      if (res.ok) toast.success("Brief sent to Telegram");
      else toast.error(res.error ?? "Couldn't send");
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectTelegram();
      toast.success("Telegram disconnected");
      refresh();
    });
  }

  const botHandle = status?.botUsername ? `@${status.botUsername}` : "your bot";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
        aria-label="Telegram reminders"
      >
        <Send className="h-4 w-4 text-cadence-accent" />
        <span className="hidden sm:inline">Telegram</span>
      </button>

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
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Send className="h-4 w-4 text-cadence-accent" />
                  Telegram reminders
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loading || !status ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
                </div>
              ) : !status.configured ? (
                <p className="text-sm text-muted-foreground">
                  The bot isn&apos;t set up yet. Add{" "}
                  <code className="rounded bg-white/5 px-1 text-foreground">TELEGRAM_BOT_TOKEN</code>{" "}
                  to your environment, then reload. See{" "}
                  <span className="text-foreground">docs/TELEGRAM_SETUP.md</span>.
                </p>
              ) : status.connected ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-3.5 py-2.5 text-sm text-emerald-200/90">
                    <Check className="h-4 w-4" />
                    Connected{status.chatName ? ` as ${status.chatName}` : ""}.
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your daily Coach brief can be delivered here. Send one now to test it.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSend}
                      disabled={isPending}
                      className="flex-1 rounded-xl bg-cadence-accent text-white hover:bg-cadence-accent/90"
                    >
                      {isPending ? "Working…" : "Send brief now"}
                    </Button>
                    <Button
                      onClick={handleDisconnect}
                      disabled={isPending}
                      variant="secondary"
                      className="rounded-xl"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <li>
                      1. Open{" "}
                      <span className="font-medium text-foreground">{botHandle}</span> in Telegram.
                    </li>
                    <li>2. Send it any message (e.g. “hi”).</li>
                    <li>3. Tap Connect below.</li>
                  </ol>
                  <Button
                    onClick={handleConnect}
                    disabled={isPending}
                    className="rounded-xl bg-cadence-accent text-white hover:bg-cadence-accent/90"
                  >
                    {isPending ? "Connecting…" : "Connect"}
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
