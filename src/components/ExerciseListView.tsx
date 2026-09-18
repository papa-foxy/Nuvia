'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { ExerciseLog } from '@/types/database';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import {
  Play,
  Plus,
  Sparkles,
  Dumbbell,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Activity,
  Flame,
  Clock,
  Zap,
  Calendar,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { PasteAiRoutineModal } from './PasteAiRoutineModal';
import { ManualRoutineModal } from './ManualRoutineModal';
import { RoutineDetailView } from './RoutineDetailView';
import { ExerciseThumbnail } from './ExerciseThumbnail';

import { TabType } from './Navigation';

interface ExerciseListViewProps {
  onOpenAddExercise: () => void;
  onNavigateTab?: (tab: TabType) => void;
}

// ─── Intensity dot color ─────────────────────────────────────────────────────
function intensityColor(intensity: string) {
  if (intensity === 'high') return '#FF453A';
  if (intensity === 'low') return '#30D158';
  return '#FF9F0A';
}

// ─── Format duration ──────────────────────────────────────────────────────────
function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ExerciseListView({ onOpenAddExercise, onNavigateTab }: ExerciseListViewProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'today' | 'plans'>('today');

  // Routines State
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<WorkoutRoutine | null>(null);

  // Activity Logs State
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Modals
  const [selectedVideoExercise, setSelectedVideoExercise] = useState<RoutineExercise | null>(null);
  const [isAiPasteOpen, setIsAiPasteOpen] = useState(false);
  const [isManualRoutineOpen, setIsManualRoutineOpen] = useState(false);

  // Feedback banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadAll = async () => {
    setLoadingRoutines(true);
    setLoadingLogs(true);

    const [routinesData, logsData] = await Promise.all([
      DataService.getWorkoutRoutines(user?.id),
      DataService.getExerciseLogs(user?.id),
    ]);

    setRoutines(routinesData);
    setExercises(logsData);
    setLoadingRoutines(false);
    setLoadingLogs(false);
  };

  useEffect(() => {
    loadAll();
  }, [user]);

  const showNotification = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleSaveRoutinesFromAi = async (newRoutines: WorkoutRoutine[]) => {
    for (const r of newRoutines) {
      await DataService.saveWorkoutRoutine(r);
    }
    await loadAll();
    showNotification(`Added ${newRoutines.length} routine(s) from AI consultation!`);
  };

  const handleSaveManualRoutine = async (routine: WorkoutRoutine) => {
    await DataService.saveWorkoutRoutine(routine);
    await loadAll();
    showNotification(`Saved "${routine.title}"!`);
  };

  const handleDeleteRoutine = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Are you sure you want to remove this workout routine?')) {
      await DataService.deleteWorkoutRoutine(id);
      if (selectedRoutine?.id === id) {
        setSelectedRoutine(null);
      }
      await loadAll();
      showNotification('Workout routine removed.');
    }
  };

  const handleCompleteExerciseFromVideo = async (ex: RoutineExercise) => {
    await DataService.addExerciseLog({
      user_id: user?.id || 'demo-user-001',
      exercise_type: `${ex.name} (${ex.sets} sets × ${ex.reps})`,
      duration_minutes: ex.sets * 3,
      intensity: 'moderate',
      calories_burned: ex.sets * 25,
      distance_km: null,
      source: 'manual',
      description: `Completed from routine: ${ex.name}`,
      confidence: 'high',
      ai_analysis: { ai_tip: `Great work completing ${ex.name}! Target: ${ex.target_muscle}` },
    });
    await loadAll();
    showNotification(`Logged ${ex.name} (+${ex.sets * 25} kcal)!`);
  };

  const handleDeleteExercise = async (id: string) => {
    if (confirm('Delete this exercise log entry?')) {
      await DataService.deleteExerciseLog(id, user?.id);
      await loadAll();
      showNotification('Exercise log removed.');
    }
  };

  // ─── Derived values ───────────────────────────────────────────────────────
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayDate = new Date().toDateString();

  // Filter to today's exercises only for the Today view
  const todayExercises = exercises.filter(
    (e) => new Date(e.created_at || new Date()).toDateString() === todayDate
  );
  const totalBurned = todayExercises.reduce((sum, e) => sum + (Number(e.calories_burned) || 0), 0);
  const totalMinutes = todayExercises.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);

  // Find today's scheduled routine (first one that matches today)
  const todayRoutine = routines.find((r) =>
    r.days.some((d) => d.toLowerCase() === todayName.toLowerCase())
  );

  // ─── If a specific routine is open, render it ─────────────────────────────
  if (selectedRoutine) {
    return (
      <RoutineDetailView
        routine={selectedRoutine}
        onBack={() => {
          setSelectedRoutine(null);
          loadAll();
        }}
        onDeleteRoutine={async (id) => {
          await handleDeleteRoutine(id);
        }}
        onWorkoutFinished={() => {
          loadAll();
          showNotification('Workout completed & calories calculated! Recorded on homepage.');
        }}
        onNavigateHome={() => {
          setSelectedRoutine(null);
          if (onNavigateTab) {
            onNavigateTab('home');
          }
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-24 px-5 pt-4 w-full max-w-md mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Fitness & Training
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">Activity</h1>
        </div>

        {/* Contextual stat in header */}
        {viewMode === 'today' ? (
          <div className="text-right mb-1">
            {totalBurned > 0 ? (
              <>
                <span className="text-sm font-bold text-white">{totalBurned}</span>
                <span className="text-xs text-[#8E8E93] font-normal ml-1">kcal today</span>
              </>
            ) : (
              <span className="text-xs text-[#8E8E93]">No activity yet</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#8E8E93] mb-1 font-medium">
            {routines.length} {routines.length === 1 ? 'Routine' : 'Routines'}
          </span>
        )}
      </div>

      {/* ── Notification Toast ── */}
      {successBanner && (
        <div className="p-3 rounded-2xl bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* ── iOS Segmented Control: [ Today | Plans ] ── */}
      <div className="p-1 bg-[#1C1C1E] border border-white/[0.08] rounded-2xl flex items-center">
        <button
          type="button"
          onClick={() => setViewMode('today')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'today'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#FF9F0A]" />
          <span>Today</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('plans')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'plans'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5 text-[#0A84FF]" />
          <span>Plans</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TODAY VIEW — Execution-first                                  */}
      {/* ============================================================ */}
      {viewMode === 'today' && (
        <div className="space-y-4">

          {/* ── Daily Stats Strip ── */}
          {totalMinutes > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="ios-card p-3 flex flex-col items-center gap-1">
                <Flame className="w-4 h-4 text-[#FF9F0A]" />
                <span className="text-sm font-bold text-white">{totalBurned}</span>
                <span className="text-[10px] text-[#8E8E93]">kcal</span>
              </div>
              <div className="ios-card p-3 flex flex-col items-center gap-1">
                <Clock className="w-4 h-4 text-[#0A84FF]" />
                <span className="text-sm font-bold text-white">{fmtDuration(totalMinutes)}</span>
                <span className="text-[10px] text-[#8E8E93]">active</span>
              </div>
              <div className="ios-card p-3 flex flex-col items-center gap-1">
                <Activity className="w-4 h-4 text-[#30D158]" />
                <span className="text-sm font-bold text-white">{todayExercises.length}</span>
                <span className="text-[10px] text-[#8E8E93]">sessions</span>
              </div>
            </div>
          )}

          {/* ── Up Next: Today's Scheduled Routine ── */}
          {!loadingRoutines && todayRoutine && (
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase mb-2">
                Up Next
              </p>
              <button
                type="button"
                onClick={() => setSelectedRoutine(todayRoutine)}
                className="w-full ios-card p-4 text-left hover:border-[#30D158]/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black/60 border border-white/[0.1] shrink-0 relative group-hover:border-[#30D158]/40 transition-colors shadow-sm">
                      {todayRoutine.exercises[0] ? (
                        <ExerciseThumbnail exercise={todayRoutine.exercises[0]} aspectRatio="1/1" className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full bg-[#30D158]/15 flex items-center justify-center">
                          <Play className="w-5 h-5 text-[#30D158] fill-[#30D158]" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#30D158] text-black">
                          Today
                        </span>
                        <span className="text-[10px] text-[#8E8E93]">
                          {todayRoutine.exercises.length} exercises
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-[#30D158] transition-colors">
                        {todayRoutine.title}
                      </h3>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#30D158] transition-colors shrink-0" />
                </div>
              </button>
            </div>
          )}

          {/* ── Log Activity CTA (shown when no logs yet or always) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
                Today's Activity
              </p>
              <button
                type="button"
                onClick={onOpenAddExercise}
                className="text-xs text-[#30D158] font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log</span>
              </button>
            </div>

            {loadingLogs ? (
              <div className="space-y-2">
                {[1, 2].map((n) => (
                  <div key={n} className="h-16 bg-[#1C1C1E] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : todayExercises.length === 0 ? (
              <div className="ios-card p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1C1C1E] flex items-center justify-center mx-auto">
                  <Activity className="w-6 h-6 text-[#3A3A3C]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">No Activity Yet</p>
                  <p className="text-xs text-[#8E8E93] mt-1 max-w-xs mx-auto">
                    {todayRoutine
                      ? `Start "${todayRoutine.title}" or log a manual activity.`
                      : 'Log a run, workout, or any movement to get started.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAddExercise}
                  className="px-5 py-2.5 rounded-full bg-[#30D158] text-black font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Activity</span>
                </button>
              </div>
            ) : (
              <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
                {todayExercises.map((ex) => {
                  const exDate = new Date(ex.created_at || new Date());
                  const timeLabel = exDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={ex.id}
                      className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Intensity indicator dot */}
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: intensityColor(ex.intensity || 'moderate') }}
                        />
                        <div>
                          <h3 className="text-sm font-semibold text-white">{ex.exercise_type}</h3>
                          <p className="text-xs text-[#8E8E93] mt-0.5">
                            {fmtDuration(Number(ex.duration_minutes))}
                            {ex.distance_km ? ` · ${ex.distance_km} km` : ''}
                            <span className="text-[#636366]"> · {timeLabel}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right shrink-0">
                          <span className="text-sm font-semibold text-white">
                            ~{ex.calories_burned}
                          </span>
                          <span className="text-xs text-[#8E8E93] ml-1">kcal</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="p-1.5 text-[#8E8E93] hover:text-[#FF453A] transition-colors"
                          title="Delete exercise entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Nudge to Plans if no routine scheduled today ── */}
          {!loadingRoutines && !todayRoutine && (
            <button
              type="button"
              onClick={() => setViewMode('plans')}
              className="w-full ios-card p-4 text-left hover:border-white/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0A84FF]/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="w-4.5 h-4.5 text-[#0A84FF]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Browse your Plans</p>
                    <p className="text-[11px] text-[#8E8E93] mt-0.5">
                      {routines.length > 0
                        ? `${routines.length} routine${routines.length > 1 ? 's' : ''} saved`
                        : 'Create or import a workout routine'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#8E8E93] group-hover:text-white transition-colors shrink-0" />
              </div>
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* PLANS VIEW — Preparation-first                               */}
      {/* ============================================================ */}
      {viewMode === 'plans' && (
        <div className="space-y-4">
          {/* Action Row: Paste from AI & Manual Builder */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setIsAiPasteOpen(true)}
              className="p-3 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#121214] border border-white/[0.08] hover:border-[#30D158]/50 text-left transition-all group flex flex-col justify-between"
            >
              <div className="w-7 h-7 rounded-xl bg-[#30D158]/15 text-[#30D158] flex items-center justify-center mb-2">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-[#30D158] transition-colors">
                  Paste AI Routine
                </p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">From your AI consultation</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsManualRoutineOpen(true)}
              className="p-3 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#121214] border border-white/[0.08] hover:border-white/30 text-left transition-all group flex flex-col justify-between"
            >
              <div className="w-7 h-7 rounded-xl bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center mb-2">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-white transition-colors">
                  Build Routine
                </p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">Pick specific exercises</p>
              </div>
            </button>
          </div>

          {/* Routine List */}
          {loadingRoutines ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="h-44 bg-[#1C1C1E] rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : routines.length === 0 ? (
            <div className="py-12 text-center ios-card p-6 space-y-2">
              <Dumbbell className="w-8 h-8 text-[#8E8E93] mx-auto mb-1" />
              <p className="text-sm font-semibold text-white">No Routines Yet</p>
              <p className="text-xs text-[#8E8E93] max-w-xs mx-auto">
                Paste the consultation text from your AI coach or build a routine manually to get
                started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {routines.map((routine) => {
                const isScheduledToday = routine.days.some(
                  (d) => d.toLowerCase() === todayName.toLowerCase()
                );
                const firstEx = routine.exercises[0];
                const bannerThumb = firstEx?.youtube_id
                  ? `https://img.youtube.com/vi/${firstEx.youtube_id}/hqdefault.jpg`
                  : firstEx?.thumbnail_url;

                return (
                  <div
                    key={routine.id}
                    onClick={() => setSelectedRoutine(routine)}
                    className="ios-card overflow-hidden border border-white/[0.08] hover:border-[#30D158]/40 transition-all cursor-pointer group"
                  >
                    {/* ── Video Thumbnail Banner ── */}
                    {bannerThumb && (
                      <div className="relative h-36 bg-black overflow-hidden">
                        <img
                          src={bannerThumb}
                          alt={routine.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* Today badge */}
                        {isScheduledToday && (
                          <div className="absolute top-2.5 left-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158] text-black shadow">
                              Today
                            </span>
                          </div>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoutine(routine.id, e)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-black/70 transition-colors"
                          title="Delete Routine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Title overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0A84FF] bg-[#0A84FF]/20 px-2 py-0.5 rounded-full backdrop-blur-sm border border-[#0A84FF]/20">
                              {routine.focus || 'Training'}
                            </span>
                            <span className="text-[10px] text-white/50">
                              {routine.exercises.length} exercises
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white leading-snug group-hover:text-[#30D158] transition-colors line-clamp-2">
                            {routine.title}
                          </h3>
                        </div>
                      </div>
                    )}

                    {/* ── Card Body ── */}
                    <div className="p-3 space-y-2.5">
                      {/* If no banner, show title here */}
                      {!bannerThumb && (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {isScheduledToday && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158] text-black">
                                  Today
                                </span>
                              )}
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0A84FF] bg-[#0A84FF]/10 px-2 py-0.5 rounded-full">
                                {routine.focus || 'Training'}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-white group-hover:text-[#30D158] transition-colors">
                              {routine.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRoutine(routine.id, e)}
                            className="p-1.5 text-[#8E8E93] hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Scheduled Days */}
                      <div className="flex flex-wrap gap-1">
                        {routine.days.map((day) => (
                          <span
                            key={day}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              day.toLowerCase() === todayName.toLowerCase()
                                ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30 font-semibold'
                                : 'bg-white/[0.05] text-[#8E8E93]'
                            }`}
                          >
                            {day}
                          </span>
                        ))}
                      </div>

                      {/* Exercise thumbnails + Open CTA */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {routine.exercises.slice(0, 6).map((ex) => (
                            <div
                              key={ex.id}
                              className="w-9 h-9 rounded-xl overflow-hidden bg-black/60 border border-white/[0.08] shrink-0 relative"
                              title={ex.name}
                            >
                              <ExerciseThumbnail exercise={ex} aspectRatio="1/1" className="w-full h-full" />
                            </div>
                          ))}
                          {routine.exercises.length > 6 && (
                            <div className="w-9 h-9 rounded-xl bg-[#2C2C2E] border border-white/[0.08] shrink-0 flex items-center justify-center text-[10px] font-bold text-[#8E8E93]">
                              +{routine.exercises.length - 6}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-xs font-semibold text-[#30D158] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                          <span>Open</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS                                                        */}
      {/* ============================================================ */}
      <ExerciseVideoModal
        exercise={selectedVideoExercise}
        isOpen={!!selectedVideoExercise}
        onClose={() => setSelectedVideoExercise(null)}
        onCompleteExercise={handleCompleteExerciseFromVideo}
      />

      <PasteAiRoutineModal
        isOpen={isAiPasteOpen}
        onClose={() => setIsAiPasteOpen(false)}
        onRoutinesSaved={handleSaveRoutinesFromAi}
      />

      <ManualRoutineModal
        isOpen={isManualRoutineOpen}
        onClose={() => setIsManualRoutineOpen(false)}
        onRoutineSaved={handleSaveManualRoutine}
      />
    </div>
  );
}
