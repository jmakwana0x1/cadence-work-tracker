/**
 * Isolated Google Calendar module.
 * All Google API calls live here. Nothing outside this file talks to Google.
 * If this module breaks, it throws — callers decide how to handle it.
 */

import { createClient } from "@/lib/supabase/server";

const TOKEN_URL     = "https://oauth2.googleapis.com/token";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const CALENDAR_ID   = "primary";

// ── Token management ────────────────────────────────────────────────────────

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at);
  const needsRefresh = expiresAt.getTime() - 60_000 < Date.now();

  if (!needsRefresh) return data.access_token;

  // Refresh
  if (!data.refresh_token) {
    await supabase.from("calendar_tokens").delete().eq("user_id", userId);
    return null;
  }

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type:    "refresh_token",
    }),
  });

  if (!resp.ok) {
    // Token revoked — force reconnect
    await supabase.from("calendar_tokens").delete().eq("user_id", userId);
    return null;
  }

  const json = await resp.json();
  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await supabase
    .from("calendar_tokens")
    .update({ access_token: json.access_token, expires_at: newExpiry })
    .eq("user_id", userId);

  return json.access_token;
}

export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number
) {
  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase.from("calendar_tokens").upsert(
    { user_id: userId, access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function disconnectCalendar(userId: string) {
  const supabase = await createClient();
  await supabase.from("calendar_tokens").delete().eq("user_id", userId);
}

// ── Google Calendar API calls ───────────────────────────────────────────────

interface GCalEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  status: string;
}

export async function fetchGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<GCalEvent[]> {
  const url = new URL(`${CALENDAR_BASE}/calendars/${CALENDAR_ID}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) throw new Error(`Google Calendar fetch failed: ${resp.status}`);

  const json = await resp.json();
  return (json.items ?? []).filter((e: GCalEvent) => e.status !== "cancelled");
}

export async function createGoogleEvent(
  accessToken: string,
  title: string,
  date: string,
  startTime: string,
  endTime: string,
  timeZone: string
): Promise<string> {
  const resp = await fetch(`${CALENDAR_BASE}/calendars/${CALENDAR_ID}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: title,
      start: { dateTime: `${date}T${startTime}`, timeZone },
      end:   { dateTime: `${date}T${endTime}`,   timeZone },
    }),
  });

  if (!resp.ok) throw new Error(`Google event creation failed: ${resp.status}`);
  const json = await resp.json();
  return json.id as string;
}

export async function deleteGoogleEvent(accessToken: string, eventId: string) {
  await fetch(`${CALENDAR_BASE}/calendars/${CALENDAR_ID}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
