'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  Sparkles,
  X,
  Check,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Activity,
  Target,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { NuviaCache } from '@/lib/nuvia-cache';
import {
  calculateTargets,
  getUserCalculationContext,
  ACTIVITY_LABELS,
  CalculationResult,
} from '@/lib/calculator';
import { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';
import { TabType } from './Navigation';

interface GoalsViewProps {
  onNavigateTab?: (tab: TabType) => void;
}

const GOAL_OPTIONS: { id: UserGoal; label: string; desc: string }[] = [
  { id: 'recomposition', label: 'Lose fat & build muscle', desc: 'Body recomposition: high protein to lose fat while building muscle' },
  { id: 'lose_weight', label: 'Lose weight', desc: 'Calorie deficit to burn fat steadily' },
  { id: 'build_muscle', label: 'Build muscle', desc: 'Lean surplus with elevated protein' },
  { id: 'maintain_weight', label: 'Maintain', desc: 'Sustain current weight & stay energized' },
  { id: 'gain_weight', label: 'Gain weight', desc: 'Calorie surplus for healthy weight gain' },
];

const PACE_OPTIONS = [
  { value: 0.25, label: '0.25 kg / week', desc: 'Gentle & sustainable pace' },
  { value: 0.5, label: '0.5 kg / week', desc: 'Recommended standard pace' },
  { value: 0.75, label: '0.75 kg / week', desc: 'Active & disciplined pace' },
  { value: 1.0, label: '1.0 kg / week', desc: 'Aggressive target pace' },
];

export function GoalsView({ onNavigateTab }: GoalsViewProps) {
  const { user, profile, goals, refreshProfileAndGoals } = useAuth();

  // Active / selected pace from profile preferences or default 0.5
  const currentPace = useMemo(() => {
    if (profile?.dietary_preference?.startsWith('pace:')) {
      const parsed = parseFloat(profile.dietary_preference.replace('pace:', ''));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0.5;
  }, [profile?.dietary_preference]);

  // Current authoritative calculation
  const calcContext = useMemo(
    () => getUserCalculationContext(profile, goals, currentPace),
    [profile, goals, currentPace]
  );
  const currentCalc: CalculationResult = useMemo(
    () => calculateTargets(calcContext),
    [calcContext]
  );

  // Active goal targets (prefer goals row, fall back to authoritative calculation)
  const calorieTarget = goals?.calorie_target || currentCalc.calorie_target;
  const proteinTarget = goals?.protein_target || currentCalc.protein_target;
  const carbTarget = goals?.carbohydrate_target || currentCalc.carbohydrate_target;
  const fatTarget = goals?.fat_target || currentCalc.fat_target;
  const currentWeight = profile?.weight_kg || 73;
  const targetWeight = goals?.target_weight_kg || profile?.target_weight_kg || 68;
  const goalType = profile?.goal || 'lose_weight';

  // Sheet / Modal States
  const [showWhySheet, setShowWhySheet] = useState(false);
  const [activeEditor, setActiveEditor] = useState<'goal' | 'target_weight' | 'activity' | 'pace' | null>(null);

  // Edit draft states
  const [draftGoal, setDraftGoal] = useState<UserGoal>(goalType);
  const [draftWeight, setDraftWeight] = useState<number>(targetWeight);
  const [draftActivity, setDraftActivity] = useState<ActivityLevel>(profile?.activity_level || 'moderately_active');
  const [draftPace, setDraftPace] = useState<number>(currentPace);
  const [saving, setSaving] = useState(false);

  // Recalculation notification banner
  const [recalcNotice, setRecalcNotice] = useState<{
    prevCal: number;
    newCal: number;
  } | null>(null);

  // Live preview for goal selector or editor modal
  const previewCalc = useMemo(() => {
    return calculateTargets({
      ...calcContext,
      goal: draftGoal,
      target_weight_kg: draftWeight,
      activity_level: draftActivity,
      weekly_pace_kg: draftPace,
    });
  }, [calcContext, draftGoal, draftWeight, draftActivity, draftPace]);

  // Commit updated configuration
  const handleSavePlan = async (overrides?: {
    goal?: UserGoal;
    target_weight_kg?: number;
    activity_level?: ActivityLevel;
    weekly_pace_kg?: number;
  }) => {
    const g = overrides?.goal ?? draftGoal;
    const tw = overrides?.target_weight_kg ?? draftWeight;
    const act = overrides?.activity_level ?? draftActivity;
    const pace = overrides?.weekly_pace_kg ?? draftPace;

    setSaving(true);
    try {
      const prevCal = calorieTarget;

      // Recalculate authoritative targets
      const newCalc = calculateTargets({
        ...calcContext,
        goal: g,
        target_weight_kg: tw,
        activity_level: act,
        weekly_pace_kg: pace,
      });

      // 1. Update profile (goal, target_weight, activity_level, pace tag)
      const updatedProfile: Profile = {
        ...(profile || ({} as Profile)),
        id: user?.id || profile?.id || DataService.getDemoUserId(),
        name: profile?.name || 'User',
        goal: g,
        target_weight_kg: tw,
        activity_level: act,
        dietary_preference: `pace:${pace}`,
      };
      await DataService.saveProfile(updatedProfile);

      // 2. Update goals table
      const updatedGoals: Goal = {
        ...(goals || ({} as Goal)),
        id: goals?.id || `goal-${Date.now()}`,
        user_id: user?.id || goals?.user_id || DataService.getDemoUserId(),
        calorie_target: newCalc.calorie_target,
        protein_target: newCalc.protein_target,
        carbohydrate_target: newCalc.carbohydrate_target,
        fat_target: newCalc.fat_target,
        exercise_minutes_target: newCalc.exercise_minutes_target,
        target_weight_kg: tw,
      };
      await DataService.saveGoals(updatedGoals);

      // 3. Invalidate Today / Dashboard caches so Today immediately reflects new targets
      NuviaCache.invalidatePrefix('today:');

      // 4. Refresh global AuthContext
      await refreshProfileAndGoals();

      // 5. Trigger notification banner if calories changed
      if (prevCal !== newCalc.calorie_target) {
        setRecalcNotice({
          prevCal,
          newCal: newCalc.calorie_target,
        });
      }

      setActiveEditor(null);
    } catch (err) {
      console.error('Failed to update goal settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Weight Progress calculations
  const weightDiff = Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10;
  const isLosing = goalType === 'lose_weight' || targetWeight < currentWeight;
  const isGaining = goalType === 'gain_weight' || goalType === 'build_muscle' || targetWeight > currentWeight;
  const isAtGoal = currentWeight === targetWeight;

  // Macro calorie percentages
  const proteinCals = proteinTarget * 4;
  const carbCals = carbTarget * 4;
  const fatCals = fatTarget * 9;
  const totalMacroCals = proteinCals + carbCals + fatCals || calorieTarget;
  const proteinPct = Math.round((proteinCals / totalMacroCals) * 100);
  const carbPct = Math.round((carbCals / totalMacroCals) * 100);
  const fatPct = Math.round((fatCals / totalMacroCals) * 100);

  // Goal name formatted
  const goalLabel =
    goalType === 'lose_weight'
      ? 'Lose weight'
      : goalType === 'maintain_weight'
      ? 'Maintain weight'
      : goalType === 'build_muscle'
      ? 'Build muscle'
      : 'Gain weight';

  return (
    <div className="flex-1 flex flex-col pb-28 px-4 pt-3 w-full max-w-md mx-auto space-y-5 animate-fadeIn">
      {/* ── TOP HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between pt-1">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Configuration
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
            Goals
          </h1>
        </div>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('home')}
            className="text-xs font-semibold text-[#30D158] hover:text-[#28B84D] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] transition-colors mb-1 cursor-pointer"
          >
            Today →
          </button>
        )}
      </div>

      {/* ── RECALCULATION NOTIFICATION BANNER ───────────────────────────── */}
      {recalcNotice && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#30D158]/15 via-white/[0.03] to-black border border-[#30D158]/30 flex items-start justify-between gap-3 animate-slideDown">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#30D158] text-black flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 fill-black" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Calorie target updated</span>
                <span className="text-[#30D158]">
                  {recalcNotice.prevCal.toLocaleString()} → {recalcNotice.newCal.toLocaleString()} kcal
                </span>
              </p>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                Recalculated using your latest profile & activity settings. Synchronized across Today and AI Coach.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRecalcNotice(null)}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 1. HERO SECTION: YOUR GOAL ─────────────────────────────────── */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase">
            Your Goal
          </span>
          <span className="text-[10px] font-semibold text-[#30D158] px-2.5 py-0.5 rounded-full bg-[#30D158]/10 border border-[#30D158]/20">
            Active Plan
          </span>
        </div>

        {/* Big Typography Goal Name */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase">
            {goalLabel}
          </h2>
          <p className="text-xs text-[#8E8E93] mt-1">
            {goalType === 'lose_weight' && 'A calorie target below your estimated maintenance to support weight loss.'}
            {goalType === 'maintain_weight' && 'A calorie target balanced with your estimated maintenance level.'}
            {goalType === 'build_muscle' && 'A controlled surplus with optimized protein for muscle growth.'}
            {goalType === 'gain_weight' && 'A steady calorie surplus to build healthy body mass.'}
          </p>
        </div>

        {/* Current -> Target Weight Hero Block */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#8E8E93] block">
              Current Weight
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {currentWeight}
              </span>
              <span className="text-xs font-semibold text-[#8E8E93]">kg</span>
            </div>
          </div>

          <div className="flex flex-col items-center px-2">
            {isLosing ? (
              <TrendingDown className="w-5 h-5 text-[#30D158]" />
            ) : isGaining ? (
              <TrendingUp className="w-5 h-5 text-[#0A84FF]" />
            ) : (
              <Minus className="w-5 h-5 text-zinc-400" />
            )}
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93] mt-0.5">
              {isAtGoal ? 'Maintaining' : `${weightDiff} kg ${isLosing ? 'to lose' : 'to gain'}`}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-[#8E8E93] block">
              Target Weight
            </span>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {targetWeight}
              </span>
              <span className="text-xs font-semibold text-[#8E8E93]">kg</span>
            </div>
          </div>
        </div>

        {/* ── GOAL TYPE SELECTOR PILLS ─────────────────────────────────── */}
        <div className="pt-1">
          <label className="text-[11px] font-semibold text-[#8E8E93] block mb-2">
            Switch Objective
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((opt) => {
              const isSelected = goalType === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (opt.id !== goalType) {
                      setDraftGoal(opt.id);
                      setActiveEditor('goal');
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black font-bold border-white shadow-md'
                      : 'bg-white/[0.03] text-zinc-300 hover:text-white border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                  </div>
                  <span
                    className={`text-[10px] block mt-0.5 truncate ${
                      isSelected ? 'text-zinc-700' : 'text-[#8E8E93]'
                    }`}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 2. CALORIE TARGET SECTION: MAINTENANCE VS GOAL TARGET ─────── */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#FF9500]" />
            <span className="text-[11px] font-bold tracking-wider text-white uppercase">
              Daily Calories
            </span>
          </div>
          <button
            onClick={() => setShowWhySheet(true)}
            className="text-[11px] font-semibold text-[#30D158] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>Why this target?</span>
          </button>
        </div>

        {/* Comparison Grid: Maintenance vs Goal Target */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Estimated Maintenance */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            <span className="text-[11px] font-medium text-[#8E8E93] block">
              Estimated maintenance
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold tracking-tight text-white">
                {currentCalc.tdee.toLocaleString()}
              </span>
              <span className="text-xs text-[#8E8E93]">kcal</span>
            </div>
            <span className="text-[10px] text-[#8E8E93] block mt-1">
              BMR ({currentCalc.bmr}) × activity
            </span>
          </div>

          {/* Goal Target */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#30D158]/10 to-transparent border border-[#30D158]/30 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white block">
                Daily goal target
              </span>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  currentCalc.adjustment < 0
                    ? 'bg-emerald-500/20 text-[#30D158]'
                    : currentCalc.adjustment > 0
                    ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                    : 'bg-white/10 text-zinc-300'
                }`}
              >
                {currentCalc.adjustment < 0
                  ? `${currentCalc.adjustment} kcal`
                  : currentCalc.adjustment > 0
                  ? `+${currentCalc.adjustment} kcal`
                  : 'Balanced'}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold tracking-tight text-white">
                {calorieTarget.toLocaleString()}
              </span>
              <span className="text-xs text-[#8E8E93]">kcal</span>
            </div>
            <span className="text-[10px] text-[#8E8E93] block mt-1">
              {currentCalc.adjustment < 0
                ? `${Math.abs(currentCalc.adjustment)} kcal/day deficit`
                : currentCalc.adjustment > 0
                ? `${currentCalc.adjustment} kcal/day surplus`
                : 'Equal to maintenance'}
            </span>
          </div>
        </div>

        {/* Visual Connector / Flow Path */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.04] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">Maintenance {currentCalc.tdee}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#8E8E93]" />
            <span className="font-bold text-white">Target {calorieTarget} kcal</span>
          </div>
          <span
            className={`font-semibold text-xs ${
              currentCalc.adjustment < 0
                ? 'text-[#30D158]'
                : currentCalc.adjustment > 0
                ? 'text-[#0A84FF]'
                : 'text-zinc-400'
            }`}
          >
            {currentCalc.adjustment < 0
              ? `${currentCalc.adjustment} vs maintenance`
              : currentCalc.adjustment > 0
              ? `+${currentCalc.adjustment} vs maintenance`
              : 'Matches maintenance'}
          </span>
        </div>

        {/* Concise Contextual Explanation */}
        <p className="text-xs text-[#8E8E93] leading-relaxed">
          {goalType === 'lose_weight' && (
            <>
              Your target is <span className="text-white font-medium">below estimated maintenance</span> to support steady, sustainable weight loss without metabolic crash.
            </>
          )}
          {goalType === 'maintain_weight' && (
            <>
              Your target is <span className="text-white font-medium">at your estimated maintenance level</span> to sustain your current weight, energy, and muscle mass.
            </>
          )}
          {goalType === 'build_muscle' && (
            <>
              Your target is <span className="text-white font-medium">above estimated maintenance</span> to supply adequate energy for progressive muscle hypertrophy.
            </>
          )}
          {goalType === 'gain_weight' && (
            <>
              Your target is <span className="text-white font-medium">in a healthy surplus</span> to facilitate steady body weight gain.
            </>
          )}
        </p>
      </div>

      {/* ── 3. GOAL PROGRESS SECTION ───────────────────────────────────── */}
      <div className="ios-card p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[#30D158]" />
            <span className="text-[11px] font-bold tracking-wider text-white uppercase">
              Goal Progress
            </span>
          </div>
          <span className="text-xs font-semibold text-white">
            {currentWeight} kg → {targetWeight} kg
          </span>
        </div>

        {/* Visual Progress Bar Path */}
        <div className="space-y-1.5 pt-1">
          <div className="relative h-2.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#30D158] to-[#0A84FF] rounded-full transition-all duration-500"
              style={{
                width: isAtGoal
                  ? '100%'
                  : `${Math.min(
                      100,
                      Math.max(15, 100 - (weightDiff / (currentWeight || 1)) * 100)
                    )}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#8E8E93] px-0.5">
            <span>Current: {currentWeight} kg</span>
            <span className="font-semibold text-white">
              {isAtGoal ? 'Target Achieved' : `${weightDiff} kg to goal`}
            </span>
            <span>Target: {targetWeight} kg</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-[#8E8E93] flex items-center justify-between">
          <span>Target pace</span>
          <span className="font-semibold text-white">{currentPace} kg / week</span>
        </div>
      </div>

      {/* ── 4. DAILY MACROS SECTION ────────────────────────────────────── */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-white uppercase">
            Daily Macros
          </span>
          <span className="text-[11px] text-[#8E8E93]">
            {calorieTarget} kcal total
          </span>
        </div>

        {/* Macro Ratio Split Bar */}
        <div className="h-2 w-full bg-white/[0.06] rounded-full flex overflow-hidden">
          <div
            className="bg-[#30D158] h-full"
            style={{ width: `${proteinPct}%` }}
            title={`Protein ${proteinPct}%`}
          />
          <div
            className="bg-amber-400 h-full"
            style={{ width: `${carbPct}%` }}
            title={`Carbs ${carbPct}%`}
          />
          <div
            className="bg-[#0A84FF] h-full"
            style={{ width: `${fatPct}%` }}
            title={`Fats ${fatPct}%`}
          />
        </div>

        {/* Apple-style Grouped Macro Rows */}
        <div className="divide-y divide-white/[0.06] text-xs">
          {/* Protein Row */}
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                <Beef className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-white block">Protein</span>
                <span className="text-[10px] text-[#8E8E93]">
                  {goalType === 'build_muscle' || goalType === 'lose_weight'
                    ? 'Primary muscle retention target'
                    : 'Essential daily intake'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-white text-sm">{proteinTarget} g</span>
              <span className="text-[10px] text-[#8E8E93] block">{proteinPct}% of cals</span>
            </div>
          </div>

          {/* Carbs Row */}
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center shrink-0">
                <Wheat className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-white block">Carbohydrates</span>
                <span className="text-[10px] text-[#8E8E93]">Energy & workout fuel</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-white text-sm">{carbTarget} g</span>
              <span className="text-[10px] text-[#8E8E93] block">{carbPct}% of cals</span>
            </div>
          </div>

          {/* Fat Row */}
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center shrink-0">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-white block">Healthy Fats</span>
                <span className="text-[10px] text-[#8E8E93]">Hormones & cellular health</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-white text-sm">{fatTarget} g</span>
              <span className="text-[10px] text-[#8E8E93] block">{fatPct}% of cals</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. YOUR PLAN / GOAL INPUTS (FOCUSED EDITORS) ─────────────────── */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase px-1">
          Your Plan
        </span>

        <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
          {/* Row 1: Goal Objective */}
          <button
            onClick={() => {
              setDraftGoal(goalType);
              setActiveEditor('goal');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Target className="w-4 h-4 text-[#30D158]" />
              <span className="font-medium text-[#8E8E93]">Goal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">{goalLabel}</span>
              <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
            </div>
          </button>

          {/* Row 2: Target Weight */}
          <button
            onClick={() => {
              setDraftWeight(targetWeight);
              setActiveEditor('target_weight');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-[#FF9500]" />
              <span className="font-medium text-[#8E8E93]">Target Weight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">{targetWeight} kg</span>
              <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
            </div>
          </button>

          {/* Row 3: Activity Level */}
          <button
            onClick={() => {
              setDraftActivity(profile?.activity_level || 'moderately_active');
              setActiveEditor('activity');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-[#0A84FF]" />
              <span className="font-medium text-[#8E8E93]">Activity Level</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">
                {ACTIVITY_LABELS[profile?.activity_level || 'moderately_active']?.label || 'Moderate'}
              </span>
              <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
            </div>
          </button>

          {/* Row 4: Goal Pace */}
          <button
            onClick={() => {
              setDraftPace(currentPace);
              setActiveEditor('pace');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-[#8E8E93]">Weekly Pace</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">{currentPace} kg / week</span>
              <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
            </div>
          </button>
        </div>
      </div>

      {/* ── 6. HOW NUVIA CALCULATES YOUR TARGET ─────────────────────────── */}
      <div className="ios-card p-5 space-y-3">
        <span className="text-[11px] font-bold tracking-wider text-[#8E8E93] uppercase block">
          How Nuvia Calculates Your Target
        </span>
        <p className="text-xs text-[#8E8E93] leading-relaxed">
          Your calorie recommendation is calculated from your body metrics using the clinical{' '}
          <strong className="text-white">Mifflin-St Jeor formula</strong> and physical activity multiplier:
        </p>

        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.04] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#8E8E93]">Estimated maintenance (TDEE)</span>
            <span className="font-bold text-white">{currentCalc.tdee.toLocaleString()} kcal</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#8E8E93]">Goal adjustment ({goalLabel})</span>
            <span
              className={`font-bold ${
                currentCalc.adjustment < 0
                  ? 'text-[#30D158]'
                  : currentCalc.adjustment > 0
                  ? 'text-[#0A84FF]'
                  : 'text-white'
              }`}
            >
              {currentCalc.adjustment < 0
                ? `${currentCalc.adjustment} kcal`
                : currentCalc.adjustment > 0
                ? `+${currentCalc.adjustment} kcal`
                : '0 kcal'}
            </span>
          </div>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="font-bold text-white">Daily Recommended Target</span>
            <span className="text-sm font-extrabold text-[#30D158]">
              {calorieTarget.toLocaleString()} kcal
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── BOTTOM SHEET: "WHY THIS TARGET?" ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showWhySheet && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 pb-[calc(68px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-[28px] p-5 space-y-4 max-h-[calc(100dvh-68px-env(safe-area-inset-bottom,0px)-1rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">
                  Why is my target {calorieTarget.toLocaleString()} kcal?
                </h3>
                <p className="text-[11px] text-[#8E8E93]">Transparent calculation breakdown</p>
              </div>
              <button
                onClick={() => setShowWhySheet(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile inputs used */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase">
                Factors From Your Profile
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] text-[#8E8E93] block">Sex & Age</span>
                  <span className="font-semibold text-white">
                    {profile?.sex || 'Male'}, {calcContext.age} yrs
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] text-[#8E8E93] block">Height & Weight</span>
                  <span className="font-semibold text-white">
                    {profile?.height_cm || 175} cm, {currentWeight} kg
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] text-[#8E8E93] block">Activity Level</span>
                  <span className="font-semibold text-white">
                    {ACTIVITY_LABELS[profile?.activity_level || 'moderately_active']?.label || 'Moderate'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-[10px] text-[#8E8E93] block">Goal & Pace</span>
                  <span className="font-semibold text-white">
                    {goalLabel} ({currentPace} kg/wk)
                  </span>
                </div>
              </div>
            </div>

            {/* Step-by-step Math */}
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase">
                Calculation Steps
              </span>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>1. Basal Metabolic Rate (BMR)</span>
                  <span>{currentCalc.bmr} kcal</span>
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  Energy burned at complete rest to keep organs functioning.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>2. Maintenance Calories (TDEE)</span>
                  <span>{currentCalc.tdee} kcal</span>
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  BMR × Activity factor. Eating this amount maintains your current {currentWeight} kg.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>3. Goal Adjustment</span>
                  <span className="text-[#30D158]">
                    {currentCalc.adjustment < 0
                      ? `${currentCalc.adjustment} kcal`
                      : currentCalc.adjustment > 0
                      ? `+${currentCalc.adjustment} kcal`
                      : '0 kcal'}
                  </span>
                </div>
                <p className="text-[11px] text-[#8E8E93]">
                  {goalType === 'lose_weight'
                    ? `Safe daily deficit for your target pace of ${currentPace} kg/week.`
                    : goalType === 'build_muscle'
                    ? 'Lean surplus to synthesize new muscle tissue with minimal fat gain.'
                    : 'Target aligned with your maintenance expenditure.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#30D158]/20 to-[#1C1C1E] border border-[#30D158]/40 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">Recommended Daily Target</span>
                  <span className="text-[10px] text-[#8E8E93]">Synchronized across Nuvia</span>
                </div>
                <span className="text-base font-extrabold text-[#30D158]">
                  {calorieTarget.toLocaleString()} kcal/day
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#8E8E93] pt-1 leading-relaxed">
              Nuvia recalculates your targets automatically whenever your weight, activity level, or goal changes in your profile.
            </p>

            <button
              onClick={() => setShowWhySheet(false)}
              className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FOCUSED PLAN ROW EDITORS ────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* 1. Goal Editor */}
      {activeEditor === 'goal' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 pb-[calc(68px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-[28px] p-5 space-y-4 max-h-[calc(100dvh-68px-env(safe-area-inset-bottom,0px)-1rem)]">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Select Your Goal</h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDraftGoal(opt.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    draftGoal === opt.id
                      ? 'bg-white/[0.08] border-[#30D158] text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{opt.label}</span>
                    {draftGoal === opt.id && <Check className="w-4 h-4 text-[#30D158]" />}
                  </div>
                  <p className="text-xs text-[#8E8E93] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Live Recalculation Preview */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#8E8E93] block">Preview target</span>
                <span className="text-sm font-bold text-white">
                  {previewCalc.calorie_target.toLocaleString()} kcal/day
                </span>
              </div>
              <span
                className={`font-semibold ${
                  previewCalc.adjustment < 0
                    ? 'text-[#30D158]'
                    : previewCalc.adjustment > 0
                    ? 'text-[#0A84FF]'
                    : 'text-zinc-400'
                }`}
              >
                {previewCalc.adjustment < 0
                  ? `${previewCalc.adjustment} kcal deficit`
                  : previewCalc.adjustment > 0
                  ? `+${previewCalc.adjustment} kcal surplus`
                  : 'Maintenance'}
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ goal: draftGoal })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Updating...' : 'Update Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Target Weight Editor */}
      {activeEditor === 'target_weight' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 pb-[calc(68px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-[28px] p-5 space-y-4 max-h-[calc(100dvh-68px-env(safe-area-inset-bottom,0px)-1rem)]">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Target Weight</h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-3">
              <span className="text-[11px] text-[#8E8E93] block">Set your desired goal weight</span>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={() => setDraftWeight((prev) => Math.max(30, Math.round((prev - 0.5) * 10) / 10))}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                  −
                </button>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {draftWeight}
                  </span>
                  <span className="text-base font-semibold text-[#8E8E93]">kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftWeight((prev) => Math.min(250, Math.round((prev + 0.5) * 10) / 10))}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-[#8E8E93] block mt-2">
                Current weight: {currentWeight} kg ({Math.round(Math.abs(currentWeight - draftWeight) * 10) / 10} kg difference)
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ target_weight_kg: draftWeight })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Activity Level Editor */}
      {activeEditor === 'activity' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 pb-[calc(68px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-[28px] p-5 space-y-4 max-h-[calc(100dvh-68px-env(safe-area-inset-bottom,0px)-1rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Daily Activity Level</h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => {
                const item = ACTIVITY_LABELS[level];
                const isSelected = draftActivity === level;
                return (
                  <button
                    key={level}
                    onClick={() => setDraftActivity(level)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/[0.08] border-[#30D158] text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#30D158]" />}
                    </div>
                    <p className="text-[11px] text-[#8E8E93] mt-0.5">{item.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ activity_level: draftActivity })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Updating...' : 'Update Activity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Goal Pace Editor */}
      {activeEditor === 'pace' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 pb-[calc(68px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-[28px] p-5 space-y-4 max-h-[calc(100dvh-68px-env(safe-area-inset-bottom,0px)-1rem)]">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Target Pace</h3>
                <p className="text-[11px] text-[#8E8E93]">Rate of weekly weight change</p>
              </div>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {PACE_OPTIONS.map((opt) => {
                const isSelected = draftPace === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDraftPace(opt.value)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/[0.08] border-[#30D158] text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#30D158]" />}
                    </div>
                    <p className="text-[11px] text-[#8E8E93] mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Recalculation Impact */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#8E8E93] block">Target with {draftPace} kg/wk</span>
                <span className="text-sm font-bold text-white">
                  {previewCalc.calorie_target.toLocaleString()} kcal/day
                </span>
              </div>
              <span className="text-[#30D158] font-semibold">
                {previewCalc.adjustment} kcal/day
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ weekly_pace_kg: draftPace })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Updating...' : 'Set Pace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
