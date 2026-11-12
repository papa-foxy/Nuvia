/**
 * Parses workouts sent by the iPhone Shortcut (Apple Health → Nuvia).
 *
 * The Shortcut builds a JSON body from Health sample details. Exact value
 * formats depend on the iOS version and the user's settings, so every field is
 * parsed leniently:
 *   start / end   ISO 8601 (recommended) or anything Date.parse understands
 *   duration      seconds (number), "1:02:03", "31 min", "1 hr 5 min", "1h 5m"
 *   distance      "5.02 km", "3.1 mi", "5020 m", or a number + `distanceUnit`
 *   energy        "320 kcal" (optional)
 *   type / name   workout type, e.g. "Running", "Outdoor Run"
 *   source        app that recorded it, e.g. "adidas Running"
 *
 * Pure module: no I/O, so it can be unit-tested and reused.
 */

export interface RawHealthWorkout {
  [key: string]: unknown;
}

export interface ParsedWorkout {
  externalId: string;
  type: string;
  source: string | null;
  startIso: string;
  /** Calendar date as sent by the phone (its local time zone), YYYY-MM-DD. */
  localDate: string;
  durationMin: number;
  distanceKm: number | null;
  caloriesReported: number | null;
}

export interface ParseResult {
  workouts: ParsedWorkout[];
  errors: string[];
}

const pick = (o: RawHealthWorkout, keys: string[]): unknown => {
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ''), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase().replace(/[\s_-]/g, '')];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

const toNumber = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function parseDate(v: unknown): Date | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') {
    // Epoch seconds or milliseconds
    const d = new Date(v < 1e12 ? v * 1000 : v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim().replace(/\s+at\s+/i, ' ');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Returns minutes, or null when the value can't be understood. */
export function parseDurationMinutes(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return v / 60; // Shortcuts durations are seconds
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  const clock = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    const [, a, b, c] = clock;
    return c !== undefined ? Number(a) * 60 + Number(b) + Number(c) / 60 : Number(a) + Number(b) / 60;
  }

  let total = 0;
  let matched = false;
  const re = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;
  for (const m of s.matchAll(re)) {
    const n = toNumber(m[1]) ?? 0;
    const unit = m[2];
    matched = true;
    if (unit.startsWith('h')) total += n * 60;
    else if (unit.startsWith('m')) total += n;
    else total += n / 60;
  }
  if (matched) return total;

  const plain = toNumber(s);
  return plain === null ? null : plain / 60; // bare number → seconds
}

/** Returns kilometres, or null when no distance is present. */
export function parseDistanceKm(v: unknown, unitHint?: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  // Capture the whole unit word, so "320 kcal" is rejected instead of read as km.
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)?/);
  if (!m) return null;
  const n = toNumber(m[1]);
  if (n === null) return null;
  const unit = (m[2] || String(unitHint ?? '').trim().toLowerCase() || 'km').replace(/s$/, '');
  if (unit.startsWith('mi')) return n * 1.609344;
  if (unit === 'm' || unit.startsWith('met')) return n / 1000;
  if (unit === 'km' || unit.startsWith('kilo')) return n;
  return null; // e.g. "kcal" passed as a value: not a distance
}

export function parseEnergyKcal(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kcal|cal|calories|kj)?/);
  if (!m) return null;
  const n = toNumber(m[1]);
  if (n === null) return null;
  if (m[2] === 'kj') return n / 4.184;
  return n;
}

