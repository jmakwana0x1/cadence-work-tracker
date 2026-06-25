"use server";

import { createClient } from "@/lib/supabase/server";

// A serialized browser PushSubscription (JSON.parse(JSON.stringify(sub))).
export interface SerializedPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Store (or refresh) a device's push subscription. No library needed — sending
// is a separate, user-owned cron/edge job (see docs/PWA_PUSH_SETUP.md).
export async function subscribeUser(sub: SerializedPushSubscription) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Invalid push subscription");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function unsubscribeUser(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  return { success: true };
}
