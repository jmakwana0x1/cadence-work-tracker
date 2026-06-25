"use server";

import { createClient } from "@/lib/supabase/server";
import { getCoachReportForUser } from "@/lib/coachReport";
import {
  telegramConfigured,
  getBotUsername,
  getRecentChat,
  sendTelegramMessage,
  formatCoachReportForTelegram,
} from "@/lib/telegram";

export interface TelegramStatus {
  configured: boolean; // bot token present on the server
  botUsername: string | null; // for "message @bot" instructions
  connected: boolean; // this user has a saved chat id
  chatName: string | null;
}

export async function telegramStatus(): Promise<TelegramStatus> {
  const configured = telegramConfigured();
  if (!configured) {
    return { configured: false, botUsername: null, connected: false, chatName: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chatId = user?.user_metadata?.telegram_chat_id ?? null;
  return {
    configured: true,
    botUsername: await getBotUsername(),
    connected: Boolean(chatId),
    chatName: user?.user_metadata?.telegram_name ?? null,
  };
}

// Auto-detect the chat from whoever most recently messaged the bot, then save it.
export async function connectTelegram(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!telegramConfigured()) return { ok: false, error: "Bot not configured on the server." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const chat = await getRecentChat();
  if (!chat) {
    return { ok: false, error: "No message found. Send your bot a message first, then try again." };
  }

  await supabase.auth.updateUser({
    data: { telegram_chat_id: String(chat.id), telegram_name: chat.name },
  });

  try {
    await sendTelegramMessage(
      chat.id,
      `✅ Connected to Cadence, ${chat.name}. I'll nudge you here to keep your rhythm.`
    );
  } catch {
    /* saved anyway; the test/brief actions will surface send errors */
  }

  return { ok: true, name: chat.name };
}

export async function disconnectTelegram(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase.auth.updateUser({
    data: { telegram_chat_id: null, telegram_name: null },
  });
  return { ok: true };
}

// Send the current Coach brief to the user's Telegram. Used by the "Send now"
// button and (via the same path) the cron route.
export async function sendMyBrief(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const chatId = user.user_metadata?.telegram_chat_id;
  if (!chatId) return { ok: false, error: "Telegram isn't connected." };

  try {
    const report = await getCoachReportForUser(supabase, user);
    await sendTelegramMessage(chatId, formatCoachReportForTelegram(report));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send." };
  }
}
