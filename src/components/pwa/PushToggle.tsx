"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { subscribeUser, unsubscribeUser } from "@/lib/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const noop = () => () => {};
function useClientFlag(get: () => boolean): boolean {
  return useSyncExternalStore(noop, get, () => false);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  // Build on an explicit ArrayBuffer so the result is a valid BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const mounted = useClientFlag(() => true);
  const supported = useClientFlag(
    () => "serviceWorker" in navigator && "PushManager" in window
  );
  const isIOS = useClientFlag(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
  const isStandalone = useClientFlag(
    () => window.matchMedia("(display-mode: standalone)").matches
  );

  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isPending, startTransition] = useTransition();

  // Read any existing subscription once the SW is ready.
  useEffect(() => {
    if (!mounted || !supported) return;
    let active = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) setSubscription(sub);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [mounted, supported]);

  // Feature off (no VAPID key) or nothing to offer: render nothing.
  if (!VAPID_PUBLIC_KEY || !mounted || !supported) return null;

  // On iOS, push only works once the PWA is installed to the home screen.
  if (isIOS && !isStandalone) {
    return (
      <span className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground sm:inline-flex">
        <Bell className="h-3.5 w-3.5" />
        Install to enable reminders
      </span>
    );
  }

  function enable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        });
        await subscribeUser(JSON.parse(JSON.stringify(sub)));
        setSubscription(sub);
        toast.success("Reminders on", { description: "We'll nudge you to keep your cadence." });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't enable reminders");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const endpoint = subscription?.endpoint;
        await subscription?.unsubscribe();
        if (endpoint) await unsubscribeUser(endpoint);
        setSubscription(null);
        toast.success("Reminders off");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't disable reminders");
      }
    });
  }

  const on = subscription !== null;

  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      disabled={isPending}
      aria-pressed={on}
      title={on ? "Reminders on" : "Enable reminders"}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-50"
    >
      {on ? (
        <BellRing className="h-4 w-4 text-cadence-accent" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{on ? "Reminders on" : "Reminders"}</span>
    </button>
  );
}
