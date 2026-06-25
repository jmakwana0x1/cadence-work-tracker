-- ─── v2: Web Push subscriptions ───
-- Stores each device's push endpoint so a (user-owned) cron / edge function can
-- send notifications later. Storing needs no library; sending uses VAPID + the
-- web-push protocol — see docs/PWA_PUSH_SETUP.md.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions owner select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subscriptions owner insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subscriptions owner update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_subscriptions owner delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
