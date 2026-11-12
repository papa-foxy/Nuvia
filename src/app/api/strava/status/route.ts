import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, userIdFromRequest } from '@/lib/server/supabase-admin';
import { stravaConfig } from '@/lib/server/strava';
import { loadConnection } from '@/lib/server/strava-sync';

/** Connection status for the signed-in user. Never returns tokens. */
export async function GET(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });

  const configured = !!stravaConfig();
  const supabase = supabaseAdmin();
  if (!configured || !supabase) return NextResponse.json({ ok: true, configured: false, connected: false });

  try {
    const conn = await loadConnection(supabase, userId);
    return NextResponse.json({
      ok: true,
      configured: true,
      connected: !!conn,
      athleteName: conn?.athlete_name ?? null,
      lastSyncAt: conn?.last_sync_at ?? null,
    });
  } catch {
    // Most likely the strava_connections table has not been created yet.
    return NextResponse.json({ ok: true, configured: false, connected: false, error: 'Database table missing.' });
  }
}
