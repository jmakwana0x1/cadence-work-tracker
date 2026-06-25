// Telegram notifications — a free, dependency-free alternative to web push.
// Sending is a plain HTTPS call to the Bot API; the only secret is the bot token
// (TELEGRAM_BOT_TOKEN). See docs/TELEGRAM_SETUP.md.

import type { CoachReport } from "@/lib/coach";

const API = "https://api.telegram.org";

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

// ─── Pure helpers (unit-tested) ───

// The Coach report as a plain-text Telegram message.
export function formatCoachReportForTelegram(report: CoachReport): string {
  const lines: string[] = [];

  // Lead with the Pulse: cadence number, rhythm state, momentum and load.
  const r = report.rhythm;
  if (r) {
    const arrow = r.delta > 0 ? `↑${r.delta}` : r.delta < 0 ? `↓${Math.abs(r.delta)}` : "→0";
    lines.push(`🫀 Cadence ${r.cadence} · ${r.stateLabel} (${arrow} this week)`);
    if (r.acwrLabel !== "—") {
      lines.push(`📊 Load: ${r.acwrLabel} (${r.acwr.toFixed(2)}× baseline)`);
    }
    lines.push("");
  }
  lines.push(`🎯 ${report.headline}`);

  if (report.insights.length > 0) {
    lines.push("", "What I'm seeing:");
    for (const n of report.insights) lines.push(`• ${n.text}`);
  }
  if (report.recommendations.length > 0) {
    lines.push("", "What to do:");
    for (const n of report.recommendations) lines.push(`→ ${n.text}`);
  }
  return lines.join("\n");
}

export interface TelegramChat {
  id: number;
  name: string;
}

interface TelegramUpdate {
  message?: { chat?: { id?: number; first_name?: string; username?: string } };
}

// Most recent chat that has messaged the bot, from a getUpdates response.
export function extractChatFromUpdates(payload: unknown): TelegramChat | null {
  const result = (payload as { result?: TelegramUpdate[] })?.result;
  if (!Array.isArray(result)) return null;
  for (let i = result.length - 1; i >= 0; i--) {
    const chat = result[i]?.message?.chat;
    if (chat?.id != null) {
      return { id: chat.id, name: chat.first_name || chat.username || "there" };
    }
  }
  return null;
}

// ─── Network calls ───

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  const res = await fetch(`${API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

export async function getBotUsername(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/bot${token()}/getMe`);
    const data = await res.json();
    return data?.result?.username ?? null;
  } catch {
    return null;
  }
}

// Auto-detect the chat to connect: the latest user who messaged the bot.
export async function getRecentChat(): Promise<TelegramChat | null> {
  try {
    const res = await fetch(`${API}/bot${token()}/getUpdates`);
    const data = await res.json();
    return extractChatFromUpdates(data);
  } catch {
    return null;
  }
}
