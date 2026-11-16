-- Body check-ins: weight (and optional waist / how you feel) over time, so
-- Nuvia can track the real trend against the plan.
-- Run once in Supabase: SQL Editor → paste → Run.

create table if not exists public.body_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  weight_kg   numeric(5, 1) not null check (weight_kg between 25 and 350),
  waist_cm    numeric(5, 1) check (waist_cm is null or waist_cm between 40 and 250),
  energy      smallint check (energy is null or energy between 1 and 5),
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists body_checkins_user_date_idx on public.body_checkins (user_id, date desc);

alter table public.body_checkins enable row level security;

-- Each user can only see and change their own check-ins.
drop policy if exists "body_checkins_select_own" on public.body_checkins;
create policy "body_checkins_select_own" on public.body_checkins
  for select using (auth.uid() = user_id);

drop policy if exists "body_checkins_insert_own" on public.body_checkins;
create policy "body_checkins_insert_own" on public.body_checkins
  for insert with check (auth.uid() = user_id);

drop policy if exists "body_checkins_update_own" on public.body_checkins;
create policy "body_checkins_update_own" on public.body_checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_checkins_delete_own" on public.body_checkins;
create policy "body_checkins_delete_own" on public.body_checkins
  for delete using (auth.uid() = user_id);
