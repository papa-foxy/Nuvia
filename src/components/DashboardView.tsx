'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Sparkles, Send, Dumbbell, Flame, CheckCircle2, Camera } from 'lucide-react';
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

interface DashboardViewProps {
  onOpenAddMeal: () => void;
  onOpenAddExercise: () => void;
  onNavigateTab: (tab: TabType) => void;
  onNaturalLanguageInput: (text: string) => void;
  /** @deprecated - no longer triggers a full reload; kept for API compatibility */
  refreshKey?: number;
}

export function DashboardView({
  onOpenAddMeal,
  onOpenAddExercise,
  onNavigateTab,
  onNaturalLanguageInput,
  refreshKey,
}: DashboardViewProps) {
  const { user, profile, goals } = useAuth();

  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [recentExercises, setRecentExercises] = useState<ExerciseLog[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);

  // Separate loading state for first-ever load vs background refetch
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [quickInput, setQuickInput] = useState('');
  const [nuviaReply, setNuviaReply] = useState<string | null>(null);

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
        const [s, m, e, r] = await Promise.all([
          DataService.getDailySummary(userId, todayStr),
          DataService.getMeals(userId, todayStr),
          DataService.getExerciseLogs(userId, todayStr),
          DataService.getWorkoutRoutines(userId),
        ]);

        // Write each result to the cache with a 90-second stale window
        const opts = { staleTime: 90_000, gcTime: 600_000 };
        NuviaCache.set(todaySummaryKey(userId, todayStr), s, opts);
        NuviaCache.set(todayMealsKey(userId, todayStr), m, opts);
        NuviaCache.set(todayActivityKey(userId, todayStr), e, opts);
        NuviaCache.set(workoutRoutinesKey(userId), r, opts);

        applyData(s, m, e, r);
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
  const calorieTarget   = goals?.calorie_target       || 2200;
  const proteinTarget   = goals?.protein_target        || 150;
  const carbsTarget     = goals?.carbohydrate_target   || 250;
  const fatTarget       = goals?.fat_target            || 70;

  const caloriesConsumed = summary?.calories_consumed   || 0;
  const caloriesBurned   = summary?.calories_burned     || 0;
  const proteinConsumed  = summary?.protein_consumed    || 0;
  const carbsConsumed    = summary?.carbohydrate_consumed || 0;
  const fatConsumed      = summary?.fat_consumed        || 0;
  const exerciseMinutes  = summary?.exercise_minutes    || 0;

  const remainingCalories = Math.max(0, calorieTarget - caloriesConsumed);
  const proteinGap        = Math.max(0, proteinTarget - proteinConsumed);

  const handleAskNuvia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const query = quickInput.trim().toLowerCase();
    if (
      query.includes('ate') ||
      query.includes('had') ||
      query.includes('ran') ||
      query.includes('walked') ||
      query.includes('workout')
    ) {
      onNaturalLanguageInput(quickInput.trim());
      setQuickInput('');
      return;
    }

    if (proteinGap > 20) {
      setNuviaReply(
        `You need ${proteinGap}g more protein today to hit your ${proteinTarget}g target. For your next meal: grilled chicken breast (180g) or tofu scramble with brown rice (≈520 kcal, ≈42g protein).`
      );
    } else if (remainingCalories > 300) {
      setNuviaReply(
        `You have ${remainingCalories} kcal remaining. A balanced option around 400 kcal like salmon with vegetables fits comfortably within your goal.`
      );
    } else {
      setNuviaReply(
        `You're right on target today (${caloriesConsumed} of ${calorieTarget} kcal). Focus on hydration and restful sleep.`
      );
    }
    setQuickInput('');
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Subtle background-refresh indicator */}
      {isFetching && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-[#30D158] animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%', marginLeft: 'auto', marginRight: 'auto' }} />
        </div>
      )}

      {/* Large Page Title (Apple Health Style) */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93]">
          {dateFormatted}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">Today</h1>
      </div>

      {/* SECTION 1: CALORIES */}
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

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[44px] font-semibold tracking-tight text-white leading-none">
            {caloriesConsumed.toLocaleString()}
          </span>
          <span className="text-base text-[#8E8E93] font-normal">
            / {calorieTarget.toLocaleString()} kcal
          </span>
        </div>

        <p className="text-xs text-[#8E8E93] mt-1.5 font-normal">
          {remainingCalories > 0 ? (
            <span>
              <span className="text-white font-medium">{remainingCalories} kcal</span> remaining today
            </span>
          ) : (
            <span className="text-[#30D158] font-medium">Daily calorie target achieved</span>
          )}
        </p>

        <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full overflow-hidden mt-3">
          <div
            className="bg-[#30D158] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (caloriesConsumed / calorieTarget) * 100)}%` }}
          />
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
              {caloriesBurned}{' '}
              <span className="text-sm text-[#8E8E93] font-normal">kcal burned</span>
            </span>
          </div>
          <span className="text-sm font-medium text-[#8E8E93]">{exerciseMinutes} min active</span>
        </div>
      </div>

      {/* SECTION 3B: WORKOUT ROUTINE PREVIEW */}
      {(() => {
        const todayRoutine =
          routines.find((r) =>
            r.days.some((d) => d.toLowerCase() === todayDayName.toLowerCase())
          ) || routines[0];

        if (!todayRoutine) return null;

        const matchingExecutedLog = recentExercises.find(
          (e) =>
            e.exercise_type === todayRoutine.title ||
            e.source === 'routine' ||
            (e.description || '').includes(todayRoutine.title) ||
            (e.description || '').toLowerCase().includes('routine')
        );

        return (
          <div
            onClick={() => onNavigateTab('exercise')}
            className={`rounded-2xl p-4 border transition-all cursor-pointer space-y-3 group ${
              matchingExecutedLog
                ? 'bg-[#1C1C1E] border-[#30D158]/40 shadow-sm'
                : 'bg-[#1C1C1E] border-white/[0.08] hover:border-[#30D158]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    matchingExecutedLog
                      ? 'bg-[#30D158]/20 text-[#30D158]'
                      : 'bg-[#30D158]/15 text-[#30D158]'
                  }`}
                >
                  <Dumbbell className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Workout Routine
                </span>
                {matchingExecutedLog && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#30D158] text-black flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Completed (+{matchingExecutedLog.calories_burned} kcal)</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-[#30D158] font-medium flex items-center gap-0.5 group-hover:underline">
                <span>{matchingExecutedLog ? 'View Details' : 'Start Workout'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-[#30D158] transition-colors">
                {todayRoutine.title}
              </h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                {todayRoutine.exercises.length} movements · {todayRoutine.focus || 'Training'}
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
              {todayRoutine.exercises.slice(0, 5).map((ex) => (
                <div
                  key={ex.id}
                  className="w-10 h-10 rounded-xl bg-black/40 p-1 border border-white/[0.06] shrink-0 relative group-hover:border-[#30D158]/30 transition-colors"
                  title={ex.name}
                >
                  <img src={ex.thumbnail_url} alt={ex.name} className="w-full h-full object-contain" />
                </div>
              ))}
              {todayRoutine.exercises.length > 5 && (
                <div className="w-10 h-10 rounded-xl bg-[#2C2C2E] border border-white/[0.06] shrink-0 flex items-center justify-center text-[10px] font-bold text-[#8E8E93]">
                  +{todayRoutine.exercises.length - 5}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="ios-divider" />

      {/* SECTION 4: NUVIA QUICK INSIGHT */}
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

        <form onSubmit={handleAskNuvia} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Ask Nuvia, or type what you ate / did..."
            className="flex-1 bg-[#2C2C2E] text-xs text-white placeholder-[#8E8E93] px-3 py-2 rounded-xl border border-transparent focus:border-[#30D158] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="p-2 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] disabled:opacity-30 text-white transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
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
