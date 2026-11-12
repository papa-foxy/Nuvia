import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHealthSyncToken } from '@/lib/health-sync-token';

/**
 * Returns the signed-in user's personal Health Sync key and the import URL.
 * Auth: `Authorization: Bearer <Supabase access token>` from the app session.
 */
export async function GET(request: NextRequest) {
  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!jwt || !url || !anonKey) {
    return NextResponse.json({ ok: false, error: 'Sign in to get your key.' }, { status: 401 });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  const token = createHealthSyncToken(data.user.id);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Health Sync is not configured on the server.' }, { status: 500 });
  }

  const endpoint = `${request.nextUrl.origin}/api/health-sync/workouts`;
  return NextResponse.json({ ok: true, token, endpoint });
}
