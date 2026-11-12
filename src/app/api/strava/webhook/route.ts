import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabase-admin';
import { stravaConfig, getActivity, validAccessToken, activityToWorkout } from '@/lib/server/strava';
import {
  importOneActivity,
  loadConnectionByAthlete,
  removeImportedActivity,
} from '@/lib/server/strava-sync';

export const maxDuration = 30;

/**
 * Strava webhook (https://developers.strava.com/docs/webhooks/).
 * GET  — subscription validation: echo hub.challenge when hub.verify_token matches.
 * POST — events. Strava needs a 200 within two seconds, so the work runs in
 *        after(), once the response has been sent.
 */
export async function GET(request: NextRequest) {
  const cfg = stravaConfig();
  const p = request.nextUrl.searchParams;
  if (!cfg || p.get('hub.mode') !== 'subscribe' || p.get('hub.verify_token') !== cfg.verifyToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ 'hub.challenge': p.get('hub.challenge') ?? '' });
}

interface StravaEvent {
  object_type?: 'activity' | 'athlete';
  object_id?: number;
  aspect_type?: 'create' | 'update' | 'delete';
  owner_id?: number;
  subscription_id?: number;
  updates?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  const event = (await request.json().catch(() => null)) as StravaEvent | null;
  const cfg = stravaConfig();
  const supabase = supabaseAdmin();

  if (event && cfg && supabase && event.owner_id && event.object_id) {
    after(async () => {
      try {
        const conn = await loadConnectionByAthlete(supabase, event.owner_id!);
        if (!conn) return;

        // The athlete revoked access on Strava.
        if (event.object_type === 'athlete' && event.updates?.authorized === 'false') {
          await supabase.from('strava_connections').delete().eq('user_id', conn.user_id);
          return;
        }
        if (event.object_type !== 'activity') return;

        if (event.aspect_type === 'create') {
          await importOneActivity(supabase, cfg, conn, event.object_id!);
        } else if (event.aspect_type === 'delete') {
          await removeImportedActivity(supabase, conn.user_id, event.object_id!);
        } else if (event.aspect_type === 'update') {
          // Title / type changed: refresh the stored type and name.
          const token = await validAccessToken(supabase, cfg, conn);
          const w = activityToWorkout(await getActivity(token, event.object_id!));
          if (!w) return;
          const { data: rows } = await supabase
            .from('exercise_logs')
            .select('id, ai_analysis')
            .eq('user_id', conn.user_id)
            .contains('ai_analysis', { external_id: w.externalId });
          for (const r of rows || []) {
            await supabase
              .from('exercise_logs')
              .update({
                exercise_type: w.type,
                ai_analysis: { ...(r.ai_analysis as object), strava_name: w.extra?.strava_name ?? null },
              })
              .eq('id', r.id);
          }
        }
      } catch (e) {
        console.error('[strava] webhook event failed:', e);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
