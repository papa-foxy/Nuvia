'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { ExerciseLog } from '@/types/database';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import {
  Play,
  Plus,
  Sparkles,
  Calendar,
  Dumbbell,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Activity,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { PasteAiRoutineModal } from './PasteAiRoutineModal';
import { ManualRoutineModal } from './ManualRoutineModal';
import { RoutineDetailView } from './RoutineDetailView';

import { TabType } from './Navigation';

interface ExerciseListViewProps {
  onOpenAddExercise: () => void;
  onNavigateTab?: (tab: TabType) => void;
}

export function ExerciseListView({ onOpenAddExercise, onNavigateTab }: ExerciseListViewProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'routines' | 'logs'>('routines');

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
    // Log as completed exercise in activity log
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

  const totalBurned = exercises.reduce((sum, e) => sum + (Number(e.calories_burned) || 0), 0);
  const totalMinutes = exercises.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);

  // Check today's day of week
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // If a specific routine is open, render its dedicated execution and exercises view
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
    <div className="flex-1 flex flex-col pb-24 px-5 pt-4 max-w-md mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Fitness & Training
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
            Workout & Movement
          </h1>
        </div>

        {viewMode === 'logs' ? (
          <span className="text-sm font-semibold text-white mb-1">
            {totalMinutes} <span className="text-xs text-[#8E8E93] font-normal">min active</span>
          </span>
        ) : (
          <span className="text-xs text-[#8E8E93] mb-1 font-medium">
            {routines.length} Saved Splits
          </span>
        )}
      </div>

      {/* Notification Toast */}
      {successBanner && (
        <div className="p-3 rounded-2xl bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* iOS Segmented Control: [ Workout Routines | Activity Logs ] */}
      <div className="p-1 bg-[#1C1C1E] border border-white/[0.08] rounded-2xl flex items-center">
        <button
          type="button"
          onClick={() => setViewMode('routines')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'routines'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5 text-[#30D158]" />
          <span>Workout Routines</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('logs')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'logs'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#0A84FF]" />
          <span>Today's Log ({exercises.length})</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. WORKOUT ROUTINES VIEW                                    */}
      {/* ============================================================ */}
      {viewMode === 'routines' && (
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
                  Manual Routine
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
            <div className="py-12 text-center text-xs text-[#8E8E93] bg-[#1C1C1E] rounded-3xl border border-white/[0.06] p-6 space-y-2">
              <Dumbbell className="w-8 h-8 text-[#8E8E93] mx-auto mb-1" />
              <p className="text-sm font-semibold text-white">No Workout Routines Yet</p>
              <p className="text-xs text-[#8E8E93] max-w-xs mx-auto">
                Paste the consultation text from your AI coach above or build a routine manually.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {routines.map((routine) => {
                const isScheduledToday = routine.days.some(
                  (d) => d.toLowerCase() === todayName.toLowerCase()
                );
                return (
                  <div
                    key={routine.id}
                    onClick={() => setSelectedRoutine(routine)}
                    className="ios-card overflow-hidden border border-white/[0.08] hover:border-[#30D158]/40 transition-all cursor-pointer p-4 space-y-3 group"
                  >
                    {/* Routine Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          {isScheduledToday && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158] text-black">
                              Today
                            </span>
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0A84FF] bg-[#0A84FF]/10 px-2 py-0.5 rounded-full">
                            {routine.focus || 'Training'}
                          </span>
                          <span className="text-[11px] text-[#8E8E93]">
                            {routine.exercises.length} exercises
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white leading-snug group-hover:text-[#30D158] transition-colors">
                          {routine.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteRoutine(routine.id, e)}
                        className="p-1.5 text-[#8E8E93] hover:text-red-400 transition-colors shrink-0"
                        title="Delete Routine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

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

                    {/* Exercise Thumbnails Preview Strip & Open CTA */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {routine.exercises.slice(0, 5).map((ex) => (
                          <div
                            key={ex.id}
                            className="w-9 h-9 rounded-xl bg-black/50 p-1 border border-white/[0.08] shrink-0"
                            title={ex.name}
                          >
                            <img src={ex.thumbnail_url} alt={ex.name} className="w-full h-full object-contain" />
                          </div>
                        ))}
                        {routine.exercises.length > 5 && (
                          <div className="w-9 h-9 rounded-xl bg-[#2C2C2E] border border-white/[0.08] shrink-0 flex items-center justify-center text-[10px] font-bold text-[#8E8E93]">
                            +{routine.exercises.length - 5}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs font-semibold text-[#30D158] group-hover:translate-x-0.5 transition-transform shrink-0">
                        <span>Open Routine</span>
                        <ChevronRight className="w-4 h-4" />
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
      {/* 2. ACTIVITY LOGS VIEW                                       */}
      {/* ============================================================ */}
      {viewMode === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
              Today's Logged Movement
            </span>
            <button
              type="button"
              onClick={onOpenAddExercise}
              className="text-xs text-[#30D158] font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Activity</span>
            </button>
          </div>

          {loadingLogs ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="h-16 bg-[#1C1C1E] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8E8E93] bg-[#1C1C1E] rounded-3xl border border-white/[0.06] p-6 space-y-2">
              <Activity className="w-8 h-8 text-[#8E8E93] mx-auto mb-1" />
              <p className="text-sm font-semibold text-white">No Activity Logged Today</p>
              <p className="text-xs text-[#8E8E93]">
                Start a routine or tap below to record your run, workout, or sports.
              </p>
              <button
                type="button"
                onClick={onOpenAddExercise}
                className="mt-2 px-4 py-2 rounded-full bg-[#30D158] text-black font-semibold text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Movement</span>
              </button>
            </div>
          ) : (
            <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
              {exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-white">{ex.exercise_type}</h3>
                    <p className="text-xs text-[#8E8E93] mt-0.5">
                      {ex.duration_minutes} min {ex.distance_km ? `· ${ex.distance_km} km` : ''} ·{' '}
                      <span className="capitalize">{ex.intensity || 'moderate'} intensity</span>
                    </p>
                    {ex.ai_analysis?.ai_tip && (
                      <p className="text-[11px] text-[#A1A1A6] mt-1 italic">
                        Nuvia: {ex.ai_analysis.ai_tip}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold text-white">~{ex.calories_burned}</span>
                    <span className="text-xs text-[#8E8E93] ml-1">kcal</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS: Video Player, AI Import, Manual Builder              */}
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
