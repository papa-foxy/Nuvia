// Personalization for the meal-photo AI: a compact summary of what THIS user
// usually logs and the corrections they made to past AI guesses.
//
// Pure helpers (summarizeMealHistory, personalContextForPrompt) + one loader
// (loadPersonalContext). Only `import type` from external packages so this file
// also runs under `node --experimental-strip-types` (no path aliases).
//
// Name grouping rule:
//   1. normalizeName(): NFKD, strip diacritics, lower-case, every non letter/digit
//      character becomes a space, collapse whitespace, trim.
//      "  LATTE, " == "latte";  "Latte (no stevia)" -> "latte no stevia".
//   2. baseKey(): the raw name with TRAILING parentheticals/brackets removed,
//      then normalized. Items are grouped by baseKey, so "Latte" and
//      "Latte (no stevia)" are one group (they become identical once the trailing
//      qualifier is ignored), while "Latte" vs "Kopi", or "Iced latte" vs
//      "Latte", stay separate. No fuzzy/synonym matching.
//   The group's display name is the most recent original spelling the user used
//   (qualifier kept, e.g. "Latte (no stevia)").
//   Corrections compare the FULL normalized names, so "Latte" -> "Latte (no
//   stevia)" counts as a correction (the qualifier is real information), but
//   "kopi ais" -> "Kopi Ais." does not.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalMealRow {
  description: string | null;
  meal_type: string | null;
  meal_time: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source?: string | null;
  ai_meal_name?: string | null;
  items?: { name: string; calories: number | null }[];
}

export interface UsualItem {
  name: string;
  count: number;
  lastSeen: string;
  mealType: string | null;
  /** Typical local hour window [startHour, endHour), 0-24 (endHour may be 24). */
  hours: { start: number; end: number } | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  daysOfLast14: number;
}

export interface Correction {
  aiSaid: string;
  userSaved: string;
  count: number;
  lastSeen: string;
}

export interface PersonalSummary {
  usual: UsualItem[];
  corrections: Correction[];
  totalMeals: number;
}

const MAX_USUAL = 12;
const MAX_CORRECTIONS = 8;
const DEFAULT_OFFSET_MIN = 480; // Malaysia, UTC+8
const DAY_MS = 86_400_000;

export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function baseKey(name: string | null | undefined): string {
  if (!name) return '';
  let s = name.trim();
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/\s*(\([^()]*\)|\[[^\[\]]*\])\s*$/, '').trim();
  }
  const base = normalizeName(s);
  return base || normalizeName(name);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function roundOrNull(n: number | null): number | null {
  return n == null ? null : Math.round(n);
}

