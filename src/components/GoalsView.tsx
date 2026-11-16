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
  getStoredWeeklyPace,
  storeWeeklyPace,
  cleanDietaryPreference,
  describeMissingFields,
  isSavedTargetOutOfDate,
  paceToDailyKcal,
  dailyKcalToPace,
} from '@/lib/calculator';
import { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';
import { TabType } from './Navigation';
import { ScreenHeader } from './ScreenHeader';

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

// Daily calorie change comes from the calculator (1 kg of body weight ≈ 7,700 kcal).
const PACE_OPTIONS = [
  { value: 0.25, label: '0.25 kg / week', desc: 'Gentle' },
  { value: 0.5, label: '0.5 kg / week', desc: 'Recommended' },
  { value: 0.75, label: '0.75 kg / week', desc: 'Faster, needs more discipline' },
  { value: 1.0, label: '1.0 kg / week', desc: 'Very fast, hard to keep up' },
].map((o) => ({ ...o, desc: `${o.desc} · about ${paceToDailyKcal(o.value)} kcal a day` }));

const GOAL_LABELS: Record<UserGoal, string> = {
  recomposition: 'Lose fat & build muscle',
  lose_weight: 'Lose weight',
  maintain_weight: 'Maintain weight',
  build_muscle: 'Build muscle',
  gain_weight: 'Gain weight',
};

export function GoalsView({ onNavigateTab }: GoalsViewProps) {
  const { user, profile, goals, refreshProfileAndGoals } = useAuth();

  // Weekly pace the user chose (kept on this device; default 0.5)
  const [paceVersion, setPaceVersion] = useState(0);
  const currentPace = useMemo(
    () => getStoredWeeklyPace(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, paceVersion]
  );

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
  const currentWeight = calcContext.weight_kg;
  // No target weight saved yet -> treat it as "stay at current weight" instead of inventing one
  const targetWeight = calcContext.target_weight_kg || currentWeight;
  const goalType = calcContext.goal;
  const currentActivity = calcContext.activity_level;
  const usesPace = goalType === 'lose_weight' || goalType === 'gain_weight';

  // What the saved target means against today's maintenance estimate
  const shownAdjustment = calorieTarget - currentCalc.tdee;
  const shownPace = dailyKcalToPace(shownAdjustment);
  // Saved numbers no longer match what the current body details give
  const targetOutOfDate = isSavedTargetOutOfDate(goals, currentCalc);
  const missingDetails = describeMissingFields(calcContext.missing_fields);

  // Sheet / Modal States
  const [showWhySheet, setShowWhySheet] = useState(false);
  const [activeEditor, setActiveEditor] = useState<'goal' | 'target_weight' | 'activity' | 'pace' | null>(null);

  // Edit draft states
  const [draftGoal, setDraftGoal] = useState<UserGoal>(goalType);
  const [draftWeight, setDraftWeight] = useState<number>(targetWeight);
  const [draftActivity, setDraftActivity] = useState<ActivityLevel>(currentActivity);
  const [draftPace, setDraftPace] = useState<number>(currentPace);
  const [saving, setSaving] = useState(false);

  // Recalculation notification banner
  const [recalcNotice, setRecalcNotice] = useState<{
    prevCal: number;
    newCal: number;
  } | null>(null);

  // Live preview for goal selector or editor modal
  // Only the editor that is open contributes its draft; everything else stays as saved.
  const previewCalc = useMemo(() => {
    return calculateTargets({
      ...calcContext,
      goal: activeEditor === 'goal' ? draftGoal : calcContext.goal,
      target_weight_kg: activeEditor === 'target_weight' ? draftWeight : calcContext.target_weight_kg,
      activity_level: activeEditor === 'activity' ? draftActivity : calcContext.activity_level,
      weekly_pace_kg: activeEditor === 'pace' ? draftPace : calcContext.weekly_pace_kg,
    });
  }, [calcContext, activeEditor, draftGoal, draftWeight, draftActivity, draftPace]);

  // Commit updated configuration
  const handleSavePlan = async (overrides?: {
    goal?: UserGoal;
    target_weight_kg?: number;
    activity_level?: ActivityLevel;
    weekly_pace_kg?: number;
  }) => {
    // Anything not being changed keeps its saved value (never a leftover draft
    // from an editor the user opened and cancelled).
    const g = overrides?.goal ?? goalType;
    const tw = overrides?.target_weight_kg ?? targetWeight;
    const act = overrides?.activity_level ?? currentActivity;
    const pace = overrides?.weekly_pace_kg ?? currentPace;

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

      // 1. Update profile (goal, target_weight, activity_level). The pace is kept
      //    on the device; it used to overwrite dietary_preference with "pace:x".
      const profileId = user?.id || profile?.id || DataService.getDemoUserId();
      const updatedProfile: Profile = {
        ...(profile || ({} as Profile)),
        id: profileId,
        name: profile?.name || 'User',
        goal: g,
        target_weight_kg: tw,
        activity_level: act,
        dietary_preference: cleanDietaryPreference(profile?.dietary_preference),
      };
      storeWeeklyPace(profileId, pace);
      setPaceVersion((v) => v + 1);
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
  const isLosing = targetWeight < currentWeight;
  const isGaining = targetWeight > currentWeight;
  const isAtGoal = currentWeight === targetWeight;
  // Goal and target weight point in opposite directions (e.g. "lose weight" with a higher target)
  const goalConflictsWithTarget =
    (shownAdjustment < 0 && isGaining) || (shownAdjustment > 0 && isLosing);
  // Time to goal uses the same pace the calorie target delivers
  const shownWeeks =
    !isAtGoal && !goalConflictsWithTarget && shownPace > 0 ? Math.ceil(weightDiff / shownPace) : null;

  // Macro calorie percentages
  const proteinCals = proteinTarget * 4;
  const carbCals = carbTarget * 4;
  const fatCals = fatTarget * 9;
  const totalMacroCals = proteinCals + carbCals + fatCals || calorieTarget;
  const proteinPct = Math.round((proteinCals / totalMacroCals) * 100);
  const carbPct = Math.round((carbCals / totalMacroCals) * 100);
  const fatPct = Math.round((fatCals / totalMacroCals) * 100);

  // Goal name formatted
  const goalLabel = GOAL_LABELS[goalType] || 'Maintain weight';

  return (
    <div className="flex-1 flex flex-col pb-28 px-5 pt-4 w-full max-w-md mx-auto space-y-5 animate-fadeIn">
      {/* ── TOP HEADER ─────────────────────────────────────────────────── */}
      <div className="-mx-5">
        <ScreenHeader
          eyebrow="Weight goal & daily targets"
          title="Goals"
          onOpenProfile={onNavigateTab ? () => onNavigateTab('profile') : undefined}
        />
      </div>

      {/* ── RECALCULATION NOTIFICATION BANNER ───────────────────────────── */}
      {recalcNotice && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-accent/15 via-fg/[0.03] to-black border border-accent/30 flex items-start justify-between gap-3 animate-slideDown">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-accent text-on-accent flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 fill-black" />
            </div>
            <div>
              <p className="text-xs font-bold text-fg flex items-center gap-1.5">
                <span>Calorie target updated</span>
                <span className="text-green-ink">
                  {recalcNotice.prevCal.toLocaleString()} → {recalcNotice.newCal.toLocaleString()} kcal
                </span>
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Recalculated using your latest profile & activity settings. Synchronized across Today and AI Coach.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRecalcNotice(null)}
            className="text-zinc-400 hover:text-fg p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MISSING BODY DETAILS: numbers below are only an estimate ─────── */}
      {missingDetails && (
        <div className="p-3.5 rounded-2xl bg-card border border-warn/40 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-fg">These numbers are a rough estimate</p>
            <p className="text-[11px] text-muted mt-0.5">
              Add your {missingDetails} in Profile so Nuvia can work out your real targets.
            </p>
          </div>
        </div>
      )}

      {/* ── SAVED TARGET NO LONGER MATCHES CURRENT BODY DETAILS ──────────── */}
      {targetOutOfDate && !missingDetails && (
        <div className="p-3.5 rounded-2xl bg-card border border-accent/30 space-y-2.5">
          <div>
            <p className="text-xs font-bold text-fg">Your targets can be updated</p>
            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
              You are using {calorieTarget.toLocaleString()} kcal ({proteinTarget} g protein, {carbTarget} g carbs,{' '}
              {fatTarget} g fat). With your current details Nuvia now suggests{' '}
              <span className="text-fg font-semibold">
                {currentCalc.calorie_target.toLocaleString()} kcal ({currentCalc.protein_target} g protein,{' '}
                {currentCalc.carbohydrate_target} g carbs, {currentCalc.fat_target} g fat)
              </span>
              .
            </p>
          </div>
          <button
            onClick={() => handleSavePlan({})}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs cursor-pointer"
          >
            {saving ? 'Updating...' : 'Use the new targets'}
          </button>
        </div>
      )}

      {/* ── 1. HERO SECTION: YOUR GOAL ─────────────────────────────────── */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
            Your Goal
          </span>
          <span className="text-[10px] font-semibold text-green-ink px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            Active Plan
          </span>
        </div>

        {/* Big Typography Goal Name */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight uppercase">
            {goalLabel}
          </h2>
          <p className="text-xs text-muted mt-1">
            {goalType === 'recomposition' && 'A small calorie deficit with high protein, to lose fat while you train.'}
            {goalType === 'lose_weight' && 'A calorie target below your estimated maintenance to support weight loss.'}
            {goalType === 'maintain_weight' && 'A calorie target balanced with your estimated maintenance level.'}
            {goalType === 'build_muscle' && 'A controlled surplus with optimized protein for muscle growth.'}
            {goalType === 'gain_weight' && 'A steady calorie surplus to build healthy body mass.'}
          </p>
        </div>

        {/* Current -> Target Weight Hero Block */}
        <div className="p-3.5 rounded-2xl bg-fg/[0.03] border border-fg/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-muted block">
              Current Weight
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-fg tracking-tight">
                {currentWeight}
              </span>
              <span className="text-xs font-semibold text-muted">kg</span>
            </div>
          </div>

          <div className="flex flex-col items-center px-2">
            {isLosing ? (
              <TrendingDown className="w-5 h-5 text-green-ink" />
            ) : isGaining ? (
              <TrendingUp className="w-5 h-5 text-blue-ink" />
            ) : (
              <Minus className="w-5 h-5 text-zinc-400" />
            )}
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted mt-0.5">
              {isAtGoal ? 'Maintaining' : `${weightDiff} kg ${isLosing ? 'to lose' : 'to gain'}`}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-muted block">
              Target Weight
            </span>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-fg tracking-tight">
                {targetWeight}
              </span>
              <span className="text-xs font-semibold text-muted">kg</span>
            </div>
          </div>
        </div>

        {/* ── GOAL TYPE SELECTOR PILLS ─────────────────────────────────── */}
        <div className="pt-1">
          <label className="text-[11px] font-semibold text-muted block mb-2">
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
                      ? 'bg-fg text-app font-bold border-fg shadow-md'
                      : 'bg-fg/[0.03] text-zinc-300 hover:text-fg border-fg/[0.06] hover:bg-fg/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                  </div>
                  <span
                    className={`text-[10px] block mt-0.5 truncate ${
                      isSelected ? 'text-zinc-700' : 'text-muted'
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
            <Flame className="w-4 h-4 text-orange-ink" />
            <span className="text-[11px] font-bold tracking-wider text-fg uppercase">
              Daily Calories
            </span>
          </div>
          <button
            onClick={() => setShowWhySheet(true)}
            className="text-[11px] font-semibold text-green-ink hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>Why this target?</span>
          </button>
        </div>

        {/* Comparison Grid: Maintenance vs Goal Target */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Estimated Maintenance */}
          <div className="p-3.5 rounded-2xl bg-fg/[0.03] border border-fg/[0.05]">
            <span className="text-[11px] font-medium text-muted block">
              Estimated maintenance
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold tracking-tight text-fg">
                {currentCalc.tdee.toLocaleString()}
              </span>
              <span className="text-xs text-muted">kcal</span>
            </div>
            <span className="text-[10px] text-muted block mt-1">
              BMR ({currentCalc.bmr}) × activity
            </span>
          </div>

          {/* Goal Target */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-b from-accent/10 to-transparent border border-accent/30 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-fg block">
                Daily goal target
              </span>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  shownAdjustment < 0
                    ? 'bg-emerald-500/20 text-green-ink'
                    : shownAdjustment > 0
                    ? 'bg-info/20 text-blue-ink'
                    : 'bg-fg/10 text-zinc-300'
                }`}
              >
                {shownAdjustment < 0
                  ? `${shownAdjustment} kcal`
                  : shownAdjustment > 0
                  ? `+${shownAdjustment} kcal`
                  : 'Balanced'}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold tracking-tight text-fg">
                {calorieTarget.toLocaleString()}
              </span>
              <span className="text-xs text-muted">kcal</span>
            </div>
            <span className="text-[10px] text-muted block mt-1">
              {shownAdjustment < 0
                ? `${Math.abs(shownAdjustment)} kcal/day deficit`
                : shownAdjustment > 0
                ? `${shownAdjustment} kcal/day surplus`
                : 'Equal to maintenance'}
            </span>
          </div>
        </div>

        {/* Visual Connector / Flow Path */}
        <div className="p-3 rounded-xl bg-app/40 border border-fg/[0.04] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">Maintenance {currentCalc.tdee}</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted" />
            <span className="font-bold text-fg">Target {calorieTarget} kcal</span>
          </div>
          <span
            className={`font-semibold text-xs ${
              shownAdjustment < 0
                ? 'text-green-ink'
                : shownAdjustment > 0
                ? 'text-blue-ink'
                : 'text-zinc-400'
            }`}
          >
            {shownAdjustment < 0
              ? `${shownAdjustment} vs maintenance`
              : shownAdjustment > 0
              ? `+${shownAdjustment} vs maintenance`
              : 'Matches maintenance'}
          </span>
        </div>

        {/* Concise Contextual Explanation */}
        <p className="text-xs text-muted leading-relaxed">
          {goalType === 'lose_weight' && (
            <>
              Your target is <span className="text-fg font-medium">below estimated maintenance</span> to support steady, sustainable weight loss.
            </>
          )}
          {goalType === 'recomposition' && (
            <>
              Your target is <span className="text-fg font-medium">slightly below estimated maintenance</span>, with high protein to help keep muscle while you lose fat.
            </>
          )}
          {goalType === 'maintain_weight' && (
            <>
              Your target is <span className="text-fg font-medium">at your estimated maintenance level</span> to sustain your current weight, energy, and muscle mass.
            </>
          )}
          {goalType === 'build_muscle' && (
            <>
              Your target is <span className="text-fg font-medium">above estimated maintenance</span> to supply adequate energy for progressive muscle hypertrophy.
            </>
          )}
          {goalType === 'gain_weight' && (
            <>
              Your target is <span className="text-fg font-medium">in a healthy surplus</span> to facilitate steady body weight gain.
            </>
          )}
        </p>
      </div>

      {/* ── 3. GOAL PROGRESS SECTION ───────────────────────────────────── */}
      <div className="ios-card p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-green-ink" />
            <span className="text-[11px] font-bold tracking-wider text-fg uppercase">
              Goal Progress
            </span>
          </div>
          <span className="text-xs font-semibold text-fg">
            {currentWeight} kg → {targetWeight} kg
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[10px] text-muted px-0.5">
            <span>Current: {currentWeight} kg</span>
            <span className="font-semibold text-fg">
              {isAtGoal ? 'Target Achieved' : `${weightDiff} kg to goal`}
            </span>
            <span>Target: {targetWeight} kg</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-fg/[0.02] border border-fg/[0.04] text-xs text-muted space-y-1.5">
          <div className="flex items-center justify-between">
            <span>Expected pace at this target</span>
            <span className="font-semibold text-fg">
              {shownPace > 0
                ? `about ${shownPace} kg / week ${shownAdjustment < 0 ? 'down' : 'up'}`
                : 'Holding steady'}
            </span>
          </div>
          {shownWeeks != null && (
            <div className="flex items-center justify-between">
              <span>Estimated time to {targetWeight} kg</span>
              <span className="font-semibold text-fg">about {shownWeeks} weeks</span>
            </div>
          )}
          {usesPace && !targetOutOfDate && currentCalc.limited_by !== 'none' && (
            <p className="text-[11px] text-warn leading-relaxed">
              You chose {currentPace} kg / week, but that would need a bigger calorie{' '}
              {goalType === 'lose_weight' ? 'cut' : 'increase'} than Nuvia will suggest
              {currentCalc.limited_by === 'min_calories'
                ? ` (it will not go below ${currentCalc.min_calories.toLocaleString()} kcal a day)`
                : ' (no more than a quarter of your maintenance calories)'}
              , so your pace will be slower.
            </p>
          )}
          {goalConflictsWithTarget && (
            <p className="text-[11px] text-warn leading-relaxed">
              Your goal and your target weight point in different directions. Check your target weight or change your goal.
            </p>
          )}
          <p className="text-[10px] text-subtle leading-relaxed">
            Estimates only. Real weight change varies from week to week.
          </p>
        </div>
      </div>

      {/* ── 4. DAILY MACROS SECTION ────────────────────────────────────── */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-fg uppercase">
            Daily Macros
          </span>
          <span className="text-[11px] text-muted">
            {calorieTarget} kcal total
          </span>
        </div>

        {/* Macro Ratio Split Bar */}
        <div className="h-2 w-full bg-fg/[0.06] rounded-full flex overflow-hidden">
          <div
            className="bg-accent h-full"
            style={{ width: `${proteinPct}%` }}
            title={`Protein ${proteinPct}%`}
          />
          <div
            className="bg-amber-400 h-full"
            style={{ width: `${carbPct}%` }}
            title={`Carbs ${carbPct}%`}
          />
          <div
            className="bg-info h-full"
            style={{ width: `${fatPct}%` }}
            title={`Fats ${fatPct}%`}
          />
        </div>

        {/* Apple-style Grouped Macro Rows */}
        <div className="divide-y divide-fg/[0.06] text-xs">
          {/* Protein Row */}
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-accent/15 text-green-ink flex items-center justify-center shrink-0">
                <Beef className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-fg block">Protein</span>
                <span className="text-[10px] text-muted">
                  {goalType === 'build_muscle' || goalType === 'lose_weight'
                    ? 'Primary muscle retention target'
                    : 'Essential daily intake'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-fg text-sm">{proteinTarget} g</span>
              <span className="text-[10px] text-muted block">{proteinPct}% of cals</span>
            </div>
          </div>

          {/* Carbs Row */}
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center shrink-0">
                <Wheat className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-fg block">Carbohydrates</span>
                <span className="text-[10px] text-muted">Energy & workout fuel</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-fg text-sm">{carbTarget} g</span>
              <span className="text-[10px] text-muted block">{carbPct}% of cals</span>
            </div>
          </div>

          {/* Fat Row */}
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-info/15 text-blue-ink flex items-center justify-center shrink-0">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-fg block">Healthy Fats</span>
                <span className="text-[10px] text-muted">Hormones & cellular health</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-fg text-sm">{fatTarget} g</span>
              <span className="text-[10px] text-muted block">{fatPct}% of cals</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. YOUR PLAN / GOAL INPUTS (FOCUSED EDITORS) ─────────────────── */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold tracking-wider text-muted uppercase px-1">
          Your Plan
        </span>

        <div className="ios-card divide-y divide-fg/[0.06] overflow-hidden text-xs">
          {/* Row 1: Goal Objective */}
          <button
            onClick={() => {
              setDraftGoal(goalType);
              setActiveEditor('goal');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-fg/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Target className="w-4 h-4 text-green-ink" />
              <span className="font-medium text-muted">Goal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-fg">{goalLabel}</span>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          </button>

          {/* Row 2: Target Weight */}
          <button
            onClick={() => {
              setDraftWeight(targetWeight);
              setActiveEditor('target_weight');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-fg/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-orange-ink" />
              <span className="font-medium text-muted">Target Weight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-fg">{targetWeight} kg</span>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          </button>

          {/* Row 3: Activity Level */}
          <button
            onClick={() => {
              setDraftActivity(currentActivity);
              setActiveEditor('activity');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-fg/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-blue-ink" />
              <span className="font-medium text-muted">Activity Level</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-fg">
                {ACTIVITY_LABELS[currentActivity]?.label || 'Not set'}
              </span>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          </button>

          {/* Row 4: Goal Pace */}
          <button
            onClick={() => {
              setDraftPace(currentPace);
              setActiveEditor('pace');
            }}
            className="w-full p-3.5 flex items-center justify-between hover:bg-fg/[0.02] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-muted">Weekly Pace</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-fg">
                {usesPace ? `${currentPace} kg / week` : 'Not used for this goal'}
              </span>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          </button>
        </div>
      </div>

      {/* ── 6. HOW NUVIA CALCULATES YOUR TARGET ─────────────────────────── */}
      <div className="ios-card p-5 space-y-3">
        <span className="text-[11px] font-bold tracking-wider text-muted uppercase block">
          How Nuvia Calculates Your Target
        </span>
        <p className="text-xs text-muted leading-relaxed">
          Your calorie target is estimated from your age, sex, height and weight using the{' '}
          <strong className="text-fg">Mifflin-St Jeor formula</strong>, multiplied by your activity level:
        </p>

        <div className="p-3.5 rounded-2xl bg-app/40 border border-fg/[0.04] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Estimated maintenance (TDEE)</span>
            <span className="font-bold text-fg">{currentCalc.tdee.toLocaleString()} kcal</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Goal adjustment ({goalLabel})</span>
            <span
              className={`font-bold ${
                shownAdjustment < 0
                  ? 'text-green-ink'
                  : shownAdjustment > 0
                  ? 'text-blue-ink'
                  : 'text-fg'
              }`}
            >
              {shownAdjustment < 0
                ? `${shownAdjustment} kcal`
                : shownAdjustment > 0
                ? `+${shownAdjustment} kcal`
                : '0 kcal'}
            </span>
          </div>
          <div className="pt-2 border-t border-fg/10 flex items-center justify-between">
            <span className="font-bold text-fg">Daily Recommended Target</span>
            <span className="text-sm font-extrabold text-green-ink">
              {calorieTarget.toLocaleString()} kcal
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── BOTTOM SHEET: "WHY THIS TARGET?" ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showWhySheet && (
        <>
          <div
            className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity animate-fadeIn"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
            onClick={() => setShowWhySheet(false)}
            aria-hidden="true"
          />
          <div
            className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-card border-t border-x border-b-0 border-fg/10 rounded-t-[28px] rounded-b-none p-5 space-y-4 max-h-[var(--sheet-max-h)] overflow-y-auto animate-slideUp"
            >
            <div className="flex items-center justify-between pb-2 border-b border-fg/10">
              <div>
                <h3 className="text-base font-bold text-fg">
                  Why is my target {calorieTarget.toLocaleString()} kcal?
                </h3>
                <p className="text-[11px] text-muted">Transparent calculation breakdown</p>
              </div>
              <button
                onClick={() => setShowWhySheet(false)}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile inputs used */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted uppercase">
                Factors From Your Profile
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-fg/[0.03] border border-fg/[0.04]">
                  <span className="text-[10px] text-muted block">Sex & Age</span>
                  <span className="font-semibold text-fg">
                    {profile?.sex ? <span className="capitalize">{profile.sex}</span> : 'Sex not set'},{' '}
                    {calcContext.missing_fields.includes('date_of_birth') ? 'age not set' : `${calcContext.age} yrs`}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-fg/[0.03] border border-fg/[0.04]">
                  <span className="text-[10px] text-muted block">Height & Weight</span>
                  <span className="font-semibold text-fg">
                    {calcContext.height_cm} cm, {currentWeight} kg
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-fg/[0.03] border border-fg/[0.04]">
                  <span className="text-[10px] text-muted block">Activity Level</span>
                  <span className="font-semibold text-fg">
                    {ACTIVITY_LABELS[currentActivity]?.label || 'Not set'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-fg/[0.03] border border-fg/[0.04]">
                  <span className="text-[10px] text-muted block">Goal & Pace</span>
                  <span className="font-semibold text-fg">
                    {goalLabel}{usesPace ? ` (${currentPace} kg/wk)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Step-by-step Math */}
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-bold text-muted uppercase">
                Calculation Steps
              </span>

              <div className="p-3 rounded-xl bg-fg/[0.02] border border-fg/[0.05] space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-fg">
                  <span>1. Basal Metabolic Rate (BMR)</span>
                  <span>{currentCalc.bmr} kcal</span>
                </div>
                <p className="text-[11px] text-muted">
                  Energy burned at complete rest to keep organs functioning.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-fg/[0.02] border border-fg/[0.05] space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-fg">
                  <span>2. Maintenance Calories (TDEE)</span>
                  <span>{currentCalc.tdee} kcal</span>
                </div>
                <p className="text-[11px] text-muted">
                  BMR × Activity factor. Eating this amount maintains your current {currentWeight} kg.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-fg/[0.02] border border-fg/[0.05] space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-fg">
                  <span>3. Goal Adjustment</span>
                  <span className="text-green-ink">
                    {shownAdjustment < 0
                      ? `${shownAdjustment} kcal`
                      : shownAdjustment > 0
                      ? `+${shownAdjustment} kcal`
                      : '0 kcal'}
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  {shownAdjustment < 0
                    ? `Eating ${Math.abs(shownAdjustment)} kcal below maintenance each day works out to about ${shownPace} kg lost per week (1 kg of body weight is roughly 7,700 kcal).`
                    : shownAdjustment > 0
                    ? `Eating ${shownAdjustment} kcal above maintenance each day works out to about ${shownPace} kg gained per week (1 kg of body weight is roughly 7,700 kcal).`
                    : 'Your target matches your maintenance calories.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-accent/20 to-card border border-accent/40 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-fg block">Recommended Daily Target</span>
                  <span className="text-[10px] text-muted">Synchronized across Nuvia</span>
                </div>
                <span className="text-base font-extrabold text-green-ink">
                  {calorieTarget.toLocaleString()} kcal/day
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted pt-1 leading-relaxed">
              Your targets update when you change your goal, pace or activity level here, or save new body details in Profile. Calories burned in workouts are not added back, because your activity level already covers them.
            </p>

            <button
              onClick={() => setShowWhySheet(false)}
              className="w-full py-3 rounded-xl bg-fg text-app font-bold text-xs hover:bg-fg/85 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FOCUSED PLAN ROW EDITORS ────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* 1. Goal Editor */}
      {activeEditor === 'goal' && (
        <>
          <div
            className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity animate-fadeIn"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
            onClick={() => setActiveEditor(null)}
            aria-hidden="true"
          />
          <div
            className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-card border-t border-x border-b-0 border-fg/10 rounded-t-[28px] rounded-b-none p-5 space-y-4 max-h-[var(--sheet-max-h)] animate-slideUp"
            >
            <div className="flex items-center justify-between pb-2 border-b border-fg/10">
              <h3 className="text-base font-bold text-fg">Select Your Goal</h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-zinc-400 cursor-pointer"
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
                      ? 'bg-fg/[0.08] border-accent text-fg'
                      : 'bg-fg/[0.02] border-fg/[0.06] text-muted hover:text-fg'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-fg">{opt.label}</span>
                    {draftGoal === opt.id && <Check className="w-4 h-4 text-green-ink" />}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Live Recalculation Preview */}
            <div className="p-3.5 rounded-2xl bg-app/40 border border-fg/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="text-muted block">Preview target</span>
                <span className="text-sm font-bold text-fg">
                  {previewCalc.calorie_target.toLocaleString()} kcal/day
                </span>
              </div>
              <span
                className={`font-semibold ${
                  previewCalc.adjustment < 0
                    ? 'text-green-ink'
                    : previewCalc.adjustment > 0
                    ? 'text-blue-ink'
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
                className="flex-1 py-3 rounded-xl bg-fg/10 text-fg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ goal: draftGoal })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Updating...' : 'Update Goal'}
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* 2. Target Weight Editor */}
      {activeEditor === 'target_weight' && (
        <>
          <div
            className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity animate-fadeIn"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
            onClick={() => setActiveEditor(null)}
            aria-hidden="true"
          />
          <div
            className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-card border-t border-x border-b-0 border-fg/10 rounded-t-[28px] rounded-b-none p-5 space-y-4 max-h-[var(--sheet-max-h)] animate-slideUp"
            >
            <div className="flex items-center justify-between pb-2 border-b border-fg/10">
              <h3 className="text-base font-bold text-fg">Target Weight</h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-3">
              <span className="text-[11px] text-muted block">Set your desired goal weight</span>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={() => setDraftWeight((prev) => Math.max(30, Math.round((prev - 0.5) * 10) / 10))}
                  className="w-12 h-12 rounded-2xl bg-fg/10 hover:bg-fg/15 text-fg font-bold text-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                  −
                </button>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-fg tracking-tight">
                    {draftWeight}
                  </span>
                  <span className="text-base font-semibold text-muted">kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftWeight((prev) => Math.min(250, Math.round((prev + 0.5) * 10) / 10))}
                  className="w-12 h-12 rounded-2xl bg-fg/10 hover:bg-fg/15 text-fg font-bold text-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-muted block mt-2">
                Current weight: {currentWeight} kg ({Math.round(Math.abs(currentWeight - draftWeight) * 10) / 10} kg difference)
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-fg/10 text-fg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ target_weight_kg: draftWeight })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Target'}
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* 3. Activity Level Editor */}
      {activeEditor === 'activity' && (
        <>
          <div
            className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity animate-fadeIn"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
            onClick={() => setActiveEditor(null)}
            aria-hidden="true"
          />
          <div
            className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-card border-t border-x border-b-0 border-fg/10 rounded-t-[28px] rounded-b-none p-5 space-y-4 max-h-[var(--sheet-max-h)] overflow-y-auto animate-slideUp"
            >
            <div className="flex items-center justify-between pb-2 border-b border-fg/10">
              <h3 className="text-base font-bold text-fg">Daily Activity Level</h3>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-zinc-400 cursor-pointer"
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
                        ? 'bg-fg/[0.08] border-accent text-fg'
                        : 'bg-fg/[0.02] border-fg/[0.06] text-muted hover:text-fg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-fg">{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-green-ink" />}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">{item.desc}</p>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Not sure? Pick the lower option. Choosing a level that is too high makes your calorie target too high.
            </p>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-fg/10 text-fg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ activity_level: draftActivity })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Updating...' : 'Update Activity'}
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* 4. Goal Pace Editor */}
      {activeEditor === 'pace' && (
        <>
          <div
            className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity animate-fadeIn"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
            onClick={() => setActiveEditor(null)}
            aria-hidden="true"
          />
          <div
            className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
            style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-card border-t border-x border-b-0 border-fg/10 rounded-t-[28px] rounded-b-none p-5 space-y-4 max-h-[var(--sheet-max-h)] animate-slideUp"
            >
            <div className="flex items-center justify-between pb-2 border-b border-fg/10">
              <div>
                <h3 className="text-base font-bold text-fg">Target Pace</h3>
                <p className="text-[11px] text-muted">Rate of weekly weight change</p>
              </div>
              <button
                onClick={() => setActiveEditor(null)}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-zinc-400 cursor-pointer"
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
                        ? 'bg-fg/[0.08] border-accent text-fg'
                        : 'bg-fg/[0.02] border-fg/[0.06] text-muted hover:text-fg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-fg">{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-green-ink" />}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Recalculation Impact */}
            <div className="p-3.5 rounded-2xl bg-app/40 border border-fg/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="text-muted block">Target with {draftPace} kg/wk</span>
                <span className="text-sm font-bold text-fg">
                  {previewCalc.calorie_target.toLocaleString()} kcal/day
                </span>
              </div>
              <span className="text-green-ink font-semibold">
                {previewCalc.adjustment > 0 ? `+${previewCalc.adjustment}` : previewCalc.adjustment} kcal/day
              </span>
            </div>

            {!usesPace && (
              <p className="text-[11px] text-muted leading-relaxed">
                Weekly pace only changes your calories when your goal is Lose weight or Gain weight.
              </p>
            )}
            {usesPace && previewCalc.limited_by !== 'none' && (
              <p className="text-[11px] text-warn leading-relaxed">
                {draftPace} kg / week would need a bigger calorie {goalType === 'lose_weight' ? 'cut' : 'increase'} than
                Nuvia will suggest
                {previewCalc.limited_by === 'min_calories'
                  ? ` (it will not go below ${previewCalc.min_calories.toLocaleString()} kcal a day)`
                  : ' (no more than a quarter of your maintenance calories)'}
                . At this target, expect about {previewCalc.expected_pace_kg} kg / week.
              </p>
            )}

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setActiveEditor(null)}
                className="flex-1 py-3 rounded-xl bg-fg/10 text-fg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan({ weekly_pace_kg: draftPace })}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? 'Updating...' : 'Set Pace'}
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
