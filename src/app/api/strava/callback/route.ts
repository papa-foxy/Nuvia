import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabase-admin';
import {
  ensureWebhookSubscription,
  exchangeCode,
  STRAVA_SCOPE,
  stravaConfig,
  verifyOAuthState,
} from '@/lib/server/strava';
import { loadConnection, syncSince } from '@/lib/server/strava-sync';

export const maxDuration = 30;

/**
 * Strava redirects here after the user approves (or cancels). Saves the
 * connection, imports the last 30 days, makes sure the webhook exists, then
 * sends the user back to the app with ?strava=<status>.
 */
export async function GET(request: NextRequest) {
  const back = (status: string) => NextResponse.redirect(new URL(`/?strava=${status}`, request.nextUrl.origin));
  const p = request.nextUrl.searchParams;

  if (p.get('error')) return back('cancelled');
  const userId = verifyOAuthState(p.get('state'));
  const code = p.get('code');
  if (!userId || !code) return back('error');

  // activity:read_all is needed to read every activity (and for webhooks).
  const granted = (p.get('scope') || '').split(/[ ,]/);
  if (!granted.includes('activity:read_all') && !granted.includes('activity:read')) return back('missing-permission');

  const cfg = stravaConfig();
  const supabase = supabaseAdmin();
  if (!cfg || !supabase) return back('not-configured');

  try {
    const t = await exchangeCode(cfg, code);
    if (!t.athlete?.id) return back('error');
    const name = [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(' ') || null;

    const { error } = await supabase.from('strava_connections').upsert(
      {
        user_id: userId,
        athlete_id: t.athlete.id,
        athlete_name: name,
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: t.expires_at,
        scope: t.scope ?? STRAVA_SCOPE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      console.error('[strava] save connection failed:', error.message);
      return back(/athlete_id/.test(error.message) ? 'athlete-in-use' : 'error');
    }

    const conn = await loadConnection(supabase, userId);
    if (conn) {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86_400;
      await syncSince(supabase, cfg, conn, thirtyDaysAgo).catch((e) => console.error('[strava] backfill failed:', e));
    }
    await ensureWebhookSubscription(cfg, `${request.nextUrl.origin}/api/strava/webhook`).catch((e) =>
      console.error('[strava] webhook subscription failed:', e),
    );
    return back('connected');
  } catch (e) {
    console.error('[strava] callback failed:', e);
    return back('error');
  }
}
