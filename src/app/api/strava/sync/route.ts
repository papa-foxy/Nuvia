import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, userIdFromRequest } from '@/lib/server/supabase-admin';
import { stravaConfig } from '@/lib/server/strava';
import { loadConnection, syncSince } from '@/lib/server/strava-sync';
import { describeIngest } from '@/lib/server/activity-ingest';

export const maxDuration = 30;

/** "Sync now": imports activities since the last sync (minus 2 days, at most 30 days back). */
export async function POST(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });

  const cfg = stravaConfig();
  const supabase = supabaseAdmin();
  if (!cfg || !supabase) return NextResponse.json({ ok: false, error: 'Strava is not set up on the server yet.' }, { status: 503 });

  const conn = await loadConnection(supabase, userId);
  if (!conn) return NextResponse.json({ ok: false, error: 'Strava is not connected.' }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  const last = conn.last_sync_at ? Math.floor(new Date(conn.last_sync_at).getTime() / 1000) : 0;
  const after = Math.max(now - 30 * 86_400, last - 2 * 86_400);

  try {
    const result = await syncSince(supabase, cfg, conn, after);
    return NextResponse.json({
      ok: true,
      imported: result.imported,
      items: result.items,
      message: describeIngest(result, { prefix: 'Strava' }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
