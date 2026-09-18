'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { DailySummary, Meal, ExerciseLog } from '@/types/database';

export function DailySummaryView({ refreshKey }: { refreshKey?: number } = {}) {
  const { user, goals } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);

  useEffect(() => {
    async function loadDay() {
      const s = await DataService.getDailySummary(user?.id, selectedDate);
      const m = await DataService.getMeals(user?.id, selectedDate);
      const e = await DataService.getExerciseLogs(user?.id, selectedDate);
      setSummary(s);
      setMeals(m);
      setExercises(e);
    }
    loadDay();
  }, [user, selectedDate, refreshKey]);

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
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 max-w-md mx-auto space-y-6">
      {/* Date Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
            Summary
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-[#1C1C1E] px-2.5 py-1.5 rounded-full border border-white/[0.08]">
          <button
            onClick={() => changeDateBy(-1)}
            className="p-1 text-[#8E8E93] hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-white">{dateLabel}</span>
          <button
            onClick={() => changeDateBy(1)}
            className="p-1 text-[#8E8E93] hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Metrics (Calories Intake & Burned) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="ios-card p-4 space-y-1">
          <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
            Intake
          </p>
          <p className="text-3xl font-bold text-white tracking-tight">
            {caloriesConsumed}
          </p>
          <p className="text-xs text-[#8E8E93]">of {calorieTarget} kcal target</p>
        </div>

        <div className="ios-card p-4 space-y-1">
          <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
            Burned
          </p>
          <p className="text-3xl font-bold text-white tracking-tight">
            {caloriesBurned}
          </p>
          <p className="text-xs text-[#8E8E93]">{summary?.exercise_minutes || 0} min active</p>
        </div>
      </div>

      {/* Macronutrient Detail (Apple Health Inset Cell) */}
      <div className="ios-card p-4 space-y-3">
        <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
          Macronutrients
        </p>

        {/* Protein */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#8E8E93]">Protein</span>
            <span className="font-semibold text-white">{proteinConsumed} / {proteinTarget}g</span>
          </div>
          <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#30D158] h-full rounded-full"
              style={{ width: `${Math.min(100, (proteinConsumed / proteinTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#8E8E93]">Carbohydrates</span>
            <span className="font-semibold text-white">{carbsConsumed} / {carbsTarget}g</span>
          </div>
          <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8E8E93] h-full rounded-full"
              style={{ width: `${Math.min(100, (carbsConsumed / carbsTarget) * 100)}%` }}
            />
          </div>
        </div>

        {/* Fat */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#8E8E93]">Fat</span>
            <span className="font-semibold text-white">{fatConsumed} / {fatTarget}g</span>
          </div>
          <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8E8E93] h-full rounded-full"
              style={{ width: `${Math.min(100, (fatConsumed / fatTarget) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Nuvia Daily Summary Note */}
      <div className="bg-[#1C1C1E] p-4 rounded-2xl border border-white/[0.06] space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
          <span>Nuvia Day Summary</span>
        </div>
        <p className="text-xs text-[#D1D1D6] leading-relaxed">
          {caloriesConsumed <= calorieTarget && proteinConsumed >= proteinTarget * 0.85
            ? "You maintained your calorie deficit and reached your protein threshold. Consistent execution today."
            : `Logged ${caloriesConsumed} kcal and ${proteinConsumed}g protein. Prioritize hitting protein earlier tomorrow.`}
        </p>
      </div>

      {/* Day Logged Items List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
          Items Logged ({meals.length + exercises.length})
        </p>
        <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
          {meals.map((m) => (
            <div key={m.id} className="p-3.5 flex justify-between items-center text-xs">
              <div>
                <p className="font-semibold text-white">{m.description}</p>
                <p className="text-[11px] text-[#8E8E93] capitalize">{m.meal_type} · {m.protein_g}g protein</p>
              </div>
              <span className="font-semibold text-white">{m.calories} kcal</span>
            </div>
          ))}
          {exercises.map((e) => (
            <div key={e.id} className="p-3.5 flex justify-between items-center text-xs">
              <div>
                <p className="font-semibold text-white">{e.exercise_type}</p>
                <p className="text-[11px] text-[#8E8E93]">{e.duration_minutes} min</p>
              </div>
              <span className="font-semibold text-[#FF9F0A]">~{e.calories_burned} kcal</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
