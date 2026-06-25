-- ─── v2: Rhythm Engine daily snapshot ───
-- Persisted per-day Cadence + load/ACWR + rhythm state. The dashboard can compute
-- the live reading from habit_logs on the fly (see RhythmCard), but this table
-- lets a daily job store history cheaply for trends and the (deterministic) coach.

create table if not exists public.rhythm_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  cadence numeric(4, 1) not null default 0,      -- 0..100
  completion numeric(4, 3) not null default 0,   -- 0..1 raw daily activity
  attempts numeric(6, 2) not null default 0,     -- daily attempt volume
  load_acute numeric(6, 2) not null default 0,   -- 7-day mean attempts
  load_chronic numeric(6, 2) not null default 0, -- 28-day mean attempts
  acwr numeric(5, 2) not null default 0,         -- acute : chronic ratio
  state text not null default 'dormant'
    check (state in ('in-rhythm', 'building', 'slipping', 'recovering', 'overreaching', 'dormant')),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.rhythm_daily enable row level security;

create policy "rhythm_daily owner select" on public.rhythm_daily
  for select using (auth.uid() = user_id);

create policy "rhythm_daily owner insert" on public.rhythm_daily
  for insert with check (auth.uid() = user_id);

create policy "rhythm_daily owner update" on public.rhythm_daily
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "rhythm_daily owner delete" on public.rhythm_daily
  for delete using (auth.uid() = user_id);

create index if not exists rhythm_daily_user_date_idx
  on public.rhythm_daily (user_id, date);
