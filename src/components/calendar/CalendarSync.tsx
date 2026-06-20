"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, RefreshCw, LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { CalendarGrid } from "./CalendarGrid";
import type { CalendarEvent } from "@/types/database";

type SyncState =
  | { status: "idle" }
  | { status: "success"; pulled: number; pushed: number }
  | { status: "error"; message: string }
  | { status: "partial"; pulled: number; pushed: number; errors: string[] };

interface CalendarSyncProps {
  connected: boolean;
  events: CalendarEvent[];
  tz: string;
  today: string;
  initialError?: string;
}

export function CalendarSync({ connected, events, tz, today, initialError }: CalendarSyncProps) {
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [isSyncing, startSync]    = useTransition();

  function handleSync() {
    setSyncState({ status: "idle" });
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    startSync(async () => {
      try {
        const resp = await fetch("/api/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeZone }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          setSyncState({ status: "error", message: json.error ?? `HTTP ${resp.status}` });
          return;
        }
        if (json.errors?.length) {
          setSyncState({ status: "partial", pulled: json.pulled, pushed: json.pushed, errors: json.errors });
        } else {
          setSyncState({ status: "success", pulled: json.pulled, pushed: json.pushed });
          setTimeout(() => window.location.reload(), 900);
        }
      } catch (err) {
        setSyncState({ status: "error", message: err instanceof Error ? err.message : "Network error" });
      }
    });
  }

  return (
    <div className="glass-card overflow-hidden">

      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            connected
              ? "bg-emerald-500/15 border border-emerald-500/20"
              : "bg-white/5 border border-white/10"
          }`}>
            <CalendarDays className={`h-3.5 w-3.5 ${connected ? "text-emerald-400" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Google Calendar</p>
            <p className={`text-[11px] mt-0.5 ${connected ? "text-emerald-400/70" : "text-muted-foreground"}`}>
              {connected
                ? `Connected · ${events.length} upcoming event${events.length !== 1 ? "s" : ""}`
                : "Not connected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cadence-accent hover:bg-cadence-accent/85 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing…" : "Sync now"}
              </motion.button>
              <a
                href="/api/calendar/connect"
                title="Reconnect"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground/60 transition-colors"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <a
              href="/api/calendar/connect"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cadence-accent hover:bg-cadence-accent/85 text-white text-sm font-medium transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Connect
            </a>
          )}
        </div>
      </div>

      {/* Status banner */}
      <AnimatePresence>
        {(initialError || syncState.status !== "idle") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-2.5 border-b border-white/[0.06] text-xs">
              {initialError && (
                <div className="flex items-start gap-2 text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span className="break-all">{decodeURIComponent(initialError)}</span>
                </div>
              )}
              {syncState.status === "error" && (
                <div className="flex items-start gap-2 text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Sync failed</p>
                    <p className="mt-0.5 opacity-70 break-all">{syncState.message}</p>
                  </div>
                </div>
              )}
              {syncState.status === "partial" && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      Partial sync — {syncState.pulled} pulled · {syncState.pushed} pushed
                    </span>
                  </div>
                  {syncState.errors.map((e, i) => (
                    <p key={i} className="text-amber-400/60 pl-5 break-all">{e}</p>
                  ))}
                </div>
              )}
              {syncState.status === "success" && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{syncState.pulled} events pulled · {syncState.pushed} blocks pushed to Google</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Week time-grid (Google Calendar style) */}
      {connected && events.length > 0 ? (
        <CalendarGrid events={events} tz={tz} today={today} />
      ) : connected ? (
        <div className="flex items-center gap-3 px-5 py-5">
          <CalendarDays className="h-6 w-6 text-muted-foreground/20 flex-shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">No upcoming events</p>
            <p className="text-xs text-muted-foreground/40 mt-0.5">Hit Sync now to pull from Google</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-5 py-5">
          <CalendarDays className="h-6 w-6 text-muted-foreground/20 flex-shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Connect Google Calendar</p>
            <p className="text-xs text-muted-foreground/40 mt-0.5">
              Pull events and push your time blocks to Google
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
