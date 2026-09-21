import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronRight, Sparkles, Send, Dumbbell, Flame, CheckCircle2, Camera, Moon, X, Loader2 } from 'lucide-react';
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
import { NuviaNextActionCard } from './adaptive/NuviaNextActionCard';
import { IntentProposalCard } from './adaptive/IntentProposalCard';
import { AiService } from '@/lib/ai-service';
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
  const exerciseCalories = summary?.calories_burned || 0;
  const exerciseMinutes = summary?.exercise_minutes || 0;
  const proteinConsumed = summary?.protein_consumed || 0;
  const carbsConsumed = summary?.carbohydrate_consumed || 0;
  const fatConsumed = summary?.fat_consumed || 0;

  /**
   * Authoritative Calorie Accounting Pipeline:
   * 1. Maintenance (TDEE): Baseline energy expenditure calculated from Mifflin-St Jeor BMR * Activity Multiplier.
   * 2. Goal Adjustment: Deficit/surplus based on user's target (e.g. -500 kcal for fat loss, +250 kcal for muscle gain).
   * 3. Daily Calorie Target: The authoritative dietary baseline allowance (TDEE + Goal Adjustment).
   * 4. Eligible Exercise Credit: Workout and activity calories burned logged today (exerciseCalories).
   * 5. Net Calories: Actual food consumed minus eligible exercise credit (foodCalories - exerciseCalories).
   * 6. Remaining Budget: Allowance remaining within the daily target (dailyTarget - netCalories).
   *
   * Accounting integrity: Food consumed is never artificially altered, recorded workout burns remain
   * exact, and exercise directly offsets food intake within the daily net budget without double-counting baseline activity.
   */
  const netCalories = foodCalories - exerciseCalories;
  const remainingCalories = calorieTarget - netCalories;
  const isOverTarget = netCalories > calorieTarget;
  const overCalories = isOverTarget ? netCalories - calorieTarget : 0;
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
          <div className="h-3 w-32 bg-[#2C2C2E] rounded-full mb-2" />
          <div className="h-8 w-20 bg-[#2C2C2E] rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-12 w-40 bg-[#2C2C2E] rounded-xl" />
          <div className="h-3 w-48 bg-[#2C2C2E] rounded-full" />
          <div className="h-1.5 w-full bg-[#2C2C2E] rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-12 bg-[#2C2C2E] rounded-full" />
              <div className="h-6 w-16 bg-[#2C2C2E] rounded-lg" />
              <div className="h-1 w-full bg-[#2C2C2E] rounded-full" />
            </div>
          ))}
        </div>
        <div className="h-20 w-full bg-[#2C2C2E] rounded-2xl" />
      </div>
    );
  }

  const avatarUrl = profile?.avatar_url || user?.avatar_url;
  const displayName = profile?.name || user?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Subtle background-refresh indicator */}
      {isFetching && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-[#30D158] animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%', marginLeft: 'auto', marginRight: 'auto' }} />
        </div>
      )}

      {/* Large Page Title (Apple Health Style) with User Avatar */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93]">
            {dateFormatted}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">Today</h1>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          className="relative group p-0.5 rounded-full hover:scale-105 active:scale-95 transition-transform"
          title="View Profile"
        >
          <div className="w-10 h-10 rounded-full bg-[#1C1C1E] border border-white/20 group-hover:border-[#30D158] overflow-hidden flex items-center justify-center text-white font-bold text-sm shadow-md">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>
        </button>
      </div>

      {/* TARGET RECALCULATION NOTIFICATION (When authoritative calorie target changes) */}
      {targetUpdateNotice && (
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-start justify-between gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles className="w-3.5 h-3.5 text-[#30D158]" />
              <span>Calorie target updated</span>
            </div>
            <p className="text-sm text-white font-bold tracking-tight">
              {targetUpdateNotice.prev.toLocaleString()} → {targetUpdateNotice.current.toLocaleString()} kcal/day
            </p>
            <p className="text-[11px] text-[#8E8E93]">
              Based on your latest goal and profile information.
            </p>
            <button
              type="button"
              onClick={() => {
                handleDismissTargetNotice();
                onNavigateTab('goals');
              }}
              className="text-[11px] text-[#30D158] hover:underline font-medium pt-0.5 block cursor-pointer"
            >
              Why this changed →
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismissTargetNotice}
            className="text-[#8E8E93] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: CALORIES (NET CALORIE BUDGETING MODEL) */}
      <div onClick={() => onNavigateTab('summary')} className="cursor-pointer group">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
            Calories
          </span>
          <span className="text-xs text-[#8E8E93] group-hover:text-white flex items-center gap-0.5 transition-colors">
            <span>Summary</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* 1. How much did I eat? (Primary Number) */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[40px] sm:text-[44px] font-semibold tracking-tight text-white leading-none">
            {foodCalories.toLocaleString()}
          </span>
          <span className="text-base text-[#8E8E93] font-normal">
            kcal eaten
          </span>
        </div>

        {/* 2 & 3. What is my net balance? & How much room do I have left? */}
        <div className="flex items-center gap-2 mt-1.5 text-sm font-medium">
          <span className="text-white font-semibold">
            {netCalories.toLocaleString()} kcal net
          </span>
          <span className="text-[#8E8E93]">·</span>
          {isOverTarget ? (
            <span className="text-[#FF9F0A] font-semibold">
              {overCalories.toLocaleString()} kcal above target
            </span>
          ) : (
            <span className="text-[#8E8E93]">
              <span className="text-white font-semibold">{remainingCalories.toLocaleString()} kcal</span> remaining
            </span>
          )}
        </div>

        {/* Subtractive / Overlay Calorie Lane (Total lane represents Daily Target; Blue overlays food offset) */}
        <div className="w-full bg-[#2C2C2E] h-2 rounded-full overflow-hidden mt-3.5 relative">
          <div
            className="h-full flex rounded-full transition-all duration-500 overflow-hidden"
            style={{
              width: `${Math.min(100, Math.max(0, (foodCalories / calorieTarget) * 100))}%`,
            }}
          >
            {/* Net calories consumed (Solid Nuvia Green) */}
            <div
              className="bg-[#30D158] h-full transition-all duration-500"
              style={{
                width: foodCalories > 0
                  ? `${Math.min(100, Math.max(0, (netCalories / foodCalories) * 100))}%`
                  : '0%',
              }}
            />
            {/* Activity credit offset (Subtle Blue subtraction overlay) */}
            {exerciseCalories > 0 && foodCalories > 0 && (
              <div
                className="bg-[#0A84FF] h-full transition-all duration-500 opacity-90"
                style={{
                  width: `${Math.min(100, Math.max(0, (Math.min(exerciseCalories, foodCalories) / foodCalories) * 100))}%`,
                }}
                title={`-${exerciseCalories} kcal activity credit offset`}
              />
            )}
          </div>
        </div>

        {/* Direct Supporting Equation */}
        <p className="text-xs text-[#8E8E93] mt-2 font-normal">
          {foodCalories.toLocaleString()} eaten
          {exerciseCalories > 0 ? ` − ${exerciseCalories.toLocaleString()} activity` : ' − 0 activity'}
          {' = '}
          <span className="text-white font-medium">{netCalories.toLocaleString()} net</span>
        </p>

        {/* 4. Why is my target this value? (Daily target & maintenance secondary context) */}
        <div className="flex items-center justify-between text-xs text-[#8E8E93] mt-2 pt-2.5 border-t border-white/[0.05]">
          <span>
            Daily target: <span className="text-white font-medium">{calorieTarget.toLocaleString()} kcal</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateTab('goals');
            }}
            className="text-[11px] text-[#8E8E93] hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
            title="Why this target?"
          >
            <span>Why this target?</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAddMeal();
            }}
            className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#30D158]/15 to-[#2C2C2E]/60 hover:from-[#30D158]/25 border border-[#30D158]/30 hover:border-[#30D158] transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#30D158] text-black flex items-center justify-center">
                <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-white">Snap Food Picture</span>
            </div>
            <span className="text-[11px] font-semibold text-[#30D158] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              <span>AI Count Calories</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>

      <div className="ios-divider" />

      {/* SECTION 2: MACRONUTRIENTS */}
      <div onClick={() => onNavigateTab('goals')} className="cursor-pointer group">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
            Nutrition Targets
          </span>
          <span className="text-xs text-[#8E8E93] group-hover:text-white flex items-center gap-0.5 transition-colors">
            <span>Goals</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-1">
          {/* Protein */}
          <div>
            <p className="text-[11px] text-[#8E8E93] font-medium">Protein</p>
            <p className="text-xl font-semibold text-white tracking-tight mt-0.5">
              {proteinConsumed}{' '}
              <span className="text-xs text-[#8E8E93] font-normal">/ {proteinTarget}g</span>
            </p>
            <div className="w-full bg-[#2C2C2E] h-1 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-[#30D158] h-full rounded-full"
                style={{ width: `${Math.min(100, (proteinConsumed / proteinTarget) * 100)}%` }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div>
            <p className="text-[11px] text-[#8E8E93] font-medium">Carbohydrates</p>
            <p className="text-xl font-semibold text-white tracking-tight mt-0.5">
              {carbsConsumed}{' '}
              <span className="text-xs text-[#8E8E93] font-normal">/ {carbsTarget}g</span>
            </p>
            <div className="w-full bg-[#2C2C2E] h-1 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-[#8E8E93] h-full rounded-full"
                style={{ width: `${Math.min(100, (carbsConsumed / carbsTarget) * 100)}%` }}
              />
            </div>
          </div>

          {/* Fat */}
          <div>
            <p className="text-[11px] text-[#8E8E93] font-medium">Fat</p>
            <p className="text-xl font-semibold text-white tracking-tight mt-0.5">
              {fatConsumed}{' '}
              <span className="text-xs text-[#8E8E93] font-normal">/ {fatTarget}g</span>
            </p>
            <div className="w-full bg-[#2C2C2E] h-1 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-[#8E8E93] h-full rounded-full"
                style={{ width: `${Math.min(100, (fatConsumed / fatTarget) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ios-divider" />

      {/* SECTION 3: ACTIVITY SUMMARY */}
      <div onClick={() => onNavigateTab('exercise')} className="cursor-pointer group">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
            Activity
          </span>
          <span className="text-xs text-[#8E8E93] group-hover:text-white flex items-center gap-0.5 transition-colors">
            <span>Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <span className="text-2xl font-semibold text-white tracking-tight">
              {exerciseCalories.toLocaleString()}{' '}
              <span className="text-sm text-[#8E8E93] font-normal">kcal burned</span>
            </span>
          </div>
          <span className="text-sm font-medium text-[#8E8E93]">{exerciseMinutes} min active</span>
        </div>
      </div>

      {/* SECTION 3B: ADAPTIVE TRAINING ENGINE NEXT ACTION */}
      {fitnessContext?.adaptive?.next_action && (
        <NuviaNextActionCard
          action={fitnessContext.adaptive.next_action}
          onActionClick={() => onNavigateTab('exercise')}
          onAcceptProposal={async (prop: any, opt: any) => {
            if (!userId) return;
            const targetDate = opt.to_date || prop.suggested_date || todayStr;
            await DataService.saveScheduleAdaptation({
              user_id: userId,
              routine_id: prop.routine_id,
              routine_title: prop.routine_title,
              date: targetDate,
              original_date: prop.from_date,
              target_date: targetDate,
              action: opt.action === 'move' ? 'move_workout' : opt.action === 'add_activity' ? 'add_activity' : 'cancel_workout',
              reason: prop.reason,
              status: 'accepted',
              user_confirmed: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            FitnessContextService.invalidateFitnessContext(userId);
            fetchAndCache(false);
          }}
          onUndoProposal={async (changeId: string) => {
            await DataService.undoScheduleAdaptation(changeId);
            FitnessContextService.invalidateFitnessContext(userId);
            fetchAndCache(false);
          }}
        />
      )}

      {/* SECTION 3C: WORKOUT ROUTINE SCHEDULING (AUTHORITATIVE SESSION & STRICT DAY MATCHING) */}
      {(() => {
        const isRoutineScheduledForDay = (r: WorkoutRoutine, dayName: string) => {
          if (!r.days || !Array.isArray(r.days)) return false;
          const targetFull = dayName.toLowerCase();
          const targetShort = targetFull.slice(0, 3);
          return r.days.some((d) => {
            const dLower = d.trim().toLowerCase();
            return dLower === targetFull || dLower.startsWith(targetShort);
          });
        };

        const scheduledRoutinesToday = routines.filter((r) =>
          isRoutineScheduledForDay(r, todayDayName)
        );

        // Authoritative workout-session status inspection
        const getRoutineSessionStatus = (routine: WorkoutRoutine) => {
          const matchingLog = recentExercises.find((e) => {
            const logRoutineId = e.ai_analysis?.routine_id;
            if (logRoutineId && logRoutineId === routine.id) return true;
            if (e.exercise_type?.toLowerCase() === routine.title.toLowerCase()) return true;
            if (e.source === 'routine' && (e.description || '').toLowerCase().includes(routine.title.toLowerCase())) return true;
            return false;
          });

          if (!matchingLog) {
            return { status: 'unstarted' as const, log: null, executedCount: 0, totalExercises: routine.exercises?.length || 0 };
          }

          const executedCount = matchingLog.ai_analysis?.executed_count;
          const totalExercises = matchingLog.ai_analysis?.total_exercises || routine.exercises?.length || 0;

          if (executedCount !== undefined && totalExercises > 0 && executedCount < totalExercises) {
            return {
              status: 'partial' as const,
              log: matchingLog,
              executedCount,
              totalExercises,
            };
          }

          return {
            status: 'completed' as const,
            log: matchingLog,
            executedCount: totalExercises,
            totalExercises,
          };
        };

        // If today has scheduled routines:
        if (scheduledRoutinesToday.length > 0) {
          return (
            <div className="space-y-3">
              {scheduledRoutinesToday.map((routine) => {
                const sessionStatus = getRoutineSessionStatus(routine);
                const isFinished = sessionStatus.status === 'completed';
                const isPartial = sessionStatus.status === 'partial';
                const hasLogged = isFinished || isPartial;

                return (
                  <div
                    key={routine.id}
                    onClick={() => onNavigateTab('exercise')}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer space-y-3.5 group ${
                      isFinished
                        ? 'bg-[#1C1C1E] border-[#30D158]/40 shadow-sm'
                        : isPartial
                        ? 'bg-[#1C1C1E] border-[#0A84FF]/40 shadow-sm'
                        : 'bg-[#1C1C1E] border-white/[0.08] hover:border-[#30D158]/40'
                    }`}
                  >
                    {/* Top Bar: Routine Header & Status Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            isFinished
                              ? 'bg-[#30D158]/20 text-[#30D158]'
                              : isPartial
                              ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                              : 'bg-[#30D158]/15 text-[#30D158]'
                          }`}
                        >
                          {isFinished ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Dumbbell className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          Today's Workout
                        </span>
                        {isFinished && sessionStatus.log && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#30D158] text-black flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed ({sessionStatus.log.calories_burned} kcal)</span>
                          </span>
                        )}
                        {isPartial && sessionStatus.log && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0A84FF] text-white flex items-center gap-1">
                            <span>Partially completed ({sessionStatus.executedCount}/{sessionStatus.totalExercises})</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#30D158] font-medium flex items-center gap-0.5 group-hover:underline">
                        <span>{hasLogged ? 'View Details' : 'Start Workout'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    {/* Main Routine Row with Hero Visual Thumbnail */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/60 border border-white/[0.1] shrink-0 relative shadow-md group-hover:border-[#30D158]/40 transition-colors">
                        {routine.exercises?.[0] ? (
                          <ExerciseThumbnail
                            exercise={routine.exercises[0]}
                            aspectRatio="1/1"
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#2C2C2E] text-[#8E8E93]">
                            <Dumbbell className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white group-hover:text-[#30D158] transition-colors truncate">
                          {isFinished
                            ? `✓ ${cleanActivityTitle(routine.title).title}`
                            : cleanActivityTitle(routine.title).title}
                        </h4>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          {hasLogged && sessionStatus.log
                            ? `${sessionStatus.log.duration_minutes || 45} min · ${sessionStatus.log.calories_burned} kcal burned`
                            : `${routine.exercises?.length || 0} movements · ${routine.focus || 'Training'}`}
                        </p>
                        {routine.days && routine.days.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {routine.days.map((day) => (
                              <span
                                key={day}
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  isRoutineScheduledForDay(routine, day) && day.toLowerCase() === todayDayName.toLowerCase()
                                    ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30 font-semibold'
                                    : 'bg-white/[0.05] text-[#8E8E93]'
                                }`}
                              >
                                {day}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Exercise Movements Strip with Individual Thumbnails */}
                    {routine.exercises && routine.exercises.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pt-0.5 no-scrollbar scroll-smooth">
                        {routine.exercises.map((ex, idx) => (
                          <div
                            key={ex.id || idx}
                            className="w-10 h-10 rounded-xl overflow-hidden bg-black/40 border border-white/[0.08] shrink-0 relative group-hover:border-[#30D158]/30 transition-colors"
                            title={ex.name}
                          >
                            <ExerciseThumbnail exercise={ex} aspectRatio="1/1" className="w-full h-full" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        // If today has NO workout scheduled: Date-aware recovery day state
        const ALL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayIdx = today.getDay();
        let nextScheduled: { routines: WorkoutRoutine[]; day: string } | null = null;
        for (let offset = 1; offset <= 7; offset++) {
          const checkDay = ALL_WEEKDAYS[(currentDayIdx + offset) % 7];
          const found = routines.filter((r) => isRoutineScheduledForDay(r, checkDay));
          if (found.length > 0) {
            nextScheduled = { routines: found, day: checkDay };
            break;
          }
        }

        return (
          <div className="rounded-2xl p-4 bg-[#1C1C1E] border border-white/[0.08] space-y-3.5">
            {/* Header: Recovery Day */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Today's Workout
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-[#8E8E93]">
                Recovery day
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white">No workout scheduled today</h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                Today is a recovery/rest day. Focus on balanced nutrition, hydration, and muscle repair.
              </p>
            </div>

            {/* UP NEXT ROUTINE PREVIEW (Handles multiple routines on the next scheduled day) */}
            {nextScheduled ? (
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  <span>Up Next</span>
                  <span className="text-[#30D158]">{nextScheduled.day}</span>
                </div>

                <div className="space-y-2">
                  {nextScheduled.routines.map((nextRoutine) => (
                    <div
                      key={nextRoutine.id}
                      onClick={() => onNavigateTab('exercise')}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/50 border border-white/[0.08] shrink-0">
                          {nextRoutine.exercises?.[0] ? (
                            <ExerciseThumbnail
                              exercise={nextRoutine.exercises[0]}
                              aspectRatio="1/1"
                              className="w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#8E8E93]">
                              <Dumbbell className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white group-hover:text-[#30D158] transition-colors truncate">
                            {cleanActivityTitle(nextRoutine.title).title}
                          </h5>
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            {nextRoutine.exercises?.length || 0} movements · {nextRoutine.focus || 'Training'}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs text-[#8E8E93] group-hover:text-white flex items-center gap-0.5 shrink-0 ml-2 font-medium transition-colors">
                        <span>View workout</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : routines.length > 0 ? (
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-[#8E8E93]">Explore your training routines</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('exercise')}
                  className="text-xs text-[#30D158] hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                >
                  <span>See routines</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : null}
          </div>
        );
      })()}

      <div className="ios-divider" />

      {/* SECTION 4: NUVIA QUICK INSIGHT & NATURAL LOGGER */}
      <div className="bg-[#1C1C1E] rounded-2xl p-4 border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
            <span>Nuvia</span>
          </div>
          <button
            onClick={() => onNavigateTab('coach')}
            className="text-[11px] text-[#8E8E93] hover:text-white transition-colors"
          >
            Insights &amp; Chat →
          </button>
        </div>

        <p className="text-xs text-[#D1D1D6] leading-relaxed">
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
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#E5E5EA] border border-white/[0.08] transition-all flex items-center gap-1.5 active:scale-95"
              >
                {s.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#30D158]/20 text-[#30D158] font-bold">
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
          <div className="p-3.5 rounded-xl bg-[#121214] border border-[#30D158]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#30D158] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Today's Workout</span>
              </span>
              {pendingWorkoutReview.is_partial && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
                  Partial ~{pendingWorkoutReview.completion_percentage}%
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">{pendingWorkoutReview.routine_title}</p>
            <p className="text-xs text-[#8E8E93]">
              {pendingWorkoutReview.duration_minutes} mins · ~{pendingWorkoutReview.estimated_calories_burned} kcal
              {pendingWorkoutReview.notes ? ` · ${pendingWorkoutReview.notes}` : ''}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmWorkoutReview(pendingWorkoutReview)}
                className="flex-1 py-2 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs transition-colors"
              >
                Confirm &amp; Log Workout
              </button>
              <button
                type="button"
                onClick={() => setPendingWorkoutReview(null)}
                className="px-3 py-2 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-white text-xs font-medium"
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
            className="flex-1 bg-[#2C2C2E] text-xs text-white placeholder-[#8E8E93] px-3 py-2 rounded-xl border border-transparent focus:border-[#30D158] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!quickInput.trim() || isInterpreting}
            className="p-2 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] disabled:opacity-30 text-white transition-colors flex items-center justify-center min-w-[32px]"
          >
            {isInterpreting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#30D158]" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>

      {/* SECTION 5: TODAY'S LOGS */}
      <div className="space-y-4 pt-1">
        {/* Completed Workouts */}
        {recentExercises.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#FF453A]" />
                <span>Today's Completed Workouts</span>
              </span>
              <button
                onClick={() => onNavigateTab('exercise')}
                className="text-xs text-[#30D158] hover:underline font-medium"
              >
                View All
              </button>
            </div>

            <div className="ios-card divide-y divide-white/[0.06] overflow-hidden border border-[#30D158]/20">
              {recentExercises.map((e) => (
                <div
                  key={e.id}
                  onClick={() => onNavigateTab('exercise')}
                  className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{e.exercise_type}</p>
                      <p className="text-xs text-[#8E8E93] mt-0.5">
                        {e.duration_minutes} min active · {e.description || 'Completed workout'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-[#30D158] flex items-center gap-0.5">
                      +{e.calories_burned}{' '}
                      <span className="text-xs font-medium text-[#8E8E93]">kcal</span>
                    </span>
                    <span className="text-[10px] text-[#8E8E93] font-medium block">burned</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Meals */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Today's Meals
            </span>
            <button
              onClick={() => onNavigateTab('meals')}
              className="text-xs text-[#30D158] hover:underline font-medium"
            >
              View All
            </button>
          </div>

          {recentMeals.length === 0 ? (
            <p className="text-xs text-[#8E8E93] py-2">No meals logged yet today.</p>
          ) : (
            <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
              {recentMeals.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{m.description}</p>
                    <p className="text-xs text-[#8E8E93] capitalize mt-0.5">
                      {m.meal_type} · {m.protein_g}g protein
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {m.calories} <span className="text-xs text-[#8E8E93] font-normal">kcal</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
