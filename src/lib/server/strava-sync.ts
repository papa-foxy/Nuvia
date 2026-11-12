/**
 * Pulls recent Strava activities for one user into Nuvia (server only).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ingestWorkouts, type IngestResult } from './activity-ingest';
import {
  activityToWorkout,
  getActivity,
  listActivitiesSince,
  validAccessToken,
  type StravaConfig,
  type StravaConnection,
} from './strava';

export async function loadConnection(supabase: SupabaseClient, userId: string): Promise<StravaConnection | null> {
  const { data } = await supabase.from('strava_connections').select('*').eq('user_id', userId).maybeSingle();
  return (data as StravaConnection | null) ?? null;
}

export async function loadConnectionByAthlete(supabase: SupabaseClient, athleteId: number): Promise<StravaConnection | null> {
  const { data } = await supabase.from('strava_connections').select('*').eq('athlete_id', athleteId).maybeSingle();
  return (data as StravaConnection | null) ?? null;
}

/** Imports activities that started after `afterEpoch` (seconds) and records the sync time. */
export async function syncSince(
  supabase: SupabaseClient,
  cfg: StravaConfig,
  conn: StravaConnection,
  afterEpoch: number,
): Promise<IngestResult> {
  const token = await validAccessToken(supabase, cfg, conn);
  const activities = await listActivitiesSince(token, afterEpoch);
  const workouts = activities.map(activityToWorkout).filter((w): w is NonNullable<typeof w> => w !== null);
  const result = await ingestWorkouts(supabase, conn.user_id, workouts);
  await supabase
    .from('strava_connections')
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', conn.user_id);
  return result;
}

/** Imports a single activity (webhook "create"), using the detailed endpoint for calories. */
export async function importOneActivity(
  supabase: SupabaseClient,
  cfg: StravaConfig,
  conn: StravaConnection,
  activityId: number,
): Promise<IngestResult> {
  const token = await validAccessToken(supabase, cfg, conn);
  const w = activityToWorkout(await getActivity(token, activityId));
  return ingestWorkouts(supabase, conn.user_id, w ? [w] : []);
}

/** Deletes Nuvia logs that came from a given Strava activity (webhook "delete"). */
export async function removeImportedActivity(supabase: SupabaseClient, userId: string, activityId: number) {
  await supabase
    .from('exercise_logs')
    .delete()
    .eq('user_id', userId)
    .contains('ai_analysis', { external_id: `strava:${activityId}` });
}
