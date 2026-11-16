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
  ArrowRight,
} from 'lucide-react';
import { Profile, ActivityLevel, UserGoal, Goal } from '@/types/database';
import { DataService } from '@/lib/data-service';
import {
  calculateTargets,
  getUserCalculationContext,
  calculateAge,
  cleanDietaryPreference,
  describeMissingFields,
  ACTIVITY_LABELS,
} from '@/lib/calculator';
import { NuviaBottomSheet } from '../NuviaBottomSheet';
import { FitnessContextService } from '@/lib/fitness-context-service';
import { PhysiqueIllustration } from '../physique/PhysiqueIllustration';

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
  // Body details start empty when the profile has none, so nothing is invented.
  const [sex, setSex] = useState<'male' | 'female' | ''>(profile?.sex || '');
  const [dob, setDob] = useState(profile?.date_of_birth?.slice(0, 10) || '');
  const [heightCm, setHeightCm] = useState(String(profile?.height_cm || ''));
  const [weightKg, setWeightKg] = useState(String(profile?.weight_kg || ''));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>(
    profile?.activity_level || ''
  );
  const [goal, setGoal] = useState<UserGoal | ''>(profile?.goal || '');
  const [dietaryPreference, setDietaryPreference] = useState(
    cleanDietaryPreference(profile?.dietary_preference) || 'Halal / Balanced'
  );
  const [syncTargets, setSyncTargets] = useState(true);

  // Stored visual physique preferences
  const initialFp = useMemo(() => FitnessContextService.getStoredPreferences(profile?.id), [profile?.id]);
  const [currentPhysique, setCurrentPhysique] = useState(initialFp.current_physique || 'soft_low_muscle');
  const [desiredPhysique, setDesiredPhysique] = useState(initialFp.desired_physique || 'athletic');
  const [adaptivePlanMode, setAdaptivePlanMode] = useState<'ask_first' | 'auto_adjust'>(
    initialFp.adaptive_plan_mode || 'ask_first'
  );

  // Synchronize edit form when profile updates
  useEffect(() => {
    setName(profile?.name || '');
    setAvatarUrl(profile?.avatar_url || '');
    setSex(profile?.sex || '');
    setDob(profile?.date_of_birth?.slice(0, 10) || '');
    setHeightCm(String(profile?.height_cm || ''));
    setWeightKg(String(profile?.weight_kg || ''));
    setActivityLevel(profile?.activity_level || '');
    setGoal(profile?.goal || '');
    setDietaryPreference(cleanDietaryPreference(profile?.dietary_preference) || 'Halal / Balanced');
    const fp = FitnessContextService.getStoredPreferences(profile?.id);
    setCurrentPhysique(fp.current_physique || 'soft_low_muscle');
    setDesiredPhysique(fp.desired_physique || 'athletic');
    setAdaptivePlanMode(fp.adaptive_plan_mode || 'ask_first');
  }, [profile]);

  const savedAge = useMemo(() => calculateAge(profile?.date_of_birth), [profile?.date_of_birth]);

  // Live preview: the same calculation every other screen uses, fed with the form values.
  const previewContext = useMemo(
    () =>
      getUserCalculationContext({
        ...(profile || ({} as Profile)),
        date_of_birth: dob || null,
        sex: sex || null,
        height_cm: Number(heightCm) || null,
        weight_kg: Number(weightKg) || null,
        activity_level: activityLevel || null,
        goal: goal || null,
      }),
    [profile, dob, sex, heightCm, weightKg, activityLevel, goal]
  );
  const calculatedPreview = useMemo(() => calculateTargets(previewContext), [previewContext]);
  const previewMissing = describeMissingFields(previewContext.missing_fields);

  const openEditModal = () => {
    setName(profile?.name || '');
    setAvatarUrl(profile?.avatar_url || '');
    setSex(profile?.sex || '');
    setDob(profile?.date_of_birth?.slice(0, 10) || '');
    setHeightCm(String(profile?.height_cm || ''));
    setWeightKg(String(profile?.weight_kg || ''));
    setActivityLevel(profile?.activity_level || '');
    setGoal(profile?.goal || '');
    setDietaryPreference(cleanDietaryPreference(profile?.dietary_preference) || 'Halal / Balanced');
    const fp = FitnessContextService.getStoredPreferences(profile?.id);
    setAdaptivePlanMode(fp.adaptive_plan_mode || 'ask_first');
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
      // 1. Fetch existing goals (keeps the saved target weight)
      const currentGoal = await DataService.getGoals(profile?.id);

      // 2. Same calculation as every other screen, from the saved profile and pace
      const ctx = getUserCalculationContext(profile, currentGoal);
      if (ctx.missing_fields.length > 0) {
        setStatusBanner({
          type: 'error',
          message: `Add your ${describeMissingFields(ctx.missing_fields)} first (tap Edit), then recalculate.`,
        });
        return;
      }
      const calculated = calculateTargets(ctx);
      const targetWeight = ctx.target_weight_kg ?? null;

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
        date_of_birth: dob || profile?.date_of_birth || null,
        sex: sex || profile?.sex || null,
        height_cm: Number(heightCm) || profile?.height_cm || null,
        weight_kg: Number(weightKg) || profile?.weight_kg || null,
        activity_level: activityLevel || profile?.activity_level || null,
        goal: goal || profile?.goal || null,
        dietary_preference: cleanDietaryPreference(dietaryPreference),
      };

      await DataService.saveProfile(updatedProfile);

      // Save updated visual physique preferences
      FitnessContextService.saveStoredPreferences(
        {
          current_physique: currentPhysique as any,
          desired_physique: desiredPhysique as any,
          current_physique_label:
            currentPhysique === 'lean'
              ? 'Lean'
              : currentPhysique === 'average'
              ? 'Average'
              : currentPhysique === 'higher_body_fat'
              ? 'Higher body fat'
              : currentPhysique === 'muscular_some_fat'
              ? 'Muscular'
              : 'Soft',
          desired_look:
            desiredPhysique === 'lean'
              ? 'Lean'
              : desiredPhysique === 'athletic'
              ? 'Athletic'
              : desiredPhysique === 'lean_muscular'
              ? 'Lean + Muscular'
              : desiredPhysique === 'muscular'
              ? 'Muscular'
              : desiredPhysique === 'strong_powerful'
              ? 'Strong'
              : 'General Fitness',
          adaptive_plan_mode: adaptivePlanMode,
        },
        profile?.id
      );

      // Update targets if requested (never from incomplete details)
      if (syncTargets && previewContext.missing_fields.length === 0) {
        const newGoal: Goal = {
          id: `goal-${Date.now()}`,
          user_id: profile?.id || DataService.getDemoUserId(),
          calorie_target: calculatedPreview.calorie_target,
          protein_target: calculatedPreview.protein_target,
          carbohydrate_target: calculatedPreview.carbohydrate_target,
          fat_target: calculatedPreview.fat_target,
          exercise_minutes_target: calculatedPreview.exercise_minutes_target,
          target_weight_kg: previewContext.target_weight_kg ?? null,
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
        return 'Not set';
    }
  };

  const formatGoal = (g?: string | null) => {
    switch (g) {
      case 'recomposition':
        return 'Lose fat & build muscle';
      case 'lose_weight':
        return 'Lose weight';
      case 'maintain_weight':
        return 'Maintain weight';
      case 'gain_weight':
        return 'Gain weight';
      case 'build_muscle':
        return 'Build muscle';
      default:
        return 'Not set';
    }
  };

  return (
    <div className="ios-card divide-y divide-fg/[0.06] overflow-hidden text-xs">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-green-ink" />
          <span className="font-bold text-fg uppercase tracking-wider text-xs">
            About You
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Recalculate CTA */}
          <button
            type="button"
            disabled={isRecalculating}
            onClick={handleRecalculate}
            className="text-[11px] text-green-ink hover:text-green-ink disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer font-semibold"
            title="Recalculate calorie & macro targets from current measurements"
          >
            <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Recalculate'}</span>
          </button>

          {/* Edit Parameters CTA */}
          <button
            type="button"
            onClick={openEditModal}
            className="text-[11px] text-muted hover:text-fg flex items-center gap-1 transition-colors cursor-pointer"
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
              ? 'bg-accent/10 text-green-ink border-b border-accent/20'
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
      <div className="divide-y divide-fg/[0.04]">
        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Height</span>
          <span className="font-semibold text-fg">{profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Current Weight</span>
          <span className="font-semibold text-fg">{profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Age</span>
          <span className="font-semibold text-fg">{savedAge != null ? `${savedAge} years` : 'Not set'}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Biological Sex</span>
          <span className="font-semibold text-fg capitalize">{profile?.sex || 'Not set'}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Activity Level</span>
          <span className="font-semibold text-fg">{formatActivity(profile?.activity_level)}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Primary Goal</span>
          <span className="font-semibold text-green-ink">{formatGoal(profile?.goal)}</span>
        </div>

        <div className="w-full p-3.5 flex justify-between items-center text-left">
          <span className="text-muted">Dietary Style</span>
          <span className="font-semibold text-fg truncate max-w-[170px]">
            {cleanDietaryPreference(profile?.dietary_preference) || 'Halal / Balanced'}
          </span>
        </div>

        {/* Qualitative Fitness Context & Transformation Direction */}
        {(() => {
          const fp = FitnessContextService.getStoredPreferences(profile?.id);
          const currentType = fp.current_physique || 'soft_low_muscle';
          const desiredType = fp.desired_physique || 'athletic';
          return (
            <div className="p-3.5 bg-app/40 border-b border-fg/[0.04] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Transformation Direction
                </span>
                <span className="text-[10px] text-green-ink bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                  Visual Baseline
                </span>
              </div>

              <div className="flex items-center justify-around py-2 rounded-xl border border-line/60">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] uppercase font-semibold text-muted mb-1">Starting</span>
                  <div className="w-16 h-24 rounded-xl bg-card border border-line/60 p-1 flex items-center justify-center">
                    <PhysiqueIllustration sex={profile?.sex || 'male'} type={currentType} className="w-full h-full" />
                  </div>
                  <span className="text-[10px] font-semibold text-fg mt-1 text-center truncate max-w-[90px]">
                    {fp.current_physique_label || 'Soft'}
                  </span>
                </div>

                <div className="flex flex-col items-center text-green-ink">
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-[8px] text-muted mt-0.5">Target</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[9px] uppercase font-semibold text-green-ink mb-1">Desired</span>
                  <div className="w-16 h-24 rounded-xl bg-card border border-accent p-1 flex items-center justify-center">
                    <PhysiqueIllustration sex={profile?.sex || 'male'} type={desiredType} className="w-full h-full" selected />
                  </div>
                  <span className="text-[10px] font-semibold text-green-ink mt-1 text-center truncate max-w-[90px]">
                    {fp.desired_look || 'Athletic'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1 text-left">
                <span className="text-muted">Equipment Limits</span>
                <span className="font-semibold text-fg truncate max-w-[190px]">
                  {(fp.constraints.available_equipment || ['dumbbells', 'bodyweight']).slice(0, 3).join(', ')}
                </span>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1 text-left">
                <span className="text-muted">Adaptive Training</span>
                <span className="font-semibold text-fg">
                  {fp.adaptive_plan_mode === 'auto_adjust' ? 'Auto-adjust minor changes' : 'Ask me before changing'}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Recalibrate / Replay Onboarding Button */}
        <div className="p-3 bg-fg/[0.02] flex justify-center">
          <button
            type="button"
            onClick={onReplayOnboarding}
            className="w-full py-2.5 rounded-xl bg-fg/[0.06] hover:bg-fg/[0.1] text-xs font-semibold text-zinc-300 hover:text-fg transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-green-ink" />
            <span>Recalibrate Body &amp; Training Vision</span>
          </button>
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
            <label className="block text-muted mb-1 font-medium">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
              placeholder="Your Name"
            />
          </div>

          {/* Profile Photo / Avatar URL */}
          <div>
            <label className="block text-muted mb-1 font-medium">Profile Picture / Google Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-medium placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              placeholder="https://lh3.googleusercontent.com/... or image link"
            />
          </div>

          {/* Sex & Height & Weight */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-muted mb-1 font-medium">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as 'male' | 'female' | '')}
                required
                className="w-full px-2.5 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
              >
                <option value="" disabled className="bg-card">Select</option>
                <option value="male" className="bg-card">Male</option>
                <option value="female" className="bg-card">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-muted mb-1 font-medium">Height (cm)</label>
              <input
                type="number"
                min={100}
                max={250}
                required
                placeholder="e.g. 170"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-muted mb-1 font-medium">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min={25}
                max={350}
                required
                placeholder="e.g. 70"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Date of birth (age changes your calorie estimate) */}
          <div>
            <label className="block text-muted mb-1 font-medium">Date of Birth</label>
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
            />
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-muted mb-1 font-medium">Activity Level</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
            >
              <option value="" disabled className="bg-card">Select</option>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                <option key={level} value={level} className="bg-card">
                  {ACTIVITY_LABELS[level].label} ({ACTIVITY_LABELS[level].desc})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted mt-1">
              Not sure? Pick the lower option. A level that is too high makes your calorie target too high.
            </p>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-muted mb-1 font-medium">Primary Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as UserGoal)}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
            >
              <option value="" disabled className="bg-card">Select</option>
              <option value="recomposition" className="bg-card">Lose Fat &amp; Build Muscle (Recomposition)</option>
              <option value="lose_weight" className="bg-card">Lose Weight</option>
              <option value="build_muscle" className="bg-card">Build Muscle</option>
              <option value="maintain_weight" className="bg-card">Maintain Weight</option>
              <option value="gain_weight" className="bg-card">Gain Weight</option>
            </select>
          </div>

          {/* Dietary Preference */}
          <div>
            <label className="block text-muted mb-1 font-medium">Dietary Style & Restrictions</label>
            <input
              type="text"
              value={dietaryPreference}
              onChange={(e) => setDietaryPreference(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-fg/5 border border-fg/10 text-fg font-semibold focus:outline-none focus:border-accent"
              placeholder="e.g. Halal, High-Protein, Low-Carb, Peanut Allergy"
            />
          </div>

          {/* Starting & Target Physique Visual Selector */}
          <div className="space-y-2 pt-2 border-t border-fg/[0.08]">
            <label className="block text-muted font-medium">Starting &amp; Target Physique</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted mb-1 block">Current</span>
                <select
                  value={currentPhysique}
                  onChange={(e) => setCurrentPhysique(e.target.value as any)}
                  className="w-full px-2.5 py-2 rounded-xl bg-fg/5 border border-fg/10 text-fg text-xs font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="lean" className="bg-card">Lean</option>
                  <option value="average" className="bg-card">Average</option>
                  <option value="soft_low_muscle" className="bg-card">Soft</option>
                  <option value="higher_body_fat" className="bg-card">Higher body fat</option>
                  <option value="muscular_some_fat" className="bg-card">Muscular</option>
                  <option value="not_sure" className="bg-card">Not sure</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-muted mb-1 block">Desired</span>
                <select
                  value={desiredPhysique}
                  onChange={(e) => setDesiredPhysique(e.target.value as any)}
                  className="w-full px-2.5 py-2 rounded-xl bg-fg/5 border border-fg/10 text-fg text-xs font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="lean" className="bg-card">Lean</option>
                  <option value="athletic" className="bg-card">Athletic</option>
                  <option value="lean_muscular" className="bg-card">Lean + Muscular</option>
                  <option value="muscular" className="bg-card">Muscular</option>
                  <option value="strong_powerful" className="bg-card">Strong</option>
                  <option value="general_fitness" className="bg-card">General Fitness</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-around py-2 rounded-xl border border-line/60">
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-muted mb-0.5 uppercase font-medium">Current</span>
                <div className="w-16 h-24 rounded-xl bg-card border border-line/60 p-1 flex items-center justify-center">
                  <PhysiqueIllustration sex={sex || 'male'} type={currentPhysique} className="w-full h-full" />
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-green-ink" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-green-ink mb-0.5 uppercase font-medium">Desired</span>
                <div className="w-16 h-24 rounded-xl bg-card border border-accent p-1 flex items-center justify-center">
                  <PhysiqueIllustration sex={sex || 'male'} type={desiredPhysique} className="w-full h-full" selected />
                </div>
              </div>
            </div>
          </div>

          {/* Adaptive Training Plan Strategy */}
          <div className="space-y-1.5 pt-2 border-t border-fg/[0.08]">
            <label className="block text-muted font-medium">Adaptive Training Strategy</label>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setAdaptivePlanMode('ask_first')}
                className={`w-full p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                  adaptivePlanMode === 'ask_first'
                    ? 'bg-accent/10 border-accent/40 text-fg'
                    : 'bg-fg/5 border-fg/10 text-muted hover:text-fg'
                }`}
              >
                <div>
                  <p className="text-xs font-semibold text-fg">Ask me before changing my plan</p>
                  <p className="text-[10px] text-muted mt-0.5">
                    Recommended. Proposals include explanation, recovery reasoning, and clear options.
                  </p>
                </div>
                {adaptivePlanMode === 'ask_first' && (
                  <CheckCircle2 className="w-4 h-4 text-green-ink shrink-0 mt-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setAdaptivePlanMode('auto_adjust')}
                className={`w-full p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                  adaptivePlanMode === 'auto_adjust'
                    ? 'bg-accent/10 border-accent/40 text-fg'
                    : 'bg-fg/5 border-fg/10 text-muted hover:text-fg'
                }`}
              >
                <div>
                  <p className="text-xs font-semibold text-fg">Automatically adjust minor schedule changes</p>
                  <p className="text-[10px] text-muted mt-0.5">
                    Adapts missed workouts automatically with transparent inline [Undo].
                  </p>
                </div>
                {adaptivePlanMode === 'auto_adjust' && (
                  <CheckCircle2 className="w-4 h-4 text-green-ink shrink-0 mt-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Scientific Live Calculation Preview */}
          <div className="p-3.5 rounded-2xl bg-app/40 border border-accent/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-green-ink uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{previewMissing ? 'Rough Estimate' : 'Your New Targets'}</span>
              </span>
              <span className="text-[10px] font-semibold text-muted">Mifflin-St Jeor</span>
            </div>

            {previewMissing && (
              <p className="text-[11px] text-warn leading-relaxed">
                Add your {previewMissing} above to get your real targets. Until then these numbers are only a rough guess and will not be saved as your targets.
              </p>
            )}
            {!previewMissing && calculatedPreview.limited_by !== 'none' && (
              <p className="text-[11px] text-muted leading-relaxed">
                Your chosen pace of {calculatedPreview.weekly_pace_kg} kg / week needs a bigger calorie change than Nuvia will suggest, so this target gives about {calculatedPreview.expected_pace_kg} kg / week.
              </p>
            )}

            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-fg">{calculatedPreview.calorie_target.toLocaleString()}</span>
                <span className="text-[10px] text-muted ml-1">kcal / day</span>
              </div>
              <div className="text-right text-[10px] text-muted">
                <span>At rest: <strong className="text-fg">{calculatedPreview.bmr}</strong></span>
                <span className="mx-1">·</span>
                <span>Maintenance: <strong className="text-fg">{calculatedPreview.tdee}</strong></span>
              </div>
            </div>

            {/* Macros Mini Badges */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="p-1.5 rounded-lg bg-fg/[0.04] border border-fg/[0.06]">
                <span className="text-emerald-400 block font-medium">Protein</span>
                <strong className="text-fg text-xs">{calculatedPreview.protein_target}g</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-fg/[0.04] border border-fg/[0.06]">
                <span className="text-amber-400 block font-medium">Carbs</span>
                <strong className="text-fg text-xs">{calculatedPreview.carbohydrate_target}g</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-fg/[0.04] border border-fg/[0.06]">
                <span className="text-sky-400 block font-medium">Fats</span>
                <strong className="text-fg text-xs">{calculatedPreview.fat_target}g</strong>
              </div>
            </div>

            {/* Auto Sync Checkbox */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncTargets}
                onChange={(e) => setSyncTargets(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent rounded cursor-pointer"
              />
              <span className="text-[11px] text-fg-soft font-medium">
                Update my daily calorie &amp; macro targets with these values
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="flex-1 py-3 rounded-xl bg-fg/10 hover:bg-fg/15 text-fg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold transition-colors flex items-center justify-center gap-1.5 shadow cursor-pointer"
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
