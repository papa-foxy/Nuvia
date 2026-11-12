'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Flame,
  Clock,
  Dumbbell,
  Trash2,
  Award,
  Sparkles,
  ExternalLink,
  Minus,
  Plus,
  RotateCcw,
  Pencil,
  Copy,
  RefreshCw,
  Info,
  Calendar,
  Check,
  Weight,
  History,
  TrendingUp,
} from 'lucide-react';
import { WorkoutRoutine, RoutineExercise, LoggedSet, ExercisePerformance, RoutineWorkoutStats } from '@/types/routine';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { ExerciseReplaceModal } from './ExerciseReplaceModal';
import { calculateWorkoutCalories } from '@/lib/calorie-calculator';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { cleanActivityTitle } from '@/lib/activity-utils';
import {
  NuviaCache,
  todaySummaryKey,
  todayActivityKey,
  exerciseLogsKey,
} from '@/lib/nuvia-cache';

interface RoutineDetailViewProps {
  routine: WorkoutRoutine;
  onBack: () => void;
  onDeleteRoutine: (id: string) => void;
  onEditRoutine?: (routine: WorkoutRoutine) => void;
  onDuplicateRoutine?: (routineId: string) => void;
  onWorkoutFinished?: () => void;
  onNavigateHome?: () => void;
  initialMode?: 'overview' | 'workout';
}

type WorkoutStatus = 'idle' | 'active' | 'paused' | 'finished';

function parseTargetReps(repsStr: string): number {
  const match = repsStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 10;
}

