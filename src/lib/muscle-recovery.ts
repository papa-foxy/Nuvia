/**
 * Muscle recovery estimated from the user's own workout history.
 *
 * Inputs (nothing hardcoded per user):
 *  - ExerciseLog.ai_analysis.actual_performance: completed sets per exercise
 *    (name + target muscle group) from routine workouts.
 *  - Cardio logs without sets (runs, rides, walks, court sports): treated as
 *    leg work in proportion to their duration.
 *
 * Model: each exercise loads one or more muscles (primary = 1, helpers less).
 * A session's effective sets for a muscle decide how long it needs: about a
 * day for a few sets up to four days for a very high-volume session (abs,
 * calves and forearms recover faster). Recovery % = time since ÷ time needed.
 * This is a training rule of thumb, not a measurement of the body.
 */
import type { ExerciseLog } from '@/types/database';

export const MUSCLE_IDS = [
  'chest',
  'deltoids',
  'trapezius',
  'upper-back',
  'lower-back',
  'biceps',
  'triceps',
  'forearm',
  'abs',
  'obliques',
  'gluteal',
  'quadriceps',
  'hamstring',
  'adductors',
  'calves',
  'tibialis',
] as const;
export type MuscleId = (typeof MUSCLE_IDS)[number];

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Legs'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_INFO: Record<MuscleId, { label: string; group: MuscleGroup; view: 'front' | 'back' }> = {
  chest: { label: 'Chest', group: 'Chest', view: 'front' },
  deltoids: { label: 'Shoulders', group: 'Shoulders', view: 'front' },
  trapezius: { label: 'Traps', group: 'Back', view: 'back' },
  'upper-back': { label: 'Lats & upper back', group: 'Back', view: 'back' },
  'lower-back': { label: 'Lower back', group: 'Back', view: 'back' },
  biceps: { label: 'Biceps', group: 'Biceps', view: 'front' },
  triceps: { label: 'Triceps', group: 'Triceps', view: 'back' },
  forearm: { label: 'Forearms', group: 'Forearms', view: 'front' },
  abs: { label: 'Abs', group: 'Abs', view: 'front' },
  obliques: { label: 'Obliques', group: 'Abs', view: 'front' },
  gluteal: { label: 'Glutes', group: 'Legs', view: 'back' },
  quadriceps: { label: 'Quads', group: 'Legs', view: 'front' },
  hamstring: { label: 'Hamstrings', group: 'Legs', view: 'back' },
  adductors: { label: 'Inner thighs', group: 'Legs', view: 'front' },
  calves: { label: 'Calves', group: 'Legs', view: 'back' },
  tibialis: { label: 'Shins', group: 'Legs', view: 'front' },
};

type Load = Partial<Record<MuscleId, number>>;

/**
 * Which muscles an exercise loads, and how much (1 = primary). Derived from
 * the exercise's target group refined by keywords in its name.
 */
export function musclesForExercise(name: string, targetMuscle: string): Load {
  const n = (name || '').toLowerCase();
  const has = (re: RegExp) => re.test(n);
  switch ((targetMuscle || '').trim()) {
    case 'Chest':
      if (has(/fly|flye|crossover|pec deck/)) return { chest: 1, deltoids: 0.2 };
      return { chest: 1, deltoids: 0.4, triceps: 0.4 };
    case 'Back':
      if (has(/deadlift|good morning|hyperextension|back extension|superman/)) {
        return { 'lower-back': 1, gluteal: 0.6, hamstring: 0.6, trapezius: 0.3, forearm: 0.3 };
      }
      if (has(/shrug/)) return { trapezius: 1, forearm: 0.3 };
      if (has(/face pull|reverse fly|rear delt/)) return { trapezius: 0.7, deltoids: 0.7, 'upper-back': 0.4 };
      return { 'upper-back': 1, trapezius: 0.5, biceps: 0.4, forearm: 0.3 };
    case 'Shoulders':
      if (has(/press|push/)) return { deltoids: 1, triceps: 0.4, trapezius: 0.3 };
      if (has(/shrug|upright row/)) return { trapezius: 1, deltoids: 0.6 };
      return { deltoids: 1, trapezius: 0.2 };
    case 'Biceps':
      return { biceps: 1, forearm: 0.4 };
    case 'Triceps':
      if (has(/dip|close.?grip|push.?up/)) return { triceps: 1, chest: 0.4, deltoids: 0.3 };
      return { triceps: 1 };
    case 'Forearms':
      return { forearm: 1 };
    case 'Abs':
      if (has(/twist|oblique|side|russian|woodchop|bicycle|windshield/)) return { obliques: 1, abs: 0.6 };
      if (has(/plank|hollow|rollout|roll-out/)) return { abs: 1, obliques: 0.5, 'lower-back': 0.2 };
      return { abs: 1, obliques: 0.3 };
    case 'Legs':
      if (has(/calf|calves/)) return { calves: 1, tibialis: 0.2 };
      if (has(/hip thrust|glute|bridge|kickback|donkey/)) return { gluteal: 1, hamstring: 0.5 };
      if (has(/leg curl|hamstring|rdl|romanian|deadlift|good morning|nordic/)) {
        return { hamstring: 1, gluteal: 0.6, 'lower-back': 0.4 };
      }
      if (has(/adduct|sumo|cossack|side lunge|lateral lunge/)) return { adductors: 1, quadriceps: 0.6, gluteal: 0.6 };
      if (has(/extension/)) return { quadriceps: 1 };
      if (has(/jump|skip|box/)) return { quadriceps: 0.8, calves: 0.8, gluteal: 0.5 };
      return { quadriceps: 1, gluteal: 0.7, hamstring: 0.4, adductors: 0.3 };
    case 'Full Body': {
      const all: Load = {};
      for (const id of MUSCLE_IDS) all[id] = 0.4;
      return all;
    }
    default:
      return {};
  }
}

