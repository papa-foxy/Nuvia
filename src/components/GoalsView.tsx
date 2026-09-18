'use client';

import React, { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';

export function GoalsView() {
  const { user, profile, goals, refreshProfileAndGoals } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);

  const [calorieTarget, setCalorieTarget] = useState(String(goals?.calorie_target || 2200));
  const [proteinTarget, setProteinTarget] = useState(String(goals?.protein_target || 150));
  const [targetWeight, setTargetWeight] = useState(String(goals?.target_weight_kg || 68));
  const [exerciseMinutes, setExerciseMinutes] = useState(String(goals?.exercise_minutes_target || 45));
  const [saving, setSaving] = useState(false);

  const currentWeight = profile?.weight_kg || 73;
  const targetWeightNum = goals?.target_weight_kg || 68;

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updated = {
      ...(goals || {}),
      id: goals?.id || `goal-${Date.now()}`,
      user_id: user?.id || goals?.user_id || DataService.getDemoUserId(),
      calorie_target: Number(calorieTarget) || 2200,
      protein_target: Number(proteinTarget) || 150,
      carbohydrate_target: Number(goals?.carbohydrate_target) || 250,
      fat_target: Number(goals?.fat_target) || 70,
      target_weight_kg: Number(targetWeight) || 68,
      exercise_minutes_target: Number(exerciseMinutes) || 45,
    };

    await DataService.saveGoals(updated as any);
    await refreshProfileAndGoals();
    setSaving(false);
    setShowEditModal(false);
  };

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Configuration
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
            Goals
          </h1>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="text-xs font-semibold text-[#30D158] hover:underline mb-1"
        >
          Edit Targets
        </button>
      </div>

      {/* Inset Grouped Goals Table */}
      <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8E8E93]">Daily Calories</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {goals?.calorie_target?.toLocaleString() || '2,200'} kcal
            </p>
          </div>
          <span className="text-xs font-medium text-[#8E8E93]">Target</span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8E8E93]">Daily Protein</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {goals?.protein_target || 150} g
            </p>
          </div>
          <span className="text-xs font-medium text-[#30D158]">Muscle target</span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8E8E93]">Weight Goal</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {currentWeight} kg → {targetWeightNum} kg
            </p>
          </div>
          <span className="text-xs font-medium text-[#8E8E93]">Target weight</span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8E8E93]">Daily Exercise</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {goals?.exercise_minutes_target || 45} minutes
            </p>
          </div>
          <span className="text-xs font-medium text-[#8E8E93]">Activity</span>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Edit Daily Goals</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoals} className="space-y-3">
              <div>
                <label className="block text-xs text-[#8E8E93] mb-1">
                  Daily Calorie Target (kcal)
                </label>
                <input
                  type="number"
                  value={calorieTarget}
                  onChange={(e) => setCalorieTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#8E8E93] mb-1">
                  Protein Target (g)
                </label>
                <input
                  type="number"
                  value={proteinTarget}
                  onChange={(e) => setProteinTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#8E8E93] mb-1">
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#8E8E93] mb-1">
                  Exercise Target (minutes)
                </label>
                <input
                  type="number"
                  value={exerciseMinutes}
                  onChange={(e) => setExerciseMinutes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-sm text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl bg-[#30D158] text-black font-semibold text-xs"
                >
                  {saving ? 'Saving...' : 'Save Targets'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-3 rounded-2xl bg-[#2C2C2E] text-white text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
