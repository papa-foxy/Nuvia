'use client';

import React, { useMemo, useState } from 'react';
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
import {
  calculateTargets,
  calculateAge,
  getUserCalculationContext,
  cleanDietaryPreference,
  CalculationResult,
} from '@/lib/calculator';
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
  // Body details start empty for a new user: nothing is pre-filled with someone else's numbers.
  const [dob, setDob] = useState(profile?.date_of_birth?.slice(0, 10) || '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '');
  const [weightKg, setWeightKg] = useState(profile?.weight_kg ? String(profile.weight_kg) : '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activity_level || 'moderately_active'
  );
  const [goal, setGoal] = useState<UserGoal>(profile?.goal || 'build_muscle');
  const [targetWeightKg, setTargetWeightKg] = useState(
    profile?.target_weight_kg ? String(profile.target_weight_kg) : ''
  );
  const [dietaryPref, setDietaryPref] = useState(cleanDietaryPreference(profile?.dietary_preference) || 'Halal');

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
  const [saving, setSaving] = useState(false);

  // Body details must be real, plausible values before any target is calculated.
  const heightNum = Number(heightCm);
  const weightNum = Number(weightKg);
  const targetWeightNum = Number(targetWeightKg);
  const bodyDetailsError =
    !(heightNum >= 100 && heightNum <= 250)
      ? 'Enter your height in centimetres (for example 170).'
      : !(weightNum >= 25 && weightNum <= 350)
      ? 'Enter your weight in kilograms (for example 70).'
      : calculateAge(dob) == null
      ? 'Enter your date of birth.'
      : null;
  const needsTargetWeight = goal === 'lose_weight' || goal === 'gain_weight';
  const targetWeightError =
    targetWeightKg.trim() === ''
      ? needsTargetWeight
        ? 'Enter the weight you want to reach.'
        : null
      : !(targetWeightNum >= 25 && targetWeightNum <= 350)
      ? 'Enter your target weight in kilograms.'
      : goal === 'lose_weight' && targetWeightNum >= weightNum
      ? 'To lose weight, your target weight should be below your current weight.'
      : goal === 'gain_weight' && targetWeightNum <= weightNum
      ? 'To gain weight, your target weight should be above your current weight.'
      : null;
  const stepError = step === 1 ? bodyDetailsError : step === 2 ? targetWeightError : null;
  const savedTargetWeight = targetWeightKg.trim() !== '' && !targetWeightError ? targetWeightNum : null;

  // Targets always come from the shared calculator, using exactly what was entered.
  const calculatedTargets: CalculationResult | null = useMemo(() => {
    if (bodyDetailsError) return null;
    return calculateTargets(
      getUserCalculationContext({
        ...(profile || ({} as Profile)),
        date_of_birth: dob,
        sex,
        height_cm: heightNum,
        weight_kg: weightNum,
        activity_level: activityLevel,
        goal,
        target_weight_kg: savedTargetWeight,
      })
    );
  }, [bodyDetailsError, profile, dob, sex, heightNum, weightNum, activityLevel, goal, savedTargetWeight]);

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

  const handleNextStep = () => {
    if (stepError) return;
    if (step < totalSteps) {
      setStep((s) => s + 1);
    }
  };

  // Final submission of all biometric, metabolic, and qualitative context
  const handleFinalSave = async () => {
    // Never save a plan built from missing or invalid body details.
    if (!calculatedTargets || bodyDetailsError) {
      setStep(1);
      return;
    }
    if (targetWeightError) {
      setStep(2);
      return;
    }
    setSaving(true);
    const userId = user?.id || DataService.getDemoUserId();

    // 1. Authoritative Biometric Profile
    const updatedProfile: Profile = {
      id: userId,
      name: profile?.name || null,
      date_of_birth: dob,
      sex,
      height_cm: heightNum,
      weight_kg: weightNum,
      activity_level: activityLevel,
      goal,
      target_weight_kg: savedTargetWeight,
      dietary_preference: dietaryPref,
      allergies: [],
    };

    // 2. Authoritative Nutritional Goals (deterministic Mifflin-St Jeor)
    const targets = calculatedTargets;

    const newGoals: Goal = {
      id: `goal-${Date.now()}`,
      user_id: userId,
      calorie_target: targets.calorie_target,
      protein_target: targets.protein_target,
      carbohydrate_target: targets.carbohydrate_target,
      fat_target: targets.fat_target,
      exercise_minutes_target: targets.exercise_minutes_target,
      target_weight_kg: savedTargetWeight,
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
    // The label shows the real gap between this user's target and their maintenance calories.
    const adj = calculatedTargets?.adjustment ?? 0;
    const label =
      adj < 0 ? `${adj} kcal vs maintenance` : adj > 0 ? `+${adj} kcal vs maintenance` : 'At maintenance';
    switch (g) {
      case 'recomposition':
        return { label, tag: 'Lose Fat & Build Muscle', color: 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' };
      case 'lose_weight':
        return { label, tag: 'Fat Loss', color: 'text-amber-400 bg-amber-400/15 border-amber-400/30' };
      case 'build_muscle':
        return { label, tag: 'Muscle Growth', color: 'text-green-ink bg-accent/15 border-accent/30' };
      case 'gain_weight':
        return { label, tag: 'Weight Gain', color: 'text-green-ink bg-sky-400/15 border-sky-400/30' };
      case 'maintain_weight':
      default:
        return { label, tag: 'Maintenance', color: 'text-fg bg-fg/10 border-fg/20' };
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
      data-theme="dark"
      className="relative w-full max-w-md mx-auto bg-app text-fg flex flex-col overflow-hidden"
      style={{
        // Same screen height the app shell uses (100vh in the installed iOS app).
        height: 'var(--sheet-viewport-h, 100dvh)',
      }}
    >
      {/* Background: soft lime glow at the top fading into the app colour (no photo to load). */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 60% at 50% -10%, color-mix(in srgb, var(--theme-accent) 22%, transparent) 0%, transparent 60%),' +
              'radial-gradient(80% 50% at 100% 100%, color-mix(in srgb, var(--theme-accent) 8%, transparent) 0%, transparent 70%),' +
              'var(--theme-app)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(var(--theme-fg) 1px, transparent 1px), linear-gradient(90deg, var(--theme-fg) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'linear-gradient(to bottom, black, transparent 45%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 45%)',
          }}
        />
      </div>

      {/* ── TOP NAVIGATION & STEP PROGRESS ─────────────────────────────────── */}
      <div
        className="relative shrink-0 px-5 pb-2 z-10"
        style={{ paddingTop: 'calc(var(--screen-top) + 16px)' }}
      >
        <div className="flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="w-10 h-10 -ml-1 flex items-center justify-center text-fg rounded-full bg-card border border-line/60 hover:border-fg/30 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : onCancel ? (
            <button onClick={onCancel} className="h-10 px-3 -ml-1 rounded-full text-sm font-semibold text-muted hover:text-fg transition-colors">
              Cancel
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}

          <div
            className="flex-1 mx-4 flex items-center gap-1"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-valuenow={step}
            aria-label={`Step ${step} of ${totalSteps}`}
          >
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i + 1 <= step ? 'bg-accent' : 'bg-fg/10'
                }`}
              />
            ))}
          </div>

          <span className="w-10 text-right text-xs font-semibold text-muted tabular-nums">
            {step}/{totalSteps}
          </span>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT BODY ─────────────────────────────────────────── */}
      <div
        className="relative z-10 flex-1 overflow-y-auto px-5 pt-4 pb-8 overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* ===================================================================== */}
        {/* STEP 1: BIOMETRICS (Deterministic Calorie Anchor)                      */}
        {/* ===================================================================== */}
        {step === 1 && (
          <div className="space-y-6 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
              <Sparkles className="w-3 h-3" />
              Biometrics
            </span>
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">About You</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              We use this to work out how many calories your body burns each day.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
                Biological Sex
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['male', 'female'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSex(opt)}
                    className={`py-2.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                      sex === opt ? 'bg-accent/15 text-fg font-bold border border-accent ring-1 ring-accent/30' : 'bg-card text-fg-soft hover:text-fg border border-line/60 hover:border-fg/25'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1.5">
                  Height
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={100}
                    max={250}
                    placeholder="e.g. 170"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-card border border-line/60 text-base text-fg font-semibold placeholder:text-subtle placeholder:font-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1.5">
                  Weight
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={25}
                    max={350}
                    placeholder="e.g. 70"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-card border border-line/60 text-base text-fg font-semibold placeholder:text-subtle placeholder:font-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">kg</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-card border border-line/60 text-base text-fg font-semibold placeholder:text-subtle placeholder:font-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: ACTIVITY & WEIGHT TARGET (Deterministic Calorie Multiplier)   */}
      {/* ===================================================================== */}
      {step === 2 && (
        <div className="space-y-6 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
              <Target className="w-3 h-3" />
              Metabolism &amp; Target
            </span>
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">Goals &amp; Energy</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Your daily activity and goal set your calorie target.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-2">
                Primary Goal
              </label>

              {/* Featured: Lose Fat & Build Muscle (Body Recomposition) */}
              <button
                type="button"
                onClick={() => setGoal('recomposition')}
                className={`w-full mb-2 p-3 rounded-2xl text-left transition-all flex items-center justify-between border cursor-pointer active:scale-[0.98] ${
                  goal === 'recomposition'
                    ? 'bg-accent/15 text-fg font-bold border-accent ring-1 ring-accent/30'
                    : 'bg-card text-fg-soft hover:text-fg border-line/60 hover:border-fg/25'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      goal === 'recomposition' ? 'bg-app text-fg' : 'bg-fg/5 text-green-ink'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${goal === 'recomposition' ? 'text-black' : 'text-fg'}`}>
                      Lose Fat &amp; Build Muscle
                    </p>
                    <p className={`text-[10px] ${goal === 'recomposition' ? 'text-zinc-700 font-medium' : 'text-muted'}`}>
                      Body Recomposition (simultaneous fat loss &amp; muscle gain)
                    </p>
                  </div>
                </div>
                {goal === 'recomposition' && (
                  <div className="w-5 h-5 rounded-full bg-app text-fg flex items-center justify-center">
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
                      goal === g.id ? 'bg-accent/15 text-fg font-bold border border-accent ring-1 ring-accent/30' : 'bg-card text-fg-soft hover:text-fg border border-line/60 hover:border-fg/25'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
                Target Weight
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={25}
                  max={350}
                  placeholder={needsTargetWeight ? 'e.g. 65' : 'Optional'}
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-card border border-line/60 text-base text-fg font-semibold placeholder:text-subtle placeholder:font-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">kg</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-2">
                Activity Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'sedentary' as ActivityLevel, label: 'Sedentary' },
                  { id: 'lightly_active' as ActivityLevel, label: 'Light (1-3d)' },
                  { id: 'moderately_active' as ActivityLevel, label: 'Moderate (3-5d)' },
                  { id: 'very_active' as ActivityLevel, label: 'Active (6-7d)' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActivityLevel(act.id)}
                    className={`p-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activityLevel === act.id ? 'bg-accent/15 text-fg font-bold border border-accent ring-1 ring-accent/30' : 'bg-card text-fg-soft hover:text-fg border border-line/60 hover:border-fg/25'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-1.5">
                Days of exercise per week. Not sure? Pick the lower option, because a level that is too high makes your calorie target too high.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: UNDERSTAND YOUR BODY (Current Physique Assessment)            */}
      {/* ===================================================================== */}
      {step === 3 && (
        <div className="space-y-6 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
              <User className="w-3 h-3" />
              Understand Your Body
            </span>
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">Where You Are Starting</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Pick the build closest to yours today. It shapes your training, and we never guess a body-fat number from it.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-2">
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
                          ? 'bg-card border-accent ring-1 ring-accent/40 shadow-sm scale-[1.02]'
                          : 'bg-card border-line/60 hover:border-fg/20'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center text-on-accent shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-16 h-28 flex items-center justify-center py-1">
                        <PhysiqueIllustration sex={sex} type={opt.id} selected={isSelected} />
                      </div>
                      <div className="w-full mt-1 pt-1.5 border-t border-fg/[0.04]">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-green-ink' : 'text-fg'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[9px] text-muted mt-0.5 truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Why we ask disclaimer */}
            <div className="rounded-xl bg-fg/[0.02] border border-fg/[0.05] p-2.5 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
              <div className="text-[10px] text-muted leading-relaxed">
                <span className="font-semibold text-muted">Why we ask: </span>
                This helps Nuvia understand the starting shape and structure to personalize your training strategy. It does not estimate your exact body-fat percentage.
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
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
                          ? 'bg-accent/15 border-accent text-fg font-semibold'
                          : 'bg-card border-line/60 text-fg-soft hover:text-fg hover:border-fg/25'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-green-ink" />}
                      <span>{area}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted mt-1.5 italic">
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
        <div className="space-y-6 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
              <Compass className="w-3 h-3" />
              Your Vision
            </span>
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">Desired Physique</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Choose the look you are working towards. Your workouts are built around it.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-2">
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
                          ? 'bg-card border-accent ring-1 ring-accent/40 shadow-sm scale-[1.02]'
                          : 'bg-card border-line/60 hover:border-fg/20'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center text-on-accent shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-16 h-28 flex items-center justify-center py-1">
                        <PhysiqueIllustration sex={sex} type={opt.id} selected={isSelected} />
                      </div>
                      <div className="w-full mt-1 pt-1.5 border-t border-fg/[0.04]">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-green-ink' : 'text-fg'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[9px] text-muted mt-0.5 truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Interactive Transformation Preview Card */}
            <div className="p-3.5 rounded-[var(--radius-card)] bg-card border border-line/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Your Direction
                </span>
                <span className="text-[10px] font-medium text-green-ink bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                  Personalized Path
                </span>
              </div>

              <div className="flex items-center justify-around py-1">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-semibold text-muted mb-1">Current</span>
                  <div className="w-16 h-24 rounded-xl bg-card border border-line/60 p-1 flex items-center justify-center">
                    <PhysiqueIllustration sex={sex} type={currentPhysique} className="w-full h-full" />
                  </div>
                  <span className="text-[11px] font-semibold text-fg mt-1 text-center">
                    {currentPhysiqueOptions.find((c) => c.id === currentPhysique)?.label}
                  </span>
                </div>

                <div className="flex flex-col items-center px-1 text-green-ink">
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-[9px] font-medium text-muted mt-0.5">Focus</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-semibold text-green-ink mb-1">Desired</span>
                  <div className="w-16 h-24 rounded-xl bg-card border border-accent p-1 flex items-center justify-center">
                    <PhysiqueIllustration sex={sex} type={desiredPhysique} className="w-full h-full" selected />
                  </div>
                  <span className="text-[11px] font-semibold text-green-ink mt-1 text-center">
                    {desiredPhysiqueOptions.find((d) => d.id === desiredPhysique)?.label}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-muted text-center mt-2 border-t border-fg/[0.04] pt-2">
                Nuvia will use this direction to personalize your training strategy and nutrition balance.
              </p>
            </div>

            {/* Custom Description */}
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1">
                Describe your ideal look in your own words (optional)
              </label>
              <input
                type="text"
                value={desiredPhysiqueCustom}
                onChange={(e) => setDesiredPhysiqueCustom(e.target.value)}
                placeholder="e.g. Lean athletic with visible shoulders and less belly fat"
                className="w-full px-3 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg placeholder:text-subtle focus:outline-none focus:border-accent"
              />
            </div>

            {/* Why we ask disclaimer */}
            <div className="rounded-xl bg-fg/[0.02] border border-fg/[0.05] p-2.5 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
              <div className="text-[10px] text-muted leading-relaxed">
                <span className="font-semibold text-muted">Why we ask: </span>
                This guides exercise selection, repetition ranges, and volume bias so you progress toward your ideal build.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1">
                  Target BF% reference
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetBfRef}
                    onChange={(e) => setTargetBfRef(e.target.value)}
                    placeholder="15"
                    className="w-full px-3 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
                  />
                  <span className="absolute right-3 top-2 text-xs text-muted pointer-events-none">%</span>
                </div>
                <p className="text-[9px] text-muted mt-0.5">Visual target only</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1">
                  Reference photo
                </label>
                {physiquePhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-fg/10 h-14 bg-app flex items-center justify-between px-3">
                    <img src={physiquePhotoPreview} alt="Preview" className="h-10 w-10 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setPhysiquePhotoPreview(null)}
                      className="text-muted hover:text-fg p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-dashed border-fg/20 text-xs text-muted hover:text-fg cursor-pointer h-10">
                    <Camera className="w-3.5 h-3.5 text-green-ink" />
                    <span className="text-[11px]">Add photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
                <p className="text-[9px] text-muted mt-0.5">Optional &amp; client-side only</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: TRAINING REALITY & HARD CONSTRAINTS                          */}
      {/* ===================================================================== */}
      {step === 5 && (
        <div className="space-y-6 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
              <Dumbbell className="w-3 h-3" />
              Hard Constraints
            </span>
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">Equipment &amp; Split</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Tell us what you can use. Nuvia only plans exercises with this equipment.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
                Training Experience &amp; Consistency
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted mb-1">Experience:</p>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
                  >
                    {experienceOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted mb-1">Consistency:</p>
                  <select
                    value={consistencyLevel}
                    onChange={(e) => setConsistencyLevel(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
                  >
                    {consistencyOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
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
                        ? 'bg-accent/15 text-fg border border-accent'
                        : 'bg-card text-fg-soft hover:text-fg border border-line/60 hover:border-fg/25'
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
                          ? 'bg-accent/15 border-accent text-fg font-bold'
                          : 'bg-card border-line/60 text-fg-soft hover:text-fg hover:border-fg/25'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-green-ink" />}
                      <span>{eq}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1">
                  Preferred Split
                </label>
                <select
                  value={preferredSplit}
                  onChange={(e) => setPreferredSplit(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
                >
                  {splitOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1">
                  Session Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
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
        <div className="space-y-6 py-1 animate-fadeIn">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
              <Clock className="w-3 h-3" />
              Lifestyle &amp; Habit
            </span>
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">Habits &amp; Obstacles</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              So your plan fits your week and you can keep it up.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1">
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
                        ? 'bg-accent/15 text-fg font-semibold border border-accent'
                        : 'bg-card text-fg-soft hover:text-fg border border-line/60 hover:border-fg/25'
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
                className="w-full px-3 py-1.5 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1">
                  Training Intensity
                </label>
                <select
                  value={targetRir}
                  onChange={(e) => setTargetRir(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
                >
                  <option value="1-3">Challenging (1-3 RIR)</option>
                  <option value="0-1">Hard (0-1 RIR)</option>
                  <option value="3-4">Comfortable (3-4 RIR)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-fg-soft mb-1">
                  Best Time of Day
                </label>
                <select
                  value={trainingTimeOfDay}
                  onChange={(e) => setTrainingTimeOfDay(e.target.value as any)}
                  className="w-full px-2.5 py-2 rounded-xl bg-card border border-fg/[0.08] text-xs text-fg focus:outline-none focus:border-accent"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="varies">It varies</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-fg-soft mb-1.5">
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
                          ? 'bg-accent/15 border-accent text-fg font-semibold'
                          : 'bg-card border-line/60 text-fg-soft hover:text-fg hover:border-fg/25'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-orange-ink" />}
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
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-ink">
                <ShieldCheck className="w-3 h-3" />
                Your plan
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
            <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-fg mt-1.5">Ready to start</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Check your targets and training plan before you start.
            </p>
          </div>

          {/* Primary Metabolic Target Card */}
          {calculatedTargets && (
            <div className="p-4 rounded-[var(--radius-card)] bg-card border border-line/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg-soft flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-ink" />
                  Daily calorie target
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-fg tracking-tight">
                    {calculatedTargets.calorie_target.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted ml-1.5">kcal / day</span>
                </div>
                <div className="text-right text-[10px] text-muted">
                  <span>At rest {calculatedTargets.bmr.toLocaleString()}</span> · <span>Maintenance {calculatedTargets.tdee.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-[10px] text-muted leading-relaxed">
                {calculatedTargets.expected_pace_kg > 0
                  ? `An estimate from your age, sex, height, weight and activity. At this target, expect about ${calculatedTargets.expected_pace_kg} kg ${calculatedTargets.adjustment < 0 ? 'lost' : 'gained'} per week${calculatedTargets.weeks_to_goal != null ? `, roughly ${calculatedTargets.weeks_to_goal} weeks to ${savedTargetWeight} kg` : ''}.`
                  : 'An estimate from your age, sex, height, weight and activity.'}
                {calculatedTargets.limited_by !== 'none' &&
                  ' Nuvia kept the calorie change within a safe range, so the pace is gentler than the standard 0.5 kg per week.'}
              </p>

              {/* Macros Row */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-fg/[0.06] text-center">
                <div className="p-1.5 rounded-lg bg-app/30">
                  <p className="text-[10px] text-emerald-400 font-semibold">Protein</p>
                  <p className="text-xs font-bold text-fg mt-0.5">{calculatedTargets.protein_target}g</p>
                </div>
                <div className="p-1.5 rounded-lg bg-app/30">
                  <p className="text-[10px] text-amber-400 font-semibold">Carbs</p>
                  <p className="text-xs font-bold text-fg mt-0.5">{calculatedTargets.carbohydrate_target}g</p>
                </div>
                <div className="p-1.5 rounded-lg bg-app/30">
                  <p className="text-[10px] text-green-ink font-semibold">Fats</p>
                  <p className="text-xs font-bold text-fg mt-0.5">{calculatedTargets.fat_target}g</p>
                </div>
              </div>
            </div>
          )}

          {/* Synthesized Training Strategy Card */}
          <div className="p-4 rounded-[var(--radius-card)] bg-card border border-line/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-fg-soft flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-green-ink" />
                <span>Your training plan</span>
              </span>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-[10px] font-semibold text-muted hover:text-fg flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {synthesizedStrategy.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] text-muted leading-relaxed">
                  <span className="text-green-ink font-bold">•</span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Transformation Direction Card */}
          <div className="p-4 rounded-[var(--radius-card)] bg-card border border-line/60 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Your Transformation Direction
              </span>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-[10px] font-semibold text-muted hover:text-fg flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            <div className="flex items-center justify-around py-1">
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-semibold text-muted mb-1">Current</span>
                <div className="w-16 h-24 rounded-xl bg-card border border-line/60 p-1 flex items-center justify-center">
                  <PhysiqueIllustration sex={sex} type={currentPhysique} className="w-full h-full" />
                </div>
                <span className="text-[10px] font-semibold text-fg mt-1 text-center">
                  {currentPhysiqueOptions.find((c) => c.id === currentPhysique)?.label}
                </span>
              </div>

              <div className="flex flex-col items-center px-1 text-green-ink">
                <ArrowRight className="w-4 h-4" />
                <span className="text-[8px] font-medium text-muted mt-0.5">Target</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-semibold text-green-ink mb-1">Desired</span>
                <div className="w-16 h-24 rounded-xl bg-card border border-accent p-1 flex items-center justify-center">
                  <PhysiqueIllustration sex={sex} type={desiredPhysique} className="w-full h-full" selected />
                </div>
                <span className="text-[10px] font-semibold text-green-ink mt-1 text-center">
                  {desiredPhysiqueOptions.find((d) => d.id === desiredPhysique)?.label}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-fg/[0.04] grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-muted">Split &amp; Duration</p>
                <p className="font-semibold text-fg truncate">
                  {preferredSplit} · {durationMinutes}m
                </p>
              </div>
              <div>
                <p className="text-muted">Equipment Limits</p>
                <p className="font-semibold text-green-ink truncate">
                  {equipment.slice(0, 2).join(', ')}{equipment.length > 2 ? ` +${equipment.length - 2}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center pt-0.5">
            <p className="text-[11px] text-muted">
              Looks right? You can change any of this later in Profile.
            </p>
          </div>
        </div>
      )}
      </div>

      {/* ── BOTTOM ACTION BUTTON ───────────────────────────────────────────── */}
      <div
        className="relative shrink-0 px-5 pt-3 z-10"
        style={{
          paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          background: 'linear-gradient(to top, var(--theme-app) 70%, transparent)',
        }}
      >
        {step < totalSteps ? (
          <>
            {stepError && (
              <p className="mb-2 text-center text-xs font-medium text-muted" role="status">
                {stepError}
              </p>
            )}
            <button
              onClick={handleNextStep}
              disabled={Boolean(stepError)}
              className="w-full h-14 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-extrabold text-base transition-transform active:scale-[0.98] cursor-pointer shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:bg-elevated disabled:text-muted disabled:shadow-none disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-14 px-5 rounded-2xl bg-card border border-line/60 text-fg font-semibold text-sm transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleFinalSave}
              disabled={saving}
              className="flex-1 h-14 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-extrabold text-base transition-transform active:scale-[0.98] cursor-pointer shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span>Generating Your Plan...</span>
              ) : (
                <>
                  <span>Create my plan</span>
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