export function RoutineDetailView({
  routine: initialRoutine,
  onBack,
  onDeleteRoutine,
  onEditRoutine,
  onDuplicateRoutine,
  onWorkoutFinished,
  onNavigateHome,
  initialMode = 'overview',
}: RoutineDetailViewProps) {
  const { user, profile, refreshProfileAndGoals } = useAuth();

  // Active routine (can be updated if exercises are replaced in session)
  const [currentRoutine, setCurrentRoutine] = useState<WorkoutRoutine>(initialRoutine);
  useEffect(() => {
    setCurrentRoutine(initialRoutine);
  }, [initialRoutine]);

  // View mode: 'overview' (Apple-inspired summary & stats) vs 'workout' (live session player)
  const [viewMode, setViewMode] = useState<'overview' | 'workout'>(initialMode);

  // Lifetime stats from actual previous logs
  const [stats, setStats] = useState<RoutineWorkoutStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Recovery awareness: muscles trained in last 48h
  const [recentMuscles, setRecentMuscles] = useState<string[]>([]);

  // Progressive overload history: exercise name -> last session string
  const [exerciseHistoryMap, setExerciseHistoryMap] = useState<Record<string, string>>({});
  // Last session's completed sets per exercise (by lower-cased name), shown beside each set row.
  const [previousSetsMap, setPreviousSetsMap] = useState<Record<string, LoggedSet[]>>({});

  // Active workout session state
  const [status, setStatus] = useState<WorkoutStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Set-by-set tracking state: exerciseId -> LoggedSet[]
  const [sessionSets, setSessionSets] = useState<Record<string, LoggedSet[]>>({});

  // Rest countdown timer state
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Duration in minutes
  const defaultEstMinutes = Math.max(10, currentRoutine.exercises.length * 3);
  const [durationMinutes, setDurationMinutes] = useState<number>(defaultEstMinutes);
  const [hasManuallyAdjusted, setHasManuallyAdjusted] = useState<boolean>(false);

  // Modals
  const [selectedVideoExercise, setSelectedVideoExercise] = useState<RoutineExercise | null>(null);
  const [replacingExercise, setReplacingExercise] = useState<RoutineExercise | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Stopwatch timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Guard against double-save (e.g. rapid taps on Finish)
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const ACTIVE_STORAGE_KEY = `nuvia_active_workout_${user?.id || 'demo'}`;

  // Initialize or restore active workout session
  useEffect(() => {
    let restored = false;
    try {
      const savedRaw = localStorage.getItem(ACTIVE_STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        const age = Date.now() - (saved.lastSavedAt || 0);
        const isFresh = age < 18 * 60 * 60 * 1000; // within 18h
        if (isFresh && saved.routineId === currentRoutine.id && saved.sessionSets) {
          setSessionSets(saved.sessionSets);
          if (typeof saved.durationMinutes === 'number') setDurationMinutes(saved.durationMinutes);
          if (typeof saved.hasManuallyAdjusted === 'boolean') setHasManuallyAdjusted(saved.hasManuallyAdjusted);

          const timePassed = Math.floor(age / 1000);
          if (saved.status === 'active') {
            // Add background time elapsed (capped at 1 hour to prevent runaway timer if left open)
            setElapsedSeconds((saved.elapsedSeconds || 0) + Math.min(Math.max(0, timePassed), 3600));
            setStatus('active');
            setViewMode('workout');
          } else if (saved.status === 'paused') {
            setElapsedSeconds(saved.elapsedSeconds || 0);
            setStatus('paused');
            setViewMode('workout');
          }
          restored = true;
        }
      }
    } catch (e) {
      console.warn('Could not restore active session from localStorage:', e);
    }

    if (!restored) {
      const initialSetsMap: Record<string, LoggedSet[]> = {};
      currentRoutine.exercises.forEach((ex) => {
        const targetReps = parseTargetReps(ex.reps);
        const setCount = Math.max(1, ex.sets || 3);
        initialSetsMap[ex.id] = Array.from({ length: setCount }, (_, i) => ({
          set_number: i + 1,
          reps: targetReps,
          weight_kg: ex.target_weight_kg || undefined,
          completed: false,
        }));
      });
      setSessionSets(initialSetsMap);
    }
  }, [currentRoutine.id, user?.id, ACTIVE_STORAGE_KEY]);

  // Continuous autosave of active workout state to localStorage
  useEffect(() => {
    if (status === 'active' || status === 'paused') {
      try {
        localStorage.setItem(
          ACTIVE_STORAGE_KEY,
          JSON.stringify({
            routineId: currentRoutine.id,
            routineTitle: currentRoutine.title,
            routine: currentRoutine,
            sessionSets,
            elapsedSeconds,
            durationMinutes,
            hasManuallyAdjusted,
            status,
            lastSavedAt: Date.now(),
          })
        );
      } catch (err) {
        console.warn('Failed to autosave active workout:', err);
      }
    }
  }, [status, sessionSets, elapsedSeconds, durationMinutes, hasManuallyAdjusted, currentRoutine, ACTIVE_STORAGE_KEY]);

  // Flush active workout state on visibilitychange (tab switch) or beforeunload (window close)
  useEffect(() => {
    const handleFlush = () => {
      if (status === 'active' || status === 'paused') {
        try {
          localStorage.setItem(
            ACTIVE_STORAGE_KEY,
            JSON.stringify({
              routineId: currentRoutine.id,
              routineTitle: currentRoutine.title,
              routine: currentRoutine,
              sessionSets,
              elapsedSeconds,
              durationMinutes,
              hasManuallyAdjusted,
              status,
              lastSavedAt: Date.now(),
            })
          );
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleFlush);
    };
  }, [status, currentRoutine, sessionSets, elapsedSeconds, durationMinutes, hasManuallyAdjusted, ACTIVE_STORAGE_KEY]);

  // Load real routine stats, recovery info, and progressive overload history
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoadingStats(true);
      try {
        const [statsData, recentMuscleData] = await Promise.all([
          DataService.getRoutineWorkoutStats(currentRoutine.id, currentRoutine.title, user?.id),
          DataService.getRecentMuscleTrainingHistory(user?.id),
        ]);

        if (!isMounted) return;
        setStats(statsData);
        setRecentMuscles(recentMuscleData.map((m) => m.muscle.toLowerCase()));

        // Fetch previous performance for each exercise
        const historyMap: Record<string, string> = {};
        const previousMap: Record<string, LoggedSet[]> = {};
        for (const ex of currentRoutine.exercises) {
          const prev = await DataService.getExercisePerformanceHistory(ex.name, user?.id);
          if (prev && prev.sets.length > 0) {
            const completedSets = prev.sets.filter((s) => s.completed);
            const repSummary = completedSets.map((s) => s.reps).join(', ');
            const weightPrefix = prev.sets[0]?.weight_kg ? `${prev.sets[0].weight_kg}kg · ` : '';
            historyMap[ex.name.toLowerCase()] = `${weightPrefix}${repSummary} reps`;
            previousMap[ex.name.toLowerCase()] = completedSets;

            // Pre-fill working weight from previous session if sets are unassigned
            if (prev.sets[0]?.weight_kg) {
              const lastWeight = prev.sets[0].weight_kg;
              setSessionSets((prevSets) => {
                const currentSets = prevSets[ex.id];
                if (!currentSets) return prevSets;
                const needsPrefill = currentSets.every((s) => !s.weight_kg);
                if (!needsPrefill) return prevSets;
                return {
                  ...prevSets,
                  [ex.id]: currentSets.map((s) => ({ ...s, weight_kg: lastWeight })),
                };
              });
            }
          }
        }
        if (isMounted) {
          setExerciseHistoryMap(historyMap);
          setPreviousSetsMap(previousMap);
        }
      } catch (err) {
        console.warn('Failed to load routine stats:', err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentRoutine.id, currentRoutine.title, user?.id]);

  // Stopwatch timer interval
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (!hasManuallyAdjusted && next >= 60) {
            setDurationMinutes(Math.max(1, Math.round(next / 60)));
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, hasManuallyAdjusted]);

  // Rest countdown timer interval
  useEffect(() => {
    if (isRestTimerActive && restSecondsRemaining !== null && restSecondsRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSecondsRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setIsRestTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    }

    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [isRestTimerActive, restSecondsRemaining]);

  // Set-level management
  const handleToggleSetComplete = (exId: string, setIndex: number, restSeconds: number = 90) => {
    setSessionSets((prev) => {
      const sets = prev[exId] ? [...prev[exId]] : [];
      if (sets[setIndex]) {
        const nextComplete = !sets[setIndex].completed;
        sets[setIndex] = { ...sets[setIndex], completed: nextComplete };

        // If completing a set and workout is active, start rest timer!
        if (nextComplete && (status === 'active' || status === 'paused')) {
          setRestSecondsRemaining(restSeconds);
          setIsRestTimerActive(true);
        }
      }
      return { ...prev, [exId]: sets };
    });
  };

  const handleUpdateSetReps = (exId: string, setIndex: number, delta: number) => {
    setSessionSets((prev) => {
      const sets = prev[exId] ? [...prev[exId]] : [];
      if (sets[setIndex]) {
        const newReps = Math.max(1, sets[setIndex].reps + delta);
        sets[setIndex] = { ...sets[setIndex], reps: newReps };
      }
      return { ...prev, [exId]: sets };
    });
  };

  const handleUpdateSetWeight = (exId: string, setIndex: number, weight: number | undefined) => {
    setSessionSets((prev) => {
      const sets = prev[exId] ? [...prev[exId]] : [];
      if (sets[setIndex]) {
        sets[setIndex] = { ...sets[setIndex], weight_kg: weight };
      }
      return { ...prev, [exId]: sets };
    });
  };

  const handleAddSet = (exId: string, targetReps: number = 10) => {
    setSessionSets((prev) => {
      const sets = prev[exId] ? [...prev[exId]] : [];
      const newSetNumber = sets.length + 1;
      const lastSet = sets[sets.length - 1];
      const newSet: LoggedSet = {
        set_number: newSetNumber,
        reps: lastSet ? lastSet.reps : targetReps,
        weight_kg: lastSet?.weight_kg,
        completed: false,
      };
      return { ...prev, [exId]: [...sets, newSet] };
    });
  };

  const handleRemoveSet = (exId: string, setIndex: number) => {
    setSessionSets((prev) => {
      const sets = prev[exId] ? [...prev[exId]] : [];
      if (sets.length <= 1) return prev; // keep at least 1 set
      const filtered = sets.filter((_, i) => i !== setIndex).map((s, idx) => ({ ...s, set_number: idx + 1 }));
      return { ...prev, [exId]: filtered };
    });
  };

  // Skip & Replace Exercise in session
  const handleReplaceExercise = (originalExId: string, replacement: RoutineExercise) => {
    setCurrentRoutine((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) => (e.id === originalExId ? replacement : e)),
    }));

    // Transfer sets to new exercise id
    setSessionSets((prev) => {
      const existingSets = prev[originalExId] || [];
      const next = { ...prev };
      delete next[originalExId];
      next[replacement.id] = existingSets;
      return next;
    });
  };

  const handleAdjustDuration = (delta: number) => {
    setHasManuallyAdjusted(true);
    setDurationMinutes((prev) => Math.max(1, Math.min(180, prev + delta)));
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartWorkout = () => {
    setViewMode('workout');
    setStatus('active');
  };

  const handlePauseWorkout = () => {
    setStatus('paused');
  };

  const handleResumeWorkout = () => {
    setStatus('active');
  };

  // Execution calculations
  let totalSetsCount = 0;
  let completedSetsCount = 0;
  let completedExercisesCount = 0;

  currentRoutine.exercises.forEach((ex) => {
    const sets = sessionSets[ex.id] || [];
    totalSetsCount += sets.length;
    const finishedSets = sets.filter((s) => s.completed).length;
    completedSetsCount += finishedSets;
    if (sets.length > 0 && finishedSets === sets.length) {
      completedExercisesCount++;
    }
  });

  const progressPercent = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;

  // Dynamic live calories burned calculation
  const userWeight = profile?.weight_kg || 70;
  const currentCaloriesBurned = calculateWorkoutCalories({
    userWeightKg: userWeight,
    durationMinutes: durationMinutes,
    focus: currentRoutine.focus,
    executedExercisesCount: Math.max(1, completedExercisesCount),
    totalSetsExecuted: Math.max(currentRoutine.exercises.length * 2, completedSetsCount),
  });

  // Finish Workout: save session snapshot without modifying base routine definition
  const handleSaveAndConfirm = async (navigateHome: boolean) => {
    // ── Duplicate-save guard ────────────────────────────────────────────
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    // Construct actual set-by-set performance
    const actualPerformance: ExercisePerformance[] = currentRoutine.exercises.map((ex) => {
      const logged = sessionSets[ex.id] || [];
      return {
        exercise_id: ex.id,
        name: ex.name,
        target_muscle: ex.target_muscle,
        sets: logged,
      };
    });

    const completedNames = currentRoutine.exercises
      .filter((ex) => (sessionSets[ex.id] || []).some((s) => s.completed))
      .map((ex) => ex.name)
      .join(', ');

    // Log workout session to database with exact sets, duration, and calories
    await DataService.addExerciseLog({
      user_id: user?.id || 'demo-user-001',
      exercise_type: cleanActivityTitle(currentRoutine.title).title,
      duration_minutes: durationMinutes,
      intensity: 'moderate',
      calories_burned: currentCaloriesBurned,
      distance_km: null,
      source: 'routine',
      description: `Completed ${completedSetsCount}/${totalSetsCount} sets (${completedExercisesCount}/${currentRoutine.exercises.length} exercises) in ${durationMinutes} mins: ${completedNames || currentRoutine.title}`,
      confidence: 'high',
      ai_analysis: {
        routine_id: currentRoutine.id,
        routine_title: currentRoutine.title,
        executed_count: completedExercisesCount,
        total_exercises: currentRoutine.exercises.length,
        calories: currentCaloriesBurned,
        user_adjusted_duration: hasManuallyAdjusted,
        actual_performance: actualPerformance,
      },
    });

    // Clear in-progress workout snapshot
    try {
      localStorage.removeItem(ACTIVE_STORAGE_KEY);
    } catch {
      // ignore
    }

    // Invalidate caches so other tabs/screens immediately see newly recorded exercises & calories
    const uid = user?.id || 'demo-user-001';
    const dateStr = getLocalDateString(new Date());
    NuviaCache.invalidate(todaySummaryKey(uid, dateStr));
    NuviaCache.invalidate(todayActivityKey(uid, dateStr));
    NuviaCache.invalidate(exerciseLogsKey(uid));
    NuviaCache.invalidatePrefix('today-summary:');
    NuviaCache.invalidatePrefix('today-activity:');
    NuviaCache.invalidatePrefix('exercise-logs:');

    await refreshProfileAndGoals();
    setShowCompletionModal(false);
    setIsSaving(false);
    isSavingRef.current = false;
    onWorkoutFinished?.();

    if (navigateHome && onNavigateHome) {
      onNavigateHome();
    } else {
      onBack();
    }
  };

  const handleDiscardWorkout = () => {
    if (confirm('Discard this in-progress workout session? Tracked progress for this session will be reset.')) {
      try {
        localStorage.removeItem(ACTIVE_STORAGE_KEY);
      } catch {
        // ignore
      }
      setStatus('idle');
      setElapsedSeconds(0);
      setViewMode('overview');
      const initialSetsMap: Record<string, LoggedSet[]> = {};
      currentRoutine.exercises.forEach((ex) => {
        const targetReps = parseTargetReps(ex.reps);
        const setCount = Math.max(1, ex.sets || 3);
        initialSetsMap[ex.id] = Array.from({ length: setCount }, (_, i) => ({
          set_number: i + 1,
          reps: targetReps,
          weight_kg: ex.target_weight_kg || undefined,
          completed: false,
        }));
      });
      setSessionSets(initialSetsMap);
    }
  };


  // Recovery warning calculation
  const routineFocusLower = (currentRoutine.focus || '').toLowerCase();
  const hasRecentlyTrained = recentMuscles.some(
    (m) => routineFocusLower.includes(m) || currentRoutine.exercises.some((e) => e.target_muscle.toLowerCase() === m)
  );

  // =========================================================================
  // 1. ROUTINE OVERVIEW MODE (Apple-inspired summary, real stats & Start CTA)
  // =========================================================================
  if (viewMode === 'overview') {
    return (
      <div className="flex-1 flex flex-col pb-28 px-4 pt-3 w-full max-w-md mx-auto space-y-4 animate-fadeIn">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg transition-colors py-1.5 px-2.5 rounded-xl bg-fg/[0.06] hover:bg-fg/[0.12]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Plans</span>
          </button>

          <div className="flex items-center gap-1.5">
            {onEditRoutine && (
              <button
                type="button"
                onClick={() => onEditRoutine(currentRoutine)}
                className="py-1.5 px-3 rounded-xl bg-fg/[0.06] hover:bg-fg/[0.12] text-xs font-semibold text-fg flex items-center gap-1.5 transition-colors"
                title="Edit Routine"
              >
                <Pencil className="w-3.5 h-3.5 text-green-ink" />
                <span>Edit</span>
              </button>
            )}

            {onDuplicateRoutine && (
              <button
                type="button"
                onClick={() => onDuplicateRoutine(currentRoutine.id)}
                className="p-2 rounded-xl bg-fg/[0.04] hover:bg-fg/[0.08] text-muted hover:text-fg transition-colors"
                title="Duplicate Routine"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onDeleteRoutine(currentRoutine.id)}
              className="p-2 rounded-xl bg-fg/[0.04] hover:bg-fg/[0.08] text-muted hover:text-red-400 transition-colors"
              title="Delete Routine"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Hero Card with Title, Focus, and Training Days */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-green-ink border border-accent/25">
              {currentRoutine.focus || 'Workout'}
            </span>
            <span className="text-xs text-muted">
              {currentRoutine.exercises.length} Movements · ~{defaultEstMinutes} min
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-fg leading-tight">
            {currentRoutine.title}
          </h1>

          {currentRoutine.description && (
            <p className="text-xs text-muted leading-relaxed">{currentRoutine.description}</p>
          )}

          {/* Days Chips */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[11px] text-muted mr-1">Scheduled on:</span>
            {currentRoutine.days.map((day) => (
              <span
                key={day}
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-fg/[0.08] text-fg border border-fg/5"
              >
                {day}
              </span>
            ))}
          </div>
        </div>

        {/* Recovery Awareness Guidance (Phase 11) */}
        {hasRecentlyTrained && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200">
            <Info className="w-4 h-4 text-orange-ink shrink-0 mt-0.5" />
            <p className="leading-snug text-[11px]">
              Target muscle groups were trained recently. You can still train today — listen to your body and adjust resistance or volume as needed.
            </p>
          </div>
        )}

        {/* Real Lifetime Performance Statistics (Phase 3) */}
        <div className="p-4 rounded-3xl bg-gradient-to-b from-card to-card dark:to-[#141416] border border-fg/[0.08] space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-ink" />
              <span>Routine Activity History</span>
            </span>
            {stats && stats.completedCount > 0 && (
              <span className="text-[10px] text-green-ink font-semibold bg-accent/10 px-2 py-0.5 rounded-full">
                Active Routine
              </span>
            )}
          </div>

          {loadingStats ? (
            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="h-12 bg-fg/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-fg/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-fg/5 rounded-xl animate-pulse" />
            </div>
          ) : stats && stats.completedCount > 0 ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-app/40 border border-fg/[0.04]">
                <p className="text-[10px] text-muted">Workouts</p>
                <p className="text-base font-bold text-fg mt-0.5">{stats.completedCount}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-app/40 border border-fg/[0.04]">
                <p className="text-[10px] text-muted">Total Time</p>
                <p className="text-base font-bold text-fg mt-0.5">
                  {stats.totalDurationMinutes >= 60
                    ? `${Math.floor(stats.totalDurationMinutes / 60)}h ${stats.totalDurationMinutes % 60}m`
                    : `${stats.totalDurationMinutes}m`}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-app/40 border border-fg/[0.04]">
                <p className="text-[10px] text-muted">Calories</p>
                <p className="text-base font-bold text-orange-ink mt-0.5">{stats.totalCaloriesBurned}</p>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center space-y-1">
              <p className="text-xs text-zinc-300 font-medium">No sessions completed yet.</p>
              <p className="text-[11px] text-muted">Start your first workout to begin tracking consistency & progressive overload.</p>
            </div>
          )}

          {stats?.lastCompletedDate && (
            <div className="flex items-center justify-between pt-1 border-t border-fg/[0.04] text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-green-ink" />
                <span>Last completed:</span>
              </span>
              <span className="text-fg font-medium">
                {new Date(stats.lastCompletedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Big Apple-Style [ Start Workout ] Primary CTA */}
        <button
          type="button"
          onClick={handleStartWorkout}
          className="w-full py-4 rounded-2xl bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent font-extrabold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/25"
        >
          <Play className="w-5 h-5 fill-black" />
          <span>Start Workout Session</span>
        </button>

        {/* Exercise Preview List */}
        <div className="space-y-2.5 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block px-1">
            Planned Exercises ({currentRoutine.exercises.length})
          </span>

          <div className="space-y-2.5">
            {currentRoutine.exercises.map((ex, idx) => (
              <div
                key={ex.id || idx}
                onClick={() => setSelectedVideoExercise(ex)}
                className="p-3 rounded-2xl bg-fg/[0.03] hover:bg-fg/[0.06] border border-fg/[0.06] flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-app shrink-0 border border-fg/10 relative">
                    <ExerciseThumbnail exercise={ex} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 text-fg fill-white" />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-fg group-hover:text-green-ink transition-colors leading-tight">
                      {ex.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
                      <span className="font-semibold text-zinc-300">
                        {ex.sets} sets × {ex.reps}
                      </span>
                      {ex.target_weight_kg && (
                        <>
                          <span>·</span>
                          <span className="text-blue-ink font-medium">{ex.target_weight_kg} kg</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{ex.target_muscle}</span>
                    </div>

                    {/* Progressive Overload Insight Badge (Phase 10) */}
                    {exerciseHistoryMap[ex.name.toLowerCase()] && (
                      <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <History className="w-2.5 h-2.5 text-green-ink" />
                        <span>Last: {exerciseHistoryMap[ex.name.toLowerCase()]}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-muted group-hover:text-fg transition-colors">
                    Watch ›
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Video Modal */}
        <ExerciseVideoModal
          exercise={selectedVideoExercise}
          isOpen={!!selectedVideoExercise}
          onClose={() => setSelectedVideoExercise(null)}
        />
      </div>
    );
  }

  // =========================================================================
  // 2. ACTIVE WORKOUT PLAYER MODE (Timer, Set-by-Set Tracking & Replacement)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col pb-28 px-4 pt-3 w-full max-w-md mx-auto space-y-4 animate-fadeIn">
      {/* Active Workout Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setViewMode('overview')}
          className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg transition-colors py-1.5 px-2.5 rounded-xl bg-fg/[0.06] hover:bg-fg/[0.12]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-fg">
            {completedSetsCount}/{totalSetsCount} Sets Done
          </span>
          <div className="w-16 h-2 bg-fg/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Controller Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-b from-card to-card dark:to-[#141416] border border-fg/[0.1] shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'active'
                  ? 'bg-accent animate-pulse'
                  : status === 'paused'
                  ? 'bg-warn'
                  : 'bg-[#8E8E93]'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-fg">
              {status === 'active' ? 'Live Session' : status === 'paused' ? 'Paused' : 'Workout Ready'}
            </span>
          </div>

          {/* Stopwatch Display */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-app/60 border border-fg/[0.08] text-fg">
              <Clock className="w-3.5 h-3.5 text-green-ink" />
              <span className="font-mono text-sm font-bold tracking-wider">{formatTimer(elapsedSeconds)}</span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/25 text-green-ink">
              <Flame className="w-3 h-3 fill-accent" />
              <span className="text-xs font-bold">{currentCaloriesBurned} kcal</span>
            </div>
          </div>
        </div>

        {/* Adjustable Duration Controls */}
        <div className="p-2.5 rounded-2xl bg-app/40 border border-fg/[0.06] flex items-center justify-between text-xs">
          <span className="text-[11px] text-muted">Duration:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleAdjustDuration(-5)}
              className="px-2 py-1 rounded-lg bg-fg/5 hover:bg-fg/10 text-muted text-[10px]"
            >
              -5m
            </button>
            <span className="font-bold text-fg px-1.5">{durationMinutes} min</span>
            <button
              type="button"
              onClick={() => handleAdjustDuration(5)}
              className="px-2 py-1 rounded-lg bg-fg/5 hover:bg-fg/10 text-muted text-[10px]"
            >
              +5m
            </button>
          </div>
        </div>

        {/* Play/Pause/Finish Buttons */}
        <div className="flex gap-2">
          {status === 'active' ? (
            <>
              <button
                type="button"
                onClick={handlePauseWorkout}
                className="flex-1 py-3 px-4 rounded-2xl bg-elevated hover:bg-elevated-2 text-orange-ink font-bold text-xs flex items-center justify-center gap-2 border border-warn/30 transition-all"
              >
                <Pause className="w-4 h-4 fill-warn" />
                <span>Pause</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatus('finished');
                  setShowCompletionModal(true);
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish Workout</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResumeWorkout}
                className="flex-1 py-3 px-4 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition-all"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Resume Session</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatus('finished');
                  setShowCompletionModal(true);
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-elevated hover:bg-elevated-2 text-fg font-bold text-xs flex items-center justify-center gap-2 border border-fg/[0.1] transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-green-ink" />
                <span>Finish Early</span>
              </button>
            </>
          )}
        </div>

        {status === 'paused' && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={handleDiscardWorkout}
              className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard in-progress session</span>
            </button>
          </div>
        )}
      </div>

      {/* Exercises with Set-by-Set Logging (Phase 4) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Track Sets & Reps
          </span>
          <span className="text-[10px] text-muted">Check set to start rest timer</span>
        </div>

        {currentRoutine.exercises.map((ex, exIdx) => {
          const sets = sessionSets[ex.id] || [];
          const allSetsDone = sets.length > 0 && sets.every((s) => s.completed);

          return (
            <div
              key={ex.id || exIdx}
              className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                allSetsDone
                  ? 'bg-accent/[0.03] border-accent/30 shadow-sm'
                  : 'bg-fg/[0.02] border-fg/[0.08]'
              }`}
            >
              {/* Exercise Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    onClick={() => setSelectedVideoExercise(ex)}
                    className="w-11 h-11 rounded-xl overflow-hidden bg-app shrink-0 border border-fg/10 cursor-pointer relative group"
                  >
                    <ExerciseThumbnail exercise={ex} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-3.5 h-3.5 text-fg fill-white" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-fg leading-tight">{ex.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted">
                      <span>Planned: {ex.sets} × {ex.reps}</span>
                      <span>·</span>
                      <span className="text-green-ink font-medium">{ex.target_muscle}</span>
                    </div>

                    {/* Progressive Overload Badge */}
                    {exerciseHistoryMap[ex.name.toLowerCase()] && (
                      <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <History className="w-2.5 h-2.5 text-green-ink" />
                        <span>Last: {exerciseHistoryMap[ex.name.toLowerCase()]}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Replace Exercise Button (Phase 5) */}
                <button
                  type="button"
                  onClick={() => setReplacingExercise(ex)}
                  className="px-2.5 py-1 rounded-xl bg-fg/5 hover:bg-fg/10 text-[10px] font-semibold text-zinc-300 hover:text-fg border border-fg/5 flex items-center gap-1 transition-colors"
                  title="Replace with alternative movement"
                >
                  <RefreshCw className="w-3 h-3 text-orange-ink" />
                  <span>Replace</span>
                </button>
              </div>

              {/* Set-by-Set Table (Phase 4) */}
              <div className="space-y-1.5 pt-1">
                <div className="grid grid-cols-12 gap-1 text-[10px] text-muted font-semibold px-2">
                  <span className="col-span-2">SET · LAST</span>
                  <span className="col-span-4 text-center">REPS</span>
                  <span className="col-span-4 text-center">WEIGHT (KG)</span>
                  <span className="col-span-2 text-right">DONE</span>
                </div>

                {sets.map((set, sIdx) => (
                  <div
                    key={sIdx}
                    className={`grid grid-cols-12 gap-1 items-center px-2 py-1.5 rounded-xl border transition-colors ${
                      set.completed
                        ? 'bg-accent/10 border-accent/25'
                        : 'bg-app/30 border-fg/[0.04]'
                    }`}
                  >
                    <span className="col-span-2 px-1 flex flex-col leading-tight">
                      <span className="text-xs font-bold text-fg">{set.set_number}</span>
                      {(() => {
                        const prev = previousSetsMap[ex.name.toLowerCase()]?.[sIdx];
                        if (!prev) return null;
                        return (
                          <span
                            className="mt-0.5 text-[10px] font-semibold text-subtle tabular-nums whitespace-nowrap"
                            title="Last session"
                          >
                            {prev.weight_kg ? `${prev.weight_kg}×${prev.reps}` : `×${prev.reps}`}
                          </span>
                        );
                      })()}
                    </span>

                    {/* Reps stepper */}
                    <div className="col-span-4 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateSetReps(ex.id, sIdx, -1)}
                        className="w-8 h-8 rounded-lg bg-elevated text-fg flex items-center justify-center text-base font-bold cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <span className="font-bold tabular-nums text-fg text-sm w-6 text-center">
                        {set.reps}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateSetReps(ex.id, sIdx, 1)}
                        className="w-8 h-8 rounded-lg bg-elevated text-fg flex items-center justify-center text-base font-bold cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {/* Weight input */}
                    <div className="col-span-4 flex items-center justify-center">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={set.weight_kg ?? ''}
                        placeholder="—"
                        onChange={(e) =>
                          handleUpdateSetWeight(
                            ex.id,
                            sIdx,
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        inputMode="decimal"
                        aria-label={`Weight for set ${set.set_number} in kilograms`}
                        className="w-16 h-9 px-1.5 text-center tabular-nums text-sm font-bold rounded-lg bg-app/40 border border-fg/10 text-fg focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Completion Toggle */}
                    <div className="col-span-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleToggleSetComplete(ex.id, sIdx, ex.rest_seconds ?? 90)}
                        aria-label={`${set.completed ? 'Unmark' : 'Complete'} set ${set.set_number}`}
                        aria-pressed={set.completed}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                          set.completed
                            ? 'bg-accent text-on-accent shadow'
                            : 'bg-elevated hover:bg-elevated-2 text-muted'
                        }`}
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add / Remove Set Row */}
              <div className="flex items-center justify-between pt-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleAddSet(ex.id, parseTargetReps(ex.reps))}
                  className="text-[11px] font-semibold text-green-ink hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Set</span>
                </button>

                {sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSet(ex.id, sets.length - 1)}
                    className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Remove Last Set
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Docked rest timer: stays above the bottom bar while you scroll (auto-starts when a set is ticked) */}
      {isRestTimerActive && restSecondsRemaining !== null && restSecondsRemaining > 0 && (
        <div
          role="timer"
          aria-label="Rest timer"
          className="sticky z-30 rounded-[var(--radius-card)] bg-surface border border-line shadow-xl shadow-black/30 p-3 flex items-center justify-between gap-3 animate-fadeIn"
          style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <div className="pl-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Rest</p>
            <p className="text-[30px] leading-none font-extrabold tabular-nums text-fg">
              {formatTimer(restSecondsRemaining)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRestSecondsRemaining((prev) => Math.max(1, (prev ?? 0) - 15))}
              className="h-11 min-w-[52px] px-3 rounded-[var(--radius-control)] bg-elevated text-fg text-sm font-bold tabular-nums cursor-pointer"
            >
              −15
            </button>
            <button
              type="button"
              onClick={() => setRestSecondsRemaining((prev) => (prev ?? 0) + 15)}
              className="h-11 min-w-[52px] px-3 rounded-[var(--radius-control)] bg-elevated text-fg text-sm font-bold tabular-nums cursor-pointer"
            >
              +15
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRestTimerActive(false);
                setRestSecondsRemaining(0);
              }}
              className="h-11 px-4 rounded-[var(--radius-control)] bg-accent text-on-accent text-sm font-extrabold hover:bg-accent-hover cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Completion Dialog */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-card border border-fg/15 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-accent/20 text-green-ink flex items-center justify-center mx-auto">
              <Award className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-fg">Workout Complete!</h3>
              <p className="text-xs text-muted mt-1">
                {completedSetsCount} sets logged across {completedExercisesCount} movements.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-fg/[0.04] border border-fg/[0.06] grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[11px] text-muted">Duration</p>
                <p className="text-base font-extrabold text-fg mt-0.5">{durationMinutes} min</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Burned</p>
                <p className="text-base font-extrabold text-orange-ink mt-0.5">{currentCaloriesBurned} kcal</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveAndConfirm(true)}
                disabled={isSaving}
                className="w-full py-3.5 rounded-2xl bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-on-accent font-extrabold text-xs shadow-lg shadow-accent/20 transition-all"
              >
                {isSaving ? 'Saving…' : 'Save & View Today Summary'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndConfirm(false)}
                disabled={isSaving}
                className="w-full py-3 rounded-2xl bg-fg/10 hover:bg-fg/15 disabled:opacity-60 disabled:cursor-not-allowed text-fg font-semibold text-xs transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save & Return to Plans'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      <ExerciseVideoModal
        exercise={selectedVideoExercise}
        isOpen={!!selectedVideoExercise}
        onClose={() => setSelectedVideoExercise(null)}
      />

      {/* Skip / Replace Modal (Phase 5) */}
      <ExerciseReplaceModal
        exercise={replacingExercise}
        isOpen={!!replacingExercise}
        onClose={() => setReplacingExercise(null)}
        onReplace={handleReplaceExercise}
      />
    </div>
  );
}
