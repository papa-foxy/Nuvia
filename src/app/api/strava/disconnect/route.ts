import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, userIdFromRequest } from '@/lib/server/supabase-admin';
import { deauthorize, stravaConfig, validAccessToken } from '@/lib/server/strava';
import { loadConnection } from '@/lib/server/strava-sync';

/**
 * Disconnects Strava: revokes Nuvia's access on Strava and deletes the stored
 * tokens. Body { removeActivities: true } also deletes activities that were
 * imported from Strava.
 */
export async function POST(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });

  const supabase = supabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server is not configured.' }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { removeActivities?: boolean };
  const cfg = stravaConfig();
  const conn = await loadConnection(supabase, userId);

  if (conn && cfg) {
    const token = await validAccessToken(supabase, cfg, conn).catch(() => conn.access_token);
    await deauthorize(token);
  }
  await supabase.from('strava_connections').delete().eq('user_id', userId);

  let removed = 0;
  if (body.removeActivities) {
    const { data } = await supabase
      .from('exercise_logs')
      .delete()
      .eq('user_id', userId)
      .contains('ai_analysis', { import_source: 'strava' })
      .select('id');
    removed = data?.length ?? 0;
  }
  return NextResponse.json({ ok: true, removed });
}
