/**
 * Nuvia Adaptive Training Engine — Type Definitions
 *
 * Distinguishes:
 * 1. Routine Template (long-term template in workout_routines)
 * 2. Planned Session (date-specific expectation)
 * 3. Actual Session (execution in exercise_logs)
 * 4. User Intent (what user wants to do, evaluated before action)
 */

import { WorkoutRoutine } from './routine';
import { ExerciseLog } from './database';

export type TrainingDayState =
  | 'scheduled_workout'
  | 'workout_in_progress'
  | 'partial_workout'
  | 'completed_workout'
  | 'rest_day'
  | 'optional_activity'
  | 'unscheduled';

export type AdaptivePlanMode = 'ask_first' | 'auto_adjust';

export type ScheduleActionType =
  | 'move_workout'
  | 'cancel_workout'
  | 'add_activity'
  | 'rest_override';

export interface AdaptiveScheduleChange {
  id: string;
  user_id: string;
  date: string; // ISO 'YYYY-MM-DD'
  action: ScheduleActionType;
  routine_id?: string;
  routine_title?: string;
  original_date?: string; // If moved, original date (YYYY-MM-DD)
  target_date?: string;   // Destination date (YYYY-MM-DD)
  activity_name?: string; // e.g. "Outdoor Run", "Brisk Walk"
  activity_duration_minutes?: number;
  activity_distance_km?: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected' | 'undone';
  user_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export type NextTrainingAction =
  | {
      type: 'start_workout';
      routineId: string;
      routineTitle: string;
      focus: string;
      durationMinutes: number;
      exerciseCount: number;
      reason: string;
    }
  | {
      type: 'continue_workout';
      routineId: string;
      routineTitle: string;
      completedExercises: number;
      totalExercises: number;
      remainingExercises: number;
      percentage: number;
      reason: string;
    }
  | {
      type: 'recovery';
      reason: string;
      lightActivityAllowed: boolean;
      suggestedActivities: string[];
    }
  | {
      type: 'optional_activity';
      activityType: string;
      suggestedDurationMinutes: number;
      suggestedDistanceKm?: number;
      intensity: 'low' | 'moderate';
      reason: string;
    }
  | {
      type: 'reschedule';
      proposal: RescheduleProposal;
    };

export interface RescheduleOption {
  label: string;
  action: 'move' | 'keep' | 'skip';
  target_date?: string;
  description: string;
}

export interface RescheduleProposal {
  id: string;
  routine_id: string;
  routine_title: string;
  from_date: string; // YYYY-MM-DD
  suggested_date: string; // YYYY-MM-DD
  reason: string;
  recovery_analysis: string;
  conflict_warning?: string;
  options: RescheduleOption[];
}

export interface PlannedVsActualComparison {
  date: string; // YYYY-MM-DD
  dayName: string;
  planned: {
    type: 'workout' | 'cardio' | 'rest';
    routineId?: string;
    routineTitle?: string;
    description: string;
  };
  actual: {
    status: 'none' | 'partial' | 'completed' | 'alternative_activity' | 'rest_taken';
    description: string;
    durationMinutes: number;
    caloriesBurned: number;
    completedExercisesCount?: number;
    totalExercisesCount?: number;
    exerciseNames: string[];
  };
  difference: 'as_planned' | 'partial_completed' | 'missed' | 'substituted' | 'extra_done' | 'rest_as_planned';
  adaptationNote?: string;
}

export interface WeeklyDayPlan {
  date: string; // YYYY-MM-DD
  dayName: string; // 'Monday', 'Tuesday', ...
  dayShort: string; // 'Mon', 'Tue', ...
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  plannedType: 'workout' | 'cardio' | 'rest';
  routineTitle?: string;
  routineId?: string;
  isAdapted: boolean;
  adaptationAction?: ScheduleActionType;
  adaptationReason?: string;
  statusBadge: 'completed' | 'partial' | 'missed' | 'adapted' | 'planned' | 'rest';
  displayText: string;
}

export interface WeeklyTrainingReport {
  startDate: string;
  endDate: string;
  plannedWorkouts: number;
  completedWorkouts: number;
  partialWorkouts: number;
  extraActivities: number;
  recoveryDays: number;
  consistencyRate: string; // e.g. "3 / 4 planned sessions completed"
  totalMinutes: number;
  totalCalories: number;
  adaptationsSummary: string[];
}

export type UserIntentClassification =
  | 'LOG_ACTIVITY'
  | 'PLAN_CHANGE'
  | 'WORKOUT_MODIFICATION'
  | 'REST_REQUEST'
  | 'SCHEDULING_CONFLICT'
  | 'PREFERENCE'
  | 'GENERAL_QUESTION';

export interface UserIntentAnalysis {
  classification: UserIntentClassification;
  confidence: number;
  intentSummary: string;
  detectedActivity?: string;
  targetDate?: string;
  preferredAction?: 'replace' | 'add' | 'move' | 'rest';
  proposal?: RescheduleProposal;
  requiresConfirmation: boolean;
}
