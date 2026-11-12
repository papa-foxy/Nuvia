-- Background meal-photo analysis jobs, so analysis keeps running on the server
-- after the user closes the app. Run once in Supabase: SQL Editor → paste → Run.
--
-- Server-only: RLS is enabled with NO policies; only the service role (used by
-- /api/ai/meal-jobs) can read or write. The photo itself is not stored here.

create table if not exists public.meal_analysis_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists meal_analysis_jobs_user_idx on public.meal_analysis_jobs (user_id, created_at desc);

alter table public.meal_analysis_jobs enable row level security;

-- Intentionally no policies (server-only access via service role).
