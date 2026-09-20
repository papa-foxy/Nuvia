/**
 * Nuvia Adaptive Training Engine
 *
 * Deterministic orchestration layer operating over:
 * - Routine Templates (`workout_routines`)
 * - Execution History (`exercise_logs`)
 * - Schedule Adaptations (`AdaptiveScheduleChange`)
 * - 48-Hour Muscle Recovery State
 *
 * Zero external LLM dependency for state calculation:
 * Computes deterministic TrainingDayState, PlannedVsActual,
 * Missed Workout detection, and Next Training Action.
 */

import type { WorkoutRoutine } from '../types/routine';
import type { ExerciseLog } from '../types/database';
import type {
  TrainingDayState,
  NextTrainingAction,
  RescheduleProposal,
  PlannedVsActualComparison,
  WeeklyDayPlan,
  WeeklyTrainingReport,
  AdaptiveScheduleChange,
  UserIntentAnalysis,
  UserIntentClassification,
} from '../types/adaptive-training';

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanActivityTitle(title?: string | null): { title: string } {
  if (!title) return { title: 'Workout' };
  return { title: title.replace(/\s*\(.*?\)\s*/g, '').trim() || title };
}

export class AdaptiveTrainingEngine {
  /**
   * Evaluates the deterministic training state for a specific day.
   */
  static determineDailyTrainingState(params: {
    targetDate: string; // YYYY-MM-DD
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
    activeSession?: {
      routineId?: string;
      routineTitle?: string;
      completedSetsCount?: number;
      totalSetsCount?: number;
      status?: string;
    } | null;
    cardioHabitDays?: string[];
  }): TrainingDayState {
    const { targetDate, routines, logs, adaptations = [], activeSession, cardioHabitDays = [] } = params;

    const targetDateObj = new Date(targetDate + 'T12:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
    const targetDayName = dayNames[targetDateObj.getDay()];

    const todayStr = getLocalDateString(new Date());
    const isToday = targetDate === todayStr;

    // 1. Check in-progress session (if target is today and an active session exists)
    if (isToday && activeSession && activeSession.status === 'active') {
      return 'workout_in_progress';
    }

    // 2. Check logs recorded on this target date
    const dayLogs = logs.filter((l) => (l.created_at || '').startsWith(targetDate));
    const routineLog = dayLogs.find((l) => l.source === 'routine');

    if (routineLog) {
      const executed = routineLog.ai_analysis?.executed_count;
      const total = routineLog.ai_analysis?.total_exercises;
      if (typeof executed === 'number' && typeof total === 'number' && total > 0 && executed < total) {
        return 'partial_workout';
      }
      return 'completed_workout';
    }

    // Check if other workouts/exercises were logged
    if (dayLogs.length > 0) {
      return 'completed_workout';
    }

    // 3. Check date-specific schedule adaptations for this date
    const dayAdaptations = adaptations.filter(
      (a) => a.date === targetDate && (a.status === 'accepted' || a.status === 'pending')
    );

    for (const adapt of dayAdaptations) {
      if (adapt.action === 'rest_override' || adapt.action === 'cancel_workout') {
        return 'rest_day';
      }
      if (adapt.action === 'add_activity') {
        return 'optional_activity';
      }
      if (adapt.action === 'move_workout') {
        // If moved TO this date
        if (adapt.target_date === targetDate) {
          return 'scheduled_workout';
        }
        // If moved AWAY from this date
        if (adapt.original_date === targetDate) {
          return 'rest_day';
        }
      }
    }

    // Also check if any adaptation moved a workout away from this date
    const movedAway = adaptations.some(
      (a) =>
        a.original_date === targetDate &&
        a.action === 'move_workout' &&
        (a.status === 'accepted' || a.status === 'pending')
    );
    if (movedAway) {
      return 'rest_day';
    }

    // 4. Check routine template schedule
    const isScheduledByTemplate = routines.some(
      (r) => r.days && r.days.some((d) => d.toLowerCase() === targetDayName.toLowerCase())
    );

    if (isScheduledByTemplate) {
      return 'scheduled_workout';
    }

    // 5. Check cardio habit days
    if (cardioHabitDays.some((d) => d.toLowerCase() === targetDayName.toLowerCase())) {
      return 'optional_activity';
    }

    return 'rest_day';
  }

  /**
   * Compares what was planned vs what actually happened on a given date.
   */
  static comparePlannedVsActual(params: {
    date: string; // YYYY-MM-DD
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
    cardioHabitDays?: string[];
  }): PlannedVsActualComparison {
    const { date, routines, logs, adaptations = [], cardioHabitDays = [] } = params;

    const dateObj = new Date(date + 'T12:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
    const dayName = dayNames[dateObj.getDay()];

    const todayStr = getLocalDateString(new Date());
    const isPast = date < todayStr;
    const isToday = date === todayStr;

    // Check adaptations
    const activeAdaptation = adaptations.find(
      (a) => (a.date === date || a.target_date === date) && (a.status === 'accepted' || a.status === 'pending')
    );

    // Determine planned
    let plannedType: 'workout' | 'cardio' | 'rest' = 'rest';
    let plannedRoutine: WorkoutRoutine | undefined;
    let plannedDescription = 'Rest & recovery';

    if (activeAdaptation && activeAdaptation.action === 'move_workout' && activeAdaptation.target_date === date) {
      plannedType = 'workout';
      plannedRoutine = routines.find((r) => r.id === activeAdaptation.routine_id);
      plannedDescription = `${plannedRoutine ? cleanActivityTitle(plannedRoutine.title).title : 'Workout'} (Adapted)`;
    } else if (activeAdaptation && activeAdaptation.action === 'rest_override') {
      plannedType = 'rest';
      plannedDescription = 'Planned Rest (Adapted)';
    } else {
      plannedRoutine = routines.find(
        (r) => r.days && r.days.some((d) => d.toLowerCase() === dayName.toLowerCase())
      );
      if (plannedRoutine) {
        plannedType = 'workout';
        plannedDescription = cleanActivityTitle(plannedRoutine.title).title;
      } else if (cardioHabitDays.some((d) => d.toLowerCase() === dayName.toLowerCase())) {
        plannedType = 'cardio';
        plannedDescription = 'Scheduled Cardio / Walk';
      }
    }

    // Inspect actual logs
    const dayLogs = logs.filter((l) => (l.created_at || '').startsWith(date));
    const totalDuration = dayLogs.reduce((acc, l) => acc + (Number(l.duration_minutes) || 0), 0);
    const totalCalories = dayLogs.reduce((acc, l) => acc + (Number(l.calories_burned) || 0), 0);
    const exerciseNames = dayLogs.map((l) => cleanActivityTitle(l.exercise_type).title);

    const routineLog = dayLogs.find((l) => l.source === 'routine');

    let actualStatus: 'none' | 'partial' | 'completed' | 'alternative_activity' | 'rest_taken' = 'none';
    let difference: PlannedVsActualComparison['difference'] = 'rest_as_planned';
    let completedExercisesCount: number | undefined;
    let totalExercisesCount: number | undefined;

    if (routineLog) {
      const executed = routineLog.ai_analysis?.executed_count;
      const total = routineLog.ai_analysis?.total_exercises;
      completedExercisesCount = executed;
      totalExercisesCount = total;

      if (typeof executed === 'number' && typeof total === 'number' && total > 0 && executed < total) {
        actualStatus = 'partial';
        difference = 'partial_completed';
      } else {
        actualStatus = 'completed';
        difference = 'as_planned';
      }
    } else if (dayLogs.length > 0) {
      if (plannedType === 'workout') {
        actualStatus = 'alternative_activity';
        difference = 'substituted';
      } else {
        actualStatus = 'completed';
        difference = 'extra_done';
      }
    } else {
      if (plannedType === 'workout') {
        actualStatus = 'none';
        difference = isPast ? 'missed' : 'as_planned';
      } else {
        actualStatus = 'rest_taken';
        difference = 'rest_as_planned';
      }
    }

    return {
      date,
      dayName,
      planned: {
        type: plannedType,
        routineId: plannedRoutine?.id,
        routineTitle: plannedRoutine ? cleanActivityTitle(plannedRoutine.title).title : undefined,
        description: plannedDescription,
      },
      actual: {
        status: actualStatus,
        description: dayLogs.length > 0 ? exerciseNames.join(', ') : 'No activity logged',
        durationMinutes: totalDuration,
        caloriesBurned: totalCalories,
        completedExercisesCount,
        totalExercisesCount,
        exerciseNames,
      },
      difference,
      adaptationNote: activeAdaptation?.reason,
    };
  }

  /**
   * Detects missed workouts from recent days that have not been rescheduled yet.
   */
  static detectMissedWorkouts(params: {
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
    trainedMusclesLast48h?: string[];
  }): RescheduleProposal[] {
    const { routines, logs, adaptations = [], trainedMusclesLast48h = [] } = params;
    const proposals: RescheduleProposal[] = [];

    const now = new Date();
    const todayStr = getLocalDateString(now);

    // Scan previous 3 days for missed sessions
    for (let i = 1; i <= 3; i++) {
      const pastDate = new Date(now);
      pastDate.setDate(now.getDate() - i);
      const pastDateStr = getLocalDateString(pastDate);

      const comparison = this.comparePlannedVsActual({
        date: pastDateStr,
        routines,
        logs,
        adaptations,
      });

      if (comparison.difference === 'missed' && comparison.planned.routineId) {
        // Check if an adaptation already exists for this missed routine on that date
        const existingAdaptation = adaptations.find(
          (a) =>
            a.original_date === pastDateStr &&
            a.routine_id === comparison.planned.routineId &&
            a.status !== 'undone' &&
            a.status !== 'rejected'
        );

        if (!existingAdaptation) {
          const routine = routines.find((r) => r.id === comparison.planned.routineId);
          if (!routine) continue;

          // Find candidate reschedule target date
          const candidate = this.findOptimalRescheduleDate({
            routine,
            fromDate: pastDateStr,
            routines,
            logs,
            adaptations,
            trainedMusclesLast48h,
          });

          proposals.push({
            id: `proposal-${routine.id}-${pastDateStr}`,
            routine_id: routine.id,
            routine_title: cleanActivityTitle(routine.title).title,
            from_date: pastDateStr,
            suggested_date: candidate.targetDate,
            reason: `You missed ${comparison.dayName}'s ${cleanActivityTitle(routine.title).title} session.`,
            recovery_analysis: candidate.recoveryNote,
            conflict_warning: candidate.warning,
            options: [
              {
                label: `Move to ${candidate.targetDayName}`,
                action: 'move',
                target_date: candidate.targetDate,
                description: `Reschedule ${cleanActivityTitle(routine.title).title} for ${candidate.targetDayName} (${candidate.targetDate})`,
              },
              {
                label: 'Keep current plan',
                action: 'keep',
                description: 'Leave the existing weekly plan intact without making up this session.',
              },
              {
                label: 'Skip this session',
                action: 'skip',
                description: 'Mark this session as skipped and continue with the next planned workout.',
              },
            ],
          });
        }
      }
    }

    return proposals;
  }

  /**
   * Helper to find an optimal date for a missed workout, respecting rest and muscle fatigue.
   */
  private static findOptimalRescheduleDate(params: {
    routine: WorkoutRoutine;
    fromDate: string;
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations: AdaptiveScheduleChange[];
    trainedMusclesLast48h: string[];
  }): { targetDate: string; targetDayName: string; recoveryNote: string; warning?: string } {
    const { routine, fromDate, routines, logs, adaptations, trainedMusclesLast48h } = params;

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

    // Scan next 4 days
    for (let offset = 0; offset <= 4; offset++) {
      const candidateDate = new Date(now);
      candidateDate.setDate(now.getDate() + offset);
      const candidateStr = getLocalDateString(candidateDate);
      const candidateDayName = dayNames[candidateDate.getDay()];

      // Check state of candidate date
      const candidateState = this.determineDailyTrainingState({
        targetDate: candidateStr,
        routines,
        logs,
        adaptations,
      });

      // If candidate is a rest day, it is a prime target for non-disruptive placement
      if (candidateState === 'rest_day') {
        const routineMuscles = (routine.exercises || []).map((e) => e.target_muscle.toLowerCase());
        const hasMuscleConflict = routineMuscles.some((m) =>
          trainedMusclesLast48h.some((tm) => tm.toLowerCase().includes(m) || m.includes(tm.toLowerCase()))
        );

        let recoveryNote = 'Planned rest day with sufficient recovery window.';
        let warning: string | undefined;

        if (hasMuscleConflict && offset <= 1) {
          recoveryNote = 'Target muscles were recently fatigued; keep load moderate.';
          warning = 'Some muscle fatigue present from recent sessions.';
        }

        return {
          targetDate: candidateStr,
          targetDayName: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : candidateDayName,
          recoveryNote,
          warning,
        };
      }
    }

    // Default to tomorrow if all days are booked
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);
    return {
      targetDate: tomorrowStr,
      targetDayName: 'Tomorrow',
      recoveryNote: 'Added on tomorrow with recommended volume management.',
      warning: 'Upcoming days already have scheduled sessions; ensure adequate rest.',
    };
  }

  /**
   * Primary Recommendation Engine: "What should I do right now?"
   */
  static calculateNextTrainingAction(params: {
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
    activeSession?: {
      routineId?: string;
      routineTitle?: string;
      completedSetsCount?: number;
      totalSetsCount?: number;
      status?: string;
    } | null;
    trainedMusclesLast48h?: string[];
    cardioHabitDays?: string[];
  }): NextTrainingAction {
    const {
      routines,
      logs,
      adaptations = [],
      activeSession,
      trainedMusclesLast48h = [],
      cardioHabitDays = [],
    } = params;

    const todayStr = getLocalDateString(new Date());

    // 1. Check for workout session in progress right now (highest immediate priority)
    if (activeSession && activeSession.status === 'active' && activeSession.routineId) {
      const routine = routines.find((r) => r.id === activeSession.routineId);
      const completed = activeSession.completedSetsCount || 0;
      const total = activeSession.totalSetsCount || 1;
      const pct = Math.min(100, Math.round((completed / total) * 100));

      return {
        type: 'continue_workout',
        routineId: activeSession.routineId,
        routineTitle: activeSession.routineTitle || routine?.title || 'Active Workout',
        completedExercises: Math.floor(completed / 3),
        totalExercises: routine?.exercises.length || 6,
        remainingExercises: Math.max(0, (routine?.exercises.length || 6) - Math.floor(completed / 3)),
        percentage: pct,
        reason: 'You have a workout session currently in progress.',
      };
    }

    // 2. Check for missed workout proposals requiring user review
    const missedProposals = this.detectMissedWorkouts({
      routines,
      logs,
      adaptations,
      trainedMusclesLast48h,
    });

    if (missedProposals.length > 0) {
      return {
        type: 'reschedule',
        proposal: missedProposals[0],
      };
    }

    // 3. Check today's state
    const todayState = this.determineDailyTrainingState({
      targetDate: todayStr,
      routines,
      logs,
      adaptations,
      cardioHabitDays,
    });

    // A) Partial workout earlier today
    if (todayState === 'partial_workout') {
      const routineLog = logs.find(
        (l) => (l.created_at || '').startsWith(todayStr) && l.source === 'routine'
      );
      const executed = routineLog?.ai_analysis?.executed_count || 3;
      const total = routineLog?.ai_analysis?.total_exercises || 6;
      const pct = Math.round((executed / total) * 100);

      return {
        type: 'continue_workout',
        routineId: routineLog?.ai_analysis?.routine_id || '',
        routineTitle: routineLog?.exercise_type || 'Today’s Workout',
        completedExercises: executed,
        totalExercises: total,
        remainingExercises: Math.max(0, total - executed),
        percentage: pct,
        reason: `You completed ${executed} of ${total} exercises (${pct}%). You can resume now or save remaining sets.`,
      };
    }

    // B) Completed workout today
    if (todayState === 'completed_workout') {
      return {
        type: 'recovery',
        reason: 'Workout completed for today! Prioritize post-workout nutrition, protein, and physical recovery.',
        lightActivityAllowed: true,
        suggestedActivities: ['Light 15-min walk', 'Gentle stretching', 'Hydration & protein target'],
      };
    }

    // C) Scheduled workout today
    if (todayState === 'scheduled_workout') {
      // Find today's routine (check adaptations first, then day template)
      const targetAdaptation = adaptations.find(
        (a) => a.target_date === todayStr && a.action === 'move_workout' && a.status === 'accepted'
      );
      let targetRoutine: WorkoutRoutine | undefined;

      if (targetAdaptation) {
        targetRoutine = routines.find((r) => r.id === targetAdaptation.routine_id);
      }
      if (!targetRoutine) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
        const currentDayName = dayNames[new Date().getDay()];
        targetRoutine = routines.find(
          (r) => r.days && r.days.some((d) => d.toLowerCase() === currentDayName.toLowerCase())
        );
      }

      if (targetRoutine) {
        const duration = Math.max(30, (targetRoutine.exercises?.length || 5) * 6);
        return {
          type: 'start_workout',
          routineId: targetRoutine.id,
          routineTitle: cleanActivityTitle(targetRoutine.title).title,
          focus: targetRoutine.focus || 'Strength & Hypertrophy',
          durationMinutes: duration,
          exerciseCount: targetRoutine.exercises?.length || 6,
          reason: 'Scheduled for today based on your weekly training plan.',
        };
      }
    }

    // D) Optional activity / cardio
    if (todayState === 'optional_activity') {
      return {
        type: 'optional_activity',
        activityType: 'Brisk Walk / Outdoor Cardio',
        suggestedDurationMinutes: 35,
        suggestedDistanceKm: 4.0,
        intensity: 'low',
        reason: 'Great day for active recovery or an easy walk without heavy muscular fatigue.',
      };
    }

    // E) Rest day
    return {
      type: 'recovery',
      reason: 'Scheduled rest day. Recovery is when muscle protein synthesis and nervous system replenishment occur.',
      lightActivityAllowed: true,
      suggestedActivities: ['Light walk', 'Mobility & foam rolling', 'Focus on daily steps'],
    };
  }

