'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Sparkles,
  Zap,
  Beef,
  Wheat,
  Droplets,
  Target,
  Scale,
  Activity,
  Dumbbell,
  Clock,
  Heart,
  Camera,
  Check,
  CheckCircle2,
  Info,
  Calendar,
  ShieldCheck,
  Pencil,
  Compass,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PhysiqueIllustration } from '@/components/physique/PhysiqueIllustration';
import { calculateTargets, CalculationResult } from '@/lib/calculator';
import { DataService } from '@/lib/data-service';
import { ActivityLevel, UserGoal, Profile, Goal } from '@/types/database';
import {
  FitnessContextService,
  generateTrainingStrategy,
} from '@/lib/fitness-context-service';

interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const { user, profile, hasCompletedOnboarding, refreshProfileAndGoals } = useAuth();

  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // ── Step 1 & 2: Core Biometrics & Metabolism (Deterministic Calorie Inputs) ──
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex === 'female' ? 'female' : 'male');
  const [dob, setDob] = useState(profile?.date_of_birth || '2004-09-23');
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '176');
  const [weightKg, setWeightKg] = useState(profile?.weight_kg ? String(profile.weight_kg) : '79');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activity_level || 'moderately_active'
  );
  const [goal, setGoal] = useState<UserGoal>(profile?.goal || 'build_muscle');
  const [targetWeightKg, setTargetWeightKg] = useState(
    profile?.target_weight_kg ? String(profile.target_weight_kg) : '72'
  );
  const [dietaryPref, setDietaryPref] = useState(profile?.dietary_preference || 'Halal');

  // ── Step 3: Understand Your Body (Current Physique Self-Assessment) ─────────
  const [currentPhysique, setCurrentPhysique] = useState<
    'lean' | 'average' | 'soft_low_muscle' | 'higher_body_fat' | 'muscular_some_fat' | 'not_sure'
  >('soft_low_muscle');
  const [priorityAreas, setPriorityAreas] = useState<string[]>([
    'Belly / waist',
    'Overall muscle definition',
  ]);

  // ── Step 4: Desired Physique & Visual Vision ──────────────────────────────
  const [desiredPhysique, setDesiredPhysique] = useState<
    'lean' | 'athletic' | 'lean_muscular' | 'muscular' | 'strong_powerful' | 'general_fitness' | 'custom'
  >('athletic');
  const [desiredPhysiqueCustom, setDesiredPhysiqueCustom] = useState(
    'Lean athletic with visible muscle definition and less belly fat'
  );
  const [targetBfRef, setTargetBfRef] = useState('15');
  const [physiquePhotoPreview, setPhysiquePhotoPreview] = useState<string | null>(null);

  // ── Step 5: Training Reality & Hard Constraints ───────────────────────────
  const [experienceLevel, setExperienceLevel] = useState<
    'completely_new' | 'beginner' | 'beginner_trained_before' | 'intermediate' | 'advanced' | 'returning_long_break'
  >('beginner_trained_before');
  const [consistencyLevel, setConsistencyLevel] = useState<
    'very_consistent' | 'mostly_consistent' | 'on_and_off' | 'frequent_breaks' | 'getting_started'
  >('on_and_off');
  const [preferredSplit, setPreferredSplit] = useState<string>('Upper / Lower');
  const [equipment, setEquipment] = useState<string[]>([
    'Dumbbells',
    'Push-up board',
    'Bodyweight only',
  ]);
  const [environment, setEnvironment] = useState<'home' | 'gym' | 'both' | 'outdoors'>('home');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);

  // ── Step 6: Preferences, Cardio & Adherence ───────────────────────────────
  const [cardioHabit, setCardioHabit] = useState<string>('Walking');
  const [cardioDescription, setCardioDescription] = useState<string>(
    '4.5 km outdoor brisk walk every Saturday morning'
  );
  const [trainingIntensity, setTrainingIntensity] = useState<string>('Challenging but manageable (1-3 RIR)');
  const [targetRir, setTargetRir] = useState<string>('1-3');
  const [progressionPreference, setProgressionPreference] = useState<
    'reps_first_then_weight' | 'increase_weight_frequently' | 'gradual_stable' | 'let_nuvia_decide'
  >('let_nuvia_decide');
  const [trainingTimeOfDay, setTrainingTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'varies'>(
    'evening'
  );
  const [adherenceObstacles, setAdherenceObstacles] = useState<string[]>([
    'Lack of time',
    'Work/study schedule',
  ]);

  // ── Calculation & Save State ──────────────────────────────────────────────
  const [calculatedTargets, setCalculatedTargets] = useState<CalculationResult | null>(null);
  const [saving, setSaving] = useState(false);

  const calculateAge = (dobString: string): number => {
    const birthday = new Date(dobString);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) || 22;
  };

  const currentPhysiqueOptions = [
    { id: 'lean', label: 'Lean', desc: 'Slender, minimal body fat' },
    { id: 'average', label: 'Average', desc: 'Moderate natural build' },
    { id: 'soft_low_muscle', label: 'Soft', desc: 'Holding fat, looking to tone' },
    { id: 'higher_body_fat', label: 'Higher body fat', desc: 'Steady recomposition focus' },
    { id: 'muscular_some_fat', label: 'Muscular', desc: 'Solid muscular foundation' },
    { id: 'not_sure', label: 'Not sure', desc: 'Discover baseline through training' },
  ] as const;

  const priorityAreaOptions = [
    'Overall body fat',
    'Belly / waist',
    'Chest',
    'Arms',
    'Legs',
    'Back',
    'Overall muscle definition',
    'General athletic appearance',
  ];

  const desiredPhysiqueOptions = [
    { id: 'lean', label: 'Lean', desc: 'Slender, toned, low body fat' },
    { id: 'athletic', label: 'Athletic', desc: 'Balanced muscle, agile & functional' },
    { id: 'lean_muscular', label: 'Lean + Muscular', desc: 'Defined muscle bellies, trim waist' },
    { id: 'muscular', label: 'Muscular', desc: 'Fuller chest, delts & arms' },
    { id: 'strong_powerful', label: 'Strong', desc: 'Maximal strength & structural density' },
    { id: 'general_fitness', label: 'General Fitness', desc: 'Daily energy, stamina & health' },
    { id: 'custom', label: 'Other / Describe', desc: 'Custom aesthetic vision' },
  ] as const;

  const experienceOptions = [
    { id: 'completely_new', label: 'Completely new', desc: 'Never lifted or followed a fitness program' },
    { id: 'beginner', label: 'Beginner', desc: 'A few weeks/months of casual training' },
    { id: 'beginner_trained_before', label: 'Beginner but have trained before', desc: 'Know the basics, rebuilding consistency' },
    { id: 'intermediate', label: 'Intermediate', desc: '1–2+ years of consistent progressive training' },
    { id: 'advanced', label: 'Advanced', desc: '3+ years of systematic strength training' },
    { id: 'returning_long_break', label: 'Returning after a long break', desc: 'Had good progress in past, restarting fresh' },
  ] as const;

  const consistencyOptions = [
    { id: 'very_consistent', label: 'Very consistent', desc: 'Rarely miss planned sessions' },
    { id: 'mostly_consistent', label: 'Mostly consistent', desc: 'Miss occasionally when life gets busy' },
    { id: 'on_and_off', label: 'On and off', desc: 'Train for a few weeks, then stop' },
    { id: 'frequent_breaks', label: 'I often stop for weeks/months', desc: 'Need an adherence-focused approach' },
    { id: 'getting_started', label: 'Just getting started again', desc: 'Looking for a sustainable rhythm' },
  ] as const;

  const splitOptions = [
    { id: 'Upper / Lower', label: 'Upper / Lower', desc: 'Balanced 4-day split, optimal recovery' },
    { id: 'Push / Pull / Legs', label: 'Push / Pull / Legs', desc: 'High-focus 3-6 day bodybuilding split' },
    { id: 'Full body', label: 'Full body', desc: 'Maximum frequency, 2-3 days/week' },
    { id: 'Cardio + strength', label: 'Cardio + Strength', desc: 'Combined conditioning & resistance' },
    { id: "I'm not sure", label: "I'm not sure", desc: 'Let Nuvia recommend the optimal split' },
  ];

  const equipmentOptions = [
    'Dumbbells',
    'Push-up board',
    'Bodyweight only',
    'Resistance bands',
    'Pull-up bar',
    'Bench',
    'Barbell',
    'Cable machine',
    'Machines',
    'Other',
  ];

  const obstacleOptions = [
    'Lack of time',
    'Motivation',
    'Work/study schedule',
    'Workout feels too hard',
    'Lose track of routine',
    'Get bored',
    'Injury / physical aches',
  ];

  const toggleArrayItem = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      if (list.length > 1) {
        setter(list.filter((x) => x !== item));
      }
    } else {
      setter([...list, item]);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhysiquePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Re-calculate metabolic targets whenever advancing past step 2
  const runCalorieCalculation = () => {
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
  };

  const handleNextStep = () => {
    if (step === 2) {
      runCalorieCalculation();
    }
    if (step < totalSteps) {
      setStep((s) => s + 1);
    }
  };

  // Final submission of all biometric, metabolic, and qualitative context
  const handleFinalSave = async () => {
    if (!calculatedTargets) {
      runCalorieCalculation();
    }
    setSaving(true);
    const userId = user?.id || DataService.getDemoUserId();

    // 1. Authoritative Biometric Profile
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

    // 2. Authoritative Nutritional Goals (deterministic Mifflin-St Jeor)
    const targets =
      calculatedTargets ||
      calculateTargets({
        age: calculateAge(dob),
        sex,
        height_cm: Number(heightCm) || 176,
        weight_kg: Number(weightKg) || 73,
        activity_level: activityLevel,
        goal,
        target_weight_kg: Number(targetWeightKg) || 68,
      });

    const newGoals: Goal = {
      id: `goal-${Date.now()}`,
      user_id: userId,
      calorie_target: targets.calorie_target,
      protein_target: targets.protein_target,
      carbohydrate_target: targets.carbohydrate_target,
      fat_target: targets.fat_target,
      exercise_minutes_target: targets.exercise_minutes_target,
      target_weight_kg: Number(targetWeightKg) || 68,
    };

    // 3. Qualitative Personal Fitness Context (Physical reality, equipment limits, adherence)
    FitnessContextService.saveStoredPreferences(
      {
        fitness_level:
          consistencyLevel === 'very_consistent' || consistencyLevel === 'mostly_consistent'
            ? 'beginner_consistent'
            : 'beginner_inconsistent',
        experience_level: experienceLevel,
        consistency_level: consistencyLevel,
        training_background: experienceOptions.find((e) => e.id === experienceLevel)?.desc,
        current_physique: currentPhysique,
        current_physique_label: currentPhysiqueOptions.find((c) => c.id === currentPhysique)?.label,
        priority_areas: priorityAreas,
        desired_physique: desiredPhysique,
        desired_physique_custom: desiredPhysiqueCustom,
        desired_look: desiredPhysiqueOptions.find((d) => d.id === desiredPhysique)?.label,
        user_estimated_target_bf_percent: targetBfRef ? Number(targetBfRef) : undefined,
        physique_photo_url: physiquePhotoPreview || undefined,
        constraints: {
          preferred_split: preferredSplit,
          workout_duration_minutes: durationMinutes,
          environment: environment,
          available_equipment: equipment.map((e) => e.toLowerCase().replace(/\s+/g, '_')),
          training_time_of_day: trainingTimeOfDay,
          adherence_obstacles: adherenceObstacles,
          cardio_habits: {
            type: cardioHabit,
            typical_days: ['Saturday'],
            description: cardioDescription,
          },
        },
        preferences: {
          effort_target: trainingIntensity,
          target_rir: targetRir,
          progression_preference: progressionPreference,
          progression_rule:
            progressionPreference === 'reps_first_then_weight'
              ? 'Double progression: advance reps (10-15) before adding weight'
              : 'Let Nuvia decide based on logged workout performance',
          preferred_exercises: ['Goblet Squat', 'Dumbbell Row', 'Push-up', 'Dumbbell Bicep Curl'],
          disliked_exercises: ['Bulgarian Split Squat'],
          easy_hard_areas: ['Upper body feels easier', 'Core feels difficult'],
        },
      },
      userId
    );

    await DataService.saveProfile(updatedProfile);
    await DataService.saveGoals(newGoals);
    await refreshProfileAndGoals();
    setSaving(false);
    onComplete();
  };

  const getGoalStrategy = (g: UserGoal) => {
    switch (g) {
      case 'recomposition':
        return { label: 'Recomp (-200 kcal)', tag: 'Lose Fat & Build Muscle', color: 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' };
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

  // Synthesize dynamic strategy bullet points for Step 7 confirmation
  const synthesizedStrategy = generateTrainingStrategy({
    goal,
    current_physique: currentPhysique,
    priority_areas: priorityAreas,
    desired_physique: desiredPhysique,
    experience_level: experienceLevel,
    consistency_level: consistencyLevel,
    equipment,
    environment,
    duration_minutes: durationMinutes,
    adherence_obstacles: adherenceObstacles,
    preferred_split: preferredSplit,
  });

  return (
    <div
      className="relative w-full max-w-md mx-auto bg-black text-white flex flex-col overflow-hidden"
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available',
      }}
    >
      {/* Ambient glowing emerald wave background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/onboarding-bg.webp'), url('/onboarding-bg.png')",
        }}
      >
        {/* Subtle dark gradient overlay for optimal readability & contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 backdrop-blur-[1px]" />
      </div>

      {/* ── TOP NAVIGATION & STEP PROGRESS ─────────────────────────────────── */}
      <div
        className="shrink-0 px-5 pb-3 border-b border-white/[0.08] bg-black/75 backdrop-blur-xl z-10"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}
      >
        <div className="flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="p-1.5 -ml-1 text-[#8E8E93] hover:text-white transition-colors rounded-xl bg-white/[0.05]"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : onCancel ? (
            <button onClick={onCancel} className="text-xs text-[#8E8E93] hover:text-white transition-colors">
              Cancel
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === step
                    ? 'w-6 bg-[#30D158]'
                    : i + 1 < step
                    ? 'w-2 bg-[#30D158]/50'
                    : 'w-2 bg-white/10'
                }`}
              />
            ))}
          </div>

          <span className="text-[11px] font-mono font-semibold text-[#8E8E93]">
            {step}/{totalSteps}
          </span>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT BODY ─────────────────────────────────────────── */}
      <div
        className="relative z-10 flex-1 overflow-y-auto px-5 py-4 overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* ===================================================================== */}
        {/* STEP 1: BIOMETRICS (Deterministic Calorie Anchor)                      */}
        {/* ===================================================================== */}
        {step === 1 && (
          <div className="space-y-4 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 uppercase">
              <Sparkles className="w-3 h-3" />
              Biometrics
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-2">About You</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Authoritative physical data used to calculate metabolic resting burn (BMR).
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Biological Sex
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['male', 'female'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSex(opt)}
                    className={`py-2.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                      sex === opt ? 'bg-white text-black font-bold shadow-md' : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  Height
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-[#8E8E93] pointer-events-none">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  Weight
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-[#8E8E93] pointer-events-none">kg</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: ACTIVITY & WEIGHT TARGET (Deterministic Calorie Multiplier)   */}
      {/* ===================================================================== */}
      {step === 2 && (
        <div className="space-y-4 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 uppercase">
              <Target className="w-3 h-3" />
              Metabolism &amp; Target
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-2">Goals &amp; Energy</h2>
            <p className="text-xs text-[#8E8E93] mt-1">
              Determines daily maintenance energy expenditure (TDEE) and caloric balance.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                Primary Goal
              </label>

              {/* Featured: Lose Fat & Build Muscle (Body Recomposition) */}
              <button
                type="button"
                onClick={() => setGoal('recomposition')}
                className={`w-full mb-2 p-3 rounded-2xl text-left transition-all flex items-center justify-between border cursor-pointer active:scale-[0.98] ${
                  goal === 'recomposition'
                    ? 'bg-white text-black font-bold shadow-md border-white'
                    : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      goal === 'recomposition' ? 'bg-black text-white' : 'bg-white/5 text-[#30D158]'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${goal === 'recomposition' ? 'text-black' : 'text-white'}`}>
                      Lose Fat &amp; Build Muscle
                    </p>
                    <p className={`text-[10px] ${goal === 'recomposition' ? 'text-zinc-700 font-medium' : 'text-[#8E8E93]'}`}>
                      Body Recomposition (simultaneous fat loss &amp; muscle gain)
                    </p>
                  </div>
                </div>
                {goal === 'recomposition' && (
                  <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'lose_weight' as UserGoal, label: 'Lose Weight' },
                  { id: 'build_muscle' as UserGoal, label: 'Build Muscle' },
                  { id: 'maintain_weight' as UserGoal, label: 'Maintain Weight' },
                  { id: 'gain_weight' as UserGoal, label: 'Gain Weight' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`p-2.5 rounded-xl text-xs font-semibold transition-all ${
                      goal === g.id ? 'bg-white text-black font-bold shadow-md' : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Target Weight
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-sm text-white font-semibold focus:outline-none focus:border-[#30D158]"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-[#8E8E93] pointer-events-none">kg</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
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
                    className={`p-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activityLevel === act.id ? 'bg-white text-black font-bold shadow-md' : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-white/[0.04]'
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

      {/* ===================================================================== */}
      {/* STEP 3: UNDERSTAND YOUR BODY (Current Physique Assessment)            */}
      {/* ===================================================================== */}
      {step === 3 && (
        <div className="space-y-4 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-amber-500/15 text-[#FF9F0A] border border-[#FF9F0A]/30 uppercase">
              <User className="w-3 h-3" />
              Understand Your Body
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1.5">Where You Are Starting</h2>
            <p className="text-xs text-[#8E8E93] mt-0.5 leading-snug">
              A qualitative self-description to tailor training strategy. (Never used to guess fake body fat numbers).
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                How would you describe your current physique?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {currentPhysiqueOptions.map((opt) => {
                  const isSelected = currentPhysique === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCurrentPhysique(opt.id)}
                      className={`relative p-2.5 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center justify-between active:scale-[0.98] ${
                        isSelected
                          ? 'bg-white/[0.08] border-[#30D158] ring-1 ring-[#30D158]/40 shadow-sm scale-[1.02]'
                          : 'bg-[#1C1C1E] border-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#30D158] flex items-center justify-center text-black shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-16 h-28 flex items-center justify-center py-1">
                        <PhysiqueIllustration sex={sex} type={opt.id} selected={isSelected} />
                      </div>
                      <div className="w-full mt-1 pt-1.5 border-t border-white/[0.04]">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-[#30D158]' : 'text-white'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[9px] text-[#8E8E93] mt-0.5 truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Why we ask disclaimer */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-2.5 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#8E8E93] shrink-0 mt-0.5" />
              <div className="text-[10px] text-[#8E8E93] leading-relaxed">
                <span className="font-semibold text-zinc-300">Why we ask: </span>
                This helps Nuvia understand the starting shape and structure to personalize your training strategy. It does not estimate your exact body-fat percentage.
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                What would you most like to improve?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {priorityAreaOptions.map((area) => {
                  const isSelected = priorityAreas.includes(area);
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleArrayItem(priorityAreas, area, setPriorityAreas)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#30D158]/20 border-[#30D158] text-white font-semibold'
                          : 'bg-[#1C1C1E] border-white/[0.06] text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[#30D158]" />}
                      <span>{area}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#8E8E93] mt-1.5 italic">
                * Note: Overall body recomposition drives progress; spot reduction is anatomically not possible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 4: DESIRED PHYSIQUE & VISION                                     */}
      {/* ===================================================================== */}
      {step === 4 && (
        <div className="space-y-4 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
              <Compass className="w-3 h-3" />
              Your Vision
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1.5">Desired Physique</h2>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              Shapes workout selection, volume bias, and aesthetic coaching.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                What would you like your physique to look like?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {desiredPhysiqueOptions.map((opt) => {
                  const isSelected = desiredPhysique === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDesiredPhysique(opt.id)}
                      className={`relative p-2.5 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center justify-between active:scale-[0.98] ${
                        isSelected
                          ? 'bg-white/[0.08] border-[#30D158] ring-1 ring-[#30D158]/40 shadow-sm scale-[1.02]'
                          : 'bg-[#1C1C1E] border-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#30D158] flex items-center justify-center text-black shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-16 h-28 flex items-center justify-center py-1">
                        <PhysiqueIllustration sex={sex} type={opt.id} selected={isSelected} />
                      </div>
                      <div className="w-full mt-1 pt-1.5 border-t border-white/[0.04]">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-[#30D158]' : 'text-white'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[9px] text-[#8E8E93] mt-0.5 truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Interactive Transformation Preview Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#141416] border border-white/[0.08] shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  Your Direction
                </span>
                <span className="text-[10px] font-medium text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full border border-[#30D158]/20">
                  Personalized Path
                </span>
              </div>

              <div className="flex items-center justify-around py-1">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-semibold text-[#8E8E93] mb-1">Current</span>
                  <div className="w-16 h-24 rounded-xl bg-black/40 border border-white/10 p-1 flex items-center justify-center">
                    <PhysiqueIllustration sex={sex} type={currentPhysique} className="w-full h-full" />
                  </div>
                  <span className="text-[11px] font-semibold text-white mt-1 text-center">
                    {currentPhysiqueOptions.find((c) => c.id === currentPhysique)?.label}
                  </span>
                </div>

                <div className="flex flex-col items-center px-1 text-[#30D158]">
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-[9px] font-medium text-[#8E8E93] mt-0.5">Focus</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-semibold text-[#30D158] mb-1">Desired</span>
                  <div className="w-16 h-24 rounded-xl bg-[#30D158]/10 border border-[#30D158]/30 p-1 flex items-center justify-center">
                    <PhysiqueIllustration sex={sex} type={desiredPhysique} className="w-full h-full" selected />
                  </div>
                  <span className="text-[11px] font-semibold text-[#30D158] mt-1 text-center">
                    {desiredPhysiqueOptions.find((d) => d.id === desiredPhysique)?.label}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#8E8E93] text-center mt-2 border-t border-white/[0.04] pt-2">
                Nuvia will use this direction to personalize your training strategy and nutrition balance.
              </p>
            </div>

            {/* Custom Description */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                Describe your ideal look in your own words (optional)
              </label>
              <input
                type="text"
                value={desiredPhysiqueCustom}
                onChange={(e) => setDesiredPhysiqueCustom(e.target.value)}
                placeholder="e.g. Lean athletic with visible shoulders and less belly fat"
                className="w-full px-3 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#30D158]"
              />
            </div>

            {/* Why we ask disclaimer */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-2.5 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#8E8E93] shrink-0 mt-0.5" />
              <div className="text-[10px] text-[#8E8E93] leading-relaxed">
                <span className="font-semibold text-zinc-300">Why we ask: </span>
                This guides exercise selection, repetition ranges, and volume bias so you progress toward your ideal build.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Target BF% reference
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetBfRef}
                    onChange={(e) => setTargetBfRef(e.target.value)}
                    placeholder="15"
                    className="w-full px-3 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                  />
                  <span className="absolute right-3 top-2 text-xs text-[#8E8E93] pointer-events-none">%</span>
                </div>
                <p className="text-[9px] text-[#8E8E93] mt-0.5">Visual target only</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Reference photo
                </label>
                {physiquePhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10 h-14 bg-black flex items-center justify-between px-3">
                    <img src={physiquePhotoPreview} alt="Preview" className="h-10 w-10 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setPhysiquePhotoPreview(null)}
                      className="text-[#8E8E93] hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1C1E] border border-dashed border-white/20 text-xs text-[#8E8E93] hover:text-white cursor-pointer h-10">
                    <Camera className="w-3.5 h-3.5 text-[#30D158]" />
                    <span className="text-[11px]">Add photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
                <p className="text-[9px] text-[#8E8E93] mt-0.5">Optional &amp; client-side only</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: TRAINING REALITY & HARD CONSTRAINTS                          */}
      {/* ===================================================================== */}
      {step === 5 && (
        <div className="space-y-4 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase">
              <Dumbbell className="w-3 h-3" />
              Hard Constraints
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1.5">Equipment &amp; Split</h2>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              AI strictly obeys what you actually have. No unavailable gym machines will be prescribed.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Training Experience &amp; Consistency
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-[#8E8E93] mb-1">Experience:</p>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                  >
                    {experienceOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-[#8E8E93] mb-1">Consistency:</p>
                  <select
                    value={consistencyLevel}
                    onChange={(e) => setConsistencyLevel(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                  >
                    {consistencyOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                Where do you train &amp; what equipment do you have?
              </label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {(['home', 'gym', 'both', 'outdoors'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setEnvironment(loc)}
                    className={`py-1.5 rounded-xl text-[11px] font-semibold capitalize transition-all ${
                      environment === loc
                        ? 'bg-white text-black'
                        : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {equipmentOptions.map((eq) => {
                  const isSelected = equipment.includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleArrayItem(equipment, eq, setEquipment)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#30D158]/20 border-[#30D158] text-white font-bold'
                          : 'bg-[#1C1C1E] border-white/[0.06] text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[#30D158]" />}
                      <span>{eq}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Preferred Split
                </label>
                <select
                  value={preferredSplit}
                  onChange={(e) => setPreferredSplit(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                >
                  {splitOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Session Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                >
                  <option value={30}>20–30 min</option>
                  <option value={45}>30–45 min</option>
                  <option value={60}>45–60 min</option>
                  <option value={75}>60–90 min</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 6: PREFERENCES, CARDIO & ADHERENCE                               */}
      {/* ===================================================================== */}
      {step === 6 && (
        <div className="space-y-4 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-emerald-500/15 text-[#30D158] border border-[#30D158]/30 uppercase">
              <Clock className="w-3 h-3" />
              Lifestyle &amp; Habit
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1.5">Habits &amp; Obstacles</h2>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              Personalizing adherence so your plan fits into real life without burnout.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                Regular Cardio / Physical Activity
              </label>
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {['Walking', 'Running', 'Cycling', 'Sports', 'Swimming', 'None'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCardioHabit(c)}
                    className={`py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                      cardioHabit === c
                        ? 'bg-white text-black font-semibold'
                        : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={cardioDescription}
                onChange={(e) => setCardioDescription(e.target.value)}
                placeholder="e.g. 4.5 km brisk walk every Saturday"
                className="w-full px-3 py-1.5 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Training Intensity
                </label>
                <select
                  value={targetRir}
                  onChange={(e) => setTargetRir(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                >
                  <option value="1-3">Challenging (1-3 RIR)</option>
                  <option value="0-1">Hard (0-1 RIR)</option>
                  <option value="3-4">Comfortable (3-4 RIR)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Best Time of Day
                </label>
                <select
                  value={trainingTimeOfDay}
                  onChange={(e) => setTrainingTimeOfDay(e.target.value as any)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#30D158]"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="varies">It varies</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                What usually makes it hard to stay consistent?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {obstacleOptions.map((obs) => {
                  const isSelected = adherenceObstacles.includes(obs);
                  return (
                    <button
                      key={obs}
                      type="button"
                      onClick={() => toggleArrayItem(adherenceObstacles, obs, setAdherenceObstacles)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold'
                          : 'bg-[#1C1C1E] border-white/[0.06] text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[#FF9F0A]" />}
                      <span>{obs}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 7: YOUR PERSONALIZED PLAN & VERIFICATION                        */}
      {/* ===================================================================== */}
      {step === 7 && (
        <div className="space-y-3.5 py-1 animate-fadeIn">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 uppercase">
                <ShieldCheck className="w-3 h-3" />
                Verified Personal Plan
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
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1">Your Nuvia Blueprint</h2>
            <p className="text-[11px] text-[#8E8E93]">
              Review your personalized metabolic and training strategy before entering.
            </p>
          </div>

          {/* Primary Metabolic Target Card */}
          {calculatedTargets && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] border border-white/[0.1] shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#FF9500]" />
                  Mifflin-St Jeor Energy Target
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#30D158]/20 text-[#30D158]">
                  Deterministic
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {calculatedTargets.calorie_target.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#8E8E93] ml-1.5">kcal / day</span>
                </div>
                <div className="text-right text-[10px] text-[#8E8E93]">
                  <span>BMR: {calculatedTargets.bmr}</span> · <span>TDEE: {calculatedTargets.tdee}</span>
                </div>
              </div>

              {/* Macros Row */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.06] text-center">
                <div className="p-1.5 rounded-lg bg-black/30">
                  <p className="text-[10px] text-emerald-400 font-semibold">Protein</p>
                  <p className="text-xs font-bold text-white mt-0.5">{calculatedTargets.protein_target}g</p>
                </div>
                <div className="p-1.5 rounded-lg bg-black/30">
                  <p className="text-[10px] text-amber-400 font-semibold">Carbs</p>
                  <p className="text-xs font-bold text-white mt-0.5">{calculatedTargets.carbohydrate_target}g</p>
                </div>
                <div className="p-1.5 rounded-lg bg-black/30">
                  <p className="text-[10px] text-sky-400 font-semibold">Fats</p>
                  <p className="text-xs font-bold text-white mt-0.5">{calculatedTargets.fat_target}g</p>
                </div>
              </div>
            </div>
          )}

          {/* Synthesized Training Strategy Card */}
          <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#30D158] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Tailored Training Strategy</span>
              </span>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-[10px] font-semibold text-[#8E8E93] hover:text-white flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {synthesizedStrategy.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] text-zinc-300 leading-relaxed">
                  <span className="text-[#30D158] font-bold">•</span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Transformation Direction Card */}
          <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                Your Transformation Direction
              </span>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-[10px] font-semibold text-[#8E8E93] hover:text-white flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            <div className="flex items-center justify-around py-1">
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-semibold text-[#8E8E93] mb-1">Current</span>
                <div className="w-14 h-20 rounded-xl bg-black/50 border border-white/10 p-1 flex items-center justify-center">
                  <PhysiqueIllustration sex={sex} type={currentPhysique} className="w-full h-full" />
                </div>
                <span className="text-[10px] font-semibold text-white mt-1 text-center">
                  {currentPhysiqueOptions.find((c) => c.id === currentPhysique)?.label}
                </span>
              </div>

              <div className="flex flex-col items-center px-1 text-[#30D158]">
                <ArrowRight className="w-4 h-4" />
                <span className="text-[8px] font-medium text-[#8E8E93] mt-0.5">Target</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-semibold text-[#30D158] mb-1">Desired</span>
                <div className="w-14 h-20 rounded-xl bg-[#30D158]/10 border border-[#30D158]/30 p-1 flex items-center justify-center">
                  <PhysiqueIllustration sex={sex} type={desiredPhysique} className="w-full h-full" selected />
                </div>
                <span className="text-[10px] font-semibold text-[#30D158] mt-1 text-center">
                  {desiredPhysiqueOptions.find((d) => d.id === desiredPhysique)?.label}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-[#8E8E93]">Split &amp; Duration</p>
                <p className="font-semibold text-white truncate">
                  {preferredSplit} · {durationMinutes}m
                </p>
              </div>
              <div>
                <p className="text-[#8E8E93]">Equipment Limits</p>
                <p className="font-semibold text-[#30D158] truncate">
                  {equipment.slice(0, 2).join(', ')}{equipment.length > 2 ? ` +${equipment.length - 2}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center pt-0.5">
            <p className="text-[11px] text-[#8E8E93]">
              Does this look right? Tap below to establish these preferences.
            </p>
          </div>
        </div>
      )}
      </div>

      {/* ── BOTTOM ACTION BUTTON ───────────────────────────────────────────── */}
      <div
        className="shrink-0 px-5 pt-3 border-t border-white/[0.08] bg-black/80 backdrop-blur-xl z-10"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
      >
        {step < totalSteps ? (
          <button
            onClick={handleNextStep}
            className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs transition-transform active:scale-[0.98] cursor-pointer shadow-md"
          >
            Continue
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-3.5 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-semibold text-xs transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleFinalSave}
              disabled={saving}
              className="flex-1 py-3.5 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-extrabold text-xs transition-transform active:scale-[0.98] cursor-pointer shadow-lg shadow-[#30D158]/20 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span>Generating Your Plan...</span>
              ) : (
                <>
                  <span>Create My Plan &amp; Enter Nuvia</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
