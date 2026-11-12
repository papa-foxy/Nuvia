/**
 * Shared, server-only logging of external workouts (Apple Health, Strava).
 *
 * - Logs each workout on the day it started (created_at = start time).
 * - Skips workouts already imported (same external id), duplicates within one
 *   batch, and the same session arriving from another source (same type,
 *   start within 3 minutes), e.g. a run in both Apple Health and Strava.
 * - Estimates calories from body weight when the source sends none.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateCalories, intensityFor, type ParsedWorkout } from '@/lib/health-workout-parse';

export type ImportSource = 'apple_health' | 'strava';

export interface IngestWorkout extends ParsedWorkout {
  importSource: ImportSource;
  /** Extra fields stored in ai_analysis (e.g. strava_activity_id). */
  extra?: Record<string, unknown>;
}

export interface IngestItem {
  type: string;
  start: string;
  date: string;
  durationMin: number;
  distanceKm: number | null;
  calories: number;
  caloriesEstimated: boolean;
}

export interface IngestResult {
  imported: number;
  alreadyImported: number;
  duplicates: number;
  otherSource: number;
  items: IngestItem[];
}

const OVERLAP_MS = 3 * 60_000;

interface ExistingLog {
  exercise_type: string | null;
  created_at: string;
  ai_analysis: { external_id?: string } | null;
}

export async function ingestWorkouts(
  supabase: SupabaseClient,
  userId: string,
  workouts: IngestWorkout[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<IngestResult> {
  const empty: IngestResult = { imported: 0, alreadyImported: 0, duplicates: 0, otherSource: 0, items: [] };
  if (workouts.length === 0) return empty;

  const { data: profile } = await supabase.from('profiles').select('weight_kg').eq('id', userId).maybeSingle();
  const weightKg = Number((profile as { weight_kg?: number } | null)?.weight_kg) || 70;

  const times = workouts.map((w) => new Date(w.startIso).getTime());
  const from = new Date(Math.min(...times) - 86_400_000).toISOString();
  const to = new Date(Math.max(...times) + 86_400_000).toISOString();
  const { data: existingRows } = await supabase
    .from('exercise_logs')
    .select('exercise_type, created_at, ai_analysis')
    .eq('user_id', userId)
    .gte('created_at', from)
    .lte('created_at', to);
  const existing = (existingRows || []) as ExistingLog[];
  const seenIds = new Set(existing.map((r) => r.ai_analysis?.external_id).filter(Boolean) as string[]);

  let alreadyImported = 0;
  let duplicates = 0;
  let otherSource = 0;
  const batchIds = new Set<string>();
  const accepted: IngestWorkout[] = [];

  for (const w of workouts) {
    if (seenIds.has(w.externalId)) {
      alreadyImported++;
      continue;
    }
    if (batchIds.has(w.externalId)) {
      duplicates++;
      continue;
    }
    const t = new Date(w.startIso).getTime();
    const sameSession = (type: string | null, startIso: string) =>
      (type || '').toLowerCase() === w.type.toLowerCase() && Math.abs(new Date(startIso).getTime() - t) <= OVERLAP_MS;
    // Same session already in Nuvia, or earlier in this batch from another source
    const overlaps =
      existing.some((r) => sameSession(r.exercise_type, r.created_at)) ||
      accepted.some((a) => sameSession(a.type, a.startIso));
    if (overlaps) {
      otherSource++;
      continue;
    }
    batchIds.add(w.externalId);
    accepted.push(w);
  }

  const rows = accepted.map((w) => {
    const estimated = w.caloriesReported === null;
    return {
      user_id: userId,
      exercise_type: w.type,
      duration_minutes: Math.max(1, Math.round(w.durationMin)),
      intensity: intensityFor(w),
      distance_km: w.distanceKm,
      calories_burned: estimated ? estimateCalories(w, weightKg) : w.caloriesReported!,
      source: 'manual' as const,
      description: `Imported from ${w.source || (w.importSource === 'strava' ? 'Strava' : 'Apple Health')}`,
      confidence: 'high' as const,
      ai_analysis: {
        import_source: w.importSource,
        health_source: w.source,
        external_id: w.externalId,
        calories_estimated: estimated,
        ...(w.extra || {}),
      },
      created_at: w.startIso,
    };
  });

  if (!dryRun && rows.length > 0) {
    const { error } = await supabase.from('exercise_logs').insert(rows);
    if (error) throw new Error(`Could not save workouts: ${error.message}`);
  }

  return {
    imported: dryRun ? 0 : rows.length,
    alreadyImported,
    duplicates,
    otherSource,
    items: rows.map((r, i) => ({
      type: r.exercise_type,
      start: r.created_at,
      date: accepted[i].localDate,
      durationMin: r.duration_minutes,
      distanceKm: r.distance_km,
      calories: r.calories_burned,
      caloriesEstimated: r.ai_analysis.calories_estimated,
    })),
  };
}

/** One-line human summary, used in Shortcut results and the app. */
export function describeIngest(r: IngestResult, { dryRun = false, prefix = 'Nuvia' } = {}): string {
  const fmt = (i: IngestItem) =>
    `${i.type}${i.distanceKm ? ` ${i.distanceKm} km` : ''} · ${i.durationMin} min · ${i.date}`;
  const count = r.items.length;
  return (
    `${prefix}${dryRun ? ' test (nothing saved)' : ''}: ` +
    (count ? `${dryRun ? 'would import' : 'imported'} ${count} — ${r.items.map(fmt).join('; ')}` : 'nothing new') +
    (r.alreadyImported ? ` (${r.alreadyImported} already imported)` : '') +
    (r.duplicates ? ` (${r.duplicates} duplicate skipped)` : '') +
    (r.otherSource ? ` (${r.otherSource} already logged from another app)` : '')
  );
}
