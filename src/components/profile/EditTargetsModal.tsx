'use client';

import React, { useState } from 'react';
import { X, Check, Flame, Beef, Wheat, Droplets, Target, Zap, Sparkles, RefreshCw } from 'lucide-react';
import { Goal, Profile } from '@/types/database';
import { DataService } from '@/lib/data-service';
import { calculateTargets } from '@/lib/calculator';

interface EditTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: Goal | null;
  profile?: Profile | null;
  userId?: string;
  onGoalsUpdated: () => void;
}

export function EditTargetsModal({
  isOpen,
  onClose,
  goals,
  profile,
  userId,
  onGoalsUpdated,
}: EditTargetsModalProps) {
  const [calorieTarget, setCalorieTarget] = useState(String(goals?.calorie_target || 2050));
  const [proteinTarget, setProteinTarget] = useState(String(goals?.protein_target || 140));
  const [carbTarget, setCarbTarget] = useState(String(goals?.carbohydrate_target || 220));
  const [fatTarget, setFatTarget] = useState(String(goals?.fat_target || 65));
  const [targetWeight, setTargetWeight] = useState(String(goals?.target_weight_kg || 68));
  const [exerciseMinutes, setExerciseMinutes] = useState(String(goals?.exercise_minutes_target || 45));
  const [saving, setSaving] = useState(false);
  const [calculatedNotice, setCalculatedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAutoCalculate = () => {
    const age = (() => {
      if (!profile?.date_of_birth) return 23;
      const b = new Date(profile.date_of_birth);
      if (isNaN(b.getTime())) return 23;
      return Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970) || 23;
    })();

    const result = calculateTargets({
      age,
      sex: profile?.sex || 'male',
      height_cm: profile?.height_cm || 175,
      weight_kg: profile?.weight_kg || 73,
      activity_level: profile?.activity_level || 'moderately_active',
      goal: profile?.goal || 'lose_weight',
      target_weight_kg: profile?.target_weight_kg || 68,
    });

    setCalorieTarget(String(result.calorie_target));
    setProteinTarget(String(result.protein_target));
    setCarbTarget(String(result.carbohydrate_target));
    setFatTarget(String(result.fat_target));
    setExerciseMinutes(String(result.exercise_minutes_target));
    if (profile?.target_weight_kg) {
      setTargetWeight(String(profile.target_weight_kg));
    }

    setCalculatedNotice(
      `Calculated: BMR ${result.bmr} kcal · TDEE ${result.tdee} kcal (${profile?.goal ? profile.goal.replace('_', ' ') : 'goal'})`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updated: Goal = {
        ...(goals || ({} as Goal)),
        id: goals?.id || `goal-${Date.now()}`,
        user_id: userId || goals?.user_id || DataService.getDemoUserId(),
        calorie_target: Number(calorieTarget) || 2050,
        protein_target: Number(proteinTarget) || 140,
        carbohydrate_target: Number(carbTarget) || 220,
        fat_target: Number(fatTarget) || 65,
        target_weight_kg: Number(targetWeight) || 68,
        exercise_minutes_target: Number(exerciseMinutes) || 45,
      };

      await DataService.saveGoals(updated);
      await onGoalsUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to update goals:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop: bounded above bottom navigation */}
      <div
        className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity animate-fadeIn"
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container: sits above backdrop (z-45) directly on top of nav */}
      <div
        className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto w-full max-w-md bg-[#1C1C1E] border-t border-x border-b-0 border-white/10 rounded-t-[28px] rounded-b-none p-5 space-y-4 max-h-[calc(100dvh-var(--bottom-nav-height,56px)-env(safe-area-inset-bottom,0px)-0.75rem)] overflow-y-auto"
        >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Adjust Daily Targets</h3>
            <p className="text-[11px] text-[#8E8E93]">Fine-tune your personal nutrition & fitness goals</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-Calculate Quick Action */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-[#30D158]/15 via-white/[0.04] to-transparent border border-[#30D158]/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#30D158]" />
              <span>Auto-Calculate Targets</span>
            </span>
            <span className="text-[10px] text-[#8E8E93] block mt-0.5">
              Based on your profile ({profile?.height_cm || 175}cm, {profile?.weight_kg || 73}kg)
            </span>
          </div>
          <button
            type="button"
            onClick={handleAutoCalculate}
            className="px-3 py-1.5 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-xs flex items-center gap-1 transition-transform active:scale-95 shadow cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Recalculate</span>
          </button>
        </div>

        {calculatedNotice && (
          <div className="p-2 rounded-xl bg-[#30D158]/10 border border-[#30D158]/30 text-[11px] text-[#30D158] font-medium flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{calculatedNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Calories & Target Weight */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#FF9500]" />
                <span>Daily Calories</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={calorieTarget}
                  onChange={(e) => setCalorieTarget(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-[#8E8E93]">kcal</span>
              </div>
            </div>

            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-[#30D158]" />
                <span>Target Weight</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-[#8E8E93]">kg</span>
              </div>
            </div>
          </div>

          {/* Macros Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium flex items-center gap-1">
                <Beef className="w-3 h-3 text-[#30D158]" />
                <span>Protein</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={proteinTarget}
                  onChange={(e) => setProteinTarget(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-2 top-2.5 text-[10px] text-[#8E8E93]">g</span>
              </div>
            </div>

            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium flex items-center gap-1">
                <Wheat className="w-3 h-3 text-amber-400" />
                <span>Carbs</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={carbTarget}
                  onChange={(e) => setCarbTarget(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-2 top-2.5 text-[10px] text-[#8E8E93]">g</span>
              </div>
            </div>

            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium flex items-center gap-1">
                <Droplets className="w-3 h-3 text-[#0A84FF]" />
                <span>Fats</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={fatTarget}
                  onChange={(e) => setFatTarget(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-2 top-2.5 text-[10px] text-[#8E8E93]">g</span>
              </div>
            </div>
          </div>

          {/* Exercise Minutes */}
          <div>
            <label className="block text-[#8E8E93] mb-1 font-medium flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Daily Exercise Target</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={exerciseMinutes}
                onChange={(e) => setExerciseMinutes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-[#8E8E93]">minutes</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold transition-colors flex items-center justify-center gap-1.5 shadow"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Targets'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
