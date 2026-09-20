/**
 * Nuvia Fitness Context Data Models
 * 
 * Centralized schema representing the user's complete fitness reality:
 * User Facts + User Preferences + Performance History + Recovery State.
 */

import { LoggedSet } from './routine';

export interface FitnessProfile {
  sex?: 'male' | 'female' | 'other';
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  fitness_level?: 'beginner_inconsistent' | 'beginner_consistent' | 'intermediate' | 'advanced';
  training_background?: string;
}

export interface FitnessGoal {
  primary_goal: string;
  objective: string;
  target_weight_kg?: number;
  goal_pace_kg?: number;
  physique_preference?: {
    desired_look?: string;
    user_estimated_bf_percent?: number; // User-estimated visual approximation (not medical diagnosis)
  };
}

export interface WeeklyScheduleDay {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  type: 'workout' | 'cardio' | 'rest' | 'optional_active';
  routine_id?: string;
  routine_title?: string;
  focus?: string;
  description?: string;
}

export interface TrainingConstraints {
  preferred_split?: string; // e.g. "Upper / Lower"
  workout_duration_minutes?: number; // e.g. 45-60
  environment?: 'home' | 'apartment_gym' | 'commercial_gym' | 'outdoors';
  available_equipment: string[]; // e.g. ['dumbbells', 'push_up_board', 'bodyweight']
  available_space?: string; // e.g. "Living room floor"
  cardio_habits?: {
    type: string;
    distance_km?: number;
    typical_days: string[];
    description?: string;
  };
}

export interface TrainingPreferences {
  effort_target?: string; // e.g. "1-3 RIR (challenging but sustainable)"
  progression_rule?: string; // e.g. "Double progression (10-15 reps; raise weight when all sets reach 15)"
  muscle_biases?: string[]; // e.g. ["Upper body feels easier than lower body"]
  preferred_exercises: string[]; // e.g. ["Goblet Squat", "Dumbbell Row"]
  disliked_exercises: string[]; // e.g. ["Bulgarian Split Squat"]
  custom_starting_weights?: Record<string, string>; // e.g. { "goblet_squat": "12-20 kg total", "bicep_curl": "6-8 kg each" }
}

export interface ExercisePerformanceRecord {
  exercise_name: string;
  catalog_id?: string;
  last_performed_at: string;
  last_weight_kg?: number;
  last_sets: number;
  last_reps: string;
  last_rep_array: number[];
  top_set_performance?: string;
  suggested_next_target?: string;
}

export interface RecoveryState {
  trained_in_last_48h: string[]; // e.g. ['Chest', 'Triceps']
  last_workout_date: string | null;
  consecutive_training_days: number;
  today_is_rest_day: boolean;
  scheduled_today: {
    has_routine: boolean;
    routine_id?: string;
    routine_title?: string;
    is_completed: boolean;
  };
}

export interface NuviaFitnessContext {
  profile: FitnessProfile;
  goal: FitnessGoal;
  constraints: TrainingConstraints;
  preferences: TrainingPreferences;
  weekly_schedule: WeeklyScheduleDay[];
  performance: {
    recent_exercises: ExercisePerformanceRecord[];
    total_workouts_completed: number;
  };
  recovery: RecoveryState;
  active_routines: {
    id: string;
    title: string;
    days: string[];
    focus: string;
    exercise_names: string[];
  }[];
}