  /**
   * Generates a 7-day Monday–Sunday schedule representation with adaptation badges.
   */
  static generateWeeklyAdaptationView(params: {
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
    cardioHabitDays?: string[];
    startDate?: Date;
  }): WeeklyDayPlan[] {
    const { routines, logs, adaptations = [], cardioHabitDays = [], startDate } = params;

    const now = startDate ? new Date(startDate) : new Date();
    const todayStr = getLocalDateString(new Date());

    // Determine current week's Monday
    const currentDay = now.getDay(); // 0 is Sun, 1 is Mon
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + distanceToMon);

    const daysList: WeeklyDayPlan[] = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      const dStr = getLocalDateString(d);
      const isToday = dStr === todayStr;
      const isPast = dStr < todayStr;
      const isFuture = dStr > todayStr;

      const comp = this.comparePlannedVsActual({
        date: dStr,
        routines,
        logs,
        adaptations,
        cardioHabitDays,
      });

      const dayAdaptation = adaptations.find(
        (a) => (a.date === dStr || a.target_date === dStr) && (a.status === 'accepted' || a.status === 'pending')
      );

      let statusBadge: WeeklyDayPlan['statusBadge'] = 'rest';
      let displayText = comp.planned.description;

      if (comp.actual.status === 'completed') {
        statusBadge = 'completed';
        displayText = comp.actual.description || comp.planned.description;
      } else if (comp.actual.status === 'partial') {
        statusBadge = 'partial';
        displayText = `${comp.actual.completedExercisesCount}/${comp.actual.totalExercisesCount} done`;
      } else if (comp.difference === 'missed') {
        statusBadge = 'missed';
        displayText = 'Missed';
      } else if (dayAdaptation) {
        statusBadge = 'adapted';
        displayText = `${comp.planned.description} (Adapted)`;
      } else if (comp.planned.type === 'workout') {
        statusBadge = 'planned';
        displayText = comp.planned.description;
      } else {
        statusBadge = 'rest';
        displayText = 'Rest';
      }

