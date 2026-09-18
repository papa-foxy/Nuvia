/**
 * Calorie Burn Calculation Engine
 * Uses standard Metabolic Equivalent of Task (MET) formula combined with user body weight,
 * workout duration, and completed volume.
 */

export interface CalorieCalculationOptions {
  userWeightKg?: number;
  durationMinutes: number;
  focus?: string;
  executedExercisesCount: number;
  totalSetsExecuted: number;
}

export function calculateWorkoutCalories(options: CalorieCalculationOptions): number {
  const weightKg = options.userWeightKg && options.userWeightKg > 0 ? options.userWeightKg : 70;
  // Ensure at least 1 minute duration to avoid 0 kcal calculation
  const durationMinutes = Math.max(1, options.durationMinutes);

  // Determine MET based on focus / intensity
  const focusLower = (options.focus || '').toLowerCase();
  let met = 5.5; // Standard resistance / calisthenics training

  if (focusLower.includes('core') || focusLower.includes('abs')) {
    met = 5.0;
  } else if (focusLower.includes('upper') || focusLower.includes('strength')) {
    met = 6.0;
  } else if (focusLower.includes('cardio') || focusLower.includes('hiit')) {
    met = 7.5;
  } else if (focusLower.includes('leg') || focusLower.includes('lower')) {
    met = 6.5;
  }

  // Standard ACSM MET formula: Calories = (MET * 3.5 * weightKg / 200) * durationMinutes
  const timeBasedCalories = (met * 3.5 * weightKg / 200) * durationMinutes;

  // Volume-based resistance bonus per set executed (approx 3.5-5 kcal per active set)
  const volumeBonus = options.totalSetsExecuted * 4.0;

  // Exercise variety bonus (encourages completing all movements)
  const varietyBonus = options.executedExercisesCount * 2.5;

  const totalCalories = Math.round(timeBasedCalories + volumeBonus + varietyBonus);

  // Sensible minimum: if at least 1 exercise was executed, floor at 35 kcal
  if (options.executedExercisesCount > 0) {
    return Math.max(35, totalCalories);
  }

  return Math.max(15, totalCalories);
}
