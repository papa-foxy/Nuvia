'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { Meal, ExerciseLog, DailySummary } from '@/types/database';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import {
  Play,
  Plus,
  Sparkles,
  Dumbbell,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Activity,
  Flame,
  Clock,
  Calendar,
  ArrowRight,
  Heart,
  Droplets,
  Moon,
  Copy,
  Pencil,
  X,
  Info,
  Check,
} from 'lucide-react';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { PasteAiRoutineModal } from './PasteAiRoutineModal';
import { ManualRoutineModal } from './ManualRoutineModal';
import { RoutineDetailView } from './RoutineDetailView';
import { RoutineEditView } from './RoutineEditView';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { DayDetailsModal } from './DayDetailsModal';
import { ActivityDetailsModal } from './ActivityDetailsModal';
import { TabType } from './Navigation';
import { cleanActivityTitle, getActivityDisplayData } from '@/lib/activity-utils';
import { FitnessContextService } from '@/lib/fitness-context-service';
import { NuviaFitnessContext } from '@/types/fitness-context';
import { NuviaNextActionCard } from './adaptive/NuviaNextActionCard';
import { WeeklyAdaptationStrip } from './adaptive/WeeklyAdaptationStrip';
import { WeeklyReportModal } from './adaptive/WeeklyReportModal';

interface ExerciseListViewProps {
  onOpenAddExercise: () => void;
  onOpenAddMeal?: () => void;
  onNavigateTab?: (tab: TabType) => void;
  initialViewMode?: 'today' | 'plans' | 'history';
  refreshKey?: number;
  onWorkoutFinished?: () => void;
}