/** Leg load of a cardio session logged without sets, as effective sets per muscle. */
function cardioLoad(log: ExerciseLog): Load {
  const type = (log.exercise_type || '').toLowerCase();
  const minutes = Number(log.duration_minutes) || 0;
  const units = minutes / 10; // one "set" per 10 minutes
  const scale = (load: Load, cap: number): Load =>
    Object.fromEntries(Object.entries(load).map(([k, w]) => [k, Math.min(cap, units) * (w as number)])) as Load;
  if (/run|jog|sprint|hik|stair|trail/.test(type)) return scale({ quadriceps: 0.7, hamstring: 0.6, calves: 0.9, gluteal: 0.5, tibialis: 0.4 }, 8);
  if (/cycl|bik|ride|spin/.test(type)) return scale({ quadriceps: 1, gluteal: 0.5, calves: 0.4, hamstring: 0.3 }, 8);
  if (/football|futsal|soccer|badminton|basketball|tennis|squash|netball/.test(type)) {
    return scale({ quadriceps: 0.7, calves: 0.8, gluteal: 0.5, hamstring: 0.5, adductors: 0.4 }, 8);
  }
  if (/swim/.test(type)) return scale({ 'upper-back': 0.7, deltoids: 0.7, triceps: 0.4, chest: 0.3 }, 6);
  if (/walk/.test(type)) return scale({ calves: 0.3, quadriceps: 0.2, gluteal: 0.2 }, 6);
  return {};
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const RECOVERY_WINDOW_MS = 6 * DAY_MS;
const HISTORY_WINDOW_MS = 30 * DAY_MS;
const FAST_RECOVERY: MuscleId[] = ['abs', 'obliques', 'calves', 'forearm', 'tibialis'];

/** Hours a muscle needs after `sets` effective sets in one session. */
export function recoveryHours(muscle: MuscleId, sets: number): number {
  const base = Math.min(96, Math.max(24, 24 + sets * 6));
  return FAST_RECOVERY.includes(muscle) ? base * 0.7 : base;
}

export interface MuscleSession {
  /** ISO time of the session. */
  date: string;
  /** Effective sets for this muscle (primary sets count 1, helper work less). */
  sets: number;
  /** Exercises in the session that worked this muscle, biggest contribution first. */
  exercises: string[];
  /** The log's title (routine or activity name). */
  title: string;
}

export interface MuscleStatus {
  id: MuscleId;
  label: string;
  group: MuscleGroup;
  /** 0–100; 100 = fully recovered or not trained in the last 6 days. */
  percent: number;
  /** Hours until ~100%; 0 when recovered. */
  readyInHours: number;
  /** Most recent session that worked this muscle (last 30 days), if any. */
  lastTrained: string | null;
  /** Effective sets in the last 7 days. */
  weeklySets: number;
  /** Sessions in the last 30 days, newest first. */
  history: MuscleSession[];
}

interface Perf {
  name?: string;
  target_muscle?: string;
  sets?: { completed?: boolean }[];
}

function logDate(log: ExerciseLog): Date | null {
  if (!log.created_at) return null;
  const d = new Date(log.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

function performances(log: ExerciseLog): Perf[] {
  const p = (log.ai_analysis as { actual_performance?: unknown } | null)?.actual_performance;
  return Array.isArray(p) ? (p as Perf[]) : [];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Effective sets per muscle in one log, and which exercises contributed. */
function logMuscleLoad(log: ExerciseLog): Map<MuscleId, { sets: number; by: Map<string, number> }> {
  const load = new Map<MuscleId, { sets: number; by: Map<string, number> }>();
  const add = (id: MuscleId, sets: number, exercise: string) => {
    if (sets <= 0) return;
    const cur = load.get(id) || { sets: 0, by: new Map<string, number>() };
    cur.sets += sets;
    cur.by.set(exercise, (cur.by.get(exercise) || 0) + sets);
    load.set(id, cur);
  };
  for (const p of performances(log)) {
    const done = (p.sets || []).filter((s) => s.completed).length;
    if (!done) continue;
    const weights = musclesForExercise(p.name || '', p.target_muscle || '');
    for (const [id, w] of Object.entries(weights) as [MuscleId, number][]) add(id, done * w, p.name || 'Exercise');
  }
  if (load.size === 0) {
    const title = log.exercise_type || 'Activity';
    for (const [id, sets] of Object.entries(cardioLoad(log)) as [MuscleId, number][]) add(id, sets, title);
  }
  return load;
}

export interface MuscleWork {
  id: MuscleId;
  label: string;
  /** Effective sets across the given logs. */
  sets: number;
  /** Exercises that worked it, biggest contribution first. */
  exercises: string[];
}

/** What a set of logs (e.g. one day) worked, per muscle, most sets first. */
export function muscleWork(logs: ExerciseLog[]): MuscleWork[] {
  const total = new Map<MuscleId, { sets: number; by: Map<string, number> }>();
  for (const log of logs) {
    for (const [id, { sets, by }] of logMuscleLoad(log)) {
      const cur = total.get(id) || { sets: 0, by: new Map<string, number>() };
      cur.sets += sets;
      for (const [name, n] of by) cur.by.set(name, (cur.by.get(name) || 0) + n);
      total.set(id, cur);
    }
  }
  return [...total.entries()]
    .filter(([, v]) => v.sets >= 1)
    .map(([id, v]) => ({
      id,
      label: MUSCLE_INFO[id].label,
      sets: round1(v.sets),
      exercises: [...v.by.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n),
    }))
    .sort((a, b) => b.sets - a.sets);
}

/** Muscles a planned routine targets (primary work only), with planned sets. */
export function plannedMuscles(exercises: { name: string; target_muscle: string; sets?: number }[]): MuscleWork[] {
  const total = new Map<MuscleId, { sets: number; by: Set<string> }>();
  for (const ex of exercises) {
    for (const [id, w] of Object.entries(musclesForExercise(ex.name, ex.target_muscle)) as [MuscleId, number][]) {
      if (w < 0.7) continue;
      const cur = total.get(id) || { sets: 0, by: new Set<string>() };
      cur.sets += Number(ex.sets) || 0;
      cur.by.add(ex.name);
      total.set(id, cur);
    }
  }
  return [...total.entries()]
    .map(([id, v]) => ({ id, label: MUSCLE_INFO[id].label, sets: v.sets, exercises: [...v.by] }))
    .sort((a, b) => b.sets - a.sets);
}

/** Recovery and history for every muscle, from the given logs. */
export function muscleStatus(logs: ExerciseLog[], now = new Date()): MuscleStatus[] {
  const nowMs = now.getTime();
  const sessions = new Map<MuscleId, MuscleSession[]>(MUSCLE_IDS.map((id) => [id, []]));

  for (const log of logs) {
    const when = logDate(log);
    if (!when) continue;
    const age = nowMs - when.getTime();
    if (age < 0 || age > HISTORY_WINDOW_MS) continue;

    for (const [id, { sets, by }] of logMuscleLoad(log)) {
      if (sets < 1) continue; // too little to matter
      sessions.get(id)!.push({
        date: when.toISOString(),
        sets: round1(sets),
        exercises: [...by.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
        title: log.exercise_type || 'Workout',
      });
    }
  }

  return MUSCLE_IDS.map((id) => {
    const history = sessions.get(id)!.sort((a, b) => b.date.localeCompare(a.date));
    let percent = 100;
    let readyInHours = 0;
    let weeklySets = 0;
    for (const s of history) {
      const ageMs = nowMs - new Date(s.date).getTime();
      if (ageMs <= 7 * DAY_MS) weeklySets += s.sets;
      if (ageMs > RECOVERY_WINDOW_MS) continue;
      const need = recoveryHours(id, s.sets);
      const hours = ageMs / HOUR_MS;
      const p = Math.max(0, Math.min(100, Math.round((hours / need) * 100)));
      if (p < percent) {
        percent = p;
        readyInHours = Math.max(0, Math.ceil(need - hours));
      }
    }
    return {
      id,
      label: MUSCLE_INFO[id].label,
      group: MUSCLE_INFO[id].group,
      percent,
      readyInHours,
      lastTrained: history[0]?.date ?? null,
      weeklySets: round1(weeklySets),
      history,
    };
  });
}

export interface GroupStatus {
  group: MuscleGroup;
  /** The least recovered muscle in the group decides. */
  percent: number;
  readyInHours: number;
  lastTrained: string | null;
}

export function groupStatus(statuses: MuscleStatus[]): GroupStatus[] {
  return MUSCLE_GROUPS.map((group) => {
    const members = statuses.filter((s) => s.group === group);
    const worst = members.reduce((a, b) => (b.percent < a.percent ? b : a), members[0]);
    const last = members.map((m) => m.lastTrained).filter(Boolean).sort().pop() ?? null;
    return { group, percent: worst?.percent ?? 100, readyInHours: worst?.readyInHours ?? 0, lastTrained: last };
  });
}

/** Whole days since the most recent log (0 = today), or null with no logs. */
export function daysSinceLastWorkout(logs: ExerciseLog[], now = new Date()): number | null {
  let latest = 0;
  for (const log of logs) {
    const d = logDate(log);
    if (d && d.getTime() > latest && d.getTime() <= now.getTime()) latest = d.getTime();
  }
  if (!latest) return null;
  const a = new Date(latest);
  const dayA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const dayB = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((dayB - dayA) / DAY_MS);
}
