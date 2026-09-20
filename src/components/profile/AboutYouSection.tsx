'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  X,
  Check,
  RefreshCw,
  Sparkles,
  Flame,
  Pencil,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Profile, ActivityLevel, UserGoal, Goal } from '@/types/database';
import { DataService } from '@/lib/data-service';
import { calculateTargets } from '@/lib/calculator';
import { NuviaBottomSheet } from '../NuviaBottomSheet';

interface AboutYouSectionProps {
  profile: Profile | null;
  onProfileUpdated: () => void;
  onReplayOnboarding: () => void;
  isEditing?: boolean;
  onOpenEdit?: () => void;
  onCloseEdit?: () => void;
}

export function AboutYouSection({
  profile,
  onProfileUpdated,
  onReplayOnboarding,
  isEditing: isEditingProp,
  onOpenEdit,
  onCloseEdit,
}: AboutYouSectionProps) {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = isEditingProp !== undefined ? isEditingProp : internalIsEditing;

  const [saving, setSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Editable Form State
  const [name, setName] = useState(profile?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex || 'male');
  const [heightCm, setHeightCm] = useState(String(profile?.height_cm || 175));
  const [weightKg, setWeightKg] = useState(String(profile?.weight_kg || 73));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activity_level || 'moderately_active'
  );
  const [goal, setGoal] = useState<UserGoal>(profile?.goal || 'lose_weight');
  const [dietaryPreference, setDietaryPreference] = useState(
    profile?.dietary_preference || 'Halal / Balanced'
  );
  const [syncTargets, setSyncTargets] = useState(true);

  // Synchronize edit form when profile updates
  useEffect(() => {
    setName(profile?.name || '');
    setAvatarUrl(profile?.avatar_url || '');
    setSex(profile?.sex || 'male');
    setHeightCm(String(profile?.height_cm || 175));
    setWeightKg(String(profile?.weight_kg || 73));
    setActivityLevel(profile?.activity_level || 'moderately_active');
    setGoal(profile?.goal || 'lose_weight');
    setDietaryPreference(profile?.dietary_preference || 'Halal / Balanced');
  }, [profile]);

  const age = useMemo(() => {
    if (!profile?.date_of_birth) return 23;
    const b = new Date(profile.date_of_birth);
    if (isNaN(b.getTime())) return 23;
    return Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970) || 23;
  }, [profile?.date_of_birth]);

  // Scientific live calculation using Mifflin-St Jeor formula
  const calculatedPreview = useMemo(() => {
    return calculateTargets({
      age,
      sex,
      height_cm: Number(heightCm) || 175,
      weight_kg: Number(weightKg) || 73,
      activity_level: activityLevel,
      goal,
      target_weight_kg: profile?.target_weight_kg || Number(weightKg) || 68,
    });
  }, [age, sex, heightCm, weightKg, activityLevel, goal, profile?.target_weight_kg]);

  const openEditModal = () => {
    setName(profile?.name || '');
    setAvatarUrl(profile?.avatar_url || '');
    setSex(profile?.sex || 'male');
    setHeightCm(String(profile?.height_cm || 175));
    setWeightKg(String(profile?.weight_kg || 73));
    setActivityLevel(profile?.activity_level || 'moderately_active');
    setGoal(profile?.goal || 'lose_weight');
    setDietaryPreference(profile?.dietary_preference || 'Halal / Balanced');
    setSyncTargets(true);
    setInternalIsEditing(true);
    onOpenEdit?.();
  };

  const closeEditModal = () => {
    setInternalIsEditing(false);
    onCloseEdit?.();
  };

  /**
   * Deterministic, one-way recalculation of nutrition & fitness targets.
   * Pure calculation -> compare -> persist if changed -> update local cache -> display result.
   * Never calls edit triggers and never creates infinite loops.
   */
  const handleRecalculate = async () => {
    if (isRecalculating) return;
    setIsRecalculating(true);
    setStatusBanner(null);

    try {
      const height = Number(profile?.height_cm) || 175;
      const weight = Number(profile?.weight_kg) || 73;
      const targetWeight = Number(profile?.target_weight_kg) || (weight > 5 ? weight - 5 : 68);
      const biologicalSex = profile?.sex || 'male';
      const actLevel = profile?.activity_level || 'moderately_active';
      const userGoal = profile?.goal || 'lose_weight';

      // 1. Pure deterministic calculation
      const calculated = calculateTargets({
        age,
        sex: biologicalSex,
        height_cm: height,
        weight_kg: weight,
        activity_level: actLevel,
        goal: userGoal,
        target_weight_kg: targetWeight,
      });

      // 2. Fetch existing goals to compare
      const currentGoal = await DataService.getGoals(profile?.id);

      // 3. Persist new goal record
      const updatedGoal: Goal = {
        id: currentGoal?.id || `goal-${Date.now()}`,
        user_id: profile?.id || DataService.getDemoUserId(),
        calorie_target: calculated.calorie_target,
        protein_target: calculated.protein_target,
        carbohydrate_target: calculated.carbohydrate_target,
        fat_target: calculated.fat_target,
        exercise_minutes_target: calculated.exercise_minutes_target,
        target_weight_kg: targetWeight,
      };

      await DataService.saveGoals(updatedGoal);

      // 4. Update parent cached state and views
      await onProfileUpdated();

      setStatusBanner({
        type: 'success',
        message: `Calorie target recalculated to ${calculated.calorie_target.toLocaleString()} kcal/day (${calculated.protein_target}g P · ${calculated.carbohydrate_target}g C · ${calculated.fat_target}g F)`,
      });

      setTimeout(() => {
        setStatusBanner(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to recalculate targets:', err);
      setStatusBanner({
        type: 'error',
        message: "Couldn't update your calorie targets. Please try again.",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updatedProfile: Profile = {
        ...(profile || ({} as Profile)),
        id: profile?.id || 'demo-profile',
        name: name.trim() || profile?.name || null,
        avatar_url: avatarUrl.trim() || profile?.avatar_url || null,
        sex,
        height_cm: Number(heightCm) || profile?.height_cm || 175,
        weight_kg: Number(weightKg) || profile?.weight_kg || 73,
        activity_level: activityLevel,
        goal,
        dietary_preference: dietaryPreference.trim() || null,
      };

      await DataService.saveProfile(updatedProfile);

      // Auto-sync calculated targets if requested
      if (syncTargets) {
        const newGoal: Goal = {
          id: `goal-${Date.now()}`,
          user_id: profile?.id || DataService.getDemoUserId(),
          calorie_target: calculatedPreview.calorie_target,
          protein_target: calculatedPreview.protein_target,
          carbohydrate_target: calculatedPreview.carbohydrate_target,
          fat_target: calculatedPreview.fat_target,
          exercise_minutes_target: calculatedPreview.exercise_minutes_target,
          target_weight_kg: profile?.target_weight_kg || Number(weightKg) || 68,
        };
        await DataService.saveGoals(newGoal);
      }

      await onProfileUpdated();
      closeEditModal();
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatActivity = (level?: string | null) => {
    switch (level) {
      case 'sedentary':
        return 'Sedentary';
      case 'lightly_active':
        return 'Lightly active';
      case 'moderately_active':
        return 'Moderately active';
      case 'very_active':
        return 'Very active';
      case 'extremely_active':
        return 'Extremely active';
      default:
        return 'Moderately active';
    }
  };

  const formatGoal = (g?: string | null) => {
    switch (g) {
      case 'lose_weight':
        return 'Lose weight';
      case 'maintain_weight':
        return 'Maintain weight';
      case 'gain_weight':
        return 'Gain weight';
      case 'build_muscle':
        return 'Build muscle';
      default:
        return 'Maintain weight';
    }
  };

  return (
    <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-[#30D158]" />
          <span className="font-bold text-white uppercase tracking-wider text-xs">
            About You
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Recalculate CTA */}
          <button
            type="button"
            disabled={isRecalculating}
            onClick={handleRecalculate}
            className="text-[11px] text-[#30D158] hover:text-[#28B84D] disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer font-semibold"
            title="Recalculate calorie & macro targets from current measurements"
          >
            <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Recalculate'}</span>
          </button>

          {/* Edit Parameters CTA */}
          <button
            type="button"
            onClick={openEditModal}
            className="text-[11px] text-[#8E8E93] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            title="Edit profile measurements"
          >
            <Pencil className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Recalculation / Status Banner */}
      {statusBanner && (
        <div
          className={`p-3 text-xs flex items-center gap-2 ${
            statusBanner.type === 'success'
              ? 'bg-[#30D158]/10 text-[#30D158] border-b border-[#30D158]/20'
              : 'bg-red-500/10 text-red-400 border-b border-red-500/20'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="leading-tight">{statusBanner.message}</span>
        </div>
      )}

      {/* Clean iOS-style display rows */}
      <div className="divide-y divide-white/[0.04]">
        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-[#8E8E93]">Height</span>
          <span className="font-semibold text-white">{profile?.height_cm || 175} cm</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-[#8E8E93]">Current Weight</span>
          <span className="font-semibold text-white">{profile?.weight_kg || 73} kg</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-[#8E8E93]">Biological Sex</span>
          <span className="font-semibold text-white capitalize">{profile?.sex || 'Male'}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-[#8E8E93]">Activity Level</span>
          <span className="font-semibold text-white">{formatActivity(profile?.activity_level)}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-[#8E8E93]">Primary Goal</span>
          <span className="font-semibold text-[#30D158]">{formatGoal(profile?.goal)}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-[#8E8E93]">Dietary Style</span>
          <span className="font-semibold text-white truncate max-w-[170px]">
            {profile?.dietary_preference || 'Halal / Balanced'}
          </span>
        </div>
      </div>

      {/* QUICK INLINE EDIT MODAL (Powered by NuviaBottomSheet) */}
      <NuviaBottomSheet
        isOpen={isEditing}
        onClose={closeEditModal}
        title="Edit Profile Parameters"
        subtitle="Update your stored body & health measurements"
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Name */}
          <div>
            <label className="block text-[#8E8E93] mb-1 font-medium">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
              placeholder="Your Name"
            />
          </div>

          {/* Profile Photo / Avatar URL */}
          <div>
            <label className="block text-[#8E8E93] mb-1 font-medium">Profile Picture / Google Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium placeholder:text-zinc-500 focus:outline-none focus:border-[#30D158]"
              placeholder="https://lh3.googleusercontent.com/... or image link"
            />
          </div>

          {/* Sex & Height & Weight */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as 'male' | 'female')}
                className="w-full px-2.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
              >
                <option value="male" className="bg-[#1C1C1E]">Male</option>
                <option value="female" className="bg-[#1C1C1E]">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium">Height (cm)</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
              />
            </div>

            <div>
              <label className="block text-[#8E8E93] mb-1 font-medium">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
              />
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-[#8E8E93] mb-1 font-medium">Activity Level</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
            >
              <option value="sedentary" className="bg-[#1C1C1E]">Sedentary (Little to no exercise)</option>
              <option value="lightly_active" className="bg-[#1C1C1E]">Lightly Active (1-3 days/week)</option>
              <option value="moderately_active" className="bg-[#1C1C1E]">Moderately Active (3-5 days/week)</option>
              <option value="very_active" className="bg-[#1C1C1E]">Very Active (6-7 days/week)</option>
              <option value="extremely_active" className="bg-[#1C1C1E]">Extremely Active (Athletic/Physical Job)</option>
            </select>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-[#8E8E93] mb-1 font-medium">Primary Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as UserGoal)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
            >
              <option value="lose_weight" className="bg-[#1C1C1E]">Lose Weight</option>
              <option value="maintain_weight" className="bg-[#1C1C1E]">Maintain Weight</option>
              <option value="gain_weight" className="bg-[#1C1C1E]">Gain Weight</option>
              <option value="build_muscle" className="bg-[#1C1C1E]">Build Muscle</option>
            </select>
          </div>

          {/* Dietary Preference */}
          <div>
            <label className="block text-[#8E8E93] mb-1 font-medium">Dietary Style & Restrictions</label>
            <input
              type="text"
              value={dietaryPreference}
              onChange={(e) => setDietaryPreference(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none focus:border-[#30D158]"
              placeholder="e.g. Halal, High-Protein, Low-Carb, Peanut Allergy"
            />
          </div>

          {/* Scientific Live Calculation Preview */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-[#30D158]/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#30D158] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Scientific Calculation</span>
              </span>
              <span className="text-[10px] font-semibold text-[#8E8E93]">Mifflin-St Jeor</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-white">{calculatedPreview.calorie_target.toLocaleString()}</span>
                <span className="text-[10px] text-[#8E8E93] ml-1">kcal / day</span>
              </div>
              <div className="text-right text-[10px] text-[#8E8E93]">
                <span>BMR: <strong className="text-white">{calculatedPreview.bmr}</strong></span>
                <span className="mx-1">·</span>
                <span>TDEE: <strong className="text-white">{calculatedPreview.tdee}</strong></span>
              </div>
            </div>

            {/* Macros Mini Badges */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-emerald-400 block font-medium">Protein</span>
                <strong className="text-white text-xs">{calculatedPreview.protein_target}g</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-amber-400 block font-medium">Carbs</span>
                <strong className="text-white text-xs">{calculatedPreview.carbohydrate_target}g</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-sky-400 block font-medium">Fats</span>
                <strong className="text-white text-xs">{calculatedPreview.fat_target}g</strong>
              </div>
            </div>

            {/* Auto Sync Checkbox */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncTargets}
                onChange={(e) => setSyncTargets(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#30D158] rounded cursor-pointer"
              />
              <span className="text-[11px] text-[#D1D1D6] font-medium">
                Auto-update daily calorie &amp; macro targets with these values
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold transition-colors flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </NuviaBottomSheet>
    </div>
  );
}
