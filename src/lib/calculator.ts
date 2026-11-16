import type { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';

/**
 * Single source of truth for every number Nuvia derives from body data:
 * maintenance calories, the daily calorie target, macros, and time-to-goal.
 * Every screen (onboarding, Goals, Profile, Today, AI coach) must go through
 * getUserCalculationContext() + calculateTargets() so they always agree.
 */

export interface CalculationInput {
  age: number;
  /** Unknown sex uses the midpoint of the male and female equations. */
  sex?: 'male' | 'female' | null;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: UserGoal;
  target_weight_kg?: number | null;
  weekly_pace_kg?: number; // 0.25 | 0.5 | 0.75 | 1.0 kg/week (default 0.5)
}

/** Why the calorie target could not follow the requested pace exactly. */
export type TargetLimit = 'none' | 'min_calories' | 'max_deficit' | 'max_surplus';

export interface CalculationResult {
  bmr: number;
  tdee: number;
  adjustment: number; // calorie_target - tdee, e.g. -550, +250, 0
  calorie_target: number;
  protein_target: number;
  carbohydrate_target: number;
  fat_target: number;
  exercise_minutes_target: number;
  /** The pace the user asked for (kg/week). */
  weekly_pace_kg: number;
  /** The pace the calorie target actually delivers (kg/week, 0 at maintenance). */
  expected_pace_kg: number;
  /** Set when a safety limit stopped the target from matching the requested pace. */
  limited_by: TargetLimit;
  /** Lowest daily calories Nuvia will suggest for this person. */
  min_calories: number;
  /** Body weight the protein and fat targets are based on. */
  reference_weight_kg: number;
  /** Estimated weeks to reach the target weight, or null when it does not apply. */
  weeks_to_goal: number | null;
}

/** Energy in one kilogram of body-weight change (the usual planning figure). */
export const KCAL_PER_KG = 7700;
export const DEFAULT_WEEKLY_PACE_KG = 0.5;
export const WEEKLY_PACE_OPTIONS = [0.25, 0.5, 0.75, 1.0] as const;
/** A deficit or surplus is never more than this share of maintenance calories. */
export const MAX_ADJUSTMENT_SHARE = 0.25;
export const MIN_CALORIES = { male: 1500, female: 1200 } as const;
/** Fixed adjustments for goals that do not use a weekly pace. */
export const RECOMPOSITION_DEFICIT_KCAL = 200;
export const BUILD_MUSCLE_SURPLUS_KCAL = 250;
/** Protein in grams per kg of reference weight (evidence range 1.6-2.2 g/kg). */
export const PROTEIN_G_PER_KG: Record<UserGoal, number> = {
  lose_weight: 2.0,
  recomposition: 2.0,
  build_muscle: 1.8,
  maintain_weight: 1.6,
  gain_weight: 1.6,
};
/** Protein never takes more than this share of the day's calories. */
export const MAX_PROTEIN_SHARE = 0.35;
/** Fat is 25% of calories, but never below this many grams per kg of reference weight. */
export const FAT_SHARE = 0.25;
export const MIN_FAT_G_PER_KG = 0.6;
/** Above this BMI, protein and fat use the weight at this BMI instead of current weight. */
export const REFERENCE_BMI = 25;

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Sedentary', desc: 'Desk job, little or no exercise' },
  lightly_active: { label: 'Lightly Active', desc: 'Light exercise 1-3 days a week' },
  moderately_active: { label: 'Moderately Active', desc: 'Moderate exercise 3-5 days a week' },
  very_active: { label: 'Very Active', desc: 'Hard exercise 6-7 days a week' },
  extremely_active: { label: 'Extremely Active', desc: 'Physical job plus hard training most days' },
};

/** Daily calorie change needed for a weekly pace: 0.5 kg/week -> 550 kcal/day. */
export function paceToDailyKcal(paceKgPerWeek: number): number {
  return Math.round((paceKgPerWeek * KCAL_PER_KG) / 7);
}

/** Weekly weight change a daily calorie gap produces: 550 kcal/day -> 0.5 kg/week. */
export function dailyKcalToPace(kcalPerDay: number): number {
  return Math.round(((Math.abs(kcalPerDay) * 7) / KCAL_PER_KG) * 100) / 100;
}

/** Body mass index, or null when height or weight is missing. */
export function calculateBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!(w > 0) || !(h > 0)) return null;
  return w / Math.pow(h / 100, 2);
}

/**
 * Age in whole years on `now`, counting the birthday properly.
 * Returns null when the date is missing, invalid, or implausible (under 10 / over 110).
 */
export function calculateAge(dateOfBirth?: string | null, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  let y: number, mo: number, d: number;
  if (m) {
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  } else {
    const parsed = new Date(dateOfBirth);
    if (isNaN(parsed.getTime())) return null;
    y = parsed.getFullYear();
    mo = parsed.getMonth() + 1;
    d = parsed.getDate();
  }
  let age = now.getFullYear() - y;
  const monthNow = now.getMonth() + 1;
  if (monthNow < mo || (monthNow === mo && now.getDate() < d)) age--;
  return age >= 10 && age <= 110 ? age : null;
}

