-- ─── v2: Seasons ───
-- A 12-week cycle with a title + theme — a narrative arc over the daily grind.
-- The "current" season is simply the most recently started row.

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  theme text,
  started_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now()
);

alter table public.seasons enable row level security;

create policy "seasons owner select" on public.seasons
  for select using (auth.uid() = user_id);

create policy "seasons owner insert" on public.seasons
  for insert with check (auth.uid() = user_id);

create policy "seasons owner update" on public.seasons
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "seasons owner delete" on public.seasons
  for delete using (auth.uid() = user_id);

create index if not exists seasons_user_started_idx
  on public.seasons (user_id, started_on desc);
