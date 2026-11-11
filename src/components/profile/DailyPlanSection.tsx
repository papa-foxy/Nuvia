'use client';

import React from 'react';
import { Flame, Beef, Wheat, Droplets, Zap } from 'lucide-react';
import { Goal } from '@/types/database';

interface DailyPlanSectionProps {
  goals: Goal | null;
  onEditTargets: () => void;
}

export function DailyPlanSection({ goals, onEditTargets }: DailyPlanSectionProps) {
  const calories = goals?.calorie_target ? goals.calorie_target.toLocaleString() : '2,050';
  const protein = goals?.protein_target ? goals.protein_target : 140;
  const carbs = goals?.carbohydrate_target ? goals.carbohydrate_target : 220;
  const fat = goals?.fat_target ? goals.fat_target : 65;
  const exerciseMins = goals?.exercise_minutes_target ? goals.exercise_minutes_target : 45;

  return (
    <div className="ios-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-fg uppercase tracking-wider block">
            Your Daily Plan
          </span>
          <span className="text-[11px] text-muted">Reference nutrition & activity targets</span>
        </div>
        <button
          type="button"
          onClick={onEditTargets}
          className="text-xs text-green-ink hover:underline font-semibold"
        >
          Adjust Targets
        </button>
      </div>

      {/* Targets Grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-0.5">
        {/* Calories */}
        <div className="p-3 rounded-2xl bg-fg/[0.03] border border-fg/[0.04] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-ink flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-muted font-medium block">Calories</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-fg">{calories}</span>
              <span className="text-[10px] text-muted">kcal</span>
            </div>
          </div>
        </div>

        {/* Protein */}
        <div className="p-3 rounded-2xl bg-fg/[0.03] border border-fg/[0.04] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-green-ink flex items-center justify-center shrink-0">
            <Beef className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-muted font-medium block">Protein</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-fg">{protein}</span>
              <span className="text-[10px] text-muted">g</span>
            </div>
          </div>
        </div>

        {/* Carbohydrates & Fat */}
        <div className="p-3 rounded-2xl bg-fg/[0.03] border border-fg/[0.04] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Wheat className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-muted font-medium block">Carbohydrates</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-fg">{carbs}</span>
              <span className="text-[10px] text-muted">g</span>
            </div>
          </div>
        </div>

        {/* Fat & Activity */}
        <div className="p-3 rounded-2xl bg-fg/[0.03] border border-fg/[0.04] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-blue-ink flex items-center justify-center shrink-0">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-muted font-medium block">Healthy Fats</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-fg">{fat}</span>
              <span className="text-[10px] text-muted">g</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity target badge */}
      <div className="p-2.5 rounded-xl bg-app/30 border border-fg/[0.04] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-zinc-300 font-medium">Daily Active Target</span>
        </div>
        <span className="font-bold text-fg">{exerciseMins} min / day</span>
      </div>
    </div>
  );
}
