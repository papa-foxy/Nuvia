import { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';

export interface CalculationInput {
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: UserGoal;
  target_weight_kg?: number;
  weekly_pace_kg?: number; // e.g. 0.25 | 0.5 | 0.75 | 1.0 kg/week (default 0.5)
}

export interface CalculationResult {
  bmr: number;
  tdee: number;
  adjustment: number; // e.g. -500, +250, 0
  calorie_target: number;
  protein_target: number;
  carbohydrate_target: number;
  fat_target: number;
  exercise_minutes_target: number;
  weekly_pace_kg: number;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Sedentary', desc: 'Little or no exercise, desk job' },
  lightly_active: { label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  moderately_active: { label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  very_active: { label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  extremely_active: { label: 'Extremely Active', desc: 'Physical job or athlete training' },
};

export function calculateTargets(input: CalculationInput): CalculationResult {
  const { age, sex, height_cm, weight_kg, activity_level, goal } = input;
  const pace = input.weekly_pace_kg && input.weekly_pace_kg > 0 ? input.weekly_pace_kg : 0.5;

  // Mifflin-St Jeor formula (Male: +5, Female: -161)
  const bmr =
    sex === 'male'
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.375;
  const tdee = Math.round(bmr * multiplier);

  // Goal adjustment based on goal and pace
  let calorieTarget: number;
  let adjustment = 0;
  const minSafeCalories = sex === 'female' ? 1200 : 1500;

  switch (goal) {
    case 'lose_weight': {
      // 1 kg fat ≈ 7,700 kcal -> weekly pace * 7700 / 7 ≈ pace * 1100 kcal/day (normalized to ~1000)
      const targetDeficit = Math.round(pace * 1000);
      calorieTarget = Math.max(minSafeCalories, tdee - targetDeficit);
      adjustment = -(tdee - calorieTarget);
      break;
    }
    case 'gain_weight': {
      const targetSurplus = Math.round(pace * 800);
      calorieTarget = tdee + targetSurplus;
      adjustment = targetSurplus;
      break;
    }
    case 'build_muscle': {
      // Lean bulk surplus for muscle hypertrophy with minimal fat
      adjustment = 250;
      calorieTarget = tdee + adjustment;
      break;
    }
    case 'maintain_weight':
    default: {
      calorieTarget = tdee;
      adjustment = 0;
      break;
    }
  }

  calorieTarget = Math.round(calorieTarget);

  // Macronutrient breakdown
  // Protein: higher for muscle preservation/building (~2.0g/kg for muscle/loss, 1.8g/kg for maintain)
  let proteinPerKg = 1.8;
  if (goal === 'build_muscle' || goal === 'lose_weight') {
    proteinPerKg = 2.0;
  }
  let proteinGrams = Math.round(weight_kg * proteinPerKg);
  // Ensure protein is capped at 35% of total calories
  const proteinCalories = proteinGrams * 4;
  if (proteinCalories > calorieTarget * 0.35) {
    proteinGrams = Math.round((calorieTarget * 0.30) / 4);
  }

  // Fat: 25% of total calories (9 kcal/g)
  const fatGrams = Math.round((calorieTarget * 0.25) / 9);

  // Carbs: remainder (4 kcal/g)
  const remainingCalories = calorieTarget - (proteinGrams * 4 + fatGrams * 9);
  const carbGrams = Math.max(50, Math.round(remainingCalories / 4));

  // Exercise minutes target
  let exerciseMinutes = 30;
  if (activity_level === 'moderately_active') exerciseMinutes = 45;
  if (activity_level === 'very_active' || activity_level === 'extremely_active') exerciseMinutes = 60;

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
  };
}

export function getUserCalculationContext(
  profile?: Profile | null,
  goals?: Goal | null,
  paceOverride?: number
): CalculationInput {
  const age = (() => {
    if (!profile?.date_of_birth) return 24;
    const b = new Date(profile.date_of_birth);
    if (isNaN(b.getTime())) return 24;
    const calculated = Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970);
    return calculated > 10 && calculated < 110 ? calculated : 24;
  })();

  return {
    age,
    sex: profile?.sex || 'male',
    height_cm: profile?.height_cm || 175,
    weight_kg: profile?.weight_kg || 73,
    activity_level: profile?.activity_level || 'moderately_active',
    goal: profile?.goal || 'lose_weight',
    target_weight_kg: goals?.target_weight_kg || profile?.target_weight_kg || 68,
    weekly_pace_kg: paceOverride ?? 0.5,
  };
}
