"use client";

import { useEffect } from "react";
import { setUserTimezone } from "@/lib/actions/profile";

// Reports the browser's IANA timezone to the server when it differs from what's
// stored. Renders nothing. Mounted once on the dashboard.
export function TimezoneSync({ current }: { current: string | null }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      void setUserTimezone(tz);
    }
  }, [current]);

  return null;
}
