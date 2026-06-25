"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, RefreshCw, LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import type { CalendarEvent } from "@/types/database";

// Compact Google Calendar connect/sync control. The events themselves render in
// the unified Today timeline — this is just the connection + manual sync.

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

export function CalendarSync({ connected, events, initialError }: CalendarSyncProps) {
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const [isSyncing, startSync] = useTransition();

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
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: connected ? "#EEF3EC" : "var(--secondary)", border: `1px solid ${connected ? "#DCE7D8" : "var(--border)"}` }}
          >
            <CalendarDays className="h-3.5 w-3.5" style={{ color: connected ? "#5B8A5A" : "var(--muted-foreground)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-foreground">Google Calendar</p>
            <p className="mt-1 text-[11px]" style={{ color: connected ? "#5B8A5A" : "var(--muted-foreground)" }}>
              {connected ? `Connected · ${events.length} event${events.length !== 1 ? "s" : ""}` : "Not connected"}
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
                className="flex items-center gap-1.5 rounded-xl bg-cadence-accent px-3 py-1.5 text-xs font-medium text-white transition-[filter] hover:brightness-105 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing…" : "Sync"}
              </motion.button>
              <a
                href="/api/calendar/connect"
                title="Reconnect"
                className="rounded-xl border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <a
              href="/api/calendar/connect"
              className="flex items-center gap-1.5 rounded-xl bg-cadence-accent px-4 py-2 text-sm font-medium text-white transition-[filter] hover:brightness-105"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Connect
            </a>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(initialError || syncState.status !== "idle") && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border px-4 py-2.5 text-xs">
              {initialError && (
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span className="break-all">{decodeURIComponent(initialError)}</span>
                </div>
              )}
              {syncState.status === "error" && (
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Sync failed</p>
                    <p className="mt-0.5 break-all opacity-70">{syncState.message}</p>
                  </div>
                </div>
              )}
              {syncState.status === "partial" && (
                <div className="flex items-center gap-2" style={{ color: "#C99A3A" }}>
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">Partial — {syncState.pulled} pulled · {syncState.pushed} pushed</span>
                </div>
              )}
              {syncState.status === "success" && (
                <div className="flex items-center gap-2" style={{ color: "#5B8A5A" }}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{syncState.pulled} pulled · {syncState.pushed} pushed</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