function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function mode<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface Occurrence {
  original: string;
  time: number; // epoch ms
  mealType: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export function summarizeMealHistory(
  rows: PersonalMealRow[],
  opts?: { now?: Date; timeZoneOffsetMinutes?: number },
): PersonalSummary {
  const now = opts?.now ?? new Date();
  const offsetMs = (opts?.timeZoneOffsetMinutes ?? DEFAULT_OFFSET_MIN) * 60_000;
  const localDay = (t: number) => Math.floor((t + offsetMs) / DAY_MS);
  const todayLocal = localDay(now.getTime());

  const groups = new Map<string, Occurrence[]>();
  const corrections = new Map<string, Correction>();
  let totalMeals = 0;

  for (const row of rows ?? []) {
    const time = Date.parse(row?.meal_time);
    if (!Number.isFinite(time)) continue;
    totalMeals++;

    // One occurrence per distinct baseKey per meal (description wins over items).
    const seen = new Set<string>();
    const add = (original: string, occ: Omit<Occurrence, 'original' | 'time' | 'mealType'>) => {
      const key = baseKey(original);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const list = groups.get(key) ?? [];
      list.push({ original: original.trim(), time, mealType: row.meal_type ?? null, ...occ });
      groups.set(key, list);
    };

    const desc = row.description?.trim();
    if (desc) {
      add(desc, {
        calories: isNum(row.calories) ? row.calories : null,
        protein_g: isNum(row.protein_g) ? row.protein_g : null,
        carbs_g: isNum(row.carbs_g) ? row.carbs_g : null,
        fat_g: isNum(row.fat_g) ? row.fat_g : null,
      });
    }
    for (const item of row.items ?? []) {
      const name = item?.name?.trim();
      if (!name) continue;
      add(name, {
        calories: isNum(item.calories) ? item.calories : null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      });
    }

    // Corrections: AI's original name vs what the user saved.
    const ai = row.ai_meal_name?.trim();
    if (ai && desc) {
      const aiN = normalizeName(ai);
      const userN = normalizeName(desc);
      if (aiN && userN && aiN !== userN) {
        const k = `${aiN}\u0000${userN}`;
        const existing = corrections.get(k);
        if (!existing) {
          corrections.set(k, { aiSaid: ai, userSaved: desc, count: 1, lastSeen: new Date(time).toISOString() });
        } else {
          existing.count++;
          if (time > Date.parse(existing.lastSeen)) {
            existing.aiSaid = ai;
            existing.userSaved = desc;
            existing.lastSeen = new Date(time).toISOString();
          }
        }
      }
    }
  }

  const scored: { item: UsualItem; score: number; last: number }[] = [];
  for (const occs of groups.values()) {
    if (occs.length < 2) continue;
    occs.sort((a, b) => b.time - a.time);
    const latest = occs[0];

    const localHours = occs
      .map((o) => (((o.time + offsetMs) % DAY_MS) + DAY_MS) % DAY_MS / 3_600_000)
      .sort((a, b) => a - b);
    const start = Math.floor(percentile(localHours, 0.25));
    const end = Math.min(24, Math.max(start + 1, Math.floor(percentile(localHours, 0.75)) + 1));

    const days = new Set<number>();
    for (const o of occs) {
      const d = localDay(o.time);
      if (d <= todayLocal && d > todayLocal - 14) days.add(d);
    }

    const pick = (f: (o: Occurrence) => number | null) =>
      roundOrNull(median(occs.map(f).filter(isNum)));

    const item: UsualItem = {
      name: latest.original,
      count: occs.length,
      lastSeen: new Date(latest.time).toISOString(),
      mealType: mode(occs.map((o) => o.mealType).filter((m): m is string => !!m)),
      hours: { start, end },
      calories: pick((o) => o.calories),
      protein_g: pick((o) => o.protein_g),
      carbs_g: pick((o) => o.carbs_g),
      fat_g: pick((o) => o.fat_g),
      daysOfLast14: days.size,
    };
    // Frequent first, with a boost for things eaten in the last two weeks.
    scored.push({ item, score: item.count + item.daysOfLast14, last: latest.time });
  }
  scored.sort((a, b) => b.score - a.score || b.last - a.last);

  const corr = [...corrections.values()]
    .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen))
    .slice(0, MAX_CORRECTIONS);

  return {
    usual: scored.slice(0, MAX_USUAL).map((s) => s.item),
    corrections: corr,
    totalMeals,
  };
}

function fmtHour(h: number): { n: string; ap: 'am' | 'pm' } {
  const hh = ((h % 24) + 24) % 24;
  const ap = hh < 12 ? 'am' : 'pm';
  const n = hh % 12 === 0 ? 12 : hh % 12;
  return { n: String(n), ap };
}

/** e.g. {8,9} -> "~8–9am", {11,13} -> "~11am–1pm". */
export function formatHourRange(hours: { start: number; end: number }): string {
  const a = fmtHour(hours.start);
  const b = fmtHour(hours.end);
  return a.ap === b.ap ? `~${a.n}–${b.n}${b.ap}` : `~${a.n}${a.ap}–${b.n}${b.ap}`;
}

function quote(s: string): string {
  return `"${s.replace(/\s+/g, ' ').replace(/"/g, "'").slice(0, 60)}"`;
}