function intensityColor(intensity: string) {
  if (intensity === 'high') return '#FF453A';
  if (intensity === 'low') return '#30D158';
  return '#FF9F0A';
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ExerciseListView({
  onOpenAddExercise,
  onOpenAddMeal,
  onNavigateTab,
  initialViewMode = 'today',
  refreshKey,
  onWorkoutFinished,
}: ExerciseListViewProps) {
  const { user, goals } = useAuth();
  const [viewMode, setViewMode] = useState<'today' | 'plans' | 'history'>(initialViewMode);

  // Routines State
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<WorkoutRoutine | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);
  const [routineInitialMode, setRoutineInitialMode] = useState<'overview' | 'workout'>('overview');

  // Activity Logs State
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Modals
  const [selectedVideoExercise, setSelectedVideoExercise] = useState<RoutineExercise | null>(null);
  const [isAiPasteOpen, setIsAiPasteOpen] = useState(false);
  const [isManualRoutineOpen, setIsManualRoutineOpen] = useState(false);
  const [showRecoverySheet, setShowRecoverySheet] = useState(false);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<ExerciseLog | null>(null);
  const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);

  // Feedback banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Adaptive Engine State
  const [fitnessContext, setFitnessContext] = useState<NuviaFitnessContext | null>(null);
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState(false);

  // Calendar & History State
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [inspectDateStr, setInspectDateStr] = useState<string>(todayStr);

  const [activityMap, setActivityMap] = useState<
    Record<string, { hasMeal: boolean; hasWorkout: boolean; calories: number; burned: number }>
  >({});
  const [inspectSummary, setInspectSummary] = useState<DailySummary | null>(null);
  const [inspectMeals, setInspectMeals] = useState<Meal[]>([]);
  const [inspectExercises, setInspectExercises] = useState<ExerciseLog[]>([]);

  // Load activity map when entering history mode or on initial load
  useEffect(() => {
    if (viewMode === 'history' && Object.keys(activityMap).length === 0) {
      DataService.getActivityMap(user?.id).then(setActivityMap);
    }
  }, [viewMode, user?.id, activityMap]);

  const handleDayClick = async (dateStr: string) => {
    setInspectDateStr(dateStr);
    setIsDayModalOpen(true);

    const [s, m, e] = await Promise.all([
      DataService.getDailySummary(user?.id, dateStr),
      DataService.getMeals(user?.id, dateStr),
      DataService.getExerciseLogs(user?.id, dateStr),
    ]);
    setInspectSummary(s);
    setInspectMeals(m);
    setInspectExercises(e);
  };

  // Calendar calculations
  const viewedDate = new Date(today.getFullYear(), today.getMonth() + selectedMonthOffset, 1);
  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth();
  const monthName = viewedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDayIndex = (new Date(viewedYear, viewedMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate();

  // Find routine matching inspect day
  const [iY, iM, iD] = inspectDateStr.split('-').map(Number);
  const inspectDateObj = new Date(iY || today.getFullYear(), (iM || 1) - 1, iD || 1);
  const inspectDayName = inspectDateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const inspectRoutine = routines.find((r) =>
    r.days.map((d) => d.toLowerCase()).includes(inspectDayName.toLowerCase())
  );

  // Tomorrow calculations
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowDayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
  const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const todayAct = activityMap[todayStr];
  const todayHasWorkout = exercises.length > 0 || Boolean(todayAct?.hasWorkout);
  const todayRoutine = routines.find((r) =>
    r.days.map((d) => d.toLowerCase()).includes(todayDayName.toLowerCase())
  );
  const tomorrowRoutine = routines.find((r) =>
    r.days.map((d) => d.toLowerCase()).includes(tomorrowDayName.toLowerCase())
  );
  const isTomorrowRest = routines.length > 0 && !tomorrowRoutine;

  // Next scheduled routine within 7 days
  const nextScheduled = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'long' });
      const found = routines.find((r) =>
        r.days.map((d) => d.toLowerCase()).includes(dayName.toLowerCase())
      );
      if (found) {
        return {
          routine: found,
          dayName,
          daysAhead: i,
          dateStr: getLocalDateString(futureDate),
          dateFormatted: futureDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        };
      }
    }
    return null;
  }, [routines, today]);

  const loadAll = async () => {
    setLoadingRoutines(true);
    setLoadingLogs(true);

    const [routinesData, logsData, fitCtx] = await Promise.all([
      DataService.getWorkoutRoutines(user?.id),
      DataService.getExerciseLogs(user?.id),
      FitnessContextService.getFitnessContext(user?.id),
    ]);

    setRoutines(routinesData);
    setExercises(logsData);
    setFitnessContext(fitCtx);
    setLoadingRoutines(false);
    setLoadingLogs(false);
  };

  // Active in-progress workout session detector (for recovery if tab closed/switched)
  const [activeSession, setActiveSession] = useState<{
    routineId: string;
    routineTitle: string;
    routine: WorkoutRoutine;
    status: 'active' | 'paused';
    elapsedSeconds: number;
    completedSetsCount: number;
    totalSetsCount: number;
  } | null>(null);

  const checkActiveSession = () => {
    try {
      const raw = localStorage.getItem(`nuvia_active_workout_${user?.id || 'demo'}`);
      if (raw) {
        const saved = JSON.parse(raw);
        const age = Date.now() - (saved.lastSavedAt || 0);
        if (age < 18 * 60 * 60 * 1000 && saved.routine && saved.sessionSets) {
          let totalSets = 0;
          let doneSets = 0;
          Object.values(saved.sessionSets as Record<string, any[]>).forEach((sets) => {
            totalSets += sets.length;
            doneSets += sets.filter((s: any) => s.completed).length;
          });
          setActiveSession({
            routineId: saved.routineId,
            routineTitle: saved.routineTitle || saved.routine.title,
            routine: saved.routine,
            status: saved.status || 'paused',
            elapsedSeconds: saved.elapsedSeconds || 0,
            completedSetsCount: doneSets,
            totalSetsCount: totalSets,
          });
          return;
        }
      }
      setActiveSession(null);
    } catch {
      setActiveSession(null);
    }
  };

  useEffect(() => {
    loadAll();
    checkActiveSession();
  }, [user?.id, refreshKey]);

  useEffect(() => {
    checkActiveSession();
  }, [selectedRoutine]);

  const handleResumeActiveSession = () => {
    if (activeSession) {
      setSelectedRoutine(activeSession.routine);
      setRoutineInitialMode('workout');
    }
  };

  const handleDiscardActiveSession = () => {
    if (confirm('Discard this in-progress workout session?')) {
      try {
        localStorage.removeItem(`nuvia_active_workout_${user?.id || 'demo'}`);
      } catch {
        // ignore
      }
      setActiveSession(null);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleSaveRoutinesFromAi = async (newRoutines: WorkoutRoutine[]) => {
    for (const r of newRoutines) {
      await DataService.saveWorkoutRoutine(r, user?.id);
    }
    await loadAll();
    showNotification(`Added ${newRoutines.length} routine(s) from AI consultation!`);
  };

  const handleSaveManualRoutine = async (routine: WorkoutRoutine) => {
    await DataService.saveWorkoutRoutine(routine, user?.id);
    await loadAll();
    showNotification(`Saved "${routine.title}"!`);
  };

  const handleDeleteRoutine = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Are you sure you want to remove this workout routine?')) {
      await DataService.deleteWorkoutRoutine(id, user?.id);
      if (selectedRoutine?.id === id) {
        setSelectedRoutine(null);
      }
      await loadAll();
      showNotification('Workout routine removed.');
    }
  };

  const handleEditRoutine = (routine: WorkoutRoutine, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRoutine(routine);
  };

  const handleDuplicateRoutine = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cloned = await DataService.duplicateWorkoutRoutine(id, user?.id);
    if (cloned) {
      await loadAll();
      showNotification(`Duplicated routine as "${cloned.title}"`);
    }
  };

  const handleSaveEditedRoutine = async (updated: WorkoutRoutine) => {
    await DataService.saveWorkoutRoutine(updated, user?.id);
    if (selectedRoutine?.id === updated.id) {
      setSelectedRoutine(updated);
    }
    await loadAll();
    showNotification(`Updated "${updated.title}"`);
  };

  const handleStartWorkoutDirect = (routine: WorkoutRoutine, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRoutineInitialMode('workout');
    setSelectedRoutine(routine);
  };

  const handleOpenRoutineOverview = (routine: WorkoutRoutine) => {
    setRoutineInitialMode('overview');
    setSelectedRoutine(routine);
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

  const handleNextActionClick = (action: any) => {
    if (action.type === 'start_workout') {
      const routine = routines.find((r) => r.id === action.routineId);
      if (routine) {
        handleStartWorkoutDirect(routine);
      }
    } else if (action.type === 'continue_workout') {
      handleResumeActiveSession();
    } else if (action.type === 'recovery') {
      setShowRecoverySheet(true);
    } else if (action.type === 'optional_activity') {
      onOpenAddExercise();
    }
  };

  const handleAcceptAdaptiveProposal = async (proposal: any, selectedOption: any) => {
    if (!user?.id) return;
    try {
      const targetDate = selectedOption.to_date || proposal.suggested_date || todayStr;
      await DataService.saveScheduleAdaptation({
        user_id: user.id,
        routine_id: proposal.routine_id,
        routine_title: proposal.routine_title,
        date: targetDate,
        original_date: proposal.from_date,
        target_date: targetDate,
        action: selectedOption.action === 'move' ? 'move_workout' : selectedOption.action === 'add_activity' ? 'add_activity' : 'cancel_workout',
        reason: proposal.reason,
        status: 'accepted',
        user_confirmed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      FitnessContextService.invalidateFitnessContext(user.id);
      await loadAll();
      showNotification('Schedule adapted successfully.');
    } catch (e) {
      console.error('Failed to accept adaptive proposal', e);
    }
  };

  const handleUndoAdaptation = async (changeId: string) => {
    try {
      await DataService.undoScheduleAdaptation(changeId);
      FitnessContextService.invalidateFitnessContext(user?.id);
      await loadAll();
      showNotification('Schedule adaptation undone.');
    } catch (e) {
      console.error('Failed to undo schedule adaptation', e);
    }
  };

  // Filter to today's exercises for the Today view
  const todayExercises = useMemo(() => {
    return exercises.filter(
      (e) => new Date(e.created_at || new Date()).toDateString() === today.toDateString()
    );
  }, [exercises, today]);

  const totalBurned = todayExercises.reduce(
    (sum, e) => sum + (Number(e.calories_burned) || 0),
    0
  );
  const totalMinutes = todayExercises.reduce(
    (sum, e) => sum + (Number(e.duration_minutes) || 0),
    0
  );

  // History stats
  const historyStats = useMemo(() => {
    let activeDays = 0;
    let totalKcal = 0;
    let workoutsCount = 0;

    Object.values(activityMap).forEach((val) => {
      if (val.hasWorkout || val.burned > 0) {
        activeDays++;
        totalKcal += val.burned || 0;
        if (val.hasWorkout) workoutsCount++;
      }
    });

    return {
      activeDays: Math.max(activeDays, exercises.length > 0 ? 1 : 0),
      workoutsCount: Math.max(workoutsCount, exercises.length),
      totalKcal: Math.max(
        totalKcal,
        exercises.reduce((s, e) => s + (Number(e.calories_burned) || 0), 0)
      ),
    };
  }, [activityMap, exercises]);

  // Group historical exercises by date strictly from timestamp, descending
  const groupedExercises = useMemo(() => {
    const sorted = [...exercises].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const map = new Map<string, ExerciseLog[]>();
    sorted.forEach((ex) => {
      const d = new Date(ex.created_at || new Date());
      const key = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ex);
    });
    return Array.from(map.entries());
  }, [exercises]);

  // If a routine is active in workout or overview mode
  if (selectedRoutine) {
    return (
      <>
        <RoutineDetailView
          routine={selectedRoutine}
          initialMode={routineInitialMode}
          onBack={() => {
            setSelectedRoutine(null);
            loadAll();
          }}
          onDeleteRoutine={async (id) => {
            await handleDeleteRoutine(id);
          }}
          onEditRoutine={(r) => setEditingRoutine(r)}
          onDuplicateRoutine={(id) => handleDuplicateRoutine(id)}
          onWorkoutFinished={() => {
            loadAll();
            checkActiveSession();
            showNotification('Workout completed & calories calculated! Recorded on homepage.');
            onWorkoutFinished?.();
          }}
          onNavigateHome={() => {
            setSelectedRoutine(null);
            if (onNavigateTab) {
              onNavigateTab('home');
            }
          }}
        />

        {editingRoutine && (
          <RoutineEditView
            routine={editingRoutine}
            isOpen={!!editingRoutine}
            onClose={() => setEditingRoutine(null)}
            onSave={async (updated) => {
              await handleSaveEditedRoutine(updated);
              setEditingRoutine(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-28 px-4 pt-3 w-full max-w-md mx-auto space-y-6 animate-fadeIn">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="pt-1 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Fitness & Training
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">Activity</h1>
        </div>

        {viewMode === 'today' && (
          <p className="text-xs text-[#8E8E93] mb-1 font-medium">
            {todayDayName}
          </p>
        )}
      </div>

      {/* ── TOAST NOTIFICATION ──────────────────────────────────────────── */}
      {successBanner && (
        <div className="p-3 rounded-2xl bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* ── ACTIVE IN-PROGRESS WORKOUT RECOVERY BANNER ────────────────────── */}
      {activeSession && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FF9F0A]/20 via-[#1C1C1E] to-[#1C1C1E] border border-[#FF9F0A]/40 shadow-xl flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#FF9F0A]/20 text-[#FF9F0A] flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 fill-[#FF9F0A]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">Session in Progress</p>
              <p className="text-[11px] text-[#8E8E93] truncate">
                {activeSession.routineTitle} · {activeSession.completedSetsCount}/{activeSession.totalSetsCount} sets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDiscardActiveSession}
              className="text-[11px] font-semibold text-[#8E8E93] hover:text-white px-2 py-1"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleResumeActiveSession}
              className="px-3 py-1.5 rounded-xl bg-[#FF9F0A] text-black text-xs font-bold hover:bg-[#FF9F0A]/90 transition-all flex items-center gap-1 shadow"
            >
              <span>Resume</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── COMPACT APPLE SEGMENTED CONTROL ─────────────────────────────── */}
      <div className="p-1 bg-[#1C1C1E] border border-white/[0.08] rounded-xl flex items-center">
        <button
          type="button"
          onClick={() => setViewMode('today')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            viewMode === 'today'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => setViewMode('plans')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            viewMode === 'plans'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          Plans
        </button>

        <button
          type="button"
          onClick={() => setViewMode('history')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            viewMode === 'history'
              ? 'bg-[#2C2C2E] text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 1. TODAY VIEW ("What have I done today, and what next?") ────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'today' && (
        <div className="space-y-6">
          {/* ── WEEKLY ADAPTATION STRIP ──────────────────────────────────── */}
          <WeeklyAdaptationStrip
            days={fitnessContext?.adaptive?.weekly_view || []}
            onOpenWeeklyReport={() => setIsWeeklyReportOpen(true)}
          />

          {/* ── NUVIA NEXT ACTION CARD ──────────────────────────────────── */}
          {fitnessContext?.adaptive?.next_action && (
            <NuviaNextActionCard
              action={fitnessContext.adaptive.next_action}
              onActionClick={handleNextActionClick}
              onAcceptProposal={handleAcceptAdaptiveProposal}
              onUndoProposal={handleUndoAdaptation}
            />
          )}

          {/* ── ACTIVITY SUMMARY HERO (Large Typography) ─────────────────── */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase block">
              Today · {todayFormatted}
            </span>

            <div className="flex items-baseline gap-6 pt-1">
              <div>
                <span className="text-4xl font-extrabold text-white tracking-tight leading-none block">
                  {totalMinutes > 0 ? `${totalMinutes}m` : '0m'}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mt-1 block">
                  Active Time
                </span>
              </div>

              <div>
                <span className="text-4xl font-extrabold text-white tracking-tight leading-none block">
                  {totalBurned > 0 ? totalBurned.toLocaleString() : '0'}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mt-1 block">
                  kcal Burned
                </span>
              </div>
            </div>

            {/* Concise Status Line */}
            <div className="pt-2 flex items-center gap-2">
              {todayExercises.length > 0 ? (
                <span className="text-xs font-semibold text-[#30D158] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Workout completed · {cleanActivityTitle(todayExercises[todayExercises.length - 1]?.exercise_type).title}
                  </span>
                </span>
              ) : todayRoutine ? (
                <span className="text-xs font-medium text-white flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-[#0A84FF]" />
                  <span>
                    Scheduled today: <strong className="text-white">{cleanActivityTitle(todayRoutine.title).title}</strong>
                  </span>
                </span>
              ) : (
                <span className="text-xs text-[#8E8E93]">
                  Recovery day · No workout scheduled for today
                </span>
              )}
            </div>
          </div>

          <div className="h-px bg-white/[0.06] w-full" />

          {/* ── UP NEXT (Action-First) ──────────────────────────────────── */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase block">
              Up Next
            </span>

            {tomorrowRoutine ? (
              /* Tomorrow is a workout day */
              <div className="ios-card p-4 space-y-3 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30">
                    Tomorrow · Workout Day
                  </span>
                  <span className="text-xs text-[#8E8E93]">
                    {tomorrowRoutine.exercises.length} exercises
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {tomorrowRoutine.exercises[0] ? (
                      <ExerciseThumbnail
                        exercise={tomorrowRoutine.exercises[0]}
                        aspectRatio="1/1"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Dumbbell className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-white truncate">
                      {cleanActivityTitle(tomorrowRoutine.title).title}
                    </h3>
                    <p className="text-xs text-[#8E8E93] mt-0.5 truncate">
                      Focus: {tomorrowRoutine.focus || 'Strength & Conditioning'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartWorkoutDirect(tomorrowRoutine)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Start Workout</span>
                </button>
              </div>
            ) : isTomorrowRest ? (
              /* Tomorrow is an active recovery day */
              <div className="ios-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                    Tomorrow · Recovery Day
                  </span>
                  <button
                    onClick={() => setShowRecoverySheet(true)}
                    className="text-[11px] font-semibold text-[#30D158] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Why recovery?</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">Active Recovery & Restoration</h3>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    No heavy training scheduled for {tomorrowDayName}. Focus on sleep and nutrition.
                  </p>
                </div>

                {/* Clean Recovery Checklist */}
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 pt-1">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <Droplets className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
                    <span>2.5 L water</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <Flame className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                    <span>Hit {goals?.protein_target || 140}g protein</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span>15m mobility walk</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>7–8h deep sleep</span>
                  </div>
                </div>

                {nextScheduled && (
                  <button
                    type="button"
                    onClick={() => handleOpenRoutineOverview(nextScheduled.routine)}
                    className="w-full pt-1 text-xs text-[#8E8E93] hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>
                      Next session: <strong className="text-white">{cleanActivityTitle(nextScheduled.routine.title).title}</strong> ({nextScheduled.dayName})
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              /* No routines set up yet */
              <div className="ios-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">No Upcoming Routine</p>
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">
                    Add or paste your training routine in the Plans tab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('plans')}
                  className="px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Go to Plans
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.06] w-full" />

          {/* ── TODAY'S TIMELINE ────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase">
                Today&apos;s Activity
              </span>
              <button
                type="button"
                onClick={onOpenAddExercise}
                className="text-xs text-[#30D158] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Activity</span>
              </button>
            </div>

            {loadingLogs ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-[#1C1C1E] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : todayExercises.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-center space-y-2">
                <p className="text-sm font-semibold text-white">Nothing logged yet</p>
                <p className="text-xs text-[#8E8E93] max-w-xs mx-auto">
                  Your activity timeline will appear here as you log sessions or complete workouts today.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddExercise}
                  className="mt-2 px-4 py-2 rounded-full bg-[#30D158] text-black font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Activity</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] text-xs">
                {todayExercises.map((ex) => {
                  const exDate = new Date(ex.created_at || new Date());
                  const timeLabel = exDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={ex.id}
                      className="py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: intensityColor(ex.intensity || 'moderate') }}
                        />
                        <div>
                          <p className="font-semibold text-white text-sm">{ex.exercise_type}</p>
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            {fmtDuration(Number(ex.duration_minutes))}
                            {ex.distance_km ? ` · ${ex.distance_km} km` : ''}
                            <span className="text-[#636366]"> · {timeLabel}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-sm">
                          ~{ex.calories_burned} kcal
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.06] w-full" />

          {/* ── NUVIA COACH INSIGHT ──────────────────────────────────────── */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#30D158]" />
                <span className="font-bold text-white text-xs">Coach Insight</span>
              </div>
              <button
                onClick={() => setShowRecoverySheet(true)}
                className="text-[11px] text-[#30D158] hover:underline cursor-pointer"
              >
                Why? →
              </button>
            </div>

            <p className="text-[#8E8E93] leading-relaxed">
              {todayHasWorkout
                ? 'Great effort on your session today. Muscles adapt and synthesize new tissue during rest—fuel with adequate protein and aim for 7–8 hours of quality sleep.'
                : todayRoutine
                ? `You have "${todayRoutine.title}" planned for today. Complete it when your energy is highest, or log any manual activity.`
                : 'Rest and recovery day. Keep activity gentle, focus on mobility, and replenish hydration.'}
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 2. PLANS VIEW ("What I intend to do") ───────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'plans' && (
        <div className="space-y-4">
          {/* Weekly Schedule Strip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase">
                Adapted Weekly Plan
              </span>
              <button
                type="button"
                onClick={() => setIsWeeklyReportOpen(true)}
                className="text-[11px] font-semibold text-[#30D158] hover:underline"
              >
                Weekly Report →
              </button>
            </div>
            <WeeklyAdaptationStrip
              days={fitnessContext?.adaptive?.weekly_view || []}
              onOpenWeeklyReport={() => setIsWeeklyReportOpen(true)}
            />
          </div>

          <div className="h-px bg-white/[0.06] w-full" />

          {/* Header Action Strip */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase">
              Your Routines ({routines.length})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAiPasteOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-[#30D158] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Paste</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManualRoutineOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-white text-black font-bold text-xs flex items-center gap-1 hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Build</span>
              </button>
            </div>
          </div>

          {loadingRoutines ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 bg-[#1C1C1E] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : routines.length === 0 ? (
            <div className="ios-card p-6 text-center space-y-3">
              <Dumbbell className="w-8 h-8 text-[#8E8E93] mx-auto" />
              <div>
                <p className="text-sm font-bold text-white">No Routines Created</p>
                <p className="text-xs text-[#8E8E93] mt-1 max-w-xs mx-auto">
                  Build a custom training split or paste your workout routine from your AI coach.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAiPasteOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white/[0.08] text-white font-semibold text-xs cursor-pointer"
                >
                  Paste AI Routine
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualRoutineOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#30D158] text-black font-bold text-xs cursor-pointer"
                >
                  Build Custom
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {routines.map((routine) => {
                const isScheduledToday = routine.days.some(
                  (d) => d.toLowerCase() === todayDayName.toLowerCase()
                );

                return (
                  <div
                    key={routine.id}
                    onClick={() => handleOpenRoutineOverview(routine)}
                    className="ios-card p-4 space-y-3 hover:border-white/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          {isScheduledToday && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#30D158] text-black">
                              Today
                            </span>
                          )}
                          <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">
                            {routine.days.join(', ') || 'Flexible days'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-[#30D158] transition-colors">
                          {routine.title}
                        </h3>
                        <p className="text-xs text-[#8E8E93] mt-0.5">
                          {routine.exercises.length} exercises · Focus: {routine.focus || 'Strength'}
                        </p>
                      </div>

                      {/* Thumbnail Preview strip */}
                      <div className="flex -space-x-2 overflow-hidden shrink-0">
                        {routine.exercises.slice(0, 3).map((ex, idx) => (
                          <div
                            key={idx}
                            className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 overflow-hidden shrink-0"
                          >
                            <ExerciseThumbnail
                              exercise={ex}
                              aspectRatio="1/1"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleEditRoutine(routine, e)}
                          className="p-1.5 text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateRoutine(routine.id, e)}
                          className="p-1.5 text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoutine(routine.id, e)}
                          className="p-1.5 text-[#8E8E93] hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleStartWorkoutDirect(routine, e)}
                        className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs flex items-center gap-1 hover:bg-zinc-200 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-black" />
                        <span>Start</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 3. HISTORY VIEW ("What I did previously") ───────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'history' && (
        <div className="space-y-5">
          {/* Monthly Stats Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center">
              <span className="text-xl font-bold text-white tracking-tight block">
                {historyStats.activeDays}
              </span>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block mt-0.5">
                Active Days
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center">
              <span className="text-xl font-bold text-white tracking-tight block">
                {historyStats.workoutsCount}
              </span>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block mt-0.5">
                Workouts
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center">
              <span className="text-xl font-bold text-white tracking-tight block">
                {historyStats.totalKcal.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block mt-0.5">
                kcal Burned
              </span>
            </div>
          </div>

          {/* Minimal Clean Calendar */}
          <div className="ios-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{monthName}</span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedMonthOffset((prev) => prev - 1)}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 transition-colors cursor-pointer"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonthOffset(0)}
                  className={`px-2 h-7 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    selectedMonthOffset === 0
                      ? 'text-zinc-500 bg-transparent'
                      : 'text-zinc-300 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonthOffset((prev) => prev + 1)}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 transition-colors cursor-pointer"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500 uppercase">
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
              <span>Su</span>
            </div>

            {/* Monthly Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`blank-${i}`} className="h-8" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const d = new Date(viewedYear, viewedMonth, dayNum);
                const dateStr = getLocalDateString(d);
                const isToday = dateStr === todayStr;
                const act = activityMap[dateStr];
                const hasWorkout = Boolean(act?.hasWorkout);
                const hasMeal = Boolean(act?.hasMeal);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleDayClick(dateStr)}
                    className={`relative h-8 rounded-lg flex flex-col items-center justify-center text-xs transition-all cursor-pointer ${
                      isToday ? 'border border-white text-white font-bold' : 'text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="leading-none text-[11px]">{dayNum}</span>
                    <div className="flex gap-0.5 mt-0.5">
                      {hasWorkout && <span className="w-1 h-1 rounded-full bg-[#30D158]" />}
                      {hasMeal && <span className="w-1 h-1 rounded-full bg-[#FF9500]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Simple Legend */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
                  <span>Workout</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                  <span>Meal</span>
                </span>
              </div>
              <span>Tap day for details</span>
            </div>
          </div>

          {/* Chronological Activity Log */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase block">
              Recent Activity
            </span>

            {groupedExercises.length === 0 ? (
              <p className="text-xs text-[#8E8E93] text-center py-6">No historical activity recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {groupedExercises.map(([dateTitle, list]) => (
                  <div key={dateTitle} className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#8E8E93] uppercase px-1">
                      {dateTitle}
                    </span>
                    <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
                      {list.map((ex) => {
                        const data = getActivityDisplayData(ex);
                        return (
                          <div
                            key={ex.id}
                            onClick={() => {
                              setSelectedHistoryLog(ex);
                              setIsHistoryDetailOpen(true);
                            }}
                            className="p-3.5 flex items-center justify-between hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors cursor-pointer group select-none"
                          >
                            <div className="flex-1 pr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-white text-xs tracking-tight group-hover:text-[#30D158] transition-colors">
                                  {data.cleanTitle}
                                </p>
                                {data.isPartial && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    Partial ({data.movementsSummary || 'incomplete'})
                                  </span>
                                )}
                              </div>
                              {data.equipmentSubtitle && (
                                <p className="text-[10px] text-[#30D158] font-medium mt-0.5">
                                  {data.equipmentSubtitle}
                                </p>
                              )}
                              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                                {fmtDuration(Number(ex.duration_minutes))}
                                {ex.distance_km ? ` · ${ex.distance_km} km` : ''}
                                {data.movementsSummary && !data.isPartial ? ` · ${data.movementsSummary}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="font-black text-white text-xs">~{data.caloriesBurned} kcal</span>
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteExercise(ex.id);
                                }}
                                className="text-zinc-600 hover:text-red-400 p-1 transition-colors cursor-pointer ml-1"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── RECOVERY GUIDANCE BOTTOM SHEET ──────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showRecoverySheet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Why is Recovery Crucial?</h3>
                <p className="text-[11px] text-[#8E8E93]">The science of muscle adaptation</p>
              </div>
              <button
                onClick={() => setShowRecoverySheet(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                Muscles don&apos;t grow during your workouts—they grow <strong className="text-white">afterward</strong> while recovering. Strength training creates microscopic micro-tears in muscle fibers. Your body repairs and thickens these fibers during rest periods through muscle protein synthesis.
              </p>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                <span className="font-bold text-white block">Key Recovery Pillars</span>
                <div className="space-y-1.5 text-[11px] text-[#8E8E93]">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
                    <span className="text-zinc-300">
                      <strong className="text-white">Hydration:</strong> 2.5L+ restores cell volume and transports nutrients.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                    <span className="text-zinc-300">
                      <strong className="text-white">Protein:</strong> Hit your daily macro target to provide amino acid building blocks.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span className="text-zinc-300">
                      <strong className="text-white">Active Mobility:</strong> 15-20 min light walking promotes blood flow without fatigue.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-zinc-300">
                      <strong className="text-white">Deep Sleep:</strong> 7–8 hours triggers growth hormone release.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowRecoverySheet(false)}
              className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODALS (100% Preserved) ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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

      <DayDetailsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        dateStr={inspectDateStr}
        summary={inspectSummary}
        meals={inspectMeals}
        exercises={inspectExercises}
        routine={inspectRoutine || null}
        isToday={inspectDateStr === todayStr}
        onOpenAddMeal={onOpenAddMeal}
        onOpenAddExercise={onOpenAddExercise}
      />

      <ActivityDetailsModal
        log={selectedHistoryLog}
        isOpen={isHistoryDetailOpen}
        onClose={() => {
          setIsHistoryDetailOpen(false);
          setSelectedHistoryLog(null);
        }}
        onDelete={handleDeleteExercise}
      />

      {editingRoutine && (
        <RoutineEditView
          routine={editingRoutine}
          isOpen={!!editingRoutine}
          onClose={() => setEditingRoutine(null)}
          onSave={async (updated) => {
            await handleSaveEditedRoutine(updated);
            setEditingRoutine(null);
          }}
        />
      )}

      <WeeklyReportModal
        isOpen={isWeeklyReportOpen}
        onClose={() => setIsWeeklyReportOpen(false)}
        report={fitnessContext?.adaptive?.weekly_report}
      />
    </div>
  );
}
