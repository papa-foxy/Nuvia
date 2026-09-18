import {
  Profile,
  Goal,
  Meal,
  MealItem,
  ExerciseLog,
  DailySummary,
  AiRecommendation,
} from '@/types/database';
import { WorkoutRoutine } from '@/types/routine';
import { StreakData, StreakDay, MilestoneBadge } from '@/types/streak';
import { matchExercise, PLAYLIST_ID } from './exercise-catalog';
import { createClient, isSupabaseConfigured } from './supabase/client';
import { calculateTargets } from './calculator';

const DEMO_USER_ID = 'demo-user-001';

/**
 * Returns YYYY-MM-DD in the user's local timezone.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts a local calendar date string (YYYY-MM-DD) into UTC ISO timestamps
 * corresponding to local 00:00:00.000 and local 23:59:59.999.
 * This guarantees database queries match the user's actual 24-hour day regardless of timezone.
 */
export function getDayRangeIso(dateStr: string): { startIso: string; endIso: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

const DEFAULT_DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  name: 'Wann',
  date_of_birth: '2004-09-23',
  sex: 'male',
  height_cm: 176,
  weight_kg: 79,
  activity_level: 'moderately_active',
  goal: 'build_muscle',
  target_weight_kg: 72,
  dietary_preference: 'Halal',
  allergies: [],
};

const DEFAULT_DEMO_GOALS: Goal = {
  id: 'demo-goals-001',
  user_id: DEMO_USER_ID,
  calorie_target: 2450,
  protein_target: 160,
  carbohydrate_target: 270,
  fat_target: 75,
  exercise_minutes_target: 45,
  target_weight_kg: 72,
};

function createDefaultExercise(id: string, name: string, sets: number, reps: string, notes: string) {
  const matched = matchExercise(name);
  return {
    id,
    name,
    target_muscle: matched.target_muscle,
    sets,
    reps,
    notes,
    thumbnail_url: matched.thumbnail_url,
    youtube_id: matched.youtube_id,
    youtube_url: `https://www.youtube.com/watch?v=${matched.youtube_id}&list=${PLAYLIST_ID}`,
  };
}

const DEFAULT_ROUTINES: WorkoutRoutine[] = [
  {
    id: 'routine-upper-body',
    user_id: DEMO_USER_ID,
    title: 'Monday & Wednesday - Upper Body (Push-up Board + Dumbbells)',
    days: ['Monday', 'Wednesday'],
    focus: 'Upper Body',
    description: 'Targeted upper body split utilizing push-up board grips and dumbbells.',
    created_at: new Date().toISOString(),
    exercises: [
      createDefaultExercise('ex-1', 'Push-ups (Blue/Chest position)', 4, '10-12', 'Blue/Chest position'),
      createDefaultExercise('ex-2', 'Push-ups (Yellow/Back position)', 4, '10-12', 'Yellow/Back position'),
      createDefaultExercise('ex-3', 'Dumbbell shoulder press', 3, '10-12', 'Overhead pressing'),
      createDefaultExercise('ex-4', 'Push-ups (Red/Shoulder position)', 3, '10-12', 'Red/Shoulder position'),
      createDefaultExercise('ex-5', 'Dumbbell bicep curls', 3, '12', 'Bicep curls'),
      createDefaultExercise('ex-6', 'Push-ups (Green/Triceps position)', 3, '12', 'Green/Triceps position'),
      createDefaultExercise('ex-7', 'Dumbbell lateral raises', 3, '15', 'Lateral raises'),
    ],
  },
  {
    id: 'routine-abs',
    user_id: DEMO_USER_ID,
    title: 'Tuesday & Friday - Abs (done first)',
    days: ['Tuesday', 'Friday'],
    focus: 'Abs & Core',
    description: 'High-intensity core circuit prioritizing lower, upper, obliques and isometric stability.',
    created_at: new Date().toISOString(),
    exercises: [
      createDefaultExercise('ex-abs-1', 'Hanging knee raises or lying leg raises', 4, '12-15', 'done first'),
      createDefaultExercise('ex-abs-2', 'Weighted crunches (hold dumbbell)', 4, '15', 'hold dumbbell'),
      createDefaultExercise('ex-abs-3', 'Russian twists (with dumbbell)', 4, '15 per side', 'with dumbbell'),
      createDefaultExercise('ex-abs-4', 'Bicycle crunches', 3, '20', 'alternating sides'),
      createDefaultExercise('ex-abs-5', 'Plank', 3, '40-60 sec', 'isometric hold'),
      createDefaultExercise('ex-abs-6', 'Side plank', 3, '25-35 sec per side', 'per side'),
      createDefaultExercise('ex-abs-7', 'Mountain climbers', 3, '20 per side', 'per side'),
    ],
  },
];

