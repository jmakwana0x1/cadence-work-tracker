# Telegram notifications — setup

A free, dependency-free way to get your Cadence Coach brief and nudges. No VAPID,
no email, no service worker — just a bot. Recommended over web push for a
personal app.

## 1. Create a bot (one minute)
1. In Telegram, open **@BotFather** → `/newbot`.
2. Pick a name and username. BotFather gives you a **token** like
   `123456:ABC-DEF...`.

## 2. Set the env var
```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```
Reload the app. A **Telegram** button appears in the dashboard header.

## 3. Connect your account (in the app)
1. Click **Telegram** in the header.
2. Open your bot (it shows the @handle), send it any message.
3. Click **Connect** — Cadence auto-detects your chat and saves it to your
   profile. Use **Send brief now** to test.

That's it for manual sends. Your chat id is stored in your Supabase auth
`user_metadata` (no extra table).

## 4. Automated daily brief (optional)
A protected route sends every connected user their Coach brief:

```
GET /api/cron/brief
Authorization: Bearer <CRON_SECRET>
```

Extra env vars needed:
```
CRON_SECRET=<a long random string>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase project settings → API>   # server only
```

Point any scheduler at it — e.g. **Vercel Cron** (`vercel.json`):
```json
{ "crons": [{ "path": "/api/cron/brief", "schedule": "0 13 * * *" }] }
```
…or a free service like cron-job.org / a GitHub Action hitting the URL with the
`Authorization` header. `0 13 * * *` is 13:00 UTC daily — adjust to your morning.

## Notes
- The service-role key bypasses RLS, so keep it server-side only. Every query in
  the brief still filters by `user_id`.
- Sending uses the plain Bot API over `fetch` — no npm package added.
