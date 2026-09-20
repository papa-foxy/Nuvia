/**
 * Nuvia Fitness Context Data Models
 * 
 * Centralized schema representing the user's complete fitness reality:
 * User Facts + User Preferences + Performance History + Recovery State.
 */

import { LoggedSet } from './routine';
import {
  TrainingDayState,
  NextTrainingAction,
  RescheduleProposal,
  WeeklyDayPlan,
  WeeklyTrainingReport,
  AdaptivePlanMode,
} from './adaptive-training';

export interface PhysiqueVisualSelection {
  visual_category: string;
  source: 'user_selected';
}

export interface FitnessProfile {
  sex?: 'male' | 'female' | 'other';
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  fitness_level?: 'beginner_inconsistent' | 'beginner_consistent' | 'intermediate' | 'advanced';
  experience_level?: 'completely_new' | 'beginner' | 'beginner_trained_before' | 'intermediate' | 'advanced' | 'returning_long_break';
  consistency_level?: 'very_consistent' | 'mostly_consistent' | 'on_and_off' | 'frequent_breaks' | 'getting_started';
  training_background?: string;
  current_physique?: PhysiqueVisualSelection;
}

export interface FitnessGoal {
  primary_goal: string;
  objective: string;
  target_weight_kg?: number;
  goal_pace_kg?: number;
  desired_physique?: PhysiqueVisualSelection;
  physique_preference?: {
    current_physique?: 'lean' | 'average' | 'soft_low_muscle' | 'higher_body_fat' | 'muscular_some_fat' | 'not_sure' | PhysiqueVisualSelection;
    current_physique_label?: string;
    priority_areas?: string[];
    desired_physique?: 'lean' | 'athletic' | 'lean_muscular' | 'muscular' | 'strong_powerful' | 'general_fitness' | 'custom' | PhysiqueVisualSelection;
    desired_physique_custom?: string;
    desired_look?: string;
    user_estimated_target_bf_percent?: number; // Target reference only, never used for calorie calculations
    user_estimated_bf_percent?: number; // Legacy alias
    physique_photo_url?: string; // Optional client-side visual reference
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
  preferred_split?: string; // e.g. "Upper / Lower", "Push / Pull / Legs", "Full body", "Cardio + strength"
  workout_duration_minutes?: number; // e.g. 30, 45, 60
  environment?: 'home' | 'gym' | 'both' | 'outdoors' | 'apartment_gym' | 'commercial_gym';
  available_equipment: string[]; // e.g. ['dumbbells', 'push_up_board', 'bodyweight', 'resistance_bands', 'pull_up_bar', 'bench', 'barbell', 'cable_machine', 'machines']
  available_space?: string;
  training_time_of_day?: 'morning' | 'afternoon' | 'evening' | 'varies';
  adherence_obstacles?: string[]; // e.g. ['lack_of_time', 'motivation', 'work_schedule', 'workout_too_hard', 'lose_track', 'boredom']
  cardio_habits?: {
    type: string;
    distance_km?: number;
    typical_days: string[];
    description?: string;
  };
}

export interface TrainingPreferences {
  effort_target?: string; // e.g. "Challenging but manageable (1-3 RIR)"
  target_rir?: string; // e.g. "1-3"
  progression_preference?: 'reps_first_then_weight' | 'increase_weight_frequently' | 'gradual_stable' | 'let_nuvia_decide';
  progression_rule?: string;
  muscle_biases?: string[];
  easy_hard_areas?: string[]; // e.g. ["Upper body feels easier", "Core feels difficult"]
  preferred_exercises: string[]; // e.g. ["Goblet Squat", "Dumbbell Row"]
  disliked_exercises: string[]; // e.g. ["Bulgarian Split Squat"]
  custom_starting_weights?: Record<string, string>;
  adaptive_plan_mode?: AdaptivePlanMode; // 'ask_first' (default) | 'auto_adjust'
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
  trained_in_last_48h: string[];
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
  synthesized_strategy?: string[];
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
  adaptive?: {
    today_state: TrainingDayState;
    next_action: NextTrainingAction;
    pending_proposals: RescheduleProposal[];
    weekly_view: WeeklyDayPlan[];
    weekly_report?: WeeklyTrainingReport;
    auto_adjust_mode: AdaptivePlanMode;
  };
}
