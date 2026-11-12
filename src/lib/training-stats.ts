/**
 * Training statistics derived from existing data only:
 *  - ExerciseLog rows (duration, calories, created_at)
 *  - ai_analysis.actual_performance (set-by-set reps/weight from routine workouts)
 *  - WorkoutRoutine.days (scheduled training days → weekly goal)
 * Nothing here is estimated or invented; missing data yields zeros/nulls so the
 * UI can show an empty state.
 */
import type { ExerciseLog } from '@/types/database';
import type { ExercisePerformance, WorkoutRoutine } from '@/types/routine';

export interface WeekBucket {
  /** Monday of the week, YYYY-MM-DD (local time) */
  start: string;
  label: string;
  workouts: number;
  minutes: number;
  volumeKg: number;
  isCurrent: boolean;
}

export interface PersonalRecord {
  exercise: string;
  muscle: string;
  weightKg: number;
  reps: number;
  date: string;
}

export interface MuscleShare {
  muscle: string;
  sets: number;
}

const DAY_MS = 86_400_000;

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function logDate(log: ExerciseLog): Date | null {
  if (!log.created_at) return null;
  const d = new Date(log.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

function performances(log: ExerciseLog): ExercisePerformance[] {
  const p = (log.ai_analysis as { actual_performance?: unknown } | null)?.actual_performance;
  return Array.isArray(p) ? (p as ExercisePerformance[]) : [];
}

export function logVolumeKg(log: ExerciseLog): number {
  let v = 0;
  for (const perf of performances(log)) {
    for (const s of perf.sets || []) {
      if (s.completed && s.weight_kg && s.reps) v += s.weight_kg * s.reps;
    }
  }
  return v;
}

export function logCompletedSets(log: ExerciseLog): number {
  return performances(log).reduce((n, p) => n + (p.sets || []).filter((s) => s.completed).length, 0);
}

/** Distinct scheduled weekdays across all routines, or null when nothing is scheduled. */
export function weeklyWorkoutGoal(routines: WorkoutRoutine[]): number | null {
  const days = new Set<string>();
  for (const r of routines) for (const d of r.days || []) days.add(d.toLowerCase());
  return days.size > 0 ? days.size : null;
}

/** Last `count` weeks, oldest first, ending with the current week. */
export function weeklyBuckets(logs: ExerciseLog[], count: number, now = new Date()): WeekBucket[] {
  const currentStart = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const s = new Date(currentStart);
    s.setDate(s.getDate() - i * 7);
    buckets.push({
      start: localDateStr(s),
      label: s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      workouts: 0,
      minutes: 0,
      volumeKg: 0,
      isCurrent: i === 0,
    });
  }
  const firstStart = new Date(currentStart.getTime() - (count - 1) * 7 * DAY_MS);
  for (const log of logs) {
    const d = logDate(log);
    if (!d || d < firstStart) continue;
    const idx = Math.floor((startOfWeek(d).getTime() - firstStart.getTime()) / (7 * DAY_MS) + 0.01);
    const b = buckets[idx];
    if (!b) continue;
    b.workouts += 1;
    b.minutes += log.duration_minutes || 0;
    b.volumeKg += logVolumeKg(log);
  }
  return buckets;
}

/** Minutes per day for the current Monday–Sunday week. */
export function currentWeekDays(logs: ExerciseLog[], now = new Date()) {
  const start = startOfWeek(now);
  const todayStr = localDateStr(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = localDateStr(d);
    return {
      date: ds,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      minutes: 0,
      workouts: 0,
      isToday: ds === todayStr,
      isFuture: ds > todayStr,
    };
  });
  for (const log of logs) {
    const d = logDate(log);
    if (!d) continue;
    const day = days.find((x) => x.date === localDateStr(d));
    if (day) {
      day.minutes += log.duration_minutes || 0;
      day.workouts += 1;
    }
  }
  return days;
}

/** Heaviest completed set per exercise (ties broken by reps), newest first. */
export function personalRecords(logs: ExerciseLog[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const log of logs) {
    const date = log.created_at || '';
    for (const p of performances(log)) {
      for (const s of p.sets || []) {
        if (!s.completed || !s.weight_kg || !s.reps) continue;
        const key = p.name.trim().toLowerCase();
        const cur = best.get(key);
        if (!cur || s.weight_kg > cur.weightKg || (s.weight_kg === cur.weightKg && s.reps > cur.reps)) {
          best.set(key, { exercise: p.name, muscle: p.target_muscle, weightKg: s.weight_kg, reps: s.reps, date });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Completed sets per target muscle since `since`. */
export function muscleDistribution(logs: ExerciseLog[], since: Date): MuscleShare[] {
  const map = new Map<string, number>();
  for (const log of logs) {
    const d = logDate(log);
    if (!d || d < since) continue;
    for (const p of performances(log)) {
      const n = (p.sets || []).filter((s) => s.completed).length;
      if (!n) continue;
      const m = p.target_muscle || 'Other';
      map.set(m, (map.get(m) || 0) + n);
    }
  }
  return [...map.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatVolume(kg: number): string {
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}