interface LocalState {
  profile: Profile | null;
  goals: Goal | null;
  meals: Meal[];
  exerciseLogs: ExerciseLog[];
  workoutRoutines: WorkoutRoutine[];
  dailySummaries: Record<string, DailySummary>;
  recommendations: AiRecommendation[];
}

function getLocalState(): LocalState {
  if (typeof window === 'undefined') {
    return {
      profile: DEFAULT_DEMO_PROFILE,
      goals: DEFAULT_DEMO_GOALS,
      meals: [],
      exerciseLogs: [],
      workoutRoutines: DEFAULT_ROUTINES,
      dailySummaries: {},
      recommendations: [],
    };
  }

  const stored = localStorage.getItem('nuvia_storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (!parsed.workoutRoutines || parsed.workoutRoutines.length === 0) {
        parsed.workoutRoutines = DEFAULT_ROUTINES;
        saveLocalState(parsed);
      }
      return parsed;
    } catch {
      // Fallback
    }
  }

  const initial: LocalState = {
    profile: DEFAULT_DEMO_PROFILE,
    goals: DEFAULT_DEMO_GOALS,
    workoutRoutines: DEFAULT_ROUTINES,
    meals: [],
    exerciseLogs: [],
    dailySummaries: {},
    recommendations: [],
  };

  saveLocalState(initial);
  return initial;
}

function saveLocalState(state: LocalState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nuvia_storage', JSON.stringify(state));
  }
}

