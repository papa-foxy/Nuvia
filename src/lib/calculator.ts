import { ActivityLevel, UserGoal } from '@/types/database';

export interface CalculationInput {
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: UserGoal;
  target_weight_kg?: number;
}

export interface CalculationResult {
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_target: number;
  carbohydrate_target: number;
  fat_target: number;
  exercise_minutes_target: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export function calculateTargets(input: CalculationInput): CalculationResult {
  const { age, sex, height_cm, weight_kg, activity_level, goal } = input;

  // Mifflin-St Jeor formula (Male: +5, Female: -161)
  const bmr =
    sex === 'male'
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.375;
  const tdee = Math.round(bmr * multiplier);

  // Goal adjustment
  let calorieTarget: number;
  let minSafeCalories = sex === 'female' ? 1200 : 1500;

  switch (goal) {
    case 'lose_weight':
      // Modest 400-500 kcal deficit
      calorieTarget = Math.max(minSafeCalories, tdee - 450);
      break;
    case 'gain_weight':
      calorieTarget = tdee + 400;
      break;
    case 'build_muscle':
      calorieTarget = tdee + 200;
      break;
    case 'maintain_weight':
    default:
      calorieTarget = tdee;
      break;
  }

  calorieTarget = Math.round(calorieTarget);

  // Macronutrient breakdown
  // Protein: higher for muscle preservation/building (~2.0g/kg for muscle/loss, 1.6g/kg for maintain)
  let proteinPerKg = 1.8;
  if (goal === 'build_muscle' || goal === 'lose_weight') {
    proteinPerKg = 2.0;
  }
  let proteinGrams = Math.round(weight_kg * proteinPerKg);
  // Ensure protein is between 15% and 35% of calories
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
    calorie_target: calorieTarget,
    protein_target: proteinGrams,
    carbohydrate_target: carbGrams,
    fat_target: fatGrams,
    exercise_minutes_target: exerciseMinutes,
  };
}
