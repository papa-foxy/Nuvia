import { NextRequest, NextResponse } from 'next/server';
import { userIdFromRequest } from '@/lib/server/supabase-admin';
import { authorizeUrl, createOAuthState, stravaConfig } from '@/lib/server/strava';

/** Returns the Strava authorization URL for the signed-in user. */
export async function POST(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });

  const cfg = stravaConfig();
  const state = createOAuthState(userId);
  if (!cfg || !state) {
    return NextResponse.json({ ok: false, error: 'Strava is not set up on the server yet.' }, { status: 503 });
  }
  const redirectUri = `${request.nextUrl.origin}/api/strava/callback`;
  return NextResponse.json({ ok: true, url: authorizeUrl(cfg, redirectUri, state) });
}
