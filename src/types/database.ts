export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';

export type UserGoal =
  | 'lose_weight'
  | 'maintain_weight'
  | 'gain_weight'
  | 'build_muscle';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type EntrySource = 'photo' | 'text' | 'manual' | 'routine';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type IntensityLevel = 'low' | 'moderate' | 'high';

export interface Profile {
  id: string; // references auth.users(id)
  name: string | null;
  date_of_birth: string | null;
  sex: 'male' | 'female' | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: UserGoal | null;
  target_weight_kg: number | null;
  dietary_preference: string | null;
  allergies: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface Goal {
  id: string;
  user_id: string;
  calorie_target: number;
  protein_target: number;
  carbohydrate_target: number;
  fat_target: number;
  exercise_minutes_target: number;
  target_weight_kg: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Meal {
  id: string;
  user_id: string;
  meal_type: MealType;
  meal_time: string;
  source: EntrySource;
  image_url: string | null;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: ConfidenceLevel | null;
  ai_analysis: any | null;
  created_at?: string;
  items?: MealItem[];
}

export interface MealItem {
  id: string;
  meal_id: string;
  name: string;
  estimated_quantity: number | null;
  estimated_unit: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: ConfidenceLevel | null;
}

export interface ExerciseLog {
  id: string;
  user_id: string;
  exercise_type: string;
  duration_minutes: number;
  intensity: IntensityLevel | null;
  distance_km: number | null;
  calories_burned: number | null;
  source: EntrySource;
  description: string | null;
  confidence: ConfidenceLevel | null;
  ai_analysis: any | null;
  created_at?: string;
}

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  calories_consumed: number;
  protein_consumed: number;
  carbohydrate_consumed: number;
  fat_consumed: number;
  calories_burned: number;
  exercise_minutes: number;
  ai_summary: string | null;
}

export interface AiRecommendation {
  id: string;
  user_id: string;
  date: string;
  recommendation: string;
  priority: number;
  created_at?: string;
}
