import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase keep-alive.
 *
 * Free-tier Supabase projects are paused after ~7 days without activity.
 * Vercel Cron (see vercel.json) calls this route once a day, and it runs a
 * real query against Postgres so the project always registers activity.
 *
 * Secured with CRON_SECRET: Vercel Cron automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when that env var is set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'Supabase env vars missing' },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  // Lightweight read that still hits the database (bypasses RLS via service role).
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('[keep-alive] Supabase query failed:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  console.log(`[keep-alive] Supabase pinged OK (${Date.now() - startedAt}ms)`);
  return NextResponse.json({
    ok: true,
    profiles: count,
    latencyMs: Date.now() - startedAt,
    at: new Date().toISOString(),
  });
}
