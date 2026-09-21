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
import { AdaptiveTrainingEngine } from './adaptive-training-engine';
import {
  NuviaFitnessContext,
  TrainingConstraints,
  TrainingPreferences,
  WeeklyScheduleDay,
  ExercisePerformanceRecord,
  RecoveryState,
} from '@/types/fitness-context';
import { ExercisePerformance, LoggedSet } from '@/types/routine';
import {
  NaturalLanguageLoggingContext,
  FrequentMealSummary,
  RecentMealSummary,
  RecentActivitySummary,
  ScheduledRoutineSummary,
  ContextualSuggestion,
} from '@/types/natural-language';

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
  if (params.goal === 'recomposition') {
    points.push(
      `Metabolic Support: Body recomposition strategy (~2.0-2.2 g/kg protein, modest -200 kcal deficit) to fuel progressive muscle protein synthesis while mobilizing adipose fat stores.`
    );
  } else if (params.goal === 'lose_weight') {
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
  adaptive_plan_mode?: 'ask_first' | 'auto_adjust';
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
          const parsed = JSON.parse(raw);
          return {
            ...parsed,
            preferences: {
              adaptive_plan_mode: 'ask_first',
              ...(parsed.preferences || {}),
            },
          };
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
      adaptive_plan_mode: 'ask_first',
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
        adaptive_plan_mode: 'ask_first',
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

    const [profile, goals, routines, allLogs, recentMuscles, adaptations] = await Promise.all([
      DataService.getProfile(userId),
      DataService.getGoals(userId),
      DataService.getWorkoutRoutines(userId),
      DataService.getExerciseLogs(userId),
      DataService.getRecentMuscleTrainingHistory(userId),
      DataService.getScheduleAdaptations(userId),
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

    // 4. Deterministic Adaptive Training Engine Orchestration
    let activeSession = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`nuvia_active_workout_${userId || 'demo'}`);
        if (raw) activeSession = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    const trainedMusclesLast48h = Array.from(new Set(recentMuscles.map((m) => m.muscle)));
    const cardioHabitDays = storedPrefs.constraints.cardio_habits?.typical_days || [];

    const todayTrainingState = AdaptiveTrainingEngine.determineDailyTrainingState({
      targetDate: todayStr,
      routines,
      logs: allLogs,
      adaptations,
      activeSession,
      cardioHabitDays,
    });

    const nextAction = AdaptiveTrainingEngine.calculateNextTrainingAction({
      routines,
      logs: allLogs,
      adaptations,
      activeSession,
      trainedMusclesLast48h,
      cardioHabitDays,
    });

    const missedProposals = AdaptiveTrainingEngine.detectMissedWorkouts({
      routines,
      logs: allLogs,
      adaptations,
      trainedMusclesLast48h,
    });

    const weeklyView = AdaptiveTrainingEngine.generateWeeklyAdaptationView({
      routines,
      logs: allLogs,
      adaptations,
      cardioHabitDays,
    });

    const weeklyReport = AdaptiveTrainingEngine.generateWeeklyReport({
      routines,
      logs: allLogs,
      adaptations,
      cardioHabitDays,
    });

    context.adaptive = {
      today_state: todayTrainingState,
      next_action: nextAction,
      pending_proposals: missedProposals,
      weekly_view: weeklyView,
      weekly_report: weeklyReport,
      auto_adjust_mode: storedPrefs.preferences.adaptive_plan_mode || 'ask_first',
    };

    // Cache with 2-minute TTL
    NuviaCache.set(cacheKey, context, { staleTime: 120_000, gcTime: 300_000 });

    return context;
  }

  /**
   * Invalidates cached fitness context for a user.
   */
  static invalidateFitnessContext(userId?: string): void {
    const effectiveUserId = userId || DataService.getDemoUserId();
    NuviaCache.invalidate(`fitness-context:${effectiveUserId}`);
    NuviaCache.invalidate(`fitness_context_${effectiveUserId}`);
    NuviaCache.invalidate(`nl-context:${effectiveUserId}`);
  }

  /**
   * Constructs a compact, bounded natural-language logging context
   * containing frequent foods, portion baselines, recent activities,
   * habitual cardio, and today's scheduled training routine.
   */
  static async getNaturalLanguageLoggingContext(
    userId?: string
  ): Promise<NaturalLanguageLoggingContext> {
    const effectiveUserId = userId || DataService.getDemoUserId();
    const cacheKey = `nl-context:${effectiveUserId}`;
    const cached = NuviaCache.get<NaturalLanguageLoggingContext>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.data;
    }

    const [fitnessCtx, allMeals, allLogs, todaySummary, goals] = await Promise.all([
      this.getFitnessContext(userId),
      DataService.getMeals(userId),
      DataService.getExerciseLogs(userId),
      DataService.getDailySummary(userId),
      DataService.getGoals(userId),
    ]);

    const now = new Date();
    const todayDate = getLocalDateString(now);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
    const dayOfWeek = dayNames[now.getDay()];

    // 1. Build User Food Memory (Frequent Meals & Portion History)
    const mealFrequencyMap = new Map<
      string,
      {
        displayName: string;
        count: number;
        totalCalories: number;
        totalProtein: number;
        totalCarbs: number;
        totalFat: number;
        mealTypes: Record<string, number>;
        lastLoggedAt?: string;
      }
    >();

    for (const meal of allMeals) {
      const rawName = (meal.description || '').trim();
      if (!rawName || rawName.length < 2) continue;

      // Normalize key for grouping
      const normalizedKey = rawName
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
        .trim();

      if (!normalizedKey) continue;

      const existing = mealFrequencyMap.get(normalizedKey);
      const cals = Number(meal.calories) || 0;
      const prot = Number(meal.protein_g) || 0;
      const carbs = Number(meal.carbs_g) || 0;
      const fat = Number(meal.fat_g) || 0;
      const mType = (meal.meal_type || 'lunch').toLowerCase();

      if (existing) {
        existing.count += 1;
        existing.totalCalories += cals;
        existing.totalProtein += prot;
        existing.totalCarbs += carbs;
        existing.totalFat += fat;
        existing.mealTypes[mType] = (existing.mealTypes[mType] || 0) + 1;
        if (!existing.lastLoggedAt || meal.meal_time > existing.lastLoggedAt) {
          existing.lastLoggedAt = meal.meal_time;
          existing.displayName = rawName; // update to most recent casing
        }
      } else {
        mealFrequencyMap.set(normalizedKey, {
          displayName: rawName,
          count: 1,
          totalCalories: cals,
          totalProtein: prot,
          totalCarbs: carbs,
          totalFat: fat,
          mealTypes: { [mType]: 1 },
          lastLoggedAt: meal.meal_time,
        });
      }
    }

    const frequentMeals: FrequentMealSummary[] = Array.from(mealFrequencyMap.values())
      .filter((m) => m.count >= 2 || allMeals.length <= 5) // Frequent or if user is newer
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((m) => {
        // Determine dominant meal type
        let topMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch';
        let maxCount = 0;
        for (const [t, count] of Object.entries(m.mealTypes)) {
          if (count > maxCount) {
            maxCount = count;
            topMealType = t as any;
          }
        }

        return {
          name: m.displayName,
          count: m.count,
          recent_average_calories: Math.round(m.totalCalories / m.count),
          recent_average_protein_g: Math.round((m.totalProtein / m.count) * 10) / 10,
          recent_average_carbs_g: Math.round((m.totalCarbs / m.count) * 10) / 10,
          recent_average_fat_g: Math.round((m.totalFat / m.count) * 10) / 10,
          common_meal_type: topMealType,
          last_logged_at: m.lastLoggedAt,
        };
      });

    // 2. Recent Meals (Last 8 entries)
    const recentMeals: RecentMealSummary[] = allMeals
      .slice(0, 8)
      .map((m) => ({
        name: m.description || 'Meal',
        meal_type: (m.meal_type as any) || 'lunch',
        calories: Number(m.calories) || 0,
        protein_g: Number(m.protein_g) || 0,
        logged_at: m.meal_time || m.created_at || todayDate,
      }));

    // 3. Recent Activities (Last 6 entries)
    const recentActivities: RecentActivitySummary[] = allLogs
      .slice(0, 6)
      .map((log) => ({
        name: log.exercise_type || 'Activity',
        duration_minutes: Number(log.duration_minutes) || 0,
        distance_km: log.distance_km ? Number(log.distance_km) : null,
        calories_burned: Number(log.calories_burned) || 0,
        intensity: (log.intensity as any) || undefined,
        logged_at: log.created_at || todayDate,
      }));

    // 4. Scheduled Routine Context
    let scheduledToday: ScheduledRoutineSummary | null = null;
    const schedRef = fitnessCtx.recovery.scheduled_today;
    if (schedRef?.has_routine && schedRef.routine_id) {
      const matchingRoutine = fitnessCtx.active_routines.find((r) => r.id === schedRef.routine_id);
      if (matchingRoutine) {
        scheduledToday = {
          id: matchingRoutine.id,
          title: cleanActivityTitle(matchingRoutine.title).title,
          focus: matchingRoutine.focus,
          exercises: matchingRoutine.exercise_names || [],
          is_completed: schedRef.is_completed,
          total_exercises: matchingRoutine.exercise_names?.length || 0,
        };
      }
    }

    // 5. Upcoming Routine Context
    let upcomingRoutine: ScheduledRoutineSummary | null = null;
    const upcomingDay = fitnessCtx.weekly_schedule.find(
      (day) => day.type === 'workout' && day.day !== dayOfWeek && day.routine_id
    );
    if (upcomingDay?.routine_id) {
      const match = fitnessCtx.active_routines.find((r) => r.id === upcomingDay.routine_id);
      if (match) {
        upcomingRoutine = {
          id: match.id,
          title: cleanActivityTitle(match.title).title,
          focus: match.focus,
          exercises: match.exercise_names || [],
          is_completed: false,
          total_exercises: match.exercise_names?.length || 0,
        };
      }
    }

    const loggingContext: NaturalLanguageLoggingContext = {
      today_date: todayDate,
      day_of_week: dayOfWeek,
      today_summary: todaySummary
        ? {
            calories_consumed: todaySummary.calories_consumed || 0,
            protein_consumed: todaySummary.protein_consumed || 0,
            calories_burned: todaySummary.calories_burned || 0,
            exercise_minutes: todaySummary.exercise_minutes || 0,
          }
        : undefined,
      targets: {
        calorie_target: goals?.calorie_target || 2000,
        protein_target: goals?.protein_target || 140,
      },
      today_routine: scheduledToday,
      upcoming_routine: upcomingRoutine,
      frequent_meals: frequentMeals,
      recent_meals: recentMeals,
      recent_activities: recentActivities,
      habitual_cardio: fitnessCtx.constraints.cardio_habits || null,
      user_weight_kg: fitnessCtx.profile.weight_kg,
      goal: fitnessCtx.goal.primary_goal,
    };

    NuviaCache.set(cacheKey, loggingContext, { staleTime: 120_000, gcTime: 300_000 });
    return loggingContext;
  }

  /**
   * Generates dynamic contextual suggestion chips based on the user's
   * actual routines, habitual activities, and frequent meals.
   * Completely eliminates generic syntax prefixes.
   */
  static generateContextualSuggestions(
    context: NaturalLanguageLoggingContext
  ): ContextualSuggestion[] {
    const suggestions: ContextualSuggestion[] = [];
    const now = new Date();
    const currentHour = now.getHours();

    // 1. Scheduled Routine Suggestion
    if (context.today_routine && !context.today_routine.is_completed) {
      suggestions.push({
        label: `Log ${context.today_routine.title}`,
        text: `Finished today's ${context.today_routine.title} workout`,
        badge: "Today's Plan",
        type: 'workout',
      });
      suggestions.push({
        label: 'Log half workout',
        text: `I only did half of today's workout`,
        badge: 'Partial',
        type: 'workout',
      });
    }

    // 2. Habitual Cardio Suggestion (e.g. Saturday walk)
    if (context.habitual_cardio) {
      const isCardioDay = context.habitual_cardio.typical_days.some(
        (d) => d.toLowerCase() === context.day_of_week.toLowerCase()
      );
      if (isCardioDay) {
        suggestions.push({
          label: `Log ${context.day_of_week} ${context.habitual_cardio.type}`,
          text: `Did my usual ${context.day_of_week} ${context.habitual_cardio.type.toLowerCase()}`,
          badge: 'Habit',
          type: 'activity',
        });
      } else {
        suggestions.push({
          label: `Log usual ${context.habitual_cardio.type.toLowerCase()}`,
          text: `Did my usual ${context.habitual_cardio.type.toLowerCase()}`,
          type: 'activity',
        });
      }
    }

    // 3. Frequent Food Memory Suggestions
    if (context.frequent_meals.length > 0) {
      // Breakfast suggestion in morning
      if (currentHour < 12) {
        const bFast = context.frequent_meals.find((m) => m.common_meal_type === 'breakfast');
        if (bFast) {
          suggestions.push({
            label: `Log usual breakfast`,
            text: `Had my usual breakfast`,
            badge: `${bFast.recent_average_calories} kcal`,
            type: 'meal',
          });
        }
      }

      // Top frequent dish
      const topMeal = context.frequent_meals[0];
      if (topMeal && !suggestions.some((s) => s.label.includes(topMeal.name))) {
        suggestions.push({
          label: `Log ${topMeal.name}`,
          text: `Had ${topMeal.name}`,
          badge: `${topMeal.recent_average_calories} kcal`,
          type: 'meal',
        });
      }

      // Protein shake or drink habit
      const shake = context.frequent_meals.find(
        (m) =>
          m.name.toLowerCase().includes('shake') ||
          m.name.toLowerCase().includes('protein') ||
          m.name.toLowerCase().includes('milo')
      );
      if (shake && !suggestions.some((s) => s.label.includes(shake.name))) {
        suggestions.push({
          label: `Log usual ${shake.name}`,
          text: `Had my usual ${shake.name}`,
          type: 'meal',
        });
      }

      // Repeat yesterday's meal if available
      if (context.recent_meals.length > 0) {
        const yesterdayMeal = context.recent_meals[0];
        suggestions.push({
          label: `Repeat ${yesterdayMeal.name}`,
          text: `Had ${yesterdayMeal.name} again`,
          type: 'meal',
        });
      }
    }

    // 4. Clean Fallback for brand-new users with zero history
    if (suggestions.length < 3) {
      const fallbacks: ContextualSuggestion[] = [
        {
          label: 'Nasi ayam for lunch',
          text: 'I had nasi ayam for lunch',
          type: 'meal',
        },
        {
          label: 'Walked 4.5 km',
          text: 'I walked 4.5 km with my mom',
          type: 'activity',
        },
        {
          label: "Today's workout",
          text: "Finished today's workout",
          type: 'workout',
        },
        {
          label: 'Usual protein shake',
          text: 'Had my usual protein shake',
          type: 'meal',
        },
      ];

      for (const fb of fallbacks) {
        if (!suggestions.some((s) => s.text === fb.text)) {
          suggestions.push(fb);
        }
        if (suggestions.length >= 4) break;
      }
    }

    return suggestions.slice(0, 5);
  }
}