export const DataService = {
  // =========================================================================
  // PROFILES
  // =========================================================================
  async getProfile(userId?: string): Promise<Profile | null> {
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) {
          const prof = data as Profile;
          const state = getLocalState();
          state.profile = prof;
          saveLocalState(state);
          return prof;
        }
      } catch (err) {
        console.warn('Supabase getProfile error:', err);
      }
    }
    const state = getLocalState();
    return state.profile;
  },

  async saveProfile(profile: Profile): Promise<Profile> {
    if (isSupabaseConfigured() && profile.id && profile.id !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .upsert({ ...profile, updated_at: new Date().toISOString() })
          .select()
          .single();
        if (!error && data) {
          const saved = data as Profile;
          const state = getLocalState();
          state.profile = saved;
          saveLocalState(state);
          return saved;
        } else if (error) {
          console.error('Supabase saveProfile error:', error);
        }
      } catch (err) {
        console.error('Supabase saveProfile exception:', err);
      }
    }
    const state = getLocalState();
    state.profile = profile;
    saveLocalState(state);
    return profile;
  },

  // =========================================================================
  // GOALS
  // =========================================================================
  async getGoals(userId?: string): Promise<Goal | null> {
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const g = data as Goal;
          const state = getLocalState();
          state.goals = g;
          saveLocalState(state);
          return g;
        }

        // If user is authenticated in Supabase but has no goals yet, check if profile exists
        if (!data) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (prof && prof.weight_kg && prof.height_cm) {
            const birthYear = prof.date_of_birth
              ? new Date(prof.date_of_birth).getFullYear()
              : 2000;
            const age = Math.max(16, new Date().getFullYear() - birthYear);
            const calculated = calculateTargets({
              age,
              sex: prof.sex || 'male',
              height_cm: Number(prof.height_cm) || 175,
              weight_kg: Number(prof.weight_kg) || 70,
              activity_level: prof.activity_level || 'moderately_active',
              goal: prof.goal || 'build_muscle',
              target_weight_kg: Number(prof.target_weight_kg) || 70,
            });

            const initialGoalPayload = {
              user_id: userId,
              calorie_target: calculated.calorie_target,
              protein_target: calculated.protein_target,
              carbohydrate_target: calculated.carbohydrate_target,
              fat_target: calculated.fat_target,
              exercise_minutes_target: calculated.exercise_minutes_target,
              target_weight_kg: Number(prof.target_weight_kg) || 70,
            };

            const { data: newG, error: gErr } = await supabase
              .from('goals')
              .insert(initialGoalPayload)
              .select()
              .single();

            if (!gErr && newG) {
              const state = getLocalState();
              state.goals = newG as Goal;
              saveLocalState(state);
              return newG as Goal;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase getGoals error:', err);
      }
    }
    const state = getLocalState();
    return state.goals;
  },

  async saveGoals(goals: Goal): Promise<Goal> {
    if (isSupabaseConfigured() && goals.user_id && goals.user_id !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        // Check for existing goals row to update rather than failing on invalid string id
        const { data: existing } = await supabase
          .from('goals')
          .select('id')
          .eq('user_id', goals.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const payload = {
          user_id: goals.user_id,
          calorie_target: Math.round(Number(goals.calorie_target) || 2000),
          protein_target: Math.round(Number(goals.protein_target) || 140),
          carbohydrate_target: Math.round(Number(goals.carbohydrate_target) || 220),
          fat_target: Math.round(Number(goals.fat_target) || 65),
          exercise_minutes_target: Math.round(Number(goals.exercise_minutes_target) || 30),
          target_weight_kg: goals.target_weight_kg != null ? Number(goals.target_weight_kg) : null,
          updated_at: new Date().toISOString(),
        };

        if (existing?.id) {
          const { data, error } = await supabase
            .from('goals')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single();

          if (!error && data) {
            const saved = data as Goal;
            const state = getLocalState();
            state.goals = saved;
            saveLocalState(state);
            return saved;
          }
        } else {
          const { data, error } = await supabase
            .from('goals')
            .insert(payload)
            .select()
            .single();

          if (!error && data) {
            const saved = data as Goal;
            const state = getLocalState();
            state.goals = saved;
            saveLocalState(state);
            return saved;
          }
        }
      } catch (err) {
        console.error('Supabase saveGoals exception:', err);
      }
    }

    const state = getLocalState();
    state.goals = goals;
    saveLocalState(state);
    return goals;
  },

  // =========================================================================
  // MEALS & MEAL ITEMS
  // =========================================================================
  async getMeals(userId?: string, dateStr?: string): Promise<Meal[]> {
    const isRemoteUser = isSupabaseConfigured() && userId && userId !== DEMO_USER_ID;

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        let query = supabase
          .from('meals')
          .select('*, meal_items(*)')
          .eq('user_id', userId)
          .order('meal_time', { ascending: false });

        if (dateStr) {
          const { startIso, endIso } = getDayRangeIso(dateStr);
          query = query.gte('meal_time', startIso).lte('meal_time', endIso);
        }

        const { data: mealsData, error } = await query;

        if (!error && mealsData) {
          const mapped: Meal[] = mealsData.map((m: any) => ({
            ...m,
            items: m.meal_items || [],
          }));
          return mapped;
        } else if (error) {
          console.error('Supabase getMeals error:', error);
        }
      } catch (err) {
        console.warn('Supabase getMeals error:', err);
      }
    }

    // Local state fallback (for offline / demo)
    const state = getLocalState();
    if (!dateStr) {
      return state.meals.filter((m) => !userId || m.user_id === userId);
    }
    return state.meals.filter((m) => {
      const matchUser = !userId || m.user_id === userId;
      const mDate = getLocalDateString(new Date(m.meal_time));
      return matchUser && mDate === dateStr;
    });
  },

  async addMeal(meal: Omit<Meal, 'id'>, items: Omit<MealItem, 'id' | 'meal_id'>[]): Promise<Meal> {
    const isRemoteUser = isSupabaseConfigured() && meal.user_id && meal.user_id !== DEMO_USER_ID;

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        const safeType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.meal_type)
          ? meal.meal_type
          : 'snack';
        const safeSource = ['photo', 'text', 'manual'].includes(meal.source)
          ? meal.source
          : 'manual';
        const safeConfidence = ['high', 'medium', 'low'].includes(meal.confidence || '')
          ? meal.confidence
          : 'medium';

        const { data: mealRow, error: mealErr } = await supabase
          .from('meals')
          .insert({
            user_id: meal.user_id,
            meal_type: safeType,
            meal_time: meal.meal_time || new Date().toISOString(),
            source: safeSource,
            image_url: meal.image_url || null,
            description: meal.description || 'Meal',
            calories: Math.round(Number(meal.calories) || 0),
            protein_g: Math.round((Number(meal.protein_g) || 0) * 10) / 10,
            carbs_g: Math.round((Number(meal.carbs_g) || 0) * 10) / 10,
            fat_g: Math.round((Number(meal.fat_g) || 0) * 10) / 10,
            confidence: safeConfidence,
            ai_analysis: meal.ai_analysis || null,
          })
          .select()
          .single();

        if (mealErr || !mealRow) {
          console.error('Supabase meal insert error:', mealErr);
          throw mealErr;
        }

        let insertedItems: MealItem[] = [];
        if (items.length > 0) {
          const itemRows = items.map((it) => ({
            meal_id: mealRow.id,
            name: it.name,
            estimated_quantity: it.estimated_quantity != null ? Number(it.estimated_quantity) : null,
            estimated_unit: it.estimated_unit || null,
            calories: Math.round(Number(it.calories) || 0),
            protein_g: Math.round((Number(it.protein_g) || 0) * 10) / 10,
            carbs_g: Math.round((Number(it.carbs_g) || 0) * 10) / 10,
            fat_g: Math.round((Number(it.fat_g) || 0) * 10) / 10,
            confidence: ['high', 'medium', 'low'].includes(it.confidence || '') ? it.confidence : 'medium',
          }));

          const { data: itemsData, error: itemErr } = await supabase
            .from('meal_items')
            .insert(itemRows)
            .select();

          if (!itemErr && itemsData) {
            insertedItems = itemsData as MealItem[];
          }
        }

        const completeMeal: Meal = { ...mealRow, items: insertedItems };

        // Automatically sync daily summary in Supabase
        const mealLocalDate = getLocalDateString(new Date(mealRow.meal_time));
        await this.syncDailySummaryToSupabase(meal.user_id, mealLocalDate);

        return completeMeal;
      } catch (err) {
        console.error('Supabase addMeal failed, falling back to local:', err);
      }
    }

    const mealId = `meal-${Date.now()}`;
    const newMeal: Meal = {
      ...meal,
      id: mealId,
      created_at: new Date().toISOString(),
      items: items.map((it, idx) => ({
        ...it,
        id: `item-${Date.now()}-${idx}`,
        meal_id: mealId,
      })),
    };

    const state = getLocalState();
    state.meals.unshift(newMeal);
    saveLocalState(state);
    return newMeal;
  },

  async deleteMeal(mealId: string, userId?: string): Promise<boolean> {
    const isRemoteUser = isSupabaseConfigured() && userId && userId !== DEMO_USER_ID;

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('meals').delete().eq('id', mealId);
        if (error) {
          console.error('Supabase deleteMeal error:', error);
        } else {
          const todayLocal = getLocalDateString();
          await this.syncDailySummaryToSupabase(userId, todayLocal);
        }
      } catch (err) {
        console.error('Supabase deleteMeal exception:', err);
      }
    }

    const state = getLocalState();
    state.meals = state.meals.filter((m) => m.id !== mealId);
    saveLocalState(state);
    return true;
  },

  // =========================================================================
  // EXERCISE LOGS
  // =========================================================================
  async getExerciseLogs(userId?: string, dateStr?: string): Promise<ExerciseLog[]> {
    const isRemoteUser = isSupabaseConfigured() && userId && userId !== DEMO_USER_ID;

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        let query = supabase
          .from('exercise_logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (dateStr) {
          const { startIso, endIso } = getDayRangeIso(dateStr);
          query = query.gte('created_at', startIso).lte('created_at', endIso);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as ExerciseLog[];
        } else if (error) {
          console.error('Supabase getExerciseLogs error:', error);
        }
      } catch (err) {
        console.warn('Supabase getExerciseLogs error:', err);
      }
    }

    const state = getLocalState();
    if (!dateStr) {
      return state.exerciseLogs.filter((e) => !userId || e.user_id === userId);
    }
    return state.exerciseLogs.filter((e) => {
      const matchUser = !userId || e.user_id === userId;
      const eDate = getLocalDateString(new Date(e.created_at || new Date()));
      return matchUser && eDate === dateStr;
    });
  },

  async addExerciseLog(log: Omit<ExerciseLog, 'id'>): Promise<ExerciseLog> {
    const isRemoteUser = isSupabaseConfigured() && log.user_id && log.user_id !== DEMO_USER_ID;

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        const safeSource = log.source === 'routine' ? 'manual' : (log.source || 'manual');
        const safeIntensity = ['low', 'moderate', 'high'].includes(log.intensity || '')
          ? log.intensity
          : 'moderate';
        const safeConfidence = ['high', 'medium', 'low'].includes(log.confidence || '')
          ? log.confidence
          : 'medium';

        const { data, error } = await supabase
          .from('exercise_logs')
          .insert({
            user_id: log.user_id,
            exercise_type: log.exercise_type,
            duration_minutes: Math.round(Number(log.duration_minutes) || 0),
            intensity: safeIntensity,
            distance_km: log.distance_km != null ? Number(log.distance_km) : null,
            calories_burned: Math.round(Number(log.calories_burned) || 0),
            source: safeSource,
            description: log.description || '',
            confidence: safeConfidence,
            ai_analysis: log.ai_analysis || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Supabase addExerciseLog error:', error);
          throw error;
        }

        if (data) {
          const logDate = getLocalDateString(new Date(data.created_at));
          await this.syncDailySummaryToSupabase(log.user_id, logDate);
          return data as ExerciseLog;
        }
      } catch (err) {
        console.error('Supabase addExerciseLog exception, fallback to local:', err);
      }
    }

    const newLog: ExerciseLog = {
      ...log,
      id: `ex-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const state = getLocalState();
    state.exerciseLogs.unshift(newLog);
    saveLocalState(state);
    return newLog;
  },

  async deleteExerciseLog(logId: string, userId?: string): Promise<boolean> {
    const isRemoteUser = isSupabaseConfigured() && userId && userId !== DEMO_USER_ID;

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('exercise_logs').delete().eq('id', logId);
        if (error) {
          console.error('Supabase deleteExerciseLog error:', error);
        } else {
          const todayLocal = getLocalDateString();
          await this.syncDailySummaryToSupabase(userId, todayLocal);
        }
      } catch (err) {
        console.error('Supabase deleteExerciseLog exception:', err);
      }
    }

    const state = getLocalState();
    state.exerciseLogs = state.exerciseLogs.filter((e) => e.id !== logId);
    saveLocalState(state);
    return true;
  },

  // =========================================================================
  // DAILY SUMMARIES (Calculated & Persisted to Supabase)
  // =========================================================================
  async syncDailySummaryToSupabase(userId: string, dateStr: string): Promise<DailySummary | null> {
    if (!isSupabaseConfigured() || !userId || userId === DEMO_USER_ID) return null;

    try {
      const supabase = createClient();
      const meals = await this.getMeals(userId, dateStr);
      const exercises = await this.getExerciseLogs(userId, dateStr);

      const calories_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0));
      const protein_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.protein_g) || 0), 0));
      const carbohydrate_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.carbs_g) || 0), 0));
      const fat_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.fat_g) || 0), 0));

      const calories_burned = Math.round(exercises.reduce((acc, e) => acc + (Number(e.calories_burned) || 0), 0));
      const exercise_minutes = Math.round(exercises.reduce((acc, e) => acc + (Number(e.duration_minutes) || 0), 0));

      const { data, error } = await supabase
        .from('daily_summaries')
        .upsert(
          {
            user_id: userId,
            date: dateStr,
            calories_consumed,
            protein_consumed,
            carbohydrate_consumed,
            fat_consumed,
            calories_burned,
            exercise_minutes,
          },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single();

      if (!error && data) {
        return data as DailySummary;
      }
    } catch (err) {
      console.warn('syncDailySummaryToSupabase error:', err);
    }
    return null;
  },

  async getDailySummary(userId?: string, dateStr?: string): Promise<DailySummary> {
    const date = dateStr || getLocalDateString();

    // Compute live from verified meals and exercise logs
    const meals = await this.getMeals(userId, date);
    const exercises = await this.getExerciseLogs(userId, date);

    const calories_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0));
    const protein_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.protein_g) || 0), 0));
    const carbohydrate_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.carbs_g) || 0), 0));
    const fat_consumed = Math.round(meals.reduce((acc, m) => acc + (Number(m.fat_g) || 0), 0));

    const calories_burned = Math.round(exercises.reduce((acc, e) => acc + (Number(e.calories_burned) || 0), 0));
    const exercise_minutes = Math.round(exercises.reduce((acc, e) => acc + (Number(e.duration_minutes) || 0), 0));

    let ai_summary: string | null = null;

    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('daily_summaries')
          .upsert(
            {
              user_id: userId,
              date,
              calories_consumed,
              protein_consumed,
              carbohydrate_consumed,
              fat_consumed,
              calories_burned,
              exercise_minutes,
            },
            { onConflict: 'user_id,date' }
          )
          .select()
          .maybeSingle();

        if (data?.ai_summary) {
          ai_summary = data.ai_summary;
        }
      } catch (err) {
        console.warn('getDailySummary upsert error:', err);
      }
    }

    return {
      id: `summary-${date}`,
      user_id: userId || DEMO_USER_ID,
      date,
      calories_consumed,
      protein_consumed,
      carbohydrate_consumed,
      fat_consumed,
      calories_burned,
      exercise_minutes,
      ai_summary,
    };
  },

  // =========================================================================
  // AI RECOMMENDATIONS
  // =========================================================================
  async getRecommendations(userId?: string): Promise<AiRecommendation[]> {
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('ai_recommendations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data && data.length > 0) {
          return data as AiRecommendation[];
        }
      } catch (err) {
        console.warn('Supabase getRecommendations error:', err);
      }
    }

    const state = getLocalState();
    return state.recommendations;
  },

  async addRecommendation(rec: Omit<AiRecommendation, 'id' | 'created_at'>): Promise<AiRecommendation> {
    if (isSupabaseConfigured() && rec.user_id && rec.user_id !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('ai_recommendations')
          .insert({
            user_id: rec.user_id,
            date: rec.date || getLocalDateString(),
            recommendation: rec.recommendation,
            priority: rec.priority || 1,
          })
          .select()
          .single();

        if (!error && data) {
          return data as AiRecommendation;
        }
      } catch (err) {
        console.warn('Supabase addRecommendation error:', err);
      }
    }

    const newRec: AiRecommendation = {
      ...rec,
      id: `rec-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const state = getLocalState();
    state.recommendations.unshift(newRec);
    saveLocalState(state);
    return newRec;
  },

  // =========================================================================
  // WORKOUT ROUTINES (Supabase with Local Fallback)
  // =========================================================================
  async getWorkoutRoutines(userId?: string): Promise<WorkoutRoutine[]> {
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('workout_routines')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data as WorkoutRoutine[];
        }
      } catch {
        // Fallback to local
      }
    }

    const state = getLocalState();
    return state.workoutRoutines || DEFAULT_ROUTINES;
  },

  async saveWorkoutRoutine(routine: WorkoutRoutine): Promise<WorkoutRoutine> {
    if (isSupabaseConfigured() && routine.user_id && routine.user_id !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('workout_routines')
          .upsert({
            id: routine.id,
            user_id: routine.user_id,
            title: routine.title,
            days: routine.days,
            focus: routine.focus,
            description: routine.description,
            exercises: routine.exercises,
            updated_at: new Date().toISOString(),
          });

        if (!error) {
          // Table exists and saved!
        }
      } catch {
        // Table may not exist yet in Supabase
      }
    }

    const state = getLocalState();
    if (!state.workoutRoutines) {
      state.workoutRoutines = [...DEFAULT_ROUTINES];
    }
    const idx = state.workoutRoutines.findIndex((r) => r.id === routine.id);
    if (idx >= 0) {
      state.workoutRoutines[idx] = { ...routine, updated_at: new Date().toISOString() };
    } else {
      state.workoutRoutines.unshift({
        ...routine,
        created_at: routine.created_at || new Date().toISOString(),
      });
    }
    saveLocalState(state);
    return routine;
  },

  async deleteWorkoutRoutine(routineId: string, userId?: string): Promise<void> {
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        await supabase.from('workout_routines').delete().eq('id', routineId);
      } catch {
        // Fallback
      }
    }

    const state = getLocalState();
    if (state.workoutRoutines) {
      state.workoutRoutines = state.workoutRoutines.filter((r) => r.id !== routineId);
      saveLocalState(state);
    }
  },

  // =========================================================================
  // STREAK & ACHIEVEMENTS
  // =========================================================================
  async getStreakData(userId?: string): Promise<StreakData> {
    const isRemoteUser = isSupabaseConfigured() && userId && userId !== DEMO_USER_ID;
    const now = new Date();
    const todayStr = getLocalDateString(now);

    const activityMap = new Map<string, {
      hasMeal: boolean;
      hasWorkout: boolean;
      calories: number;
      burned: number;
      protein: number;
    }>();

    const recordActivity = (dateStr: string, opts: { meal?: boolean; workout?: boolean; calories?: number; burned?: number; protein?: number }) => {
      if (!dateStr) return;
      const current = activityMap.get(dateStr) || {
        hasMeal: false,
        hasWorkout: false,
        calories: 0,
        burned: 0,
        protein: 0,
      };
      if (opts.meal) current.hasMeal = true;
      if (opts.workout) current.hasWorkout = true;
      if (opts.calories) current.calories += opts.calories;
      if (opts.burned) current.burned += opts.burned;
      if (opts.protein) current.protein += opts.protein;
      activityMap.set(dateStr, current);
    };

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        const [mealsRes, exRes, sumRes] = await Promise.all([
          supabase.from('meals').select('meal_time, calories, protein_g').eq('user_id', userId),
          supabase.from('exercise_logs').select('created_at, calories_burned').eq('user_id', userId),
          supabase.from('daily_summaries').select('date, calories_consumed, calories_burned, protein_consumed').eq('user_id', userId),
        ]);

        if (mealsRes.data) {
          for (const m of mealsRes.data) {
            const d = getLocalDateString(new Date(m.meal_time));
            recordActivity(d, {
              meal: true,
              calories: Number(m.calories) || 0,
              protein: Number(m.protein_g) || 0,
            });
          }
        }

        if (exRes.data) {
          for (const e of exRes.data) {
            const d = getLocalDateString(new Date(e.created_at));
            recordActivity(d, {
              workout: true,
              burned: Number(e.calories_burned) || 0,
            });
          }
        }

        if (sumRes.data) {
          for (const s of sumRes.data) {
            if ((s.calories_consumed || 0) > 0 || (s.calories_burned || 0) > 0) {
              recordActivity(s.date, {
                meal: (s.calories_consumed || 0) > 0,
                workout: (s.calories_burned || 0) > 0,
                calories: Number(s.calories_consumed) || 0,
                burned: Number(s.calories_burned) || 0,
                protein: Number(s.protein_consumed) || 0,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Supabase getStreakData error, falling back:', err);
      }
    } else {
      const state = getLocalState();
      for (const m of state.meals) {
        if (!userId || m.user_id === userId) {
          const d = getLocalDateString(new Date(m.meal_time));
          recordActivity(d, {
            meal: true,
            calories: Number(m.calories) || 0,
            protein: Number(m.protein_g) || 0,
          });
        }
      }
      for (const e of state.exerciseLogs) {
        if (!userId || e.user_id === userId) {
          const d = getLocalDateString(new Date(e.created_at || new Date()));
          recordActivity(d, {
            workout: true,
            burned: Number(e.calories_burned) || 0,
          });
        }
      }
    }

    const activeDates = Array.from(activityMap.keys()).sort();
    const totalActiveDays = activeDates.length;

    // Calculate Current Streak
    let currentStreak = 0;
    const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isTodayActive = activityMap.has(todayStr);

    if (isTodayActive) {
      currentStreak = 1;
      // Step backwards from yesterday
      checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const ds = getLocalDateString(checkDate);
        if (activityMap.has(ds)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      // Check if yesterday was active (streak is pending today)
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = getLocalDateString(checkDate);
      if (activityMap.has(yesterdayStr)) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        while (true) {
          const ds = getLocalDateString(checkDate);
          if (activityMap.has(ds)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      } else {
        currentStreak = 0;
      }
    }

    // Calculate Longest Streak
    let longestStreak = 0;
    if (activeDates.length > 0) {
      let run = 1;
      longestStreak = 1;
      for (let i = 1; i < activeDates.length; i++) {
        const prev = new Date(activeDates[i - 1] + 'T00:00:00');
        const curr = new Date(activeDates[i] + 'T00:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          run++;
          if (run > longestStreak) longestStreak = run;
        } else if (diffDays > 1) {
          run = 1;
        }
      }
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Monthly Consistency %
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysSoFarInMonth = now.getDate();
    let monthActiveCount = 0;
    for (const dStr of activeDates) {
      const [y, m] = dStr.split('-').map(Number);
      if (y === currentYear && m === currentMonth + 1) {
        monthActiveCount++;
      }
    }
    const monthlyConsistencyPct = Math.min(100, Math.round((monthActiveCount / Math.max(1, daysSoFarInMonth)) * 100));

    // Weekly strip (Monday to Sunday)
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday);

    const weekLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const weeklyDays: StreakDay[] = [];

    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const ds = getLocalDateString(dayDate);
      const isToday = ds === todayStr;
      const isFuture = dayDate.getTime() > endOfToday;
      const act = activityMap.get(ds);

      weeklyDays.push({
        dateStr: ds,
        dayName: weekLetters[i],
        dayNumber: dayDate.getDate(),
        isToday,
        isLogged: Boolean(act && (act.hasMeal || act.hasWorkout || act.calories > 0 || act.burned > 0)),
        isFuture,
        hasMeal: Boolean(act?.hasMeal),
        hasWorkout: Boolean(act?.hasWorkout),
        calories: act?.calories || 0,
        burned: act?.burned || 0,
      });
    }

    // Weekend Warrior check
    let hasWeekendWarrior = false;
    for (let i = 0; i < activeDates.length; i++) {
      const d = new Date(activeDates[i] + 'T00:00:00');
      if (d.getDay() === 6) { // Saturday
        const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const sunStr = getLocalDateString(sun);
        if (activityMap.has(sunStr)) {
          hasWeekendWarrior = true;
          break;
        }
      }
    }

    // Protein Master check (any day with >= 100g protein logged)
    let hasHighProteinDay = false;
    for (const act of Array.from(activityMap.values())) {
      if (act.protein >= 100) {
        hasHighProteinDay = true;
        break;
      }
    }

    // Milestone Badges
    const badges: MilestoneBadge[] = [
      {
        id: 'first-step',
        title: 'First Ignition',
        description: 'Log your first meal or workout session',
        icon: 'zap',
        category: 'streak',
        unlocked: totalActiveDays >= 1,
        progress: Math.min(totalActiveDays, 1),
        maxProgress: 1,
      },
      {
        id: '3-day-streak',
        title: '3-Day Momentum',
        description: 'Maintain an unbroken 3-day active streak',
        icon: 'flame',
        category: 'streak',
        unlocked: longestStreak >= 3,
        progress: Math.min(longestStreak, 3),
        maxProgress: 3,
      },
      {
        id: '7-day-iron',
        title: '7-Day Iron Will',
        description: 'Achieve a continuous 7-day fitness streak',
        icon: 'shield',
        category: 'streak',
        unlocked: longestStreak >= 7,
        progress: Math.min(longestStreak, 7),
        maxProgress: 7,
      },
      {
        id: '14-day-master',
        title: '14-Day Habit Master',
        description: 'Lock in a 2-week consistent lifestyle',
        icon: 'trophy',
        category: 'streak',
        unlocked: longestStreak >= 14,
        progress: Math.min(longestStreak, 14),
        maxProgress: 14,
      },
      {
        id: 'weekend-warrior',
        title: 'Weekend Warrior',
        description: 'Log workouts or meals on both Saturday and Sunday',
        icon: 'star',
        category: 'fitness',
        unlocked: hasWeekendWarrior,
        progress: hasWeekendWarrior ? 1 : 0,
        maxProgress: 1,
      },
      {
        id: '10-days-total',
        title: 'Century Club Starter',
        description: 'Log activity across 10 distinct days',
        icon: 'award',
        category: 'streak',
        unlocked: totalActiveDays >= 10,
        progress: Math.min(totalActiveDays, 10),
        maxProgress: 10,
      },
      {
        id: 'protein-champion',
        title: 'Protein Champion',
        description: 'Hit 100g+ protein in a single day',
        icon: 'target',
        category: 'nutrition',
        unlocked: hasHighProteinDay,
        progress: hasHighProteinDay ? 1 : 0,
        maxProgress: 1,
      },
    ];

    return {
      currentStreak,
      longestStreak,
      totalActiveDays,
      weeklyDays,
      activeDates,
      badges,
      monthlyConsistencyPct,
    };
  },

  async getActivityMap(userId?: string): Promise<Record<string, { hasMeal: boolean; hasWorkout: boolean; calories: number; burned: number }>> {
    const isRemoteUser = isSupabaseConfigured() && userId && userId !== DEMO_USER_ID;
    const result: Record<string, { hasMeal: boolean; hasWorkout: boolean; calories: number; burned: number }> = {};

    const record = (dateStr: string, opts: { meal?: boolean; workout?: boolean; calories?: number; burned?: number }) => {
      if (!dateStr) return;
      if (!result[dateStr]) {
        result[dateStr] = { hasMeal: false, hasWorkout: false, calories: 0, burned: 0 };
      }
      if (opts.meal) result[dateStr].hasMeal = true;
      if (opts.workout) result[dateStr].hasWorkout = true;
      if (opts.calories) result[dateStr].calories += opts.calories;
      if (opts.burned) result[dateStr].burned += opts.burned;
    };

    if (isRemoteUser) {
      try {
        const supabase = createClient();
        const [mealsRes, exRes, sumRes] = await Promise.all([
          supabase.from('meals').select('meal_time, calories').eq('user_id', userId),
          supabase.from('exercise_logs').select('created_at, calories_burned').eq('user_id', userId),
          supabase.from('daily_summaries').select('date, calories_consumed, calories_burned').eq('user_id', userId),
        ]);

        if (mealsRes.data) {
          for (const m of mealsRes.data) {
            record(getLocalDateString(new Date(m.meal_time)), { meal: true, calories: Number(m.calories) || 0 });
          }
        }
        if (exRes.data) {
          for (const e of exRes.data) {
            record(getLocalDateString(new Date(e.created_at)), { workout: true, burned: Number(e.calories_burned) || 0 });
          }
        }
        if (sumRes.data) {
          for (const s of sumRes.data) {
            if ((s.calories_consumed || 0) > 0 || (s.calories_burned || 0) > 0) {
              record(s.date, {
                meal: (s.calories_consumed || 0) > 0,
                workout: (s.calories_burned || 0) > 0,
                calories: Number(s.calories_consumed) || 0,
                burned: Number(s.calories_burned) || 0,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Supabase getActivityMap error:', err);
      }
    } else {
      const state = getLocalState();
      for (const m of state.meals) {
        if (!userId || m.user_id === userId) {
          record(getLocalDateString(new Date(m.meal_time)), { meal: true, calories: Number(m.calories) || 0 });
        }
      }
      for (const e of state.exerciseLogs) {
        if (!userId || e.user_id === userId) {
          record(getLocalDateString(new Date(e.created_at || new Date())), { workout: true, burned: Number(e.calories_burned) || 0 });
        }
      }
    }

    return result;
  },

  getDemoUserId() {
    return DEMO_USER_ID;
  },
};
