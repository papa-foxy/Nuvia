import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronRight, Sparkles, Send, Dumbbell, CheckCircle2, Camera, Moon, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { DailySummary, Meal, ExerciseLog } from '@/types/database';
import { WorkoutRoutine } from '@/types/routine';
import { TabType } from './Navigation';
import {
  NuviaCache,
  todaySummaryKey,
  todayMealsKey,
  todayActivityKey,
  workoutRoutinesKey,
} from '@/lib/nuvia-cache';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { calculateTargets, getUserCalculationContext } from '@/lib/calculator';
import { cleanActivityTitle } from '@/lib/activity-utils';
import { FitnessContextService } from '@/lib/fitness-context-service';
import { NuviaFitnessContext } from '@/types/fitness-context';
import { IntentProposalCard } from './adaptive/IntentProposalCard';
import { AiService } from '@/lib/ai-service';
import { ScreenHeader } from './ScreenHeader';
import { Card, ProgressBar, ProgressRing } from './ui';
import { useTrainingOverview } from './home/TrainingOverview';
import {
  NaturalLanguageLoggingContext,
  NaturalLanguageParseResult,
} from '@/types/natural-language';

interface DashboardViewProps {
  onOpenAddMeal: () => void;
  onOpenAddExercise: () => void;
  onNavigateTab: (tab: TabType) => void;
  onNaturalLanguageInput: (text: string) => void;
  onNaturalLanguageParsed?: (result: NaturalLanguageParseResult) => void;
  onWorkoutLogged?: () => void;
  /** @deprecated - no longer triggers a full reload; kept for API compatibility */
  refreshKey?: number;
}