function usualLine(u: UsualItem): string {
  const parts = [`${u.count}x`];
  if (u.daysOfLast14 >= 2) parts.push(`${u.daysOfLast14} of last 14 days`);
  if (u.mealType || u.hours) {
    let when = 'usually';
    if (u.mealType) when += ` ${u.mealType}`;
    if (u.hours) when += ` ${formatHourRange(u.hours)}`;
    parts.push(when);
  }
  if (u.calories != null) {
    let kcal = `~${u.calories} kcal`;
    if (u.protein_g != null && u.carbs_g != null && u.fat_g != null) {
      kcal += ` (P${u.protein_g} C${u.carbs_g} F${u.fat_g})`;
    }
    parts.push(kcal);
  }
  return `- ${quote(u.name)} — ${parts.join(', ')}`;
}

const HARD_CAP = 1500;

export function personalContextForPrompt(
  summary: PersonalSummary,
  opts?: { localTimeLabel?: string },
): string {
  if (!summary) return '';
  let usual = (summary.usual ?? []).map(usualLine);
  let corr = (summary.corrections ?? []).map(
    (c) => `- ${quote(c.aiSaid)} → ${quote(c.userSaved)}${c.count > 1 ? ` (${c.count}x)` : ''}`,
  );
  if (!usual.length && !corr.length) return '';

  const label = opts?.localTimeLabel?.trim();
  const build = () => {
    const lines = ['ABOUT THIS USER (their own logging history — use it):'];
    if (usual.length) lines.push('Usual items:', ...usual);
    if (corr.length) lines.push('Past corrections (AI guess → what the user saved):', ...corr);
    if (label) lines.push(`Now: ${label}.`);
    return lines.join('\n');
  };

  // Trim least important lines (tail of the longer list first) until under cap.
  let text = build();
  while (text.length > HARD_CAP && (usual.length > 1 || corr.length > 1)) {
    if (usual.length > corr.length || corr.length <= 1) usual = usual.slice(0, -1);
    else corr = corr.slice(0, -1);
    text = build();
  }
  return text.length > HARD_CAP ? text.slice(0, HARD_CAP) : text;
}

export async function loadPersonalContext(
  supabase: SupabaseClient,
  userId: string,
  opts?: { localTimeLabel?: string; timeZoneOffsetMinutes?: number },
): Promise<string> {
  try {
    if (!supabase || !userId) return '';
    const since = new Date(Date.now() - 90 * DAY_MS).toISOString();
    const { data, error } = await supabase
      .from('meals')
      .select(
        'description, meal_type, meal_time, calories, protein_g, carbs_g, fat_g, source, ai_meal_name:ai_analysis->>meal_name, meal_items(name, calories)',
      )
      .eq('user_id', userId)
      .gte('meal_time', since)
      .order('meal_time', { ascending: false })
      .limit(300);
    if (error || !Array.isArray(data)) return '';

    type RawRow = Partial<Omit<PersonalMealRow, 'items'>> & { meal_items?: { name?: unknown; calories?: number | null }[] | null };
    const rows: PersonalMealRow[] = (data as RawRow[]).map((r) => ({
      description: r?.description ?? null,
      meal_type: r?.meal_type ?? null,
      meal_time: r?.meal_time ?? '',
      calories: r?.calories ?? null,
      protein_g: r?.protein_g ?? null,
      carbs_g: r?.carbs_g ?? null,
      fat_g: r?.fat_g ?? null,
      source: r?.source ?? null,
      ai_meal_name: typeof r?.ai_meal_name === 'string' ? r.ai_meal_name : null,
      items: Array.isArray(r?.meal_items)
        ? r.meal_items
            .filter((i): i is { name: string; calories?: number | null } => !!i && typeof i.name === 'string')
            .map((i) => ({ name: i.name, calories: i.calories ?? null }))
        : [],
    }));

    const summary = summarizeMealHistory(rows, { timeZoneOffsetMinutes: opts?.timeZoneOffsetMinutes });
    return personalContextForPrompt(summary, { localTimeLabel: opts?.localTimeLabel });
  } catch {
    return '';
  }
}
