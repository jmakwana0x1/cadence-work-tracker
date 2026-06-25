import { createClient } from "@supabase/supabase-js";
import { getCoachReportForUser } from "@/lib/coachReport";
import {
  telegramConfigured,
  sendTelegramMessage,
  formatCoachReportForTelegram,
} from "@/lib/telegram";

// Automated daily Coach brief over Telegram. Trigger from any scheduler
// (Vercel Cron, GitHub Actions, cron-job.org) with the CRON_SECRET.
//   GET /api/cron/brief   Authorization: Bearer <CRON_SECRET>
//
// Requires (server env): CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN.
// See docs/TELEGRAM_SETUP.md.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!telegramConfigured()) {
    return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 501 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 501 });
  }

  // Service-role client bypasses RLS; every query still filters by user_id.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const recipients = data.users.filter((u) => u.user_metadata?.telegram_chat_id);

  let sent = 0;
  const failures: string[] = [];
  for (const user of recipients) {
    try {
      const report = await getCoachReportForUser(admin, user);
      await sendTelegramMessage(
        user.user_metadata!.telegram_chat_id,
        formatCoachReportForTelegram(report)
      );
      sent++;
    } catch (err) {
      failures.push(`${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return Response.json({ recipients: recipients.length, sent, failures });
}
