/**
 * Nuvia Natural Language Logging Types
 *
 * Defines contracts for intent classification, user food & activity memory,
 * routine awareness, and structured parse results.
 */

export type NaturalLanguageIntent =
  | 'meal'
  | 'activity'
  | 'workout'
  | 'partial_workout'
  | 'training_intent'
  | 'question'
  | 'other';

export interface FrequentMealSummary {
  name: string;
  count: number;
  recent_average_calories: number;
  recent_average_protein_g: number;
  recent_average_carbs_g?: number;
  recent_average_fat_g?: number;
  common_meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  last_logged_at?: string;
  typical_portions?: string;
}

export interface RecentMealSummary {
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein_g: number;
  logged_at: string;
}

export interface RecentActivitySummary {
  name: string;
  duration_minutes: number;
  distance_km?: number | null;
  calories_burned: number;
  intensity?: 'low' | 'moderate' | 'high';
  logged_at: string;
}

export interface HabitualCardioSummary {
  type: string;
  distance_km?: number;
  typical_days: string[];
  description?: string;
}

export interface ScheduledRoutineSummary {
  id: string;
  title: string;
  focus?: string;
  exercises: string[];
  is_completed: boolean;
  total_exercises: number;
}

export interface NaturalLanguageLoggingContext {
  today_date: string;
  day_of_week: string;
  today_summary?: {
    calories_consumed: number;
    protein_consumed: number;
    calories_burned: number;
    exercise_minutes: number;
  };
  targets?: {
    calorie_target: number;
    protein_target: number;
  };
  today_routine?: ScheduledRoutineSummary | null;
  upcoming_routine?: ScheduledRoutineSummary | null;
  frequent_meals: FrequentMealSummary[];
  recent_meals: RecentMealSummary[];
  recent_activities: RecentActivitySummary[];
  habitual_cardio?: HabitualCardioSummary | null;
  user_weight_kg?: number;
  goal?: string;
}

export interface ContextualSuggestion {
  label: string;
  text: string;
  badge?: string;
  type: 'meal' | 'activity' | 'workout';
}

export interface NaturalLanguageParseResult {
  intent: NaturalLanguageIntent;
  confidence: 'high' | 'medium' | 'low';
  requires_clarification: boolean;
  clarification_prompt?: string;
  context_match?: {
    matched_history: boolean;
    matched_name?: string;
    confidence: number;
    badge_label?: string; // e.g. "Using your recent meals", "Matched with your usual Saturday walk", "Matched today's scheduled workout"
    note?: string; // e.g. "Your recent entries were around 600–700 kcal."
  };
  meal_data?: {
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    meal_name: string;
    foods: {
      name: string;
      estimated_quantity: number;
      unit: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      confidence?: 'high' | 'medium' | 'low';
    }[];
    total: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    assumptions?: string[];
    notes?: string;
  };
  activity_data?: {
    exercise_type: string;
    duration_minutes: number;
    intensity: 'low' | 'moderate' | 'high';
    distance_km: number | null;
    calories_burned: number;
    confidence?: 'high' | 'medium' | 'low';
    ai_tip?: string;
  };
  workout_data?: {
    routine_id?: string;
    routine_title: string;
    is_partial: boolean;
    completion_percentage?: number;
    completed_exercise_count?: number;
    total_exercise_count?: number;
    stopped_after?: string;
    duration_minutes?: number;
    estimated_calories_burned?: number;
    notes?: string;
  };
  training_intent_data?: {
    proposal?: any;
    intent_summary?: string;
    reply?: string;
  };
  question_data?: {
    reply: string;
  };
}