export function DashboardView({
  onOpenAddMeal,
  onOpenAddExercise,
  onNavigateTab,
  onNaturalLanguageInput,
  onNaturalLanguageParsed,
  onWorkoutLogged,
  refreshKey,
}: DashboardViewProps) {
  const { user, profile, goals } = useAuth();

  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [recentExercises, setRecentExercises] = useState<ExerciseLog[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [fitnessContext, setFitnessContext] = useState<NuviaFitnessContext | null>(null);
  const [nlContext, setNlContext] = useState<NaturalLanguageLoggingContext | null>(null);

  // Separate loading state for first-ever load vs background refetch
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [quickInput, setQuickInput] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [nuviaReply, setNuviaReply] = useState<string | null>(null);
  const [targetUpdateNotice, setTargetUpdateNotice] = useState<{ prev: number; current: number } | null>(null);
  const [activeProposal, setActiveProposal] = useState<any | null>(null);
  const [pendingWorkoutReview, setPendingWorkoutReview] = useState<any | null>(null);

  const today = new Date();
  const dateFormatted = today
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
  const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const todayStr = getLocalDateString(today);

  // Track the previous refreshKey to detect intentional invalidations
  const prevRefreshKey = useRef<number | undefined>(refreshKey);

  const userId = user?.id;
  const overview = useTrainingOverview(userId, refreshKey);

  const applyData = useCallback(
    (s: DailySummary | null, m: Meal[], e: ExerciseLog[], r: WorkoutRoutine[]) => {
      setSummary(s);
      setRecentMeals(m);
      setRecentExercises(e);
      setRoutines(r);
    },
    []
  );

  const fetchAndCache = useCallback(
    async (background = false) => {
      if (background) {
        setIsFetching(true);
      }
      try {
        const [s, m, e, r, fitCtx, nlCtx] = await Promise.all([
          DataService.getDailySummary(userId, todayStr),
          DataService.getMeals(userId, todayStr),
          DataService.getExerciseLogs(userId, todayStr),
          DataService.getWorkoutRoutines(userId),
          FitnessContextService.getFitnessContext(userId),
          FitnessContextService.getNaturalLanguageLoggingContext(userId),
        ]);

        // Write each result to the cache with a 90-second stale window
        const opts = { staleTime: 90_000, gcTime: 600_000 };
        NuviaCache.set(todaySummaryKey(userId, todayStr), s, opts);
        NuviaCache.set(todayMealsKey(userId, todayStr), m, opts);
        NuviaCache.set(todayActivityKey(userId, todayStr), e, opts);
        NuviaCache.set(workoutRoutinesKey(userId), r, opts);

        applyData(s, m, e, r);
        setFitnessContext(fitCtx);
        setNlContext(nlCtx);
      } finally {
        setIsInitialLoading(false);
        setIsFetching(false);
      }
    },
    [userId, todayStr, applyData]
  );

  // ── Main load effect ──────────────────────────────────────────────────────
  useEffect(() => {
    // Detect a forced refresh from the parent (meal/exercise saved)
    const forcedRefresh =
      prevRefreshKey.current !== undefined && refreshKey !== prevRefreshKey.current;
    prevRefreshKey.current = refreshKey;

    if (forcedRefresh) {
      // Parent triggered a data mutation — invalidate and hard-refetch
      NuviaCache.invalidate(todaySummaryKey(userId, todayStr));
      NuviaCache.invalidate(todayMealsKey(userId, todayStr));
      NuviaCache.invalidate(todayActivityKey(userId, todayStr));
      fetchAndCache(false);
      return;
    }

    // Check what's in the cache
    const cachedSummary  = NuviaCache.get<DailySummary | null>(todaySummaryKey(userId, todayStr));
    const cachedMeals    = NuviaCache.get<Meal[]>(todayMealsKey(userId, todayStr));
    const cachedActivity = NuviaCache.get<ExerciseLog[]>(todayActivityKey(userId, todayStr));
    const cachedRoutines = NuviaCache.get<WorkoutRoutine[]>(workoutRoutinesKey(userId));

    const allCached =
      cachedSummary !== null &&
      cachedMeals !== null &&
      cachedActivity !== null &&
      cachedRoutines !== null;

    if (allCached) {
      // Render immediately from cache — no loading state shown
      applyData(
        cachedSummary.data,
        cachedMeals.data,
        cachedActivity.data,
        cachedRoutines.data
      );
      setIsInitialLoading(false);

      // If any entry is stale, refresh in the background
      const anyStale =
        cachedSummary.isStale ||
        cachedMeals.isStale ||
        cachedActivity.isStale ||
        cachedRoutines.isStale;

      if (anyStale) {
        fetchAndCache(true); // background refresh — UI stays visible
      }
    } else {
      // Nothing in cache — full load needed
      fetchAndCache(false);
    }
  }, [userId, todayStr, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed values ───────────────────────────────────────────────────────
  const userCalc = useMemo(() => {
    const ctx = getUserCalculationContext(profile, goals);
    return calculateTargets(ctx);
  }, [profile, goals]);

  const maintenanceCalories = userCalc.tdee;
  const calorieTarget   = goals?.calorie_target       || userCalc.calorie_target;
  const proteinTarget   = goals?.protein_target        || userCalc.protein_target;
  const carbsTarget     = goals?.carbohydrate_target   || userCalc.carbohydrate_target;
  const fatTarget       = goals?.fat_target            || userCalc.fat_target;

  // Food consumed from logged meals
  const foodCalories = summary?.calories_consumed || 0;
  // Exercise calories burned from logged workouts/activities
  const proteinConsumed = summary?.protein_consumed || 0;
  const carbsConsumed = summary?.carbohydrate_consumed || 0;
  const fatConsumed = summary?.fat_consumed || 0;

  /**
   * Calorie accounting is intake-only:
   *   remaining = daily target − food eaten.
   * Exercise calories are shown in the Activity section for information but are
   * NOT subtracted from intake. The daily target itself (TDEE ± goal adjustment)
   * already accounts for the user's activity level.
   */
  const remainingCalories = Math.max(0, calorieTarget - foodCalories);
  const isOverTarget = foodCalories > calorieTarget;
  const overCalories = isOverTarget ? foodCalories - calorieTarget : 0;
  const proteinGap = Math.max(0, proteinTarget - proteinConsumed);

  const goalType = profile?.goal || 'lose_weight';

  // Target recalculation detection: show banner only when target actually changed
  useEffect(() => {
    if (!userId || !calorieTarget) return;
    const storageKey = `nuvia_last_calorie_target_${userId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const prevVal = Number(stored);
      if (prevVal && prevVal !== calorieTarget) {
        setTargetUpdateNotice({ prev: prevVal, current: calorieTarget });
      }
    } else {
      localStorage.setItem(storageKey, String(calorieTarget));
    }
  }, [userId, calorieTarget]);

  const handleDismissTargetNotice = () => {
    if (userId && calorieTarget) {
      localStorage.setItem(`nuvia_last_calorie_target_${userId}`, String(calorieTarget));
    }
    setTargetUpdateNotice(null);
  };

  const suggestions = useMemo(() => {
    if (!nlContext) return [];
    return FitnessContextService.generateContextualSuggestions(nlContext);
  }, [nlContext]);

  const placeholderText = useMemo(() => {
    if (nlContext?.today_routine && !nlContext.today_routine.is_completed) {
      return "Log a meal, activity, or today's workout...";
    }
    return "Tell Nuvia what you ate or did...";
  }, [nlContext]);

  const handleExecuteNaturalLanguage = async (text: string) => {
    if (!text.trim() || isInterpreting) return;
    const trimmed = text.trim();
    setQuickInput('');
    setIsInterpreting(true);
    setActiveProposal(null);
    setPendingWorkoutReview(null);

    try {
      const result = await AiService.parseNaturalInput({
        text: trimmed,
        context: nlContext || undefined,
      });

      // 1. Clarification needed
      if (result.requires_clarification) {
        setNuviaReply(result.clarification_prompt || "Could you clarify what you had or did?");
        return;
      }

      // 2. Training Intent (Adaptive Training Engine)
      if (result.intent === 'training_intent') {
        if (result.training_intent_data?.proposal) {
          setActiveProposal(result.training_intent_data.proposal);
        }
        setNuviaReply(
          result.training_intent_data?.reply ||
            `I've noted your training intent. Here is the recommended adjustment:`
        );
        return;
      }

      // 3. Question
      if (result.intent === 'question') {
        setNuviaReply(result.question_data?.reply || "Here is what I found.");
        return;
      }

      // 4. Workout / Partial Workout
      if (result.intent === 'workout' || result.intent === 'partial_workout') {
        if (result.workout_data) {
          setPendingWorkoutReview(result.workout_data);
          setNuviaReply(
            result.context_match?.note ||
              `Detected ${result.workout_data.is_partial ? 'partial ' : ''}workout: ${result.workout_data.routine_title}. Review below to confirm.`
          );
          return;
        }
      }

      // 5. Meal or Activity -> Pass to review modals in parent
      if (result.intent === 'meal' || result.intent === 'activity') {
        if (onNaturalLanguageParsed) {
          onNaturalLanguageParsed(result);
        } else {
          onNaturalLanguageInput(trimmed);
        }
        return;
      }

      setNuviaReply(`I've received your entry: "${trimmed}".`);
    } catch (err: any) {
      console.error('Natural language execution failed:', err);
      onNaturalLanguageInput(trimmed);
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleConfirmWorkoutReview = async (review: any) => {
    if (!review || !user) return;
    try {
      await DataService.addExerciseLog({
        user_id: user.id,
        exercise_type: review.routine_title,
        duration_minutes: review.duration_minutes || 45,
        intensity: 'moderate',
        distance_km: null,
        calories_burned: review.estimated_calories_burned || 280,
        source: 'routine',
        description: review.notes || `${review.routine_title} session`,
        confidence: 'high',
        ai_analysis: {
          executed_count: review.completed_exercise_count,
          total_exercises: review.total_exercise_count,
          completion_percentage: review.completion_percentage,
          is_partial: review.is_partial,
          stopped_after: review.stopped_after,
        },
      });

      setPendingWorkoutReview(null);
      setNuviaReply(
        `Logged ${review.routine_title} (${review.completion_percentage}% completed). Great effort!`
      );
      FitnessContextService.invalidateFitnessContext(user.id);
      onWorkoutLogged?.();
    } catch (err) {
      console.error('Failed to confirm workout:', err);
    }
  };

  const handleAskNuvia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    handleExecuteNaturalLanguage(quickInput);
  };

  // ── First-load skeleton ───────────────────────────────────────────────────
  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6 animate-pulse">
        <div className="pt-2">
          <div className="h-3 w-32 bg-elevated rounded-full mb-2" />
          <div className="h-8 w-20 bg-elevated rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-12 w-40 bg-elevated rounded-xl" />
          <div className="h-3 w-48 bg-elevated rounded-full" />
          <div className="h-1.5 w-full bg-elevated rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-12 bg-elevated rounded-full" />
              <div className="h-6 w-16 bg-elevated rounded-lg" />
              <div className="h-1 w-full bg-elevated rounded-full" />
            </div>
          ))}
        </div>
        <div className="h-20 w-full bg-elevated rounded-2xl" />
      </div>
    );
  }

  const displayName = profile?.name || user?.full_name || '';
  const firstName = displayName.trim().split(/\s+/)[0] || '';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Subtle background-refresh indicator */}
      {isFetching && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-accent animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%', marginLeft: 'auto', marginRight: 'auto' }} />
        </div>
      )}

      {/* Header: date, greeting, avatar (Profile lives behind the avatar) */}
      <div className="-mx-5">
        <ScreenHeader
          eyebrow={today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
          streak={overview.streak?.currentStreak ?? null}
          onOpenProfile={() => onNavigateTab('profile')}
        />
      </div>

      {/* CALORIES TODAY — intake vs target (the first thing on Home). Exercise is not subtracted. */}
      <Card as="section" aria-label="Calories today" className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Calories today</h2>
          <button
            type="button"
            onClick={() => onNavigateTab('summary')}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-fg transition-colors cursor-pointer -my-2 py-2"
          >
            Summary
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <ProgressRing value={foodCalories} max={calorieTarget} size={124} stroke={10} label="Calories eaten">
            <span
              className={`text-[26px] leading-none font-extrabold tabular-nums tracking-tight ${
                isOverTarget ? 'text-orange-ink' : 'text-fg'
              }`}
            >
              {(isOverTarget ? overCalories : remainingCalories).toLocaleString()}
            </span>
            <span className="mt-1 text-[11px] font-bold text-muted">{isOverTarget ? 'kcal over' : 'kcal left'}</span>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">Eaten</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[34px] leading-none font-extrabold tabular-nums tracking-tight text-fg">
                {foodCalories.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-muted">kcal</span>
            </p>
            <p className="mt-2 text-xs font-medium text-muted tabular-nums">
              of {calorieTarget.toLocaleString()} kcal target
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('goals')}
              className="mt-1 text-[11px] font-semibold text-subtle hover:text-fg transition-colors cursor-pointer"
            >
              Why this target? →
            </button>
          </div>
        </div>

        {/* Macros */}
        <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-4">
          {[
            { label: 'Protein', value: proteinConsumed, target: proteinTarget, tone: 'accent' as const },
            { label: 'Carbs', value: carbsConsumed, target: carbsTarget, tone: 'fg' as const },
            { label: 'Fat', value: fatConsumed, target: fatTarget, tone: 'fg' as const },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onNavigateTab('goals')}
              className="text-left cursor-pointer group"
            >
              <p className="text-[11px] font-semibold text-muted">{m.label}</p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums text-fg tracking-tight">
                {Math.round(m.value)}
                <span className="text-xs font-semibold text-muted"> / {Math.round(m.target)}g</span>
              </p>
              <ProgressBar value={m.value} max={m.target} tone={m.tone} label={`${m.label} eaten`} className="mt-1.5" />
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenAddMeal}
            className="h-11 rounded-[var(--radius-control)] bg-accent text-on-accent text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 stroke-[2.5]" />
            Log a meal
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('meals')}
            className="h-11 rounded-[var(--radius-control)] bg-elevated text-fg text-sm font-bold hover:bg-elevated-2 transition-colors cursor-pointer"
          >
            Today&apos;s meals
          </button>
        </div>
      </Card>


      <div className="ios-divider" />

      {/* TARGET RECALCULATION NOTIFICATION (When authoritative calorie target changes) */}
      {targetUpdateNotice && (
        <div className="p-3.5 rounded-2xl bg-fg/[0.04] border border-fg/[0.08] flex items-start justify-between gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
              <Sparkles className="w-3.5 h-3.5 text-green-ink" />
              <span>Calorie target updated</span>
            </div>
            <p className="text-sm text-fg font-bold tracking-tight">
              {targetUpdateNotice.prev.toLocaleString()} → {targetUpdateNotice.current.toLocaleString()} kcal/day
            </p>
            <p className="text-[11px] text-muted">
              Based on your latest goal and profile information.
            </p>
            <button
              type="button"
              onClick={() => {
                handleDismissTargetNotice();
                onNavigateTab('goals');
              }}
              className="text-[11px] text-green-ink hover:underline font-medium pt-0.5 block cursor-pointer"
            >
              Why this changed →
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismissTargetNotice}
            className="text-muted hover:text-fg p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TODAY'S WORKOUT — one compact card; the full schedule, adaptation and
          activity live on the Workout screen. */}
      {(() => {
        const scheduledFor = (r: WorkoutRoutine, dayName: string) => {
          const full = dayName.toLowerCase();
          const short = full.slice(0, 3);
          return (r.days || []).some((d) => {
            const x = d.trim().toLowerCase();
            return x === full || x.startsWith(short);
          });
        };
        const todays = routines.filter((r) => scheduledFor(r, todayDayName));
        const routine = todays[0];
        const isDone = (r: WorkoutRoutine) =>
          recentExercises.some(
            (e) =>
              e.ai_analysis?.routine_id === r.id ||
              e.exercise_type?.toLowerCase() === r.title.toLowerCase() ||
              (e.source === 'routine' && (e.description || '').toLowerCase().includes(r.title.toLowerCase())),
          );

        let next: { day: string; title: string } | null = null;
        if (!routine) {
          for (let i = 1; i <= 7 && !next; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const name = d.toLocaleDateString('en-US', { weekday: 'long' });
            const r = routines.find((x) => scheduledFor(x, name));
            if (r) next = { day: i === 1 ? 'Tomorrow' : name, title: cleanActivityTitle(r.title).title };
          }
        }

        return (
          <Card as="section" aria-label="Today's workout" className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Today&apos;s workout</h2>
              <button
                type="button"
                onClick={() => onNavigateTab('exercise')}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-fg transition-colors cursor-pointer -my-2 py-2"
              >
                Workout
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {routine ? (
              <button
                type="button"
                onClick={() => onNavigateTab('exercise')}
                className="mt-3 w-full flex items-center gap-3 text-left cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-[var(--radius-control)] overflow-hidden bg-elevated shrink-0">
                  {routine.exercises?.[0] ? (
                    <ExerciseThumbnail exercise={routine.exercises[0]} aspectRatio="1/1" className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold text-fg truncate">{cleanActivityTitle(routine.title).title}</p>
                  <p className="text-xs font-medium text-muted truncate">
                    {routine.exercises?.length || 0} exercises{routine.focus ? ` · ${routine.focus}` : ''}
                    {todays.length > 1 ? ` · +${todays.length - 1} more` : ''}
                  </p>
                </div>
                {isDone(routine) ? (
                  <span className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full bg-tint-green text-green-ink text-xs font-extrabold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Done
                  </span>
                ) : (
                  <span className="shrink-0 h-9 px-4 rounded-full bg-accent text-on-accent text-xs font-extrabold flex items-center group-hover:bg-accent-hover transition-colors">
                    Start
                  </span>
                )}
              </button>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-[var(--radius-control)] bg-elevated flex items-center justify-center text-muted shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-fg">Rest day</p>
                  <p className="text-xs font-medium text-muted truncate">
                    {next ? `Next: ${next.day} · ${next.title}` : 'No routines scheduled yet'}
                  </p>
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* SECTION 4: NUVIA QUICK INSIGHT & NATURAL LOGGER */}
      <div className="bg-card rounded-2xl p-4 border border-fg/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>Nuvia</span>
          </div>
          <button
            onClick={() => onNavigateTab('coach')}
            className="text-[11px] text-muted hover:text-fg transition-colors"
          >
            Insights &amp; Chat →
          </button>
        </div>

        <p className="text-xs text-fg-soft leading-relaxed">
          {nuviaReply ||
            (proteinGap > 20
              ? `You're ${proteinGap}g short of your protein target. For your next meal: grilled chicken, fish, tofu, or Greek yogurt (≈40g protein) will keep you on track.`
              : `You've maintained your calorie and macronutrient balance well today. Stay hydrated and prioritize recovery.`)}
        </p>

        {/* Dynamic Contextual Suggestion Chips */}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleExecuteNaturalLanguage(s.text)}
                disabled={isInterpreting}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-elevated hover:bg-elevated-2 text-fg-soft border border-fg/[0.08] transition-all flex items-center gap-1.5 active:scale-95"
              >
                {s.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-accent/20 text-green-ink font-bold">
                    {s.badge}
                  </span>
                )}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pending Workout Review Card */}
        {pendingWorkoutReview && (
          <div className="p-3.5 rounded-xl bg-surface border border-accent/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-green-ink uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Today's Workout</span>
              </span>
              {pendingWorkoutReview.is_partial && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
                  Partial ~{pendingWorkoutReview.completion_percentage}%
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-fg">{pendingWorkoutReview.routine_title}</p>
            <p className="text-xs text-muted">
              {pendingWorkoutReview.duration_minutes} mins · ~{pendingWorkoutReview.estimated_calories_burned} kcal
              {pendingWorkoutReview.notes ? ` · ${pendingWorkoutReview.notes}` : ''}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmWorkoutReview(pendingWorkoutReview)}
                className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs transition-colors"
              >
                Confirm &amp; Log Workout
              </button>
              <button
                type="button"
                onClick={() => setPendingWorkoutReview(null)}
                className="px-3 py-2 rounded-xl bg-elevated text-muted hover:text-fg text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active Adaptive Intent Proposal Card */}
        {activeProposal && (
          <IntentProposalCard
            proposal={activeProposal}
            onApplied={() => {
              setActiveProposal(null);
              setNuviaReply("Schedule updated. Check your weekly plan in Activity tab.");
            }}
            onDismiss={() => setActiveProposal(null)}
          />
        )}

        <form onSubmit={handleAskNuvia} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={placeholderText}
            disabled={isInterpreting}
            className="flex-1 bg-elevated text-xs text-fg placeholder-muted px-3 py-2 rounded-xl border border-transparent focus:border-accent focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!quickInput.trim() || isInterpreting}
            className="p-2 rounded-xl bg-elevated hover:bg-elevated-2 disabled:opacity-30 text-fg transition-colors flex items-center justify-center min-w-[32px]"
          >
            {isInterpreting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-ink" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
