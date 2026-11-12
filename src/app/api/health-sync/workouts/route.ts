import { NextRequest, NextResponse } from 'next/server';
import { verifyHealthSyncToken } from '@/lib/health-sync-token';
import { parseHealthWorkouts } from '@/lib/health-workout-parse';
import { supabaseAdmin } from '@/lib/server/supabase-admin';
import { describeIngest, ingestWorkouts } from '@/lib/server/activity-ingest';

/**
 * Receives workouts from the iPhone Shortcut (Apple Health → Nuvia), e.g. runs
 * recorded with adidas Running, and logs them on the day they happened.
 *
 * Auth:  `Authorization: Bearer <personal Health Sync key>` (from Profile).
 * Body:  JSON — one workout, an array, or { workouts: [...] }. See
 *        src/lib/health-workout-parse.ts for accepted fields and formats.
 * Query: ?dryRun=1 parses and reports without saving.
 *
 * Re-sending is safe: already-imported workouts and the same session from
 * another source (e.g. Strava) are skipped.
 */
export async function POST(request: NextRequest) {
  const key =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    request.headers.get('x-nuvia-key')?.trim();
  const userId = verifyHealthSyncToken(key);
  if (!userId) {
    return NextResponse.json(
      { ok: false, message: 'Nuvia: invalid key. Copy your key again from Profile → Connect adidas Running.' },
      { status: 401 },
    );
  }

  // Shortcuts may send JSON with a text content type; parse defensively.
  let body: unknown;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Nuvia: the request body is not valid JSON. Set Request Body to JSON in the Shortcut.' },
      { status: 400 },
    );
  }

  const { workouts, errors } = parseHealthWorkouts(body);
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';

  if (workouts.length === 0) {
    return NextResponse.json(
      { ok: false, imported: 0, skipped: 0, errors, message: `Nuvia: no workouts understood. ${errors[0] ?? ''}`.trim() },
      { status: 422 },
    );
  }

  const supabase = supabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: 'Nuvia: server is not configured.' }, { status: 500 });
  }

  try {
    const result = await ingestWorkouts(
      supabase,
      userId,
      workouts.map((w) => ({ ...w, importSource: 'apple_health' as const })),
      { dryRun },
    );
    const skipped = result.alreadyImported + result.duplicates + result.otherSource;
    const message =
      describeIngest(result, { dryRun }) + (errors.length ? `. Skipped ${errors.length}: ${errors[0]}` : '');
    return NextResponse.json({ ok: true, dryRun, imported: result.imported, skipped, errors, items: result.items, message });
  } catch (e) {
    console.error('[health-sync] ingest failed:', e);
    return NextResponse.json({ ok: false, message: 'Nuvia: could not save workouts. Try again later.' }, { status: 502 });
  }
}
