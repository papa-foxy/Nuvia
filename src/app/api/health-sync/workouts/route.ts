import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyHealthSyncToken } from '@/lib/health-sync-token';
import { estimateCalories, intensityFor, parseHealthWorkouts } from '@/lib/health-workout-parse';

/**
 * Receives workouts from the iPhone Shortcut (Apple Health → Nuvia), e.g. runs
 * recorded with adidas Running, and logs them on the day they happened.
 *
 * Auth:  `Authorization: Bearer <personal Health Sync key>` (from Profile).
 * Body:  JSON — one workout, an array, or { workouts: [...] }. See
 *        src/lib/health-workout-parse.ts for accepted fields and formats.
 * Query: ?dryRun=1 parses and reports without saving.
 *
 * Re-sending the same workout is safe: it is matched by start time + type
 * and skipped.
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, message: 'Nuvia: server is not configured.' }, { status: 500 });
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Weight for calorie estimates (only used when Health sends no energy value)
  const { data: profile } = await supabase.from('profiles').select('weight_kg').eq('id', userId).maybeSingle();
  const weightKg = Number((profile as { weight_kg?: number } | null)?.weight_kg) || 70;

  // De-duplicate against workouts already imported around the same dates
  const times = workouts.map((w) => new Date(w.startIso).getTime());
  const from = new Date(Math.min(...times) - 86_400_000).toISOString();
  const to = new Date(Math.max(...times) + 86_400_000).toISOString();
  const { data: existing } = await supabase
    .from('exercise_logs')
    .select('ai_analysis')
    .eq('user_id', userId)
    .gte('created_at', from)
    .lte('created_at', to);
  const seen = new Set(
    (existing || [])
      .map((r) => (r as { ai_analysis?: { external_id?: string } | null }).ai_analysis?.external_id)
      .filter(Boolean) as string[],
  );

  const fresh = workouts.filter((w) => !seen.has(w.externalId));
  // Also collapse duplicates within the same request
  const unique = fresh.filter((w, i) => fresh.findIndex((x) => x.externalId === w.externalId) === i);

  const rows = unique.map((w) => {
    const estimated = w.caloriesReported === null;
    const calories = estimated ? estimateCalories(w, weightKg) : w.caloriesReported!;
    return {
      user_id: userId,
      exercise_type: w.type,
      duration_minutes: Math.max(1, Math.round(w.durationMin)),
      intensity: intensityFor(w),
      distance_km: w.distanceKm,
      calories_burned: calories,
      source: 'manual' as const,
      description: `Imported from ${w.source || 'Apple Health'}`,
      confidence: 'high' as const,
      ai_analysis: {
        import_source: 'apple_health',
        health_source: w.source,
        external_id: w.externalId,
        calories_estimated: estimated,
      },
      created_at: w.startIso,
    };
  });
  const localDates = unique.map((w) => w.localDate);

  if (!dryRun && rows.length > 0) {
    const { error } = await supabase.from('exercise_logs').insert(rows);
    if (error) {
      console.error('[health-sync] insert failed:', error.message);
      return NextResponse.json({ ok: false, message: 'Nuvia: could not save workouts. Try again later.' }, { status: 502 });
    }
  }

  const items = rows.map((r, i) => ({
    type: r.exercise_type,
    start: r.created_at,
    date: localDates[i],
    durationMin: r.duration_minutes,
    distanceKm: r.distance_km,
    calories: r.calories_burned,
    caloriesEstimated: r.ai_analysis.calories_estimated,
  }));
  const alreadyImported = fresh.length === workouts.length ? 0 : workouts.length - fresh.length;
  const duplicates = fresh.length - unique.length;
  const skipped = alreadyImported + duplicates;
  const describe = (i: (typeof items)[number]) =>
    `${i.type}${i.distanceKm ? ` ${i.distanceKm} km` : ''} · ${i.durationMin} min · ${i.date}`;

  const message =
    (dryRun ? 'Nuvia test (nothing saved): ' : 'Nuvia: ') +
    (rows.length
      ? `${dryRun ? 'would import' : 'imported'} ${rows.length} — ${items.map(describe).join('; ')}`
      : 'nothing new') +
    (alreadyImported ? ` (${alreadyImported} already imported)` : '') +
    (duplicates ? ` (${duplicates} duplicate skipped)` : '') +
    (errors.length ? `. Skipped ${errors.length}: ${errors[0]}` : '');

  return NextResponse.json({ ok: true, dryRun, imported: dryRun ? 0 : rows.length, skipped, errors, items, message });
}
