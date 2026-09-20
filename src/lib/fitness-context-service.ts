/**
 * FitnessContextService
 * 
 * Centralized service that aggregates:
 * 1. Authoritative Biometrics & Profile (profiles table)
 * 2. Nutritional Targets & Objectives (goals table)
 * 3. Saved Workout Routines (workout_routines table)
 * 4. Actual Execution History & Progressive Overload Data (exercise_logs table)
 * 5. 48-Hour Recovery & Muscle Fatigue
 * 6. Explicit Training Preferences & Equipment Constraints
 * 
 * Produces a unified NuviaFitnessContext object that informs workout generation,
 * AI coaching, and exercise replacement.
 */

import { DataService, getLocalDateString } from './data-service';
import { NuviaCache } from './nuvia-cache';
import { cleanActivityTitle } from './activity-utils';
import {
  NuviaFitnessContext,
  TrainingConstraints,
  TrainingPreferences,
  WeeklyScheduleDay,
  ExercisePerformanceRecord,
  RecoveryState,
} from '@/types/fitness-context';
import { ExercisePerformance, LoggedSet } from '@/types/routine';

const PREFERENCES_STORAGE_KEY_PREFIX = 'nuvia_fitness_preferences_';

/**
 * Generates an individualized training & habit strategy deterministically
 * based on the user's physique self-assessment, experience, equipment, and constraints.
 */
export function generateTrainingStrategy(params: {
  goal: string;
  current_physique?: string;
  priority_areas?: string[];
  desired_physique?: string;
  experience_level?: string;
  consistency_level?: string;
  equipment: string[];
  environment?: string;
  duration_minutes?: number;
  adherence_obstacles?: string[];
  preferred_split?: string;
}): string[] {
  const points: string[] = [];

  // 1. Structure & Frequency
  const split = params.preferred_split || 'Upper / Lower';
  const duration = params.duration_minutes || 45;
  if (
    params.consistency_level === 'on_and_off' ||
    params.consistency_level === 'frequent_breaks' ||
    params.consistency_level === 'getting_started'
  ) {
    points.push(
      `Structure: 3-4 sessions/week (${split}, ~${duration} mins). Habit adherence and consistency take priority over maximal volume.`
    );
  } else {
    points.push(
      `Structure: 4 structured sessions/week (${split}, ~${duration} mins) with dedicated rest days between intensive loading blocks.`
    );
  }

  // 2. Resistance Strategy & Equipment
  const equipStr = params.equipment && params.equipment.length > 0 ? params.equipment.join(', ') : 'dumbbells & bodyweight';
  const experience = params.experience_level || 'beginner';
  if (experience === 'returning_long_break' || experience === 'beginner_trained_before') {
    points.push(
      `Resistance: Re-sensitize muscles using ${equipStr} with controlled tempo and 1-3 clean reps in reserve (RIR). Capitalize on muscle memory while avoiding early overtraining.`
    );
  } else if (experience === 'completely_new' || experience === 'beginner') {
    points.push(
      `Resistance: Master fundamental movement mechanics (squat, press, row, hinge) with ${equipStr}. Prioritize technique and neuromuscular control before increasing load.`
    );
  } else {
    points.push(
      `Resistance: Progressive overload through double progression with ${equipStr}. Increase repetitions (10-15 reps) before advancing working weights.`
    );
  }

  // 3. Target Vision & Priority Focus
  const priorities =
    params.priority_areas && params.priority_areas.length > 0
      ? params.priority_areas.join(', ')
      : 'overall muscle definition';
  const desired = params.desired_physique || 'Athletic';
  points.push(
    `Target Vision (${desired}): Prioritize progressive compound resistance while giving focused stimulus to ${priorities}. (Note: Overall systemic body composition drives fat loss; spot reduction is anatomically not possible).`
  );

  // 4. Energy & Nutrition Synergy
  if (params.goal === 'lose_weight') {
    points.push(
      `Metabolic Support: Moderate, sustainable calorie deficit paired with high dietary protein (~1.8-2.2 g/kg) to maximize fat loss while preserving lean mass.`
    );
  } else if (params.goal === 'build_muscle') {
    points.push(
      `Metabolic Support: Slight clean energy surplus (+200-300 kcal) with adequate protein to fuel muscular hypertrophy and strength gains.`
    );
  } else {
    points.push(
      `Metabolic Support: Caloric balance with high nutrient density to optimize physical recovery, muscle tone, and body recomposition.`
    );
  }

  // 5. Adherence Safeguard
  if (params.adherence_obstacles && params.adherence_obstacles.length > 0) {
    const obstacles = params.adherence_obstacles.join(', ');
    points.push(
      `Adherence Safeguard: Built-in flexibility to counter ${obstacles}—keep sessions under ${duration} mins and prioritize momentum over perfection.`
    );
  }

  return points;
}

