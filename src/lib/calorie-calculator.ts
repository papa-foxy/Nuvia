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

  // MET values based on ACSM/Compendium of Physical Activities (Ainsworth 2011)
  // These are realistic values — NOT inflated.
  const focusLower = (options.focus || '').toLowerCase();
  let met = 3.5; // Default: general resistance training (bodyweight / light weights)

  if (focusLower.includes('core') || focusLower.includes('abs')) {
    met = 3.0; // Core/abs work: crunches, planks, leg raises — low MET
  } else if (focusLower.includes('upper') || focusLower.includes('strength')) {
    met = 3.5; // Upper body resistance training (dumbbells, cables)
  } else if (focusLower.includes('cardio') || focusLower.includes('hiit')) {
    met = 7.5; // HIIT / vigorous cardio
  } else if (focusLower.includes('leg') || focusLower.includes('lower')) {
    met = 4.0; // Lower body resistance — slightly higher due to large muscle groups
  } else if (focusLower.includes('full body') || focusLower.includes('full-body')) {
    met = 4.0; // Full body circuits
  } else if (focusLower.includes('powerlifting') || focusLower.includes('olympic')) {
    met = 6.0; // Heavy compound lifting
  }

  // Standard ACSM MET formula: Calories = (MET * 3.5 * weightKg / 200) * durationMinutes
  const timeBasedCalories = (met * 3.5 * weightKg / 200) * durationMinutes;

  // Small completion bonus: +1 kcal per completed set (rest periods reduce net burn)
  // Capped at 20 kcal max to avoid inflation
  const completionBonus = Math.min(20, options.totalSetsExecuted * 1.0);

  const totalCalories = Math.round(timeBasedCalories + completionBonus);

  // Minimum floor: 20 kcal if any exercise was done, 10 kcal otherwise
  if (options.executedExercisesCount > 0) {
    return Math.max(20, totalCalories);
  }

  return Math.max(10, totalCalories);
}
