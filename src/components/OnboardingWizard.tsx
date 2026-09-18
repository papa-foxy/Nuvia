'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { calculateTargets, CalculationResult } from '@/lib/calculator';
import { DataService } from '@/lib/data-service';
import { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';

interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const { user, profile, refreshProfileAndGoals } = useAuth();

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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between px-6 py-6 max-w-md mx-auto">
      {/* Navigation & Progress */}
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="p-1 text-[#8E8E93] hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : onCancel ? (
          <button onClick={onCancel} className="text-xs text-[#8E8E93] hover:text-white">
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
        <div className="space-y-6 my-auto py-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">About You</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Used to calculate scientifically accurate baseline targets.
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
                    className={`py-3 rounded-2xl text-xs font-medium capitalize transition-colors ${
                      sex === opt ? 'bg-white text-black font-semibold' : 'bg-[#1C1C1E] text-[#8E8E93]'
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
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.06] text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.06] text-sm text-white focus:outline-none"
                />
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
                className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Goal & Activity */}
      {step === 2 && (
        <div className="space-y-6 my-auto py-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Goals & Activity</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Helps calibrate daily calories and macronutrient ratios.
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
                    className={`p-3 rounded-2xl text-xs font-medium transition-colors ${
                      goal === g.id ? 'bg-white text-black font-semibold' : 'bg-[#1C1C1E] text-[#8E8E93]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Target Weight (kg)
              </label>
              <input
                type="number"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
                placeholder="68"
                className="w-full px-3.5 py-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.06] text-sm text-white focus:outline-none"
              />
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
                    className={`p-3 rounded-2xl text-xs font-medium transition-colors ${
                      activityLevel === act.id ? 'bg-white text-black font-semibold' : 'bg-[#1C1C1E] text-[#8E8E93]'
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

      {/* Step 3: Review Plan */}
      {step === 3 && calculatedTargets && (
        <div className="space-y-6 my-auto py-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Your Plan</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Calculated using the Mifflin-St Jeor formula based on your profile.
            </p>
          </div>

          <div className="ios-card p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                Daily Calorie Target
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-bold text-white tracking-tight">
                  {calculatedTargets.calorie_target.toLocaleString()}
                </span>
                <span className="text-sm text-[#8E8E93]">kcal / day</span>
              </div>
            </div>

            <div className="ios-divider" />

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-[#8E8E93]">Protein</p>
                <p className="text-lg font-bold text-white mt-0.5">{calculatedTargets.protein_target}g</p>
              </div>
              <div>
                <p className="text-[#8E8E93]">Carbs</p>
                <p className="text-lg font-bold text-white mt-0.5">{calculatedTargets.carbohydrate_target}g</p>
              </div>
              <div>
                <p className="text-[#8E8E93]">Fat</p>
                <p className="text-lg font-bold text-white mt-0.5">{calculatedTargets.fat_target}g</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Button */}
      <div className="pb-2">
        {step < 3 ? (
          <button
            onClick={handleNextStep}
            className="w-full py-4 rounded-full bg-white text-black font-semibold text-sm transition-transform active:scale-[0.98]"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleFinalSave}
            disabled={saving}
            className="w-full py-4 rounded-full bg-[#30D158] text-black font-semibold text-sm transition-transform active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Enter Nuvia'}
          </button>
        )}
      </div>
    </div>
  );
}
