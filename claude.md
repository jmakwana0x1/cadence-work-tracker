# Project: Cadence — Consistency & Discipline Tracker

## What we're building
A productivity app that measures discipline, not just schedules it. The user
logs habits, tasks, and time blocks; plans their day; and watches their
consistency over time through a discipline score and a contribution-style
heatmap. It syncs with Google Calendar. It must look premium and feel alive —
same bar as our previous app, not a scaffolded template.

## Design lineage
This continues the design language of our weight-tracking app. Keep what worked:
- Dark glassmorphism: deep near-black background, frosted glass cards.
- ONE electric accent color — use VIOLET or AMBER here (focus/discipline energy),
  as a CSS variable so it's swappable. Give this app its own identity vs. the
  weight app's lime/cyan.
- Numbers feel alive: big hero figures, count-up animations, color-coded deltas,
  tabular/mono font so digits don't jiggle.
- Micro-interactions: spring physics on tap, satisfying log toasts, skeleton
  loaders (never spinners), milestone confetti for big streaks.
- Bento-grid dashboard, rounded-2xl, consistent 4/8px spacing rhythm.
- Dark mode is the default and must look intentional.
- Respect prefers-reduced-motion.

## The two hero elements (replace the weight chart + current weight)
1. DISCIPLINE SCORE — a single 0–100 composite, big and count-up animated,
   color-coded against yesterday. Blend of habit consistency, task completion
   rate, and schedule adherence. The formula must be transparent/visible so it
   feels earned, not arbitrary. This is the emotional anchor.
2. CONSISTENCY HEATMAP — a GitHub-contribution-style grid of daily activity.
   Build it as a custom CSS grid (not a library) so it matches the aesthetic.
   Cells intensify with more logged activity. This is the visual centerpiece.

## Stack (non-negotiable unless I say otherwise)
- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS
- Supabase (Postgres + Auth + Realtime + Edge Functions) — free tier only
- Framer Motion for animation
- Recharts for trend charts
- dnd-kit for the drag-and-drop time-block planner
- shadcn/ui base components, Lucide icons
- Google Calendar API via Supabase Google OAuth provider
- Deploy: Vercel free tier

## Features — build in this order
1. Auth (Supabase, Google provider — we'll reuse the OAuth for Calendar later)
   + protected routes.
2. Schema + RLS policies (show me before running).
3. Habits: create habit (name, category, target frequency, color), and a
   one-tap daily log flow (done/partial/skip).
4. Consistency heatmap (custom grid) driven by habit_logs.
5. Streak system per habit with the growing-flame motif + a "freeze token"
   mechanic (earn a few, spend one to protect a streak on an off day).
6. Discipline score: compute daily, store in daily_scores, render as hero number
   with count-up + delta + a trend line (Recharts).
7. Tasks: quick-capture, due dates, complete/uncomplete, category, priority.
8. Time-block planner: drag blocks onto a day timeline (dnd-kit), color-coded by
   category; mark each block hit/partial/missed at day's end. Plan-vs-actual view.
9. Google Calendar two-way sync: push app events to Calendar, pull existing
   events in. Logging against a calendar event marks it done. Handle token
   refresh and basic conflict resolution.
10. Weekly review digest (Supabase Edge Function cron): heatmap snapshot, best/
    worst categories, discipline trend, one suggested focus for next week.
11. Polish pass: animations, confetti, momentum metric, empty/first-run states.

## Key mechanics to get right
- MOMENTUM, not just streaks: a decaying-average metric that rewards recent
  consistency and recovers fast after a miss — less brittle than raw streaks.
- FREEZE TOKENS: one missed day shouldn't nuke weeks of progress. This is the
  main anti-quitting feature; prioritize it.
- PLAN vs ACTUAL: the visible gap between intended blocks and logged reality is
  the core discipline insight. Make that delta prominent.
- IDENTITY framing in copy: "you showed up as someone who trains 5 days running,"
  not "4 tasks done." Identity-based language over raw counts.
- HONEST mode: no vanity inflation. If the user is slipping, say so plainly.

## Data model sketch (RLS on every table — user sees only their own rows)
- habits: id, user_id, name, category, target_frequency, color, freeze_tokens
- habit_logs: id, habit_id, user_id, logged_at, status (done|partial|skip)
- tasks: id, user_id, title, due_at, completed_at, category, priority
- time_blocks: id, user_id, date, start, end, category, planned_label,
  actual_status (hit|partial|missed)
- events: id, user_id, google_event_id, title, start, end, synced_at
- daily_scores: id, user_id, date, discipline_score, components (jsonb)
- Always write RLS policies alongside any new table.

## Engineering rules
- TypeScript strict. No `any` without a justifying comment.
- Secrets in env vars only. Anon key client-side; service role only server-side.
  Store Google OAuth/Calendar tokens securely server-side, never exposed to client.
- Prefer Server Components; Client Components only where interactivity needs it.
- Small, composable components — no monolith pages.
- Validate all user input before DB writes.
- Stay within Supabase free-tier limits.
- Calendar sync is the riskiest part: build it isolated and well-tested, behind
  a clear interface, so a sync bug can't take down the rest of the app.

## How to work with me
- Be direct, no hedging. If an approach is bad, say so and propose better.
- Show schema/RLS before generating dependent code.
- Build incrementally; keep the app runnable at every step. Commit after each
  working step.
- When a design choice is ambiguous, pick the more premium option and tell me
  what you chose.
- Match the look and feel of our weight app — this should feel like a sibling
  product, same family, distinct identity.