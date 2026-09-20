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
  Timer,
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

  // Initialize session sets from routine definition
  useEffect(() => {
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
  }, [currentRoutine]);

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
        for (const ex of currentRoutine.exercises) {
          const prev = await DataService.getExercisePerformanceHistory(ex.name, user?.id);
          if (prev && prev.sets.length > 0) {
            const completedSets = prev.sets.filter((s) => s.completed);
            const repSummary = completedSets.map((s) => s.reps).join(', ');
            const weightPrefix = prev.sets[0]?.weight_kg ? `${prev.sets[0].weight_kg}kg · ` : '';
            historyMap[ex.name.toLowerCase()] = `${weightPrefix}${repSummary} reps`;

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
            className="flex items-center gap-1 text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors py-1.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Plans</span>
          </button>

          <div className="flex items-center gap-1.5">
            {onEditRoutine && (
              <button
                type="button"
                onClick={() => onEditRoutine(currentRoutine)}
                className="py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                title="Edit Routine"
              >
                <Pencil className="w-3.5 h-3.5 text-[#30D158]" />
                <span>Edit</span>
              </button>
            )}

            {onDuplicateRoutine && (
              <button
                type="button"
                onClick={() => onDuplicateRoutine(currentRoutine.id)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8E8E93] hover:text-white transition-colors"
                title="Duplicate Routine"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onDeleteRoutine(currentRoutine.id)}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8E8E93] hover:text-red-400 transition-colors"
              title="Delete Routine"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Hero Card with Title, Focus, and Training Days */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/25">
              {currentRoutine.focus || 'Workout'}
            </span>
            <span className="text-xs text-[#8E8E93]">
              {currentRoutine.exercises.length} Movements · ~{defaultEstMinutes} min
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
            {currentRoutine.title}
          </h1>

          {currentRoutine.description && (
            <p className="text-xs text-[#8E8E93] leading-relaxed">{currentRoutine.description}</p>
          )}

          {/* Days Chips */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[11px] text-[#8E8E93] mr-1">Scheduled on:</span>
            {currentRoutine.days.map((day) => (
              <span
                key={day}
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white border border-white/5"
              >
                {day}
              </span>
            ))}
          </div>
        </div>

        {/* Recovery Awareness Guidance (Phase 11) */}
        {hasRecentlyTrained && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200">
            <Info className="w-4 h-4 text-[#FF9F0A] shrink-0 mt-0.5" />
            <p className="leading-snug text-[11px]">
              Target muscle groups were trained recently. You can still train today — listen to your body and adjust resistance or volume as needed.
            </p>
          </div>
        )}

        {/* Real Lifetime Performance Statistics (Phase 3) */}
        <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1C1C1E] to-[#141416] border border-white/[0.08] space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#30D158]" />
              <span>Routine Activity History</span>
            </span>
            {stats && stats.completedCount > 0 && (
              <span className="text-[10px] text-[#30D158] font-semibold bg-[#30D158]/10 px-2 py-0.5 rounded-full">
                Active Routine
              </span>
            )}
          </div>

          {loadingStats ? (
            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            </div>
          ) : stats && stats.completedCount > 0 ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
                <p className="text-[10px] text-[#8E8E93]">Workouts</p>
                <p className="text-base font-bold text-white mt-0.5">{stats.completedCount}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
                <p className="text-[10px] text-[#8E8E93]">Total Time</p>
                <p className="text-base font-bold text-white mt-0.5">
                  {stats.totalDurationMinutes >= 60
                    ? `${Math.floor(stats.totalDurationMinutes / 60)}h ${stats.totalDurationMinutes % 60}m`
                    : `${stats.totalDurationMinutes}m`}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
                <p className="text-[10px] text-[#8E8E93]">Calories</p>
                <p className="text-base font-bold text-[#FF9500] mt-0.5">{stats.totalCaloriesBurned}</p>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center space-y-1">
              <p className="text-xs text-zinc-300 font-medium">No sessions completed yet.</p>
              <p className="text-[11px] text-[#8E8E93]">Start your first workout to begin tracking consistency & progressive overload.</p>
            </div>
          )}

          {stats?.lastCompletedDate && (
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[11px] text-[#8E8E93]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#30D158]" />
                <span>Last completed:</span>
              </span>
              <span className="text-white font-medium">
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
          className="w-full py-4 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] active:scale-[0.99] text-black font-extrabold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#30D158]/25"
        >
          <Play className="w-5 h-5 fill-black" />
          <span>Start Workout Session</span>
        </button>

        {/* Exercise Preview List */}
        <div className="space-y-2.5 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] block px-1">
            Planned Exercises ({currentRoutine.exercises.length})
          </span>

          <div className="space-y-2.5">
            {currentRoutine.exercises.map((ex, idx) => (
              <div
                key={ex.id || idx}
                onClick={() => setSelectedVideoExercise(ex)}
                className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10 relative">
                    <ExerciseThumbnail exercise={ex} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-[#30D158] transition-colors leading-tight">
                      {ex.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8E8E93]">
                      <span className="font-semibold text-zinc-300">
                        {ex.sets} sets × {ex.reps}
                      </span>
                      {ex.target_weight_kg && (
                        <>
                          <span>·</span>
                          <span className="text-[#0A84FF] font-medium">{ex.target_weight_kg} kg</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{ex.target_muscle}</span>
                    </div>

                    {/* Progressive Overload Insight Badge (Phase 10) */}
                    {exerciseHistoryMap[ex.name.toLowerCase()] && (
                      <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <History className="w-2.5 h-2.5 text-[#30D158]" />
                        <span>Last: {exerciseHistoryMap[ex.name.toLowerCase()]}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-[#8E8E93] group-hover:text-white transition-colors">
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
          className="flex items-center gap-1 text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors py-1.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">
            {completedSetsCount}/{totalSetsCount} Sets Done
          </span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#30D158] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Floating Rest Countdown Timer Widget (Phase 4) */}
      {isRestTimerActive && restSecondsRemaining !== null && restSecondsRemaining > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-[#1C1C1E] to-[#1C1C1E] border border-[#30D158]/40 shadow-xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#30D158]/20 text-[#30D158] flex items-center justify-center">
              <Timer className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#30D158]">Resting Between Sets</p>
              <p className="font-mono text-lg font-black text-white leading-tight">
                {formatTimer(restSecondsRemaining)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRestSecondsRemaining((prev) => (prev ? prev + 30 : 30))}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
            >
              +30s
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRestTimerActive(false);
                setRestSecondsRemaining(0);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-semibold"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Live Controller Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-b from-[#1C1C1E] to-[#141416] border border-white/[0.1] shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'active'
                  ? 'bg-[#30D158] animate-pulse'
                  : status === 'paused'
                  ? 'bg-[#FF9F0A]'
                  : 'bg-[#8E8E93]'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {status === 'active' ? 'Live Session' : status === 'paused' ? 'Paused' : 'Workout Ready'}
            </span>
          </div>

          {/* Stopwatch Display */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/[0.08] text-white">
              <Clock className="w-3.5 h-3.5 text-[#30D158]" />
              <span className="font-mono text-sm font-bold tracking-wider">{formatTimer(elapsedSeconds)}</span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#30D158]/10 border border-[#30D158]/25 text-[#30D158]">
              <Flame className="w-3 h-3 fill-[#30D158]" />
              <span className="text-xs font-bold">{currentCaloriesBurned} kcal</span>
            </div>
          </div>
        </div>

        {/* Adjustable Duration Controls */}
        <div className="p-2.5 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#8E8E93]">Duration:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleAdjustDuration(-5)}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#8E8E93] text-[10px]"
            >
              -5m
            </button>
            <span className="font-bold text-white px-1.5">{durationMinutes} min</span>
            <button
              type="button"
              onClick={() => handleAdjustDuration(5)}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#8E8E93] text-[10px]"
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
                className="flex-1 py-3 px-4 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#FF9F0A] font-bold text-xs flex items-center justify-center gap-2 border border-[#FF9F0A]/30 transition-all"
              >
                <Pause className="w-4 h-4 fill-[#FF9F0A]" />
                <span>Pause</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatus('finished');
                  setShowCompletionModal(true);
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20 transition-all"
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
                className="flex-1 py-3 px-4 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20 transition-all"
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
                className="flex-1 py-3 px-4 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/[0.1] transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-[#30D158]" />
                <span>Finish Early</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Exercises with Set-by-Set Logging (Phase 4) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
            Track Sets & Reps
          </span>
          <span className="text-[10px] text-[#8E8E93]">Check set to start rest timer</span>
        </div>

        {currentRoutine.exercises.map((ex, exIdx) => {
          const sets = sessionSets[ex.id] || [];
          const allSetsDone = sets.length > 0 && sets.every((s) => s.completed);

          return (
            <div
              key={ex.id || exIdx}
              className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                allSetsDone
                  ? 'bg-[#30D158]/[0.03] border-[#30D158]/30 shadow-sm'
                  : 'bg-white/[0.02] border-white/[0.08]'
              }`}
            >
              {/* Exercise Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    onClick={() => setSelectedVideoExercise(ex)}
                    className="w-11 h-11 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10 cursor-pointer relative group"
                  >
                    <ExerciseThumbnail exercise={ex} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">{ex.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#8E8E93]">
                      <span>Planned: {ex.sets} × {ex.reps}</span>
                      <span>·</span>
                      <span className="text-[#30D158] font-medium">{ex.target_muscle}</span>
                    </div>

                    {/* Progressive Overload Badge */}
                    {exerciseHistoryMap[ex.name.toLowerCase()] && (
                      <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <History className="w-2.5 h-2.5 text-[#30D158]" />
                        <span>Last: {exerciseHistoryMap[ex.name.toLowerCase()]}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Replace Exercise Button (Phase 5) */}
                <button
                  type="button"
                  onClick={() => setReplacingExercise(ex)}
                  className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-zinc-300 hover:text-white border border-white/5 flex items-center gap-1 transition-colors"
                  title="Replace with alternative movement"
                >
                  <RefreshCw className="w-3 h-3 text-[#FF9500]" />
                  <span>Replace</span>
                </button>
              </div>

              {/* Set-by-Set Table (Phase 4) */}
              <div className="space-y-1.5 pt-1">
                <div className="grid grid-cols-12 gap-1 text-[10px] text-[#8E8E93] font-semibold px-2">
                  <span className="col-span-2">SET</span>
                  <span className="col-span-4 text-center">REPS</span>
                  <span className="col-span-4 text-center">WEIGHT (KG)</span>
                  <span className="col-span-2 text-right">DONE</span>
                </div>

                {sets.map((set, sIdx) => (
                  <div
                    key={sIdx}
                    className={`grid grid-cols-12 gap-1 items-center p-2 rounded-xl border transition-colors ${
                      set.completed
                        ? 'bg-[#30D158]/10 border-[#30D158]/25'
                        : 'bg-black/30 border-white/[0.04]'
                    }`}
                  >
                    <span className="col-span-2 text-xs font-bold text-white px-1">
                      {set.set_number}
                    </span>

                    {/* Reps stepper */}
                    <div className="col-span-4 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateSetReps(ex.id, sIdx, -1)}
                        className="w-5 h-5 rounded bg-white/5 text-white flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-white text-xs w-6 text-center">
                        {set.reps}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateSetReps(ex.id, sIdx, 1)}
                        className="w-5 h-5 rounded bg-white/5 text-white flex items-center justify-center text-xs"
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
                        className="w-14 px-1.5 py-1 text-center font-mono text-xs rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    {/* Completion Toggle */}
                    <div className="col-span-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleToggleSetComplete(ex.id, sIdx, ex.rest_seconds ?? 90)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          set.completed
                            ? 'bg-[#30D158] text-black shadow'
                            : 'bg-white/10 hover:bg-white/15 text-zinc-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
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
                  className="text-[11px] font-semibold text-[#30D158] hover:underline flex items-center gap-1"
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

      {/* Completion Dialog */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#30D158]/20 text-[#30D158] flex items-center justify-center mx-auto">
              <Award className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Workout Complete!</h3>
              <p className="text-xs text-[#8E8E93] mt-1">
                {completedSetsCount} sets logged across {completedExercisesCount} movements.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[11px] text-[#8E8E93]">Duration</p>
                <p className="text-base font-extrabold text-white mt-0.5">{durationMinutes} min</p>
              </div>
              <div>
                <p className="text-[11px] text-[#8E8E93]">Burned</p>
                <p className="text-base font-extrabold text-[#FF9500] mt-0.5">{currentCaloriesBurned} kcal</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveAndConfirm(true)}
                disabled={isSaving}
                className="w-full py-3.5 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-60 disabled:cursor-not-allowed text-black font-extrabold text-xs shadow-lg shadow-[#30D158]/20 transition-all"
              >
                {isSaving ? 'Saving…' : 'Save & View Today Summary'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndConfirm(false)}
                disabled={isSaving}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
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
