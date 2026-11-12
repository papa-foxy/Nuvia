-- Strava connection per Nuvia user (one Strava athlete per user).
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Tokens are secrets: RLS is enabled with NO policies, so the browser (anon /
-- authenticated roles) cannot read or write this table at all. Only the
-- server, using the service-role key, can.

create table if not exists public.strava_connections (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  athlete_id     bigint not null unique,
  athlete_name   text,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     bigint not null,          -- epoch seconds
  scope          text,
  last_sync_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.strava_connections enable row level security;

-- Intentionally no policies (server-only access via service role).