export function calculateTargets(input: CalculationInput): CalculationResult {
  const { age, sex, height_cm, weight_kg, activity_level, goal } = input;
  const pace =
    input.weekly_pace_kg && input.weekly_pace_kg > 0 ? input.weekly_pace_kg : DEFAULT_WEEKLY_PACE_KG;

  // Mifflin-St Jeor (male +5, female -161; unknown sex uses the midpoint)
  const sexConstant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + sexConstant;

  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || ACTIVITY_MULTIPLIERS.lightly_active;
  const tdee = Math.round(bmr * multiplier);

  const minCalories = sex === 'female' ? MIN_CALORIES.female : MIN_CALORIES.male;
  const maxAdjustment = Math.round(tdee * MAX_ADJUSTMENT_SHARE);

  // Calorie target = maintenance +/- the goal adjustment, inside the safety limits.
  let calorieTarget = tdee;
  let limitedBy: TargetLimit = 'none';

  const applyDeficit = (wanted: number) => {
    let deficit = wanted;
    if (deficit > maxAdjustment) {
      deficit = maxAdjustment;
      limitedBy = 'max_deficit';
    }
    if (tdee - deficit < minCalories) {
      // Never push the target below the floor (and never above maintenance).
      deficit = Math.max(0, tdee - minCalories);
      limitedBy = 'min_calories';
    }
    calorieTarget = tdee - deficit;
  };

  switch (goal) {
    case 'recomposition':
      applyDeficit(RECOMPOSITION_DEFICIT_KCAL);
      break;
    case 'lose_weight':
      applyDeficit(paceToDailyKcal(pace));
      break;
    case 'gain_weight': {
      let surplus = paceToDailyKcal(pace);
      if (surplus > maxAdjustment) {
        surplus = maxAdjustment;
        limitedBy = 'max_surplus';
      }
      calorieTarget = tdee + surplus;
      break;
    }
    case 'build_muscle':
      calorieTarget = tdee + BUILD_MUSCLE_SURPLUS_KCAL;
      break;
    case 'maintain_weight':
    default:
      calorieTarget = tdee;
      break;
  }

  calorieTarget = Math.round(calorieTarget);
  const adjustment = calorieTarget - tdee;
  const expectedPace = dailyKcalToPace(adjustment);
  // A limit that only trims a few kcal does not change the pace, so do not report it.
  if ((goal === 'lose_weight' || goal === 'gain_weight') && expectedPace >= pace) {
    limitedBy = 'none';
  }

  // Reference weight: current weight, or the weight at BMI 25 when heavier than
  // that, so protein and fat are not inflated by body fat.
  const weightAtReferenceBmi = REFERENCE_BMI * Math.pow(height_cm / 100, 2);
  const referenceWeight = Math.min(weight_kg, weightAtReferenceBmi);

  // Protein: g/kg of reference weight, capped smoothly at 35% of calories.
  const proteinGrams = Math.round(
    Math.min(referenceWeight * (PROTEIN_G_PER_KG[goal] ?? 1.6), (calorieTarget * MAX_PROTEIN_SHARE) / 4)
  );

  // Fat: 25% of calories, with a floor per kg of reference weight.
  const fatGrams = Math.round(
    Math.max((calorieTarget * FAT_SHARE) / 9, referenceWeight * MIN_FAT_G_PER_KG)
  );

  // Carbs: whatever calories are left, so the three macros add up to the target.
  const carbGrams = Math.max(0, Math.round((calorieTarget - proteinGrams * 4 - fatGrams * 9) / 4));

  // Daily movement target, matched to the activity level the user chose.
  let exerciseMinutes = 30;
  if (activity_level === 'moderately_active') exerciseMinutes = 45;
  if (activity_level === 'very_active' || activity_level === 'extremely_active') exerciseMinutes = 60;

  // Time to goal: only when the target weight lies in the direction the calories push.
  let weeksToGoal: number | null = null;
  const targetWeight = Number(input.target_weight_kg);
  if (targetWeight > 0 && expectedPace > 0) {
    const kgToGo = targetWeight - weight_kg;
    if ((adjustment < 0 && kgToGo < 0) || (adjustment > 0 && kgToGo > 0)) {
      weeksToGoal = Math.ceil(Math.abs(kgToGo) / expectedPace);
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee,
    adjustment,
    calorie_target: calorieTarget,
    protein_target: proteinGrams,
    carbohydrate_target: carbGrams,
    fat_target: fatGrams,
    exercise_minutes_target: exerciseMinutes,
    weekly_pace_kg: pace,
    expected_pace_kg: expectedPace,
    limited_by: limitedBy,
    min_calories: minCalories,
    reference_weight_kg: Math.round(referenceWeight * 10) / 10,
    weeks_to_goal: weeksToGoal,
  };
}

// ── Weekly pace storage ───────────────────────────────────────────────────────
// The database has no column for the weekly pace, so it is kept on the device.
// (Older versions wrote it into profile.dietary_preference as "pace:0.5", which
// overwrote the user's dietary preference; that tag is still read, never written.)

const PACE_STORAGE_PREFIX = 'nuvia_weekly_pace_';
const LEGACY_PACE_TAG = /^pace:([0-9.]+)$/;

function isValidPace(pace: number): boolean {
  return Number.isFinite(pace) && pace > 0 && pace <= 1.5;
}

/** The weekly pace the user chose (kg/week), or the default 0.5. */
export function getStoredWeeklyPace(
  profile?: Pick<Profile, 'id' | 'dietary_preference'> | null
): number {
  if (profile?.id && typeof localStorage !== 'undefined') {
    try {
      const stored = Number(localStorage.getItem(PACE_STORAGE_PREFIX + profile.id));
      if (isValidPace(stored)) return stored;
    } catch {
      /* storage unavailable */
    }
  }
  const legacy = LEGACY_PACE_TAG.exec(profile?.dietary_preference?.trim() || '');
  if (legacy) {
    const parsed = parseFloat(legacy[1]);
    if (isValidPace(parsed)) return parsed;
  }
  return DEFAULT_WEEKLY_PACE_KG;
}

export function storeWeeklyPace(userId: string | null | undefined, pace: number): void {
  if (!userId || !isValidPace(pace) || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PACE_STORAGE_PREFIX + userId, String(pace));
  } catch {
    /* storage unavailable */
  }
}

