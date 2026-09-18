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
import { matchExercise, PLAYLIST_ID } from './exercise-catalog';
import { createClient, isSupabaseConfigured } from './supabase/client';

const DEMO_USER_ID = 'demo-user-001';

const DEFAULT_DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  name: 'Wann',
  date_of_birth: '2003-06-16',
  sex: 'male',
  height_cm: 176,
  weight_kg: 73,
  activity_level: 'moderately_active',
  goal: 'build_muscle',
  target_weight_kg: 68,
  dietary_preference: 'Halal',
  allergies: [],
};

const DEFAULT_DEMO_GOALS: Goal = {
  id: 'demo-goals-001',
  user_id: DEMO_USER_ID,
  calorie_target: 2200,
  protein_target: 150,
  carbohydrate_target: 250,
  fat_target: 70,
  exercise_minutes_target: 60,
  target_weight_kg: 68,
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

// Initial state for demo / offline mode
interface LocalState {
  profile: Profile | null;
  goals: Goal | null;
  meals: Meal[];
  exerciseLogs: ExerciseLog[];
  workoutRoutines: WorkoutRoutine[];
  dailySummaries: Record<string, DailySummary>; // date -> summary
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
      } else {
        // Enforce specific playlist video matching for all exercises
        let updated = false;
        parsed.workoutRoutines.forEach((r: any) => {
          r.exercises?.forEach((ex: any) => {
            const matched = matchExercise(ex.name);
            if (ex.youtube_id !== matched.youtube_id || !ex.youtube_url?.includes(matched.youtube_id)) {
              ex.youtube_id = matched.youtube_id;
              ex.youtube_url = `https://www.youtube.com/watch?v=${matched.youtube_id}&list=${PLAYLIST_ID}`;
              ex.thumbnail_url = matched.thumbnail_url;
              updated = true;
            }
          });
        });
        if (updated) {
          saveLocalState(parsed);
        }
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
    meals: [
      {
        id: 'meal-001',
        user_id: DEMO_USER_ID,
        meal_type: 'breakfast',
        meal_time: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
        source: 'text',
        image_url: null,
        description: 'Eggs, wholemeal toast, and latte',
        calories: 520,
        protein_g: 29,
        carbs_g: 43,
        fat_g: 22,
        confidence: 'high',
        ai_analysis: null,
        created_at: new Date().toISOString(),
        items: [
          {
            id: 'item-001',
            meal_id: 'meal-001',
            name: 'Eggs (2)',
            estimated_quantity: 2,
            estimated_unit: 'whole',
            calories: 140,
            protein_g: 12,
            carbs_g: 1,
            fat_g: 10,
            confidence: 'high',
          },
          {
            id: 'item-002',
            meal_id: 'meal-001',
            name: 'Wholemeal Bread',
            estimated_quantity: 2,
            estimated_unit: 'slices',
            calories: 160,
            protein_g: 6,
            carbs_g: 28,
            fat_g: 2,
            confidence: 'high',
          },
          {
            id: 'item-003',
            meal_id: 'meal-001',
            name: 'Latte',
            estimated_quantity: 1,
            estimated_unit: 'cup',
            calories: 150,
            protein_g: 8,
            carbs_g: 12,
            fat_g: 8,
            confidence: 'high',
          },
        ],
      },
      {
        id: 'meal-002',
        user_id: DEMO_USER_ID,
        meal_type: 'lunch',
        meal_time: new Date(new Date().setHours(12, 32, 0, 0)).toISOString(),
        source: 'photo',
        image_url: null,
        description: 'Grilled chicken, rice, broccoli, and egg',
        calories: 720,
        protein_g: 45,
        carbs_g: 75,
        fat_g: 20,
        confidence: 'medium',
        ai_analysis: null,
        created_at: new Date().toISOString(),
        items: [
          {
            id: 'item-004',
            meal_id: 'meal-002',
            name: 'Grilled Chicken Breast',
            estimated_quantity: 180,
            estimated_unit: 'g',
            calories: 300,
            protein_g: 35,
            carbs_g: 0,
            fat_g: 6,
            confidence: 'high',
          },
          {
            id: 'item-005',
            meal_id: 'meal-002',
            name: 'White Rice',
            estimated_quantity: 200,
            estimated_unit: 'g',
            calories: 260,
            protein_g: 5,
            carbs_g: 58,
            fat_g: 1,
            confidence: 'medium',
          },
          {
            id: 'item-006',
            meal_id: 'meal-002',
            name: 'Broccoli & Veggies',
            estimated_quantity: 100,
            estimated_unit: 'g',
            calories: 50,
            protein_g: 3,
            carbs_g: 8,
            fat_g: 1,
            confidence: 'medium',
          },
        ],
      },
    ],
    exerciseLogs: [
      {
        id: 'ex-001',
        user_id: DEMO_USER_ID,
        exercise_type: 'Morning Run (Cardio)',
        duration_minutes: 30,
        intensity: 'moderate',
        distance_km: 4.5,
        calories_burned: 320,
        source: 'text',
        description: 'Jogged 4.5km around park at steady pace',
        confidence: 'high',
        ai_analysis: null,
        created_at: new Date().toISOString(),
      },
    ],
    dailySummaries: {},
    recommendations: [
      {
        id: 'rec-001',
        user_id: DEMO_USER_ID,
        date: new Date().toISOString().split('T')[0],
        recommendation:
          "You've consumed 1,240 of your 2,200 kcal target with 74g of protein. For dinner, prioritize 40-50g of protein (like grilled fish, chicken breast, or tofu).",
        priority: 1,
        created_at: new Date().toISOString(),
      },
    ],
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
  async getProfile(userId?: string): Promise<Profile | null> {
    if (isSupabaseConfigured() && userId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) return data as Profile;
    }
    const state = getLocalState();
    return state.profile;
  },

  async saveProfile(profile: Profile): Promise<Profile> {
    if (isSupabaseConfigured() && profile.id !== DEMO_USER_ID) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ ...profile, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (!error && data) return data as Profile;
    }
    const state = getLocalState();
    state.profile = profile;
    saveLocalState(state);
    return profile;
  },

  async getGoals(userId?: string): Promise<Goal | null> {
    if (isSupabaseConfigured() && userId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) return data as Goal;
    }
    const state = getLocalState();
    return state.goals;
  },

  async saveGoals(goals: Goal): Promise<Goal> {
    if (isSupabaseConfigured() && goals.user_id !== DEMO_USER_ID) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('goals')
        .upsert({ ...goals, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (!error && data) return data as Goal;
    }
    const state = getLocalState();
    state.goals = goals;
    saveLocalState(state);
    return goals;
  },

  async getMeals(userId?: string, dateStr?: string): Promise<Meal[]> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const state = getLocalState();
    const localMeals = state.meals.filter((m) => {
      const mDate = m.meal_time.split('T')[0];
      return mDate === targetDate;
    });

    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const start = `${targetDate}T00:00:00.000Z`;
        const end = `${targetDate}T23:59:59.999Z`;
        const { data: mealsData, error } = await supabase
          .from('meals')
          .select('*, meal_items(*)')
          .eq('user_id', userId)
          .gte('meal_time', start)
          .lte('meal_time', end)
          .order('meal_time', { ascending: true });

        if (!error && mealsData) {
          const remoteMapped: Meal[] = mealsData.map((m: any) => ({
            ...m,
            items: m.meal_items,
          }));
          const merged = [...remoteMapped];
          localMeals.forEach((l) => {
            if (!merged.some((m) => m.id === l.id)) {
              merged.push(l);
            }
          });
          return merged;
        }
      } catch (err) {
        console.warn('Supabase getMeals error:', err);
      }
    }

    return localMeals;
  },

  async addMeal(meal: Omit<Meal, 'id'>, items: Omit<MealItem, 'id' | 'meal_id'>[]): Promise<Meal> {
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

    // Always update local state for instant responsiveness and offline support
    const state = getLocalState();
    state.meals.push(newMeal);
    saveLocalState(state);

    if (isSupabaseConfigured() && meal.user_id !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const { data: mealRow, error: mealErr } = await supabase
          .from('meals')
          .insert({
            user_id: meal.user_id,
            meal_type: meal.meal_type,
            meal_time: meal.meal_time,
            source: meal.source,
            image_url: meal.image_url,
            description: meal.description,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            confidence: meal.confidence,
            ai_analysis: meal.ai_analysis,
          })
          .select()
          .single();

        if (!mealErr && mealRow) {
          if (items.length > 0) {
            const itemRows = items.map((it) => ({
              meal_id: mealRow.id,
              name: it.name,
              estimated_quantity: it.estimated_quantity,
              estimated_unit: it.estimated_unit,
              calories: it.calories,
              protein_g: it.protein_g,
              carbs_g: it.carbs_g,
              fat_g: it.fat_g,
              confidence: it.confidence,
            }));
            const { data: insertedItems } = await supabase
              .from('meal_items')
              .insert(itemRows)
              .select();
            return { ...mealRow, items: insertedItems || [] };
          }
          return mealRow;
        }
      } catch (err) {
        console.warn('Supabase meal insert error:', err);
      }
    }

    return newMeal;
  },

  async deleteMeal(mealId: string, userId?: string): Promise<boolean> {
    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      const supabase = createClient();
      const { error } = await supabase.from('meals').delete().eq('id', mealId);
      if (!error) return true;
    }
    const state = getLocalState();
    state.meals = state.meals.filter((m) => m.id !== mealId);
    saveLocalState(state);
    return true;
  },

  async getExerciseLogs(userId?: string, dateStr?: string): Promise<ExerciseLog[]> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const state = getLocalState();
    const localLogs = state.exerciseLogs.filter((e) => {
      const eDate = (e.created_at || new Date().toISOString()).split('T')[0];
      return eDate === targetDate;
    });

    if (isSupabaseConfigured() && userId && userId !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const start = `${targetDate}T00:00:00.000Z`;
        const end = `${targetDate}T23:59:59.999Z`;
        const { data, error } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true });

        if (!error && data) {
          const merged = [...data];
          localLogs.forEach((l) => {
            if (!merged.some((m) => m.id === l.id)) {
              merged.push(l);
            }
          });
          return merged;
        }
      } catch (err) {
        console.warn('Supabase getExerciseLogs error:', err);
      }
    }

    return localLogs;
  },

  async addExerciseLog(log: Omit<ExerciseLog, 'id'>): Promise<ExerciseLog> {
    const newLog: ExerciseLog = {
      ...log,
      id: `ex-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    // Always update local state for immediate offline/hybrid responsiveness
    const state = getLocalState();
    state.exerciseLogs.push(newLog);
    saveLocalState(state);

    if (isSupabaseConfigured() && log.user_id !== DEMO_USER_ID) {
      try {
        const supabase = createClient();
        const safeSource = log.source === 'routine' ? 'manual' : log.source;
        const { data, error } = await supabase
          .from('exercise_logs')
          .insert({
            ...log,
            source: safeSource,
          })
          .select()
          .single();
        if (!error && data) {
          return data;
        } else if (error) {
          console.warn('Supabase exercise log insert error:', error);
        }
      } catch (err) {
        console.warn('Supabase exercise log error:', err);
      }
    }

    return newLog;
  },

  async getDailySummary(userId?: string, dateStr?: string): Promise<DailySummary> {
    const date = dateStr || new Date().toISOString().split('T')[0];

    // Compute live from meals and exercises
    const meals = await this.getMeals(userId, date);
    const exercises = await this.getExerciseLogs(userId, date);

    const calories_consumed = meals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);
    const protein_consumed = meals.reduce((acc, m) => acc + (Number(m.protein_g) || 0), 0);
    const carbohydrate_consumed = meals.reduce((acc, m) => acc + (Number(m.carbs_g) || 0), 0);
    const fat_consumed = meals.reduce((acc, m) => acc + (Number(m.fat_g) || 0), 0);

    const calories_burned = exercises.reduce((acc, e) => acc + (Number(e.calories_burned) || 0), 0);
    const exercise_minutes = exercises.reduce((acc, e) => acc + (Number(e.duration_minutes) || 0), 0);

    return {
      id: `summary-${date}`,
      user_id: userId || DEMO_USER_ID,
      date,
      calories_consumed: Math.round(calories_consumed),
      protein_consumed: Math.round(protein_consumed),
      carbohydrate_consumed: Math.round(carbohydrate_consumed),
      fat_consumed: Math.round(fat_consumed),
      calories_burned: Math.round(calories_burned),
      exercise_minutes: Math.round(exercise_minutes),
      ai_summary: null,
    };
  },

  async getRecommendations(userId?: string): Promise<AiRecommendation[]> {
    const state = getLocalState();
    return state.recommendations;
  },

  async addRecommendation(rec: Omit<AiRecommendation, 'id' | 'created_at'>): Promise<AiRecommendation> {
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

  getDemoUserId() {
    return DEMO_USER_ID;
  },

  async getWorkoutRoutines(userId?: string): Promise<WorkoutRoutine[]> {
    const state = getLocalState();
    return state.workoutRoutines || DEFAULT_ROUTINES;
  },

  async saveWorkoutRoutine(routine: WorkoutRoutine): Promise<WorkoutRoutine> {
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

  async deleteWorkoutRoutine(routineId: string): Promise<void> {
    const state = getLocalState();
    if (state.workoutRoutines) {
      state.workoutRoutines = state.workoutRoutines.filter((r) => r.id !== routineId);
      saveLocalState(state);
    }
  },
};
