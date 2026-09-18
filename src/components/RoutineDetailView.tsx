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
} from 'lucide-react';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { calculateWorkoutCalories } from '@/lib/calorie-calculator';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';

interface RoutineDetailViewProps {
  routine: WorkoutRoutine;
  onBack: () => void;
  onDeleteRoutine: (id: string) => void;
  onWorkoutFinished?: () => void;
  onNavigateHome?: () => void;
}

type WorkoutStatus = 'idle' | 'active' | 'paused' | 'finished';

export function RoutineDetailView({
  routine,
  onBack,
  onDeleteRoutine,
  onWorkoutFinished,
  onNavigateHome,
}: RoutineDetailViewProps) {
  const { user, profile, refreshProfileAndGoals } = useAuth();

  // Execution tracking: map of exercise.id -> boolean (whether executed or not)
  const [executedMap, setExecutedMap] = useState<Record<string, boolean>>({});

  // Active workout session state
  const [status, setStatus] = useState<WorkoutStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // User adjustable duration in minutes (default estimation from routine size, e.g. 20-25 mins)
  const defaultEstMinutes = Math.max(10, routine.exercises.length * 3);
  const [durationMinutes, setDurationMinutes] = useState<number>(defaultEstMinutes);
  const [hasManuallyAdjusted, setHasManuallyAdjusted] = useState<boolean>(false);

  // Video modal
  const [selectedVideoExercise, setSelectedVideoExercise] = useState<RoutineExercise | null>(null);

  // Completion Dialog state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [savedLogId, setSavedLogId] = useState<string | null>(null);

  // Timer interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Sync minutes automatically if user hasn't chosen custom duration
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, hasManuallyAdjusted]);

  const toggleExerciseExecution = (id: string) => {
    setExecutedMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
  };

  const handleAdjustDuration = (delta: number) => {
    setHasManuallyAdjusted(true);
    setDurationMinutes((prev) => Math.max(1, Math.min(180, prev + delta)));
  };

  const handleSetExactDuration = (mins: number) => {
    setHasManuallyAdjusted(true);
    setDurationMinutes(Math.max(1, Math.min(180, mins)));
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartWorkout = () => {
    setStatus('active');
  };

  const handlePauseWorkout = () => {
    setStatus('paused');
  };

  const handleResumeWorkout = () => {
    setStatus('active');
  };

  // Calculate executed metrics
  const executedCount = Object.values(executedMap).filter(Boolean).length;
  const totalExercises = routine.exercises.length;
  const progressPercent = totalExercises > 0
    ? Math.round((executedCount / totalExercises) * 100)
    : 0;

  const totalSetsExecuted = routine.exercises.reduce((sum, ex) => {
    return sum + (executedMap[ex.id] !== false ? Number(ex.sets) || 3 : 0);
  }, 0);

  // Dynamic live calories burned calculation based on user metrics and adjusted duration
  const userWeight = profile?.weight_kg || 70;
  const currentCaloriesBurned = calculateWorkoutCalories({
    userWeightKg: userWeight,
    durationMinutes: durationMinutes,
    focus: routine.focus,
    executedExercisesCount: Math.max(1, executedCount),
    totalSetsExecuted: Math.max(routine.exercises.length * 2, totalSetsExecuted),
  });

  const handleOpenFinishModal = () => {
    // Stop timer
    setStatus('finished');
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setShowCompletionModal(true);
  };

  const handleSaveAndConfirm = async (navigateHome: boolean) => {
    let finalExecutedCount = executedCount;
    if (finalExecutedCount === 0 && totalExercises > 0) {
      finalExecutedCount = totalExercises;
      const allDone: Record<string, boolean> = {};
      routine.exercises.forEach((e) => {
        allDone[e.id] = true;
      });
      setExecutedMap(allDone);
    }

    const executedNames = routine.exercises
      .filter((e) => executedMap[e.id] !== false)
      .map((e) => e.name)
      .join(', ');

    // Log workout session to database / local state with the exact user adjusted duration & calories
    await DataService.addExerciseLog({
      user_id: user?.id || 'demo-user-001',
      exercise_type: routine.title,
      duration_minutes: durationMinutes,
      intensity: 'moderate',
      calories_burned: currentCaloriesBurned,
      distance_km: null,
      source: 'routine',
      description: `Completed ${finalExecutedCount}/${totalExercises} exercises in ${durationMinutes} mins: ${executedNames}`,
      confidence: 'high',
      ai_analysis: {
        routine_id: routine.id,
        routine_title: routine.title,
        executed_count: finalExecutedCount,
        total_exercises: totalExercises,
        calories: currentCaloriesBurned,
        user_adjusted_duration: hasManuallyAdjusted,
      },
    });

    await refreshProfileAndGoals();
    setShowCompletionModal(false);

    if (onWorkoutFinished) {
      onWorkoutFinished();
    }

    if (navigateHome && onNavigateHome) {
      onNavigateHome();
    } else {
      onBack();
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-28 px-4 pt-3 w-full max-w-md mx-auto space-y-4 animate-fadeIn">
      {/* Top Header with Back Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors py-1.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Workouts</span>
        </button>

        <button
          type="button"
          onClick={() => onDeleteRoutine(routine.id)}
          className="p-2 text-[#8E8E93] hover:text-red-400 transition-colors rounded-xl bg-white/[0.04] hover:bg-white/[0.08]"
          title="Delete Routine"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Routine Title & Focus Info */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/25">
            {routine.focus || 'Workout'}
          </span>
          <span className="text-xs text-[#8E8E93]">
            {routine.exercises.length} Exercises
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
          {routine.title}
        </h1>
        {routine.description && (
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            {routine.description}
          </p>
        )}
      </div>

      {/* ============================================================ */}
      {/* LIVE WORKOUT CONTROLLER & ADJUSTABLE TIMER CARD              */}
      {/* ============================================================ */}
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
              {status === 'active'
                ? 'Workout Active'
                : status === 'paused'
                ? 'Workout Paused'
                : status === 'finished'
                ? 'Completed'
                : 'Session Tracker'}
            </span>
          </div>

          {/* Timer Display */}
          {status === 'active' || status === 'paused' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/[0.08] text-white">
              <Clock className="w-3.5 h-3.5 text-[#30D158]" />
              <span className="font-mono text-sm font-bold tracking-wider">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#30D158]/10 border border-[#30D158]/25 text-[#30D158]">
              <Flame className="w-3.5 h-3.5 fill-[#30D158]" />
              <span className="text-xs font-bold">{currentCaloriesBurned} kcal</span>
            </div>
          )}
        </div>

        {/* User Adjustable Duration Control */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#30D158]" />
                <span>Adjust Workout Duration</span>
              </p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">
                Completed earlier or self-paced? Adjust your time anytime:
              </p>
            </div>

            <span className="text-xs font-extrabold text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full border border-[#30D158]/20 shrink-0">
              {currentCaloriesBurned} kcal
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Decrease buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdjustDuration(-5)}
                className="px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#8E8E93] hover:text-white text-xs font-semibold transition-colors"
                title="Decrease 5 minutes"
              >
                -5m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDuration(-1)}
                className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center transition-colors"
                title="Decrease 1 minute"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Editable duration input */}
            <div className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#1C1C1E] rounded-xl border border-white/[0.12] shadow-inner">
              <input
                type="number"
                min={1}
                max={240}
                value={durationMinutes}
                onChange={(e) => handleSetExactDuration(Number(e.target.value) || 1)}
                className="w-12 bg-transparent text-center font-mono font-extrabold text-base text-white focus:outline-none"
              />
              <span className="text-xs text-[#8E8E93] font-semibold">min</span>
            </div>

            {/* Increase buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdjustDuration(1)}
                className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center transition-colors"
                title="Increase 1 minute"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDuration(5)}
                className="px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#8E8E93] hover:text-white text-xs font-semibold transition-colors"
                title="Increase 5 minutes"
              >
                +5m
              </button>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-[#8E8E93] shrink-0 mr-1">Quick Presets:</span>
            {[10, 15, 20, 25, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleSetExactDuration(mins)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all shrink-0 ${
                  durationMinutes === mins
                    ? 'bg-[#30D158] text-black font-bold'
                    : 'bg-white/[0.06] text-[#8E8E93] hover:text-white'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar of executed activities */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#8E8E93]">
            <span>Activity Progress</span>
            <span className="font-semibold text-white">
              {executedCount} of {routine.exercises.length} executed ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-[#2C2C2E] h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#30D158] to-[#0A84FF] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Workout Control Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {status === 'idle' && (
            <>
              <button
                type="button"
                onClick={handleStartWorkout}
                className="flex-1 py-3 px-3 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/[0.1] transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-white text-white" />
                <span>Start Live Timer</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFinishModal}
                className="flex-1 py-3 px-3 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#30D158]/20 transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Record Workout</span>
              </button>
            </>
          )}

          {status === 'active' && (
            <>
              <button
                type="button"
                onClick={handlePauseWorkout}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#FF9F0A] font-bold text-xs flex items-center justify-center gap-2 border border-[#FF9F0A]/30 transition-all active:scale-[0.98]"
              >
                <Pause className="w-4 h-4 fill-[#FF9F0A]" />
                <span>Pause</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFinishModal}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20 transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish & Calculate</span>
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                type="button"
                onClick={handleResumeWorkout}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20 transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFinishModal}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/[0.1] transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4 text-[#30D158]" />
                <span>Finish Workout</span>
              </button>
            </>
          )}

          {status === 'finished' && (
            <div className="w-full py-2.5 px-3 rounded-2xl bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Workout Completed & Logged to Homepage!</span>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* EXERCISES LIST                                               */}
      {/* ============================================================ */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">
            Exercises in Routine
          </span>
          <span className="text-[11px] text-[#8E8E93]">
            Tap card for video · Tap checkbox to record
          </span>
        </div>

        <div className="space-y-3">
          {routine.exercises.map((ex, idx) => {
            const isExecuted = !!executedMap[ex.id];
            // YouTube video thumbnail (maxresdefault or hqdefault)
            const ytThumb = ex.youtube_id
              ? `https://img.youtube.com/vi/${ex.youtube_id}/hqdefault.jpg`
              : ex.thumbnail_url;

            return (
              <div
                key={ex.id || idx}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  isExecuted
                    ? 'border-[#30D158]/40 shadow-sm shadow-[#30D158]/10'
                    : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                {/* Video Thumbnail Banner — click to play */}
                <div
                  onClick={() => setSelectedVideoExercise(ex)}
                  className="relative cursor-pointer group h-32 bg-black overflow-hidden"
                >
                  <img
                    src={ytThumb}
                    alt={ex.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback to NASM icon thumbnail if YouTube thumb fails
                      (e.target as HTMLImageElement).src = ex.thumbnail_url;
                      (e.target as HTMLImageElement).className = 'w-full h-full object-contain p-4 opacity-60';
                    }}
                  />
                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* YouTube Play Button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#FF0000] flex items-center justify-center shadow-2xl shadow-black/60 group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 text-white fill-white ml-1" />
                    </div>
                  </div>

                  {/* Exercise name & muscle overlaid on thumbnail */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className={`text-xs font-bold leading-tight ${isExecuted ? 'text-white/60 line-through' : 'text-white'}`}>
                      {ex.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-white/60">{ex.target_muscle}</span>
                      <span className="text-[10px] text-white/40">·</span>
                      <span className="text-[10px] font-semibold text-white/90 bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
                        {ex.sets} × {ex.reps}
                      </span>
                    </div>
                  </div>

                  {/* Executed badge */}
                  {isExecuted && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-[#30D158] text-black text-[10px] font-bold shadow">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Done</span>
                    </div>
                  )}
                </div>

                {/* Bottom action row */}
                <div className={`flex items-center justify-between px-3 py-2 ${isExecuted ? 'bg-[#1C1C1E]/90' : 'bg-[#18181A]'}`}>
                  <div className="flex items-center gap-2">
                    {ex.notes && (
                      <p className="text-[10px] text-[#8E8E93] truncate max-w-[160px]">{ex.notes}</p>
                    )}
                  </div>

                  {/* Record Execution Button */}
                  <button
                    type="button"
                    onClick={() => toggleExerciseExecution(ex.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                      isExecuted
                        ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/40'
                        : 'bg-white/[0.06] text-[#8E8E93] hover:text-white hover:bg-white/[0.12] border border-white/[0.06]'
                    }`}
                  >
                    {isExecuted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#30D158]" />
                        <span>Executed</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5 text-[#8E8E93]" />
                        <span>Record</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Video Modal */}
      {selectedVideoExercise && (
        <ExerciseVideoModal
          exercise={selectedVideoExercise}
          isOpen={!!selectedVideoExercise}
          onClose={() => setSelectedVideoExercise(null)}
          onCompleteExercise={(ex) => {
            toggleExerciseExecution(ex.id);
            setSelectedVideoExercise(null);
          }}
        />
      )}

      {/* Completion & Calorie Celebration Modal with Live Duration Adjuster */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-white/[0.15] rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-slideUp">
            <div className="w-16 h-16 rounded-full bg-[#30D158]/20 border border-[#30D158]/40 text-[#30D158] flex items-center justify-center mx-auto">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158]">
                Workout Completed
              </span>
              <h3 className="text-xl font-bold text-white mt-1.5">
                {routine.title}
              </h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                Saved to your daily activity log & homepage
              </p>
            </div>

            {/* Calculated Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/[0.06] flex flex-col items-center">
                <Flame className="w-5 h-5 text-[#FF453A] mb-1" />
                <span className="text-2xl font-extrabold text-white tracking-tight">
                  {currentCaloriesBurned}
                </span>
                <span className="text-[10px] font-medium text-[#8E8E93] uppercase tracking-wider">
                  Calories Burned
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/[0.06] flex flex-col items-center">
                <Clock className="w-5 h-5 text-[#0A84FF] mb-1" />
                <span className="text-2xl font-extrabold text-white tracking-tight">
                  {durationMinutes} min
                </span>
                <span className="text-[10px] font-medium text-[#8E8E93] uppercase tracking-wider">
                  Duration
                </span>
              </div>
            </div>

            {/* In-Modal Duration Adjuster */}
            <div className="p-3 rounded-2xl bg-[#141416] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E8E93] font-medium">Fine-tune Duration:</span>
                <span className="font-bold text-white">{durationMinutes} minutes</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(-5)}
                  className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold"
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(-1)}
                  className="w-8 h-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center font-bold"
                >
                  -1
                </button>
                <span className="px-3 py-1 font-mono font-bold text-white text-sm bg-black/60 rounded-xl border border-white/[0.08]">
                  {durationMinutes}m
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(1)}
                  className="w-8 h-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center font-bold"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(5)}
                  className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold"
                >
                  +5m
                </button>
              </div>
              <p className="text-[10px] text-[#8E8E93]">
                Calories automatically recalculate in real-time.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.04] text-xs text-[#8E8E93]">
              Executed <span className="font-bold text-white">{executedCount || totalExercises}</span> of{' '}
              <span className="font-bold text-white">{totalExercises}</span> exercises
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSaveAndConfirm(true)}
                className="w-full py-3.5 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-sm shadow-lg shadow-[#30D158]/25 transition-all flex items-center justify-center gap-2"
              >
                <span>Save & View on Homepage</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndConfirm(false)}
                className="w-full py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold text-xs transition-all"
              >
                Save & Return to Workouts
              </button>

              <button
                type="button"
                onClick={() => setShowCompletionModal(false)}
                className="w-full py-1.5 text-xs text-[#8E8E93] hover:text-white transition-colors"
              >
                Cancel / Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
