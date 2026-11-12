'use client';

import React, { useState } from 'react';
import { PieChart, Activity, Flame, ShieldAlert, Sparkles } from 'lucide-react';

interface MacroDonutChartProps {
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbsTarget: number;
  fat: number;
  fatTarget: number;
  exerciseMinutes?: number;
  exerciseTarget?: number;
}

export function MacroDonutChart({
  calories,
  calorieTarget,
  protein,
  proteinTarget,
  carbs,
  carbsTarget,
  fat,
  fatTarget,
  exerciseMinutes = 0,
  exerciseTarget = 45,
}: MacroDonutChartProps) {
  const [chartMode, setChartMode] = useState<'macros' | 'rings'>('macros');
  const [hoveredMacro, setHoveredMacro] = useState<'protein' | 'carbs' | 'fat' | null>(null);

  // Calories from each macro: 4 cal/g for protein & carbs, 9 cal/g for fat
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const totalMacroCals = Math.max(1, proteinCals + carbsCals + fatCals);

  const proteinPct = Math.round((proteinCals / totalMacroCals) * 100);
  const carbsPct = Math.round((carbsCals / totalMacroCals) * 100);
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

  // SVG circular arc calculation for Donut
  const size = 180;
  const strokeWidth = 20;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  // Offsets for 3 macro segments
  const proteinDash = (proteinPct / 100) * circumference;
  const carbsDash = (carbsPct / 100) * circumference;
  const fatDash = (fatPct / 100) * circumference;

  const proteinOffset = 0;
  const carbsOffset = -proteinDash;
  const fatOffset = -(proteinDash + carbsDash);

  // Concentric Rings calculation (Apple Watch style)
  const ring1Radius = 72; // Calories
  const ring2Radius = 54; // Protein
  const ring3Radius = 36; // Exercise
  const ringWidth = 12;

  const calCompletion = Math.min(1.5, calories / Math.max(1, calorieTarget));
  const proteinCompletion = Math.min(1.5, protein / Math.max(1, proteinTarget));
  const exCompletion = Math.min(1.5, exerciseMinutes / Math.max(1, exerciseTarget));

  const ring1Circumference = 2 * Math.PI * ring1Radius;
  const ring2Circumference = 2 * Math.PI * ring2Radius;
  const ring3Circumference = 2 * Math.PI * ring3Radius;

  return (
    <div className="ios-card p-4 space-y-4">
      {/* Header & Mode Switch */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Nutrition & Activity Balance
          </h3>
          <p className="text-sm font-bold text-fg mt-0.5">
            {chartMode === 'macros' ? 'Macronutrient Split' : 'Daily Goal Rings'}
          </p>
        </div>

        <div className="flex bg-fg/5 p-0.5 rounded-lg border border-fg/5">
          <button
            onClick={() => setChartMode('macros')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              chartMode === 'macros'
                ? 'bg-fg/15 text-fg shadow-sm'
                : 'text-zinc-400 hover:text-fg'
            }`}
          >
            Macros
          </button>
          <button
            onClick={() => setChartMode('rings')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              chartMode === 'rings'
                ? 'bg-fg/15 text-fg shadow-sm'
                : 'text-zinc-400 hover:text-fg'
            }`}
          >
            Rings
          </button>
        </div>
      </div>

      {/* Chart Center Area */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-1">
        {/* SVG Graphic */}
        <div className="relative flex items-center justify-center">
          {chartMode === 'macros' ? (
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="color-mix(in srgb, var(--theme-fg) 6%, transparent)"
                strokeWidth={strokeWidth}
              />

              {/* Protein Arc (Emerald) */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="var(--theme-accent)"
                strokeWidth={hoveredMacro === 'protein' ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${proteinDash} ${circumference}`}
                strokeDashoffset={proteinOffset}
                strokeLinecap="round"
                className="transition-all duration-500 cursor-pointer"
                onMouseEnter={() => setHoveredMacro('protein')}
                onMouseLeave={() => setHoveredMacro(null)}
              />

              {/* Carbs Arc (Amber) */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="var(--theme-warn)"
                strokeWidth={hoveredMacro === 'carbs' ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${carbsDash} ${circumference}`}
                strokeDashoffset={carbsOffset}
                strokeLinecap="round"
                className="transition-all duration-500 cursor-pointer"
                onMouseEnter={() => setHoveredMacro('carbs')}
                onMouseLeave={() => setHoveredMacro(null)}
              />

              {/* Fat Arc (Rose) */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="#FF375F"
                strokeWidth={hoveredMacro === 'fat' ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${fatDash} ${circumference}`}
                strokeDashoffset={fatOffset}
                strokeLinecap="round"
                className="transition-all duration-500 cursor-pointer"
                onMouseEnter={() => setHoveredMacro('fat')}
                onMouseLeave={() => setHoveredMacro(null)}
              />
            </svg>
          ) : (
            /* Apple Watch Rings Graphic */
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Ring 1 Track - Calories */}
              <circle
                cx={center}
                cy={center}
                r={ring1Radius}
                fill="transparent"
                stroke="rgba(255, 59, 48, 0.15)"
                strokeWidth={ringWidth}
              />
              <circle
                cx={center}
                cy={center}
                r={ring1Radius}
                fill="transparent"
                stroke="var(--theme-danger)"
                strokeWidth={ringWidth}
                strokeDasharray={ring1Circumference}
                strokeDashoffset={ring1Circumference * (1 - Math.min(1, calCompletion))}
                strokeLinecap="round"
                className="transition-all duration-700"
              />

              {/* Ring 2 Track - Protein */}
              <circle
                cx={center}
                cy={center}
                r={ring2Radius}
                fill="transparent"
                stroke="rgba(48, 209, 88, 0.15)"
                strokeWidth={ringWidth}
              />
              <circle
                cx={center}
                cy={center}
                r={ring2Radius}
                fill="transparent"
                stroke="var(--theme-accent)"
                strokeWidth={ringWidth}
                strokeDasharray={ring2Circumference}
                strokeDashoffset={ring2Circumference * (1 - Math.min(1, proteinCompletion))}
                strokeLinecap="round"
                className="transition-all duration-700"
              />

              {/* Ring 3 Track - Exercise */}
              <circle
                cx={center}
                cy={center}
                r={ring3Radius}
                fill="transparent"
                stroke="rgba(0, 122, 255, 0.15)"
                strokeWidth={ringWidth}
              />
              <circle
                cx={center}
                cy={center}
                r={ring3Radius}
                fill="transparent"
                stroke="var(--theme-info)"
                strokeWidth={ringWidth}
                strokeDasharray={ring3Circumference}
                strokeDashoffset={ring3Circumference * (1 - Math.min(1, exCompletion))}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
          )}

          {/* Center Graphic Details */}
          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
            {chartMode === 'macros' ? (
              <>
                <span className="text-2xl font-bold tracking-tight text-fg leading-none">
                  {calories.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">kcal logged</span>
                <span className="text-[9px] text-green-ink font-medium mt-0.5">
                  {protein}g protein
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-bold tracking-tight text-fg leading-none">
                  {Math.round(calCompletion * 100)}%
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">daily goal</span>
              </>
            )}
          </div>
        </div>

        {/* Legend / Metrics Grid */}
        <div className="flex-1 w-full space-y-2">
          {chartMode === 'macros' ? (
            <>
              {/* Protein */}
              <div
                onMouseEnter={() => setHoveredMacro('protein')}
                onMouseLeave={() => setHoveredMacro(null)}
                className={`p-2 rounded-xl transition-all border flex items-center justify-between ${
                  hoveredMacro === 'protein'
                    ? 'bg-accent/15 border-accent/30'
                    : 'bg-fg/[0.03] border-fg/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-sm shadow-emerald-500/50" />
                  <div>
                    <span className="text-xs font-semibold text-fg block">Protein</span>
                    <span className="text-[10px] text-zinc-400">{protein}g / {proteinTarget}g target</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-green-ink">{proteinPct}%</span>
                  <span className="text-[10px] text-zinc-500 block">{proteinCals} kcal</span>
                </div>
              </div>

              {/* Carbs */}
              <div
                onMouseEnter={() => setHoveredMacro('carbs')}
                onMouseLeave={() => setHoveredMacro(null)}
                className={`p-2 rounded-xl transition-all border flex items-center justify-between ${
                  hoveredMacro === 'carbs'
                    ? 'bg-warn/15 border-warn/30'
                    : 'bg-fg/[0.03] border-fg/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-warn shadow-sm shadow-orange-500/50" />
                  <div>
                    <span className="text-xs font-semibold text-fg block">Carbs</span>
                    <span className="text-[10px] text-zinc-400">{carbs}g / {carbsTarget}g target</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-orange-ink">{carbsPct}%</span>
                  <span className="text-[10px] text-zinc-500 block">{carbsCals} kcal</span>
                </div>
              </div>

              {/* Fat */}
              <div
                onMouseEnter={() => setHoveredMacro('fat')}
                onMouseLeave={() => setHoveredMacro(null)}
                className={`p-2 rounded-xl transition-all border flex items-center justify-between ${
                  hoveredMacro === 'fat'
                    ? 'bg-[#FF375F]/15 border-[#FF375F]/30'
                    : 'bg-fg/[0.03] border-fg/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF375F] shadow-sm shadow-pink-500/50" />
                  <div>
                    <span className="text-xs font-semibold text-fg block">Fats</span>
                    <span className="text-[10px] text-zinc-400">{fat}g / {fatTarget}g target</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-pink-ink">{fatPct}%</span>
                  <span className="text-[10px] text-zinc-500 block">{fatCals} kcal</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Calories Ring Legend */}
              <div className="p-2 rounded-xl bg-fg/[0.03] border border-fg/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger shadow-sm shadow-red-500/50" />
                  <div>
                    <span className="text-xs font-semibold text-fg block">Calories</span>
                    <span className="text-[10px] text-zinc-400">{calories} / {calorieTarget} kcal</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-red-ink">{Math.round(calCompletion * 100)}%</span>
              </div>

              {/* Protein Ring Legend */}
              <div className="p-2 rounded-xl bg-fg/[0.03] border border-fg/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-sm shadow-emerald-500/50" />
                  <div>
                    <span className="text-xs font-semibold text-fg block">Protein Target</span>
                    <span className="text-[10px] text-zinc-400">{protein}g / {proteinTarget}g</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-ink">{Math.round(proteinCompletion * 100)}%</span>
              </div>

              {/* Exercise Ring Legend */}
              <div className="p-2 rounded-xl bg-fg/[0.03] border border-fg/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-info shadow-sm shadow-blue-500/50" />
                  <div>
                    <span className="text-xs font-semibold text-fg block">Exercise Time</span>
                    <span className="text-[10px] text-zinc-400">{exerciseMinutes}m / {exerciseTarget}m</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-ink">{Math.round(exCompletion * 100)}%</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
