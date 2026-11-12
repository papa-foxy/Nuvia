'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { DailySummary, Meal, ExerciseLog } from '@/types/database';
import { MacroDonutChart } from './MacroDonutChart';
import { DateFilterBar } from './DateFilterBar';
import {
  NuviaCache,
  todaySummaryKey,
  todayMealsKey,
  todayActivityKey,
} from '@/lib/nuvia-cache';

export function DailySummaryView({ refreshKey }: { refreshKey?: number } = {}) {
  const { user, goals } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const prevRefreshKey = useRef<number | undefined>(refreshKey);
  const userId = user?.id;

  const fetchAndCache = useCallback(
    async (date: string, background = false) => {
      const [s, m, e] = await Promise.all([
        DataService.getDailySummary(userId, date),
        DataService.getMeals(userId, date),
        DataService.getExerciseLogs(userId, date),
      ]);
      const opts = { staleTime: 90_000, gcTime: 600_000 };
      NuviaCache.set(todaySummaryKey(userId, date), s, opts);
      NuviaCache.set(todayMealsKey(userId, date), m, opts);
      NuviaCache.set(todayActivityKey(userId, date), e, opts);
      setSummary(s);
      setMeals(m);
      setExercises(e);
      setIsInitialLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    const forcedRefresh =
      prevRefreshKey.current !== undefined && refreshKey !== prevRefreshKey.current;
    prevRefreshKey.current = refreshKey;

    if (forcedRefresh) {
      NuviaCache.invalidate(todaySummaryKey(userId, selectedDate));
      NuviaCache.invalidate(todayMealsKey(userId, selectedDate));
      NuviaCache.invalidate(todayActivityKey(userId, selectedDate));
      fetchAndCache(selectedDate, false);
      return;
    }

    const cachedSummary  = NuviaCache.get<DailySummary | null>(todaySummaryKey(userId, selectedDate));
    const cachedMeals    = NuviaCache.get<Meal[]>(todayMealsKey(userId, selectedDate));
    const cachedActivity = NuviaCache.get<ExerciseLog[]>(todayActivityKey(userId, selectedDate));

    if (cachedSummary && cachedMeals && cachedActivity) {
      setSummary(cachedSummary.data);
      setMeals(cachedMeals.data);
      setExercises(cachedActivity.data);
      setIsInitialLoading(false);
      if (cachedSummary.isStale || cachedMeals.isStale || cachedActivity.isStale) {
        fetchAndCache(selectedDate, true);
      }
    } else {
      setIsInitialLoading(true);
      fetchAndCache(selectedDate, false);
    }
  }, [userId, selectedDate, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeDateBy = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + days);
    setSelectedDate(getLocalDateString(current));
  };

  const calorieTarget = goals?.calorie_target || 2200;
  const proteinTarget = goals?.protein_target || 150;
  const carbsTarget = goals?.carbohydrate_target || 250;
  const fatTarget = goals?.fat_target || 70;

  const caloriesConsumed = summary?.calories_consumed || 0;
  const caloriesBurned = summary?.calories_burned || 0;
  const proteinConsumed = summary?.protein_consumed || 0;
  const carbsConsumed = summary?.carbohydrate_consumed || 0;
  const fatConsumed = summary?.fat_consumed || 0;

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Date Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
            Overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-fg mt-0.5">
            Summary
          </h1>
        </div>

        {/* Date Filter Bar with Calendar Selection */}
        <DateFilterBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </div>

      {/* Primary Metrics (Calories Intake & Burned) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="ios-card p-4 space-y-1">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Intake
          </p>
          <p className="text-3xl font-bold text-fg tracking-tight">
            {caloriesConsumed}
          </p>
          <p className="text-xs text-muted">of {calorieTarget} kcal target</p>
        </div>

        <div className="ios-card p-4 space-y-1">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Burned
          </p>
          <p className="text-3xl font-bold text-fg tracking-tight">
            {caloriesBurned}
          </p>
          <p className="text-xs text-muted">{summary?.exercise_minutes || 0} min active</p>
        </div>
      </div>

      {/* Interactive Calorie & Macro Donut Chart */}
      <MacroDonutChart
        calories={caloriesConsumed}
        calorieTarget={calorieTarget}
        protein={proteinConsumed}
        proteinTarget={proteinTarget}
        carbs={carbsConsumed}
        carbsTarget={carbsTarget}
        fat={fatConsumed}
        fatTarget={fatTarget}
        exerciseMinutes={summary?.exercise_minutes || 0}
        exerciseTarget={goals?.exercise_minutes_target || 45}
      />

      {/* Macronutrient Detail (Apple Health Inset Cell) */}
      <div className="ios-card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          Macronutrients
        </p>

        {/* Protein */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Protein</span>
            <span className="font-semibold text-fg">{proteinConsumed} / {proteinTarget}g</span>
          </div>
          <div className="w-full bg-elevated h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full rounded-full"
              style={{ width: `${Math.min(100, (proteinConsumed / proteinTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Carbohydrates</span>
            <span className="font-semibold text-fg">{carbsConsumed} / {carbsTarget}g</span>
          </div>
          <div className="w-full bg-elevated h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8E8E93] h-full rounded-full"
              style={{ width: `${Math.min(100, (carbsConsumed / carbsTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Fat */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Fat</span>
            <span className="font-semibold text-fg">{fatConsumed} / {fatTarget}g</span>
          </div>
          <div className="w-full bg-elevated h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8E8E93] h-full rounded-full"
              style={{ width: `${Math.min(100, (fatConsumed / fatTarget) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Nuvia Daily Summary Note */}
      <div className="bg-card p-4 rounded-2xl border border-fg/[0.06] space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>Nuvia Day Summary</span>
        </div>
        <p className="text-xs text-fg-soft leading-relaxed">
          {caloriesConsumed <= calorieTarget && proteinConsumed >= proteinTarget * 0.85
            ? "You maintained your calorie deficit and reached your protein threshold. Consistent execution today."
            : `Logged ${caloriesConsumed} kcal and ${proteinConsumed}g protein. Prioritize hitting protein earlier tomorrow.`}
        </p>
      </div>

      {/* Day Logged Items List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          Items Logged ({meals.length + exercises.length})
        </p>
        <div className="ios-card divide-y divide-fg/[0.06] overflow-hidden">
          {meals.map((m) => (
            <div key={m.id} className="p-3.5 flex justify-between items-center text-xs">
              <div>
                <p className="font-semibold text-fg">{m.description}</p>
                <p className="text-[11px] text-muted capitalize">{m.meal_type} · {m.protein_g}g protein</p>
              </div>
              <span className="font-semibold text-fg">{m.calories} kcal</span>
            </div>
          ))}
          {exercises.map((e) => (
            <div key={e.id} className="p-3.5 flex justify-between items-center text-xs">
              <div>
                <p className="font-semibold text-fg">{e.exercise_type}</p>
                <p className="text-[11px] text-muted">{e.duration_minutes} min</p>
              </div>
              <span className="font-semibold text-orange-ink">~{e.calories_burned} kcal</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
