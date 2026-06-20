// Centralized local-date helpers.
//
// The whole app keys habit logs, scores, heatmaps and streaks off a
// "YYYY-MM-DD" calendar day. That day must be the *user's* local day, not the
// server's UTC day — otherwise an evening habit logged in a negative UTC offset
// rolls into tomorrow and silently breaks streaks/heatmaps.
//
// We resolve the user's IANA timezone (persisted to Supabase auth metadata by
// TimezoneSync) and do all calendar math through these helpers.

export const DEFAULT_TZ = "UTC";

// Resolve a user's stored timezone, falling back to UTC.
export function userTimezone(user: {
  user_metadata?: { timezone?: string | null } | null;
} | null | undefined): string {
  return user?.user_metadata?.timezone || DEFAULT_TZ;
}

// Format an instant as "YYYY-MM-DD" in the given IANA timezone.
// en-CA's short date format is YYYY-MM-DD, which is exactly what we store.
export function localDateStr(date: Date, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The user's local "today" as a "YYYY-MM-DD" string.
export function localToday(tz: string = DEFAULT_TZ): string {
  return localDateStr(new Date(), tz);
}

// Calendar arithmetic on a "YYYY-MM-DD" string, independent of any timezone.
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Day-of-week (0=Sun..6=Sat) for a date-only string. Parsed as UTC so the
// result depends only on the calendar date, never on the runtime timezone.
export function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Day-of-month for a date-only string.
export function domOf(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

// Month index (0..11) for a date-only string.
export function monthOf(dateStr: string): number {
  return Number(dateStr.slice(5, 7)) - 1;
}

// Resolve an instant into the calendar day + minute-of-day as seen in a given
// IANA timezone. Both server (UTC) and client (user-local) get identical results
// for the same `tz`, so anything rendered from this stays hydration-stable.
export function localTimeParts(
  date: Date,
  tz: string = DEFAULT_TZ
): { dateStr: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // Some engines emit "24" for midnight under hour12:false; normalize to 0.
  const hour = get("hour") === "24" ? 0 : Number(get("hour"));
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Short weekday label ("Mon") for a date-only string — derived from the string
// itself, never from the runtime clock or locale, so it is deterministic.
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[dowOf(dateStr)];
}

// "9:05 AM"-style label for a minute-of-day count (0..1439).
export function minuteLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
