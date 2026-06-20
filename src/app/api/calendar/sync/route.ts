import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  fetchGoogleEvents,
  createGoogleEvent,
} from "@/lib/google/calendar";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "calendar_not_connected" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const timeZone: string = body.timeZone ?? "UTC";

  const today = new Date();
  const in30  = new Date(today);
  in30.setDate(today.getDate() + 30);
  const timeMin = today.toISOString();
  const timeMax = in30.toISOString();

  const results = { pulled: 0, pushed: 0, errors: [] as string[] };

  // ── PULL: Google → events table ────────────────────────────────────────────
  try {
    const gEvents = await fetchGoogleEvents(accessToken, timeMin, timeMax);

    for (const ge of gEvents) {
      const start = ge.start.dateTime ?? `${ge.start.date}T00:00:00.000Z`;
      const end   = ge.end.dateTime   ?? `${ge.end.date}T00:00:00.000Z`;

      await supabase.from("events").upsert(
        {
          user_id:         user.id,
          google_event_id: ge.id,
          title:           ge.summary ?? "(no title)",
          start_at:        start,
          end_at:          end,
          synced_at:       new Date().toISOString(),
        },
        { onConflict: "user_id,google_event_id" }
      );
      results.pulled++;
    }
  } catch (err) {
    results.errors.push(`pull: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // ── PUSH: time_blocks → Google Calendar ────────────────────────────────────
  try {
    const todayStr = today.toISOString().split("T")[0];
    const { data: blocks } = await supabase
      .from("time_blocks")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", todayStr)
      .is("google_event_id", null); // only un-synced blocks

    for (const block of blocks ?? []) {
      try {
        const gEventId = await createGoogleEvent(
          accessToken,
          block.planned_label,
          block.date,
          block.start_time,
          block.end_time,
          timeZone
        );

        await supabase
          .from("time_blocks")
          .update({ google_event_id: gEventId })
          .eq("id", block.id);

        results.pushed++;
      } catch (err) {
        results.errors.push(`push block ${block.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  } catch (err) {
    results.errors.push(`push: ${err instanceof Error ? err.message : "unknown"}`);
  }

  return NextResponse.json(results);
}