/** The user's dietary preference, hiding the old "pace:0.5" tag. */
export function cleanDietaryPreference(pref?: string | null): string | null {
  const trimmed = pref?.trim();
  if (!trimmed || LEGACY_PACE_TAG.test(trimmed)) return null;
  return trimmed;
}

// ── Profile -> calculation input ──────────────────────────────────────────────

export type MissingField = 'date_of_birth' | 'sex' | 'height_cm' | 'weight_kg' | 'activity_level' | 'goal';

export const MISSING_FIELD_LABELS: Record<MissingField, string> = {
  date_of_birth: 'date of birth',
  sex: 'sex',
  height_cm: 'height',
  weight_kg: 'weight',
  activity_level: 'activity level',
  goal: 'goal',
};

/** Neutral stand-ins used only so a rough estimate can be shown; always flagged. */
export const ESTIMATE_FALLBACKS = {
  age: 30,
  height_cm: 165,
  weight_kg: 65,
  activity_level: 'lightly_active' as ActivityLevel,
  goal: 'maintain_weight' as UserGoal,
};

export interface UserCalculationContext extends CalculationInput {
  /** Profile fields that were missing and replaced by a neutral stand-in. */
  missing_fields: MissingField[];
}

/** Which body details the profile still needs before targets are trustworthy. */
export function getMissingProfileFields(profile?: Profile | null): MissingField[] {
  const missing: MissingField[] = [];
  if (calculateAge(profile?.date_of_birth) == null) missing.push('date_of_birth');
  if (profile?.sex !== 'male' && profile?.sex !== 'female') missing.push('sex');
  if (!(Number(profile?.height_cm) > 0)) missing.push('height_cm');
  if (!(Number(profile?.weight_kg) > 0)) missing.push('weight_kg');
  if (!profile?.activity_level) missing.push('activity_level');
  if (!profile?.goal) missing.push('goal');
  return missing;
}

/** "date of birth and height" style list for prompts such as "Add your ...". */
export function describeMissingFields(missing: MissingField[]): string {
  const labels = missing.map((f) => MISSING_FIELD_LABELS[f]);
  if (labels.length <= 1) return labels[0] || '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * Builds the calculation input from the saved profile. Missing details are
 * never invented silently: they are listed in `missing_fields` so the UI can
 * ask for them and label the result as an estimate.
 */
export function getUserCalculationContext(
  profile?: Profile | null,
  goals?: Goal | null,
  paceOverride?: number
): UserCalculationContext {
  const targetWeight = Number(goals?.target_weight_kg) || Number(profile?.target_weight_kg) || null;

  return {
    age: calculateAge(profile?.date_of_birth) ?? ESTIMATE_FALLBACKS.age,
    sex: profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : null,
    height_cm: Number(profile?.height_cm) || ESTIMATE_FALLBACKS.height_cm,
    weight_kg: Number(profile?.weight_kg) || ESTIMATE_FALLBACKS.weight_kg,
    activity_level: profile?.activity_level || ESTIMATE_FALLBACKS.activity_level,
    goal: profile?.goal || ESTIMATE_FALLBACKS.goal,
    target_weight_kg: targetWeight,
    weekly_pace_kg: paceOverride ?? getStoredWeeklyPace(profile),
    missing_fields: getMissingProfileFields(profile),
  };
}

/** True when the saved goals row no longer matches what the profile now gives. */
export function isSavedTargetOutOfDate(goals: Goal | null | undefined, calc: CalculationResult): boolean {
  if (!goals?.calorie_target) return false;
  return (
    Math.abs(Number(goals.calorie_target) - calc.calorie_target) > 10 ||
    Math.abs(Number(goals.protein_target) - calc.protein_target) > 2 ||
    Math.abs(Number(goals.carbohydrate_target) - calc.carbohydrate_target) > 3 ||
    Math.abs(Number(goals.fat_target) - calc.fat_target) > 2
  );
}
