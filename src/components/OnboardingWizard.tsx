'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Flame,
  Sparkles,
  Zap,
  Beef,
  Wheat,
  Droplets,
  Target,
  Scale,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { calculateTargets, CalculationResult } from '@/lib/calculator';
import { DataService } from '@/lib/data-service';
import { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';

interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const { user, profile, hasCompletedOnboarding, refreshProfileAndGoals } = useAuth();

  const [step, setStep] = useState(1);
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex === 'female' ? 'female' : 'male');
  const [dob, setDob] = useState(profile?.date_of_birth || '2003-06-16');
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '176');
  const [weightKg, setWeightKg] = useState(profile?.weight_kg ? String(profile.weight_kg) : '73');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activity_level || 'moderately_active'
  );
  const [goal, setGoal] = useState<UserGoal>(profile?.goal || 'build_muscle');
  const [targetWeightKg, setTargetWeightKg] = useState(
    profile?.target_weight_kg ? String(profile.target_weight_kg) : '68'
  );
  const [dietaryPref, setDietaryPref] = useState(profile?.dietary_preference || 'None');

  const [calculatedTargets, setCalculatedTargets] = useState<CalculationResult | null>(null);
  const [saving, setSaving] = useState(false);

  const calculateAge = (dobString: string): number => {
    const birthday = new Date(dobString);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) || 22;
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Calculate
      const age = calculateAge(dob);
      const res = calculateTargets({
        age,
        sex,
        height_cm: Number(heightCm) || 176,
        weight_kg: Number(weightKg) || 73,
        activity_level: activityLevel,
        goal,
        target_weight_kg: Number(targetWeightKg) || Number(weightKg),
      });
      setCalculatedTargets(res);
      setStep(3);
    }
  };

  const handleFinalSave = async () => {
    if (!calculatedTargets) return;
    setSaving(true);
    const userId = user?.id || DataService.getDemoUserId();

    const updatedProfile: Profile = {
      id: userId,
      name: profile?.name || 'Wann',
      date_of_birth: dob,
      sex,
      height_cm: Number(heightCm) || 176,
      weight_kg: Number(weightKg) || 73,
      activity_level: activityLevel,
      goal,
      target_weight_kg: Number(targetWeightKg) || 68,
      dietary_preference: dietaryPref,
      allergies: [],
    };

    const newGoals: Goal = {
      id: `goal-${Date.now()}`,
      user_id: userId,
      calorie_target: calculatedTargets.calorie_target,
      protein_target: calculatedTargets.protein_target,
      carbohydrate_target: calculatedTargets.carbohydrate_target,
      fat_target: calculatedTargets.fat_target,
      exercise_minutes_target: calculatedTargets.exercise_minutes_target,
      target_weight_kg: Number(targetWeightKg) || 68,
    };

    await DataService.saveProfile(updatedProfile);
    await DataService.saveGoals(newGoals);
    await refreshProfileAndGoals();
    setSaving(false);
    onComplete();
  };

  const getGoalStrategy = (g: UserGoal) => {
    switch (g) {
      case 'lose_weight':
        return { label: '-450 kcal Deficit', tag: 'Fat Loss', color: 'text-amber-400 bg-amber-400/15 border-amber-400/30' };
      case 'build_muscle':
        return { label: '+200 kcal Surplus', tag: 'Muscle Growth', color: 'text-[#30D158] bg-[#30D158]/15 border-[#30D158]/30' };
      case 'gain_weight':
        return { label: '+400 kcal Surplus', tag: 'Weight Gain', color: 'text-sky-400 bg-sky-400/15 border-sky-400/30' };
      case 'maintain_weight':
      default:
        return { label: 'Energy Balance', tag: 'Maintenance', color: 'text-white bg-white/10 border-white/20' };
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between px-6 py-6 max-w-md mx-auto">
      {/* Navigation & Progress */}
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="p-1 text-[#8E8E93] hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : onCancel ? (
          <button onClick={onCancel} className="text-xs text-[#8E8E93] hover:text-white transition-colors">
            Cancel
          </button>
        ) : (
          <div className="w-5" />
        )}
        <span className="text-xs font-semibold text-[#8E8E93]">
          Step {step} of 3
        </span>
      </div>

      {/* Step 1: Body Metrics */}
      {step === 1 && (
        <div className="space-y-6 my-auto py-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 uppercase">
              <Sparkles className="w-3 h-3" />
              Biometrics
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white mt-2">About You</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Used to calculate scientifically accurate metabolic targets.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Biological Sex
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['male', 'female'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSex(opt)}
                    className={`py-3 rounded-2xl text-xs font-semibold capitalize transition-colors ${
                      sex === opt ? 'bg-white text-black font-bold shadow-md' : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  Height
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-[#8E8E93] font-medium pointer-events-none">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  Weight
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-[#8E8E93] font-medium pointer-events-none">kg</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Goal & Activity */}
      {step === 2 && (
        <div className="space-y-6 my-auto py-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 uppercase">
              <Target className="w-3 h-3" />
              Activity &amp; Goal
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-white mt-2">Goals &amp; Activity</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Calibrates daily energy expenditure (TDEE) and macro ratios.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                Primary Goal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'lose_weight' as UserGoal, label: 'Lose Weight' },
                  { id: 'maintain_weight' as UserGoal, label: 'Maintain Weight' },
                  { id: 'build_muscle' as UserGoal, label: 'Build Muscle' },
                  { id: 'gain_weight' as UserGoal, label: 'Gain Weight' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`p-3 rounded-2xl text-xs font-semibold transition-colors ${
                      goal === g.id ? 'bg-white text-black font-bold shadow-md' : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Target Weight
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  placeholder="68"
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-3.5 top-3.5 text-xs text-[#8E8E93] font-medium pointer-events-none">kg</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                Activity Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'sedentary' as ActivityLevel, label: 'Sedentary' },
                  { id: 'lightly_active' as ActivityLevel, label: 'Light (1-2d)' },
                  { id: 'moderately_active' as ActivityLevel, label: 'Moderate (3-5d)' },
                  { id: 'very_active' as ActivityLevel, label: 'Active (6-7d)' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActivityLevel(act.id)}
                    className={`p-3 rounded-2xl text-xs font-semibold transition-colors ${
                      activityLevel === act.id ? 'bg-white text-black font-bold shadow-md' : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Scientific Calculation Results UI */}
      {step === 3 && calculatedTargets && (
        <div className="space-y-4 my-auto py-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 uppercase">
                <Sparkles className="w-3 h-3" />
                Mifflin-St Jeor Engine
              </span>
              {(() => {
                const strat = getGoalStrategy(goal);
                return (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${strat.color}`}>
                    {strat.label}
                  </span>
                );
              })()}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1.5">Your Plan</h2>
            <p className="text-[11px] text-[#8E8E93]">
              Personalized metabolic targets based on your biometrics.
            </p>
          </div>

          {/* Primary Calorie Target Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] border border-white/[0.1] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#FF9500]" />
                Daily Calorie Target
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#30D158]/20 text-[#30D158]">
                Recommended
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-white tracking-tight">
                {calculatedTargets.calorie_target.toLocaleString()}
              </span>
              <span className="text-sm text-[#8E8E93] font-normal">kcal / day</span>
            </div>

            {/* Metabolic Breakdown Cards (BMR & TDEE) */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.08]">
              <div className="p-2 rounded-xl bg-black/40 border border-white/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Base (BMR)</span>
                  <Activity className="w-3 h-3 text-zinc-500" />
                </div>
                <p className="text-sm font-bold text-white mt-0.5">{calculatedTargets.bmr.toLocaleString()} <span className="text-[10px] text-[#8E8E93] font-normal">kcal</span></p>
                <p className="text-[9px] text-[#8E8E93]">Resting burn</p>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8E8E93] uppercase tracking-wider">Daily (TDEE)</span>
                  <Flame className="w-3 h-3 text-orange-400" />
                </div>
                <p className="text-sm font-bold text-white mt-0.5">{calculatedTargets.tdee.toLocaleString()} <span className="text-[10px] text-[#8E8E93] font-normal">kcal</span></p>
                <p className="text-[9px] text-[#8E8E93]">Maintenance burn</p>
              </div>
            </div>
          </div>

          {/* Macronutrients Breakdown Card */}
          <div className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] space-y-3">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block">
              Macronutrient Allocation
            </span>

            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Protein */}
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-400">
                  <Beef className="w-3 h-3" />
                  <span>Protein</span>
                </div>
                <p className="text-base font-bold text-white mt-1">{calculatedTargets.protein_target}g</p>
                <p className="text-[9px] text-[#8E8E93] mt-0.5">~{calculatedTargets.protein_target * 4} kcal</p>
              </div>

              {/* Carbs */}
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-amber-400">
                  <Wheat className="w-3 h-3" />
                  <span>Carbs</span>
                </div>
                <p className="text-base font-bold text-white mt-1">{calculatedTargets.carbohydrate_target}g</p>
                <p className="text-[9px] text-[#8E8E93] mt-0.5">~{calculatedTargets.carbohydrate_target * 4} kcal</p>
              </div>

              {/* Fats */}
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-sky-400">
                  <Droplets className="w-3 h-3" />
                  <span>Fats</span>
                </div>
                <p className="text-base font-bold text-white mt-1">{calculatedTargets.fat_target}g</p>
                <p className="text-[9px] text-[#8E8E93] mt-0.5">~{calculatedTargets.fat_target * 9} kcal</p>
              </div>
            </div>

            {/* Exercise Target */}
            <div className="p-2.5 rounded-xl bg-black/20 border border-white/[0.04] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#30D158]" />
                <span className="text-[#8E8E93]">Daily Activity Target:</span>
              </div>
              <span className="font-bold text-white">{calculatedTargets.exercise_minutes_target} mins/day</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Button */}
      <div className="pb-2">
        {step < 3 ? (
          <button
            onClick={handleNextStep}
            className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-sm transition-transform active:scale-[0.98] cursor-pointer"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleFinalSave}
            disabled={saving}
            className="w-full py-3.5 rounded-full bg-[#30D158] text-black font-bold text-sm transition-transform active:scale-[0.98] cursor-pointer shadow-lg shadow-[#30D158]/20"
          >
            {saving ? 'Saving Targets...' : hasCompletedOnboarding ? 'Save & Apply Calculated Targets' : 'Enter Nuvia'}
          </button>
        )}
      </div>
    </div>
  );
}
