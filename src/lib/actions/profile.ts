"use server";

import { createClient } from "@/lib/supabase/server";

// Persist the user's IANA timezone (e.g. "America/New_York") to auth metadata.
// All server-side "today" calculations read this so calendar days match the
// user's wall clock rather than the server's UTC clock.
export async function setUserTimezone(tz: string) {
  if (!tz || typeof tz !== "string" || tz.length > 64) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // No-op if unchanged, to avoid pointless writes on every page load.
  if (user.user_metadata?.timezone === tz) return;

  await supabase.auth.updateUser({ data: { timezone: tz } });
}