      daysList.push({
        date: dStr,
        dayName: dayNames[i],
        dayShort: shortNames[i],
        isToday,
        isPast,
        isFuture,
        plannedType: comp.planned.type,
        routineTitle: comp.planned.routineTitle,
        routineId: comp.planned.routineId,
        isAdapted: Boolean(dayAdaptation),
        adaptationAction: dayAdaptation?.action,
        adaptationReason: dayAdaptation?.reason,
        statusBadge,
        displayText,
      });
    }

    return daysList;
  }

  /**
   * Generates a concise weekly training report.
   */
  static generateWeeklyReport(params: {
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
    cardioHabitDays?: string[];
    startDate?: Date;
  }): WeeklyTrainingReport {
    const weeklyDays = this.generateWeeklyAdaptationView(params);

    const plannedWorkouts = weeklyDays.filter((d) => d.plannedType === 'workout').length;
    const completedWorkouts = weeklyDays.filter((d) => d.statusBadge === 'completed').length;
    const partialWorkouts = weeklyDays.filter((d) => d.statusBadge === 'partial').length;
    const recoveryDays = weeklyDays.filter((d) => d.statusBadge === 'rest').length;
    const extraActivities = weeklyDays.filter(
      (d) => d.plannedType === 'rest' && d.statusBadge === 'completed'
    ).length;

    const weekDates = new Set(weeklyDays.map((d) => d.date));
    const weekLogs = params.logs.filter((l) => weekDates.has((l.created_at || '').substring(0, 10)));

    const totalMinutes = weekLogs.reduce((acc, l) => acc + (Number(l.duration_minutes) || 0), 0);
    const totalCalories = weekLogs.reduce((acc, l) => acc + (Number(l.calories_burned) || 0), 0);

    const adaptationsSummary = (params.adaptations || [])
      .filter((a) => a.status === 'accepted')
      .map((a) => a.reason);

    return {
      startDate: weeklyDays[0].date,
      endDate: weeklyDays[6].date,
      plannedWorkouts,
      completedWorkouts,
      partialWorkouts,
      extraActivities,
      recoveryDays,
      consistencyRate: `${completedWorkouts} / ${plannedWorkouts} planned sessions completed`,
      totalMinutes,
      totalCalories,
      adaptationsSummary,
    };
  }

  /**
   * Deterministic user intent analysis for natural language inputs:
   * Classifies statement and proposes structured adaptations without mutating data.
   */
  static evaluateUserIntent(params: {
    message: string;
    todayRoutine?: WorkoutRoutine | null;
    recentMuscles: string[];
    routines: WorkoutRoutine[];
    logs: ExerciseLog[];
    adaptations?: AdaptiveScheduleChange[];
  }): UserIntentAnalysis {
    const { message, todayRoutine, recentMuscles, routines } = params;
    const text = message.toLowerCase().trim();

    // 1. Running intent ("I want to run today", "Feel like running", "Can I jog")
    const isRunIntent =
      text.includes('run') ||
      text.includes('running') ||
      text.includes('jog') ||
      text.includes('jogging');

    if (isRunIntent) {
      const todayStr = getLocalDateString(new Date());
      const hasLowerBodyFatigue = recentMuscles.some((m) =>
        ['legs', 'quads', 'hamstrings', 'glutes', 'calves', 'lower body'].some((lm) =>
          m.toLowerCase().includes(lm)
        )
      );

      const isWorkoutScheduledToday = Boolean(todayRoutine);

      if (isWorkoutScheduledToday) {
        return {
          classification: 'PLAN_CHANGE',
          confidence: 0.95,
          intentSummary: 'User wants to run on a scheduled workout day',
          detectedActivity: 'Running',
          preferredAction: 'replace',
          proposal: {
            id: `intent-run-${Date.now()}`,
            routine_id: todayRoutine!.id,
            routine_title: cleanActivityTitle(todayRoutine!.title).title,
            from_date: todayStr,
            suggested_date: todayStr,
            reason: `You have ${cleanActivityTitle(todayRoutine!.title).title} scheduled today.`,
            recovery_analysis: hasLowerBodyFatigue
              ? 'Leg muscles were recently trained. Keep the run light/easy (Zone 2) to preserve muscular recovery.'
              : 'Recent recovery allows moderate running volume.',
            options: [
              {
                label: 'Replace workout with run',
                action: 'move',
                description: `Replace today’s ${cleanActivityTitle(todayRoutine!.title).title} with a run.`,
              },
              {
                label: 'Easy run + keep workout',
                action: 'keep',
                description: 'Do a short, easy run and still complete your scheduled workout.',
              },
              {
                label: 'Move workout to tomorrow',
                action: 'move',
                description: `Reschedule ${cleanActivityTitle(todayRoutine!.title).title} to tomorrow and run today.`,
              },
            ],
          },
          requiresConfirmation: true,
        };
      } else {
        return {
          classification: 'LOG_ACTIVITY',
          confidence: 0.95,
          intentSummary: 'User wants to run on a planned rest day',
          detectedActivity: 'Running',
          preferredAction: 'add',
          proposal: {
            id: `intent-run-rest-${Date.now()}`,
            routine_id: '',
            routine_title: 'Outdoor Run',
            from_date: todayStr,
            suggested_date: todayStr,
            reason: 'Today is currently planned as a rest day.',
            recovery_analysis: hasLowerBodyFatigue
              ? 'Recent lower body training detected. An easy 20-30 min run fits well.'
              : 'Muscles are well recovered for a run.',
            options: [
              {
                label: 'Log Run Today',
                action: 'keep',
                description: 'Add an easy run to today’s activity.',
              },
              {
                label: 'Keep Rest Day',
                action: 'skip',
                description: 'Stay with full recovery for optimal muscle growth.',
              },
            ],
          },
          requiresConfirmation: true,
        };
      }
    }

    // 2. Rest intent ("I want to rest today", "I feel sore", "Need a break")
    const isRestIntent =
      text.includes('rest today') ||
      text.includes('take a rest') ||
      text.includes('feel sore') ||
      text.includes('too tired') ||
      text.includes('skip today');

    if (isRestIntent) {
      const todayStr = getLocalDateString(new Date());
      return {
        classification: 'REST_REQUEST',
        confidence: 0.92,
        intentSummary: 'User requested a rest day today',
        preferredAction: 'rest',
        proposal: {
          id: `intent-rest-${Date.now()}`,
          routine_id: todayRoutine?.id || '',
          routine_title: todayRoutine ? cleanActivityTitle(todayRoutine.title).title : 'Workout',
          from_date: todayStr,
          suggested_date: todayStr,
          reason: 'Rest requested by user.',
          recovery_analysis: 'Active rest and extra sleep support nervous system recovery.',
          options: [
            {
              label: 'Take Rest Day',
              action: 'move',
              description: todayRoutine
                ? `Postpone ${cleanActivityTitle(todayRoutine.title).title} and rest today.`
                : 'Enjoy your recovery day.',
            },
            {
              label: 'Keep Planned Schedule',
              action: 'keep',
              description: 'Continue with today’s session as planned.',
            },
          ],
        },
        requiresConfirmation: true,
      };
    }

    // Default: General question
    return {
      classification: 'GENERAL_QUESTION',
      confidence: 0.8,
      intentSummary: 'General coaching inquiry',
      requiresConfirmation: false,
    };
  }
}
