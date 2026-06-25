"use client";

import { useEffect } from "react";

// Registers the service worker once, app-wide. Renders nothing.
export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* registration is best-effort; the app works without it */
      });
  }, []);

  return null;
}