export function normalizeType(v: unknown): string {
  const s = String(v ?? '').trim();
  const l = s.toLowerCase();
  if (/run|jog/.test(l)) return 'Running';
  if (/walk/.test(l)) return 'Walking';
  if (/hik/.test(l)) return 'Hiking';
  if (/cycl|bik|ride/.test(l)) return 'Cycling';
  if (/swim/.test(l)) return 'Swimming';
  if (!s) return 'Workout';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseOne(o: RawHealthWorkout, index: number): ParsedWorkout | string {
  const rawStart = pick(o, ['start', 'startDate', 'start_date', 'startTime', 'begin']);
  const start = parseDate(rawStart);
  const end = parseDate(pick(o, ['end', 'endDate', 'end_date', 'endTime', 'finish']));
  if (!start) return `Workout ${index + 1}: missing or unreadable start date`;

  let durationMin = parseDurationMinutes(pick(o, ['duration', 'durationSeconds', 'elapsed', 'time']));
  if (end && end > start) durationMin = (end.getTime() - start.getTime()) / 60000; // most reliable
  if (!durationMin || durationMin <= 0) return `Workout ${index + 1}: missing duration (send start and end dates)`;
  if (durationMin > 24 * 60) return `Workout ${index + 1}: duration over 24 hours, ignored`;

  const unit = pick(o, ['distanceUnit', 'unit']);
  let distanceKm = parseDistanceKm(pick(o, ['distance', 'totalDistance', 'distanceKm']), unit);
  if (distanceKm === null) {
    // Some Shortcut setups put the distance in "value" with a separate unit
    const valueUnit = String(unit ?? '').toLowerCase();
    if (/km|mi|meter|metre|^m$/.test(valueUnit)) distanceKm = parseDistanceKm(pick(o, ['value']), unit);
  }
  if (distanceKm !== null && (distanceKm <= 0 || distanceKm > 500)) distanceKm = null;

  const caloriesReported = parseEnergyKcal(pick(o, ['energy', 'calories', 'activeEnergy', 'totalEnergy', 'kcal']));
  const type = normalizeType(pick(o, ['type', 'workoutType', 'activityType', 'name', 'activity']));
  const source = pick(o, ['source', 'sourceName', 'app', 'device']);

  return {
    // Same workout re-sent by the Shortcut gets the same id → de-duplicated
    externalId: `hk:${start.toISOString().slice(0, 16)}:${type.toLowerCase()}`,
    type,
    source: source === undefined ? null : String(source).trim(),
    startIso: start.toISOString(),
    localDate: /^\d{4}-\d{2}-\d{2}/.test(String(rawStart)) ? String(rawStart).slice(0, 10) : start.toISOString().slice(0, 10),
    durationMin: Math.round(durationMin * 10) / 10,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
    caloriesReported: caloriesReported === null ? null : Math.round(caloriesReported),
  };
}

/** Accepts { workouts: [...] }, a bare array, or a single workout object. */
export function parseHealthWorkouts(body: unknown): ParseResult {
  let list: unknown[] = [];
  if (Array.isArray(body)) list = body;
  else if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.workouts)) list = b.workouts;
    else if (Array.isArray(b.items)) list = b.items;
    else list = [b];
  }
  const workouts: ParsedWorkout[] = [];
  const errors: string[] = [];
  list.slice(0, 100).forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Workout ${i + 1}: not an object`);
      return;
    }
    const r = parseOne(item as RawHealthWorkout, i);
    if (typeof r === 'string') errors.push(r);
    else workouts.push(r);
  });
  return { workouts, errors };
}

/** Calorie estimate when Health doesn't send energy. kcal/kg/km for foot sports, MET otherwise. */
export function estimateCalories(w: ParsedWorkout, weightKg: number): number {
  const kg = weightKg > 0 ? weightKg : 70;
  if (w.distanceKm && w.type === 'Running') return Math.round(kg * w.distanceKm * 1.0);
  if (w.distanceKm && w.type === 'Walking') return Math.round(kg * w.distanceKm * 0.55);
  const met = w.type === 'Cycling' ? 7 : w.type === 'Hiking' ? 6 : w.type === 'Walking' ? 3.5 : w.type === 'Running' ? 9.8 : 5;
  return Math.round(met * kg * (w.durationMin / 60));
}

export function intensityFor(w: ParsedWorkout): 'low' | 'moderate' | 'high' {
  if (w.type === 'Running' && w.distanceKm) {
    const pace = w.durationMin / w.distanceKm; // min/km
    return pace < 5.5 ? 'high' : pace < 7 ? 'moderate' : 'low';
  }
  if (w.type === 'Walking') return 'low';
  return 'moderate';
}
