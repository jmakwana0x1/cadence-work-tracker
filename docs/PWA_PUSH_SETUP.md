# PWA & Push — setup

Cadence is an installable PWA. **Installing** works out of the box (manifest +
service worker + HTTPS). **Push notifications** are optional and need a one-time
setup, all free — no paid service.

## What already works
- `app/manifest.ts` — installable manifest (Add to Home Screen).
- `public/sw.js` — service worker that shows notifications + handles clicks.
- `PushToggle` in the dashboard header — **hidden until you set a VAPID key**.
- `push_subscriptions` table — run `supabase/migrations/004_push_subscriptions.sql`.

## Enable push (3 steps)

### 1. Generate VAPID keys (free)
```bash
npx web-push generate-vapid-keys
```

### 2. Set env vars
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>          # server only — never expose
```
The public key turns on the "Reminders" toggle; users can then subscribe and
their device is saved to `push_subscriptions`.

### 3. Send notifications (your cron / edge function)
Sending is intentionally **not** bundled into the app (keeps the dependency tree
lean — see the project memory). Do it from a Supabase Edge Function or any cron,
reading subscriptions from the table and sending with the web-push protocol:

```ts
// edge function / script — not part of the app bundle
import webpush from "web-push"; // install only here

webpush.setVapidDetails(
  "mailto:you@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// for each row in push_subscriptions:
await webpush.sendNotification(
  { endpoint, keys: { p256dh, auth } },
  JSON.stringify({ title: "Cadence", body: "Your streak is unlogged.", url: "/dashboard" }),
);
```

Good triggers to send on: a morning brief (the deterministic Coach already
generates the copy), and an evening streak-save nudge for unlogged habits.

## Notes
- iOS only delivers push to PWAs **installed** to the home screen (iOS 16.4+).
  `PushToggle` shows an "Install to enable reminders" hint there.
- Test locally over HTTPS: `next dev --experimental-https`.
