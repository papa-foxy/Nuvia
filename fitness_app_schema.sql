-- =====================================================================
-- Fitness / Nutrition PWA — Supabase (Postgres) schema + RLS policies
-- =====================================================================
-- Run this in a fresh Supabase project (SQL Editor or via CLI migration).
-- auth.users is Supabase's built-in auth table — we reference it directly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUM TYPES (keeps values consistent, avoids typos vs plain text)
-- ---------------------------------------------------------------------
create type activity_level as enum ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active');
create type user_goal as enum ('lose_weight', 'maintain_weight', 'gain_weight', 'build_muscle');
create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type entry_source as enum ('photo', 'text', 'manual');
create type confidence_level as enum ('high', 'medium', 'low');
create type intensity_level as enum ('low', 'moderate', 'high');

-- ---------------------------------------------------------------------
-- PROFILES  (one row per user, id = auth.users.id)
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  date_of_birth date,
  sex text check (sex in ('male', 'female')),
  height_cm numeric,
  weight_kg numeric,
  activity_level activity_level,
  goal user_goal,
  target_weight_kg numeric,
  dietary_preference text,
  allergies text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- GOALS  (one row per user; recalculated when profile changes)
-- ---------------------------------------------------------------------
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calorie_target numeric not null,
  protein_target numeric not null,
  carbohydrate_target numeric not null,
  fat_target numeric not null,
  exercise_minutes_target numeric not null default 30,
  target_weight_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MEALS
-- ---------------------------------------------------------------------
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type meal_type not null,
  meal_time timestamptz not null default now(),
  source entry_source not null,
  image_url text,
  description text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  confidence confidence_level,
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MEAL ITEMS  (child of meals — no user_id column, ownership via meal_id)
-- ---------------------------------------------------------------------
create table meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  name text not null,
  estimated_quantity numeric,
  estimated_unit text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  confidence confidence_level
);

-- ---------------------------------------------------------------------
-- EXERCISE LOGS
-- ---------------------------------------------------------------------
create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_type text not null,
  duration_minutes numeric not null,
  intensity intensity_level,
  distance_km numeric,
  calories_burned numeric,
  source entry_source not null,
  description text,
  confidence confidence_level,
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DAILY SUMMARIES  (one row per user per date)
-- ---------------------------------------------------------------------
create table daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  calories_consumed numeric not null default 0,
  protein_consumed numeric not null default 0,
  carbohydrate_consumed numeric not null default 0,
  fat_consumed numeric not null default 0,
  calories_burned numeric not null default 0,
  exercise_minutes numeric not null default 0,
  ai_summary text,
  unique (user_id, date)
);

-- ---------------------------------------------------------------------
-- AI RECOMMENDATIONS
-- ---------------------------------------------------------------------
create table ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  recommendation text not null,
  priority int not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INDEXES (speed up the queries you'll run constantly: "today's data")
-- ---------------------------------------------------------------------
create index idx_meals_user_time on meals (user_id, meal_time desc);
create index idx_exercise_user_time on exercise_logs (user_id, created_at desc);
create index idx_summaries_user_date on daily_summaries (user_id, date desc);
create index idx_meal_items_meal on meal_items (meal_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
-- Enabling RLS with zero policies BLOCKS ALL ACCESS, including the owner.
-- Every table below gets RLS enabled AND its policies in the same block —
-- never split these across separate migration runs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- GOALS
-- ---------------------------------------------------------------------
alter table goals enable row level security;

create policy "goals_select_own" on goals
  for select using (auth.uid() = user_id);

create policy "goals_insert_own" on goals
  for insert with check (auth.uid() = user_id);

create policy "goals_update_own" on goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goals_delete_own" on goals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- MEALS
-- ---------------------------------------------------------------------
alter table meals enable row level security;

create policy "meals_select_own" on meals
  for select using (auth.uid() = user_id);

create policy "meals_insert_own" on meals
  for insert with check (auth.uid() = user_id);

create policy "meals_update_own" on meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meals_delete_own" on meals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- MEAL ITEMS  (ownership checked via parent meal — this is the
-- pattern people most often get wrong: a child table does NOT
-- inherit its parent's RLS automatically)
-- ---------------------------------------------------------------------
alter table meal_items enable row level security;

create policy "meal_items_select_own" on meal_items
  for select using (
    exists (select 1 from meals where meals.id = meal_items.meal_id and meals.user_id = auth.uid())
  );

create policy "meal_items_insert_own" on meal_items
  for insert with check (
    exists (select 1 from meals where meals.id = meal_items.meal_id and meals.user_id = auth.uid())
  );

create policy "meal_items_update_own" on meal_items
  for update using (
    exists (select 1 from meals where meals.id = meal_items.meal_id and meals.user_id = auth.uid())
  ) with check (
    exists (select 1 from meals where meals.id = meal_items.meal_id and meals.user_id = auth.uid())
  );

create policy "meal_items_delete_own" on meal_items
  for delete using (
    exists (select 1 from meals where meals.id = meal_items.meal_id and meals.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- EXERCISE LOGS
-- ---------------------------------------------------------------------
alter table exercise_logs enable row level security;

create policy "exercise_select_own" on exercise_logs
  for select using (auth.uid() = user_id);

create policy "exercise_insert_own" on exercise_logs
  for insert with check (auth.uid() = user_id);

create policy "exercise_update_own" on exercise_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "exercise_delete_own" on exercise_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- DAILY SUMMARIES
-- ---------------------------------------------------------------------
alter table daily_summaries enable row level security;

create policy "summaries_select_own" on daily_summaries
  for select using (auth.uid() = user_id);

create policy "summaries_insert_own" on daily_summaries
  for insert with check (auth.uid() = user_id);

create policy "summaries_update_own" on daily_summaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Note: daily_summaries rows are typically written by a server-side
-- Edge Function using the service_role key (which bypasses RLS entirely).
-- These policies matter if/when the client ever reads or writes them directly.

-- ---------------------------------------------------------------------
-- AI RECOMMENDATIONS
-- ---------------------------------------------------------------------
alter table ai_recommendations enable row level security;

create policy "recommendations_select_own" on ai_recommendations
  for select using (auth.uid() = user_id);

create policy "recommendations_insert_own" on ai_recommendations
  for insert with check (auth.uid() = user_id);

create policy "recommendations_delete_own" on ai_recommendations
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- IMPORTANT REMINDERS
-- =====================================================================
-- 1. The service_role key (used in your Gemini Edge Functions) BYPASSES
--    RLS entirely. Your Edge Function code must manually check that the
--    authenticated user making the request owns the row it's writing,
--    e.g. verify the JWT's user id matches the user_id being inserted.
--
-- 2. Never test these policies in the Supabase SQL Editor — it runs as
--    the postgres superuser and ignores RLS, so broken policies will
--    look like they work. Test through the actual client SDK, logged
--    in as a real user, or simulate it with:
--        set local role authenticated;
--        set local request.jwt.claims = '{"sub": "<some-user-uuid>"}';
--      then run your query in the same transaction.
-- =====================================================================