export interface StoredFitnessPreferences {
  constraints: TrainingConstraints;
  preferences: TrainingPreferences;
  fitness_level?: 'beginner_inconsistent' | 'beginner_consistent' | 'intermediate' | 'advanced';
  experience_level?: 'completely_new' | 'beginner' | 'beginner_trained_before' | 'intermediate' | 'advanced' | 'returning_long_break';
  consistency_level?: 'very_consistent' | 'mostly_consistent' | 'on_and_off' | 'frequent_breaks' | 'getting_started';
  training_background?: string;
  objective?: string;
  current_physique?: 'lean' | 'average' | 'soft_low_muscle' | 'higher_body_fat' | 'muscular_some_fat' | 'not_sure';
  current_physique_label?: string;
  priority_areas?: string[];
  desired_physique?: 'lean' | 'athletic' | 'lean_muscular' | 'muscular' | 'strong_powerful' | 'general_fitness' | 'custom';
  desired_physique_custom?: string;
  desired_look?: string;
  user_estimated_target_bf_percent?: number;
  user_estimated_bf_percent?: number;
  physique_photo_url?: string;
}

export class FitnessContextService {
  /**
   * Retrieves persistent fitness constraints and preferences (equipment, environment, etc.)
   */
  static getStoredPreferences(userId?: string): StoredFitnessPreferences {
    const key = `${PREFERENCES_STORAGE_KEY_PREFIX}${userId || 'demo'}`;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        console.warn('Failed to parse stored fitness preferences:', err);
      }
    }

    // Default configuration (flexible, realistic starting baseline)
    return {
      fitness_level: 'beginner_inconsistent',
      experience_level: 'beginner_trained_before',
      consistency_level: 'on_and_off',
      training_background: 'Has trained periodically before; returning to consistency',
      objective: 'Reduce body fat while maintaining and building lean muscle',
      current_physique: 'soft_low_muscle',
      current_physique_label: 'Soft / little muscle definition',
      priority_areas: ['Belly / waist', 'Overall muscle definition'],
      desired_physique: 'athletic',
      desired_look: 'Athletic, lean, and functional',
      user_estimated_target_bf_percent: 15,
      user_estimated_bf_percent: 28,
      constraints: {
        preferred_split: 'Upper / Lower',
        workout_duration_minutes: 45,
        environment: 'home',
        available_equipment: ['dumbbells', 'push_up_board', 'bodyweight'],
        available_space: 'Adequate room for floor and dumbbell exercises',
        training_time_of_day: 'evening',
        adherence_obstacles: ['lack_of_time', 'work_schedule'],
        cardio_habits: {
          type: 'Brisk walking',
          distance_km: 4.5,
          typical_days: ['Saturday'],
          description: '4.5 km outdoor brisk walk on weekend mornings',
        },
      },
      preferences: {
        effort_target: 'Challenging but manageable (1-3 RIR)',
        target_rir: '1-3',
        progression_preference: 'let_nuvia_decide',
        progression_rule: 'Double progression: 10-15 rep range; increase resistance once all sets hit 15 reps with good technique',
        muscle_biases: ['Upper body exercises feel slightly more natural than lower body; ensure lower body is progressively loaded without overloading recovery'],
        easy_hard_areas: ['Upper body feels easier', 'Core feels difficult'],
        preferred_exercises: ['Goblet Squat', 'Dumbbell Row', 'Push-up', 'Dumbbell Bicep Curl'],
        disliked_exercises: ['Bulgarian Split Squat'],
        custom_starting_weights: {
          'Goblet Squat': '12-20 kg total',
          'Dumbbell Row': '10-14 kg',
          'Dumbbell Bicep Curl': '6-8 kg each',
          'Dumbbell Shoulder Press': '6-10 kg each',
          'Romanian Deadlift': '10-16 kg each',
        },
      },
    };
  }

  /**
   * Saves updated constraints or preferences
   */
  static saveStoredPreferences(
    data: Partial<StoredFitnessPreferences>,
    userId?: string
  ): void {
    const existing = this.getStoredPreferences(userId);
    const updated: StoredFitnessPreferences = {
      ...existing,
      ...data,
      constraints: { ...existing.constraints, ...(data.constraints || {}) },
      preferences: { ...existing.preferences, ...(data.preferences || {}) },
    };

    const key = `${PREFERENCES_STORAGE_KEY_PREFIX}${userId || 'demo'}`;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(updated));
        NuviaCache.invalidate(`fitness-context:${userId || 'demo'}`);
      } catch (err) {
        console.warn('Failed to save fitness preferences:', err);
      }
    }
  }

  /**
   * Assembles the complete NuviaFitnessContext for a user
   */
  static async getFitnessContext(userId?: string): Promise<NuviaFitnessContext> {
    const cacheKey = `fitness-context:${userId || 'demo'}`;
    const cached = NuviaCache.get<NuviaFitnessContext>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.data;
    }

    const [profile, goals, routines, allLogs, recentMuscles] = await Promise.all([
      DataService.getProfile(userId),
      DataService.getGoals(userId),
      DataService.getWorkoutRoutines(userId),
      DataService.getExerciseLogs(userId),
      DataService.getRecentMuscleTrainingHistory(userId),
    ]);

    const storedPrefs = this.getStoredPreferences(userId);

    // 1. Analyze Schedule & Today's State
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
    const currentDayName = dayNames[now.getDay()];

    // Map Monday through Sunday
    const weekOrder: (typeof dayNames[number])[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weeklySchedule: WeeklyScheduleDay[] = weekOrder.map((day) => {
      const matchingRoutine = routines.find((r) =>
        r.days && r.days.some((d) => d.toLowerCase() === day.toLowerCase())
      );

      if (matchingRoutine) {
        return {
          day,
          type: 'workout',
          routine_id: matchingRoutine.id,
          routine_title: cleanActivityTitle(matchingRoutine.title).title,
          focus: matchingRoutine.focus,
          description: `${matchingRoutine.exercises.length} exercises planned`,
        };
      }

      // Check if cardio habit coincides with this day
      if (storedPrefs.constraints.cardio_habits?.typical_days.some((d) => d.toLowerCase() === day.toLowerCase())) {
        return {
          day,
          type: 'cardio',
          description: `${storedPrefs.constraints.cardio_habits.type} (~${storedPrefs.constraints.cardio_habits.distance_km || 4.5} km)`,
        };
      }

      return {
        day,
        type: 'rest',
        description: 'Rest & recovery / optional light mobility',
      };
    });

    // Check today's routine assignment and completion
    const todayRoutine = routines.find((r) =>
      r.days && r.days.some((d) => d.toLowerCase() === currentDayName.toLowerCase())
    );

    const todayLogs = allLogs.filter((l) => (l.created_at || '').startsWith(todayStr));
    const isCompletedToday = todayRoutine
      ? todayLogs.some(
          (log) =>
            log.source === 'routine' &&
            log.exercise_type.toLowerCase().includes(cleanActivityTitle(todayRoutine.title).title.toLowerCase())
        )
      : false;

    const todayIsRest = !todayRoutine && !storedPrefs.constraints.cardio_habits?.typical_days.includes(currentDayName);

    // 2. Recovery Analysis
    let lastWorkoutDate: string | null = null;
    let consecutiveDays = 0;
    const pastWorkoutLogs = allLogs.filter((l) => l.source === 'routine' || l.duration_minutes >= 20);

    if (pastWorkoutLogs.length > 0) {
      lastWorkoutDate = pastWorkoutLogs[0].created_at || null;
    }

    // 3. Exercise Performance History Extraction (from exercise_logs.ai_analysis.actual_performance)
    const exerciseHistoryMap = new Map<string, ExercisePerformanceRecord>();

    for (const log of allLogs) {
      const performanceList = log.ai_analysis?.actual_performance as ExercisePerformance[] | undefined;
      if (Array.isArray(performanceList)) {
        for (const item of performanceList) {
          const normName = item.name.trim();
          const key = normName.toLowerCase();
          if (!exerciseHistoryMap.has(key) && Array.isArray(item.sets) && item.sets.length > 0) {
            const completedSets = item.sets.filter((s) => s.completed);
            const repArray = (completedSets.length > 0 ? completedSets : item.sets).map((s) => Number(s.reps) || 0);
            const topWeight = Math.max(0, ...item.sets.map((s) => Number(s.weight_kg) || 0));

            exerciseHistoryMap.set(key, {
              exercise_name: normName,
              last_performed_at: log.created_at || new Date().toISOString(),
              last_weight_kg: topWeight > 0 ? topWeight : undefined,
              last_sets: item.sets.length,
              last_reps: repArray.join(', '),
              last_rep_array: repArray,
              top_set_performance: topWeight > 0 ? `${topWeight} kg × ${repArray[0] || 10} reps` : `${repArray[0] || 10} reps (bodyweight)`,
              suggested_next_target:
                repArray.every((r) => r >= 15) && topWeight > 0
                  ? `Ready to progress: increase weight (+1 to +2 kg) and reset to 10-12 reps`
                  : `Aim for ${Math.min(15, (repArray[0] || 10) + 1)} reps with ${topWeight > 0 ? `${topWeight} kg` : 'clean form'}`,
            });
          }
        }
      }
    }

    // Goal pace extraction
    let goalPace = 0.5;
    if (profile?.dietary_preference && profile.dietary_preference.includes('pace:')) {
      const match = profile.dietary_preference.match(/pace:([0-9.]+)/);
      if (match) goalPace = parseFloat(match[1]);
    }

    let calculatedAge: number | undefined;
    if (profile?.date_of_birth) {
      const birth = new Date(profile.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age > 0) calculatedAge = age;
    }

    const synthesizedStrategy = generateTrainingStrategy({
      goal: profile?.goal || 'lose_weight',
      current_physique: storedPrefs.current_physique,
      priority_areas: storedPrefs.priority_areas,
      desired_physique: storedPrefs.desired_physique,
      experience_level: storedPrefs.experience_level,
      consistency_level: storedPrefs.consistency_level,
      equipment: storedPrefs.constraints.available_equipment,
      environment: storedPrefs.constraints.environment,
      duration_minutes: storedPrefs.constraints.workout_duration_minutes,
      adherence_obstacles: storedPrefs.constraints.adherence_obstacles,
      preferred_split: storedPrefs.constraints.preferred_split,
    });

    const context: NuviaFitnessContext = {
      profile: {
        sex: (profile?.sex as any) ?? undefined,
        age: calculatedAge,
        height_cm: profile?.height_cm ?? undefined,
        weight_kg: profile?.weight_kg ?? undefined,
        fitness_level: storedPrefs.fitness_level || 'beginner_inconsistent',
        experience_level: storedPrefs.experience_level,
        consistency_level: storedPrefs.consistency_level,
        training_background: storedPrefs.training_background,
        current_physique: storedPrefs.current_physique
          ? { visual_category: storedPrefs.current_physique, source: 'user_selected' }
          : undefined,
      },
      goal: {
        primary_goal: profile?.goal || 'lose_weight',
        objective: storedPrefs.objective || 'Body recomposition (fat loss with muscle retention)',
        target_weight_kg: goals?.target_weight_kg ?? undefined,
        goal_pace_kg: goalPace,
        desired_physique: storedPrefs.desired_physique
          ? { visual_category: storedPrefs.desired_physique, source: 'user_selected' }
          : undefined,
        physique_preference: {
          current_physique: storedPrefs.current_physique,
          current_physique_label: storedPrefs.current_physique_label,
          priority_areas: storedPrefs.priority_areas,
          desired_physique: storedPrefs.desired_physique,
          desired_physique_custom: storedPrefs.desired_physique_custom,
          desired_look: storedPrefs.desired_look || 'Athletic, lean, and balanced',
          user_estimated_target_bf_percent: storedPrefs.user_estimated_target_bf_percent,
          user_estimated_bf_percent: storedPrefs.user_estimated_bf_percent,
          physique_photo_url: storedPrefs.physique_photo_url,
        },
      },
      constraints: storedPrefs.constraints,
      preferences: storedPrefs.preferences,
      synthesized_strategy: synthesizedStrategy,
      weekly_schedule: weeklySchedule,
      performance: {
        recent_exercises: Array.from(exerciseHistoryMap.values()).slice(0, 15),
        total_workouts_completed: pastWorkoutLogs.length,
      },
      recovery: {
        trained_in_last_48h: Array.from(new Set(recentMuscles.map((m) => m.muscle))),
        last_workout_date: lastWorkoutDate,
        consecutive_training_days: consecutiveDays,
        today_is_rest_day: todayIsRest,
        scheduled_today: {
          has_routine: Boolean(todayRoutine),
          routine_id: todayRoutine?.id,
          routine_title: todayRoutine ? cleanActivityTitle(todayRoutine.title).title : undefined,
          is_completed: isCompletedToday,
        },
      },
      active_routines: routines.map((r) => ({
        id: r.id,
        title: cleanActivityTitle(r.title).title,
        days: r.days || [],
        focus: r.focus || 'General',
        exercise_names: r.exercises.map((e) => e.name),
      })),
    };

    // Cache with 2-minute TTL
    NuviaCache.set(cacheKey, context, { staleTime: 120_000, gcTime: 300_000 });

    return context;
  }
}
