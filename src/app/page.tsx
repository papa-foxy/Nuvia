'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { BottomNav, TabType } from '@/components/Navigation';
import { LandingView } from '@/components/LandingView';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { DashboardView } from '@/components/DashboardView';
import { MealsListView } from '@/components/MealsListView';
import { ExerciseListView } from '@/components/ExerciseListView';
import { AiCoachView } from '@/components/AiCoachView';
import { DailySummaryView } from '@/components/DailySummaryView';
import { GoalsView } from '@/components/GoalsView';
import { ProfileView } from '@/components/ProfileView';
import { AddMealModal } from '@/components/AddMealModal';
import { AddExerciseModal } from '@/components/AddExerciseModal';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { DataService } from '@/lib/data-service';
import {
  NuviaCache,
  todaySummaryKey,
  todayMealsKey,
  todayActivityKey,
  allMealsKey,
  exerciseLogsKey,
} from '@/lib/nuvia-cache';
import { getLocalDateString } from '@/lib/data-service';
import { Flame } from 'lucide-react';

export default function HomePage() {
  const { user, profile, goals, isLoading, hasCompletedOnboarding, refreshProfileAndGoals } =
    useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);

  /**
   * refreshKey is incremented after a data mutation so DashboardView knows
   * to bypass its cache and fetch fresh data.
   * Using a separate counter per data type allows targeted invalidation.
   */
  const [refreshKey, setRefreshKey] = useState(0);

  // Prefilled natural language inputs
  const [prefilledMealPrompt, setPrefilledMealPrompt] = useState('');
  const [prefilledExercisePrompt, setPrefilledExercisePrompt] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070A13] flex flex-col items-center justify-center text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center animate-bounce shadow-xl shadow-emerald-500/25">
          <Flame className="w-7 h-7 text-slate-950 fill-slate-950" />
        </div>
        <p className="mt-4 text-xs font-bold tracking-widest text-emerald-400 uppercase">
          Nuvia AI Fitness
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingView
        onStartOnboarding={() => setShowOnboarding(true)}
        onEnterDashboard={() => setActiveTab('home')}
      />
    );
  }

  if (!hasCompletedOnboarding || showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setShowOnboarding(false);
          setActiveTab('home');
        }}
        onCancel={hasCompletedOnboarding ? () => setShowOnboarding(false) : undefined}
      />
    );
  }

  const handleNaturalLanguageInput = (input: string) => {
    const text = input.toLowerCase();
    const exerciseKeywords = [
      'run', 'jog', 'walk', 'gym', 'workout', 'cardio',
      'hiit', 'bench', 'lift', 'cycle', 'bike', 'swim', 'badminton',
    ];
    const isExercise = exerciseKeywords.some((k) => text.includes(k));

    if (isExercise) {
      setPrefilledExercisePrompt(input);
      setIsAddExerciseOpen(true);
    } else {
      setPrefilledMealPrompt(input);
      setIsAddMealOpen(true);
    }
  };

  const todayStr = getLocalDateString();

  const handleSaveMeal = async (mealData: any) => {
    await DataService.addMeal(
      {
        user_id: user.id,
        meal_type: mealData.meal_type,
        meal_time: mealData.meal_time || new Date().toISOString(),
        source: mealData.source || 'text',
        image_url: mealData.image_url || null,
        description: mealData.description,
        calories: mealData.calories,
        protein_g: mealData.protein_g,
        carbs_g: mealData.carbs_g,
        fat_g: mealData.fat_g,
        confidence: mealData.confidence || 'medium',
        ai_analysis: mealData.ai_analysis || null,
      },
      mealData.items || []
    );

    // Targeted invalidation — only clear the keys that a meal addition affects
    NuviaCache.invalidate(todaySummaryKey(user.id, todayStr));
    NuviaCache.invalidate(todayMealsKey(user.id, todayStr));
    NuviaCache.invalidate(allMealsKey(user.id));

    setRefreshKey((k) => k + 1);
    await refreshProfileAndGoals();
  };

  const handleSaveExercise = async (exerciseData: any) => {
    await DataService.addExerciseLog({
      user_id: user.id,
      exercise_type: exerciseData.exercise_type,
      duration_minutes: exerciseData.duration_minutes,
      intensity: exerciseData.intensity,
      distance_km: exerciseData.distance_km,
      calories_burned: exerciseData.calories_burned,
      source: exerciseData.source || 'text',
      description: exerciseData.description,
      confidence: exerciseData.confidence || 'medium',
      ai_analysis: exerciseData.ai_analysis || null,
    });

    // Targeted invalidation — clear keys that an exercise log affects
    NuviaCache.invalidate(todaySummaryKey(user.id, todayStr));
    NuviaCache.invalidate(todayActivityKey(user.id, todayStr));
    NuviaCache.invalidate(exerciseLogsKey(user.id));
    NuviaCache.invalidatePrefix('today-summary:');
    NuviaCache.invalidatePrefix('today-activity:');
    NuviaCache.invalidatePrefix('exercise-logs:');

    setRefreshKey((k) => k + 1);
    await refreshProfileAndGoals();
  };

  return (
    <div
      className="w-full bg-black text-white flex flex-col md:items-center md:justify-center p-0 md:py-6 relative overflow-hidden"
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available',
      }}
    >
      {/* Main Mobile App Container */}
      <div
        className="w-full max-w-md bg-black md:border md:border-[#2C2C2E] shadow-2xl flex flex-col relative overflow-hidden md:rounded-[36px] md:h-[92vh] md:max-h-[92vh]"
        style={{
          flex: 1,
          height: '100%',
        }}
      >
        {/* PWA Install Banner */}
        <PwaInstallBanner />

        {/*
          ── TAB CONTENT STRATEGY ─────────────────────────────────────────────
          All tab components are rendered once and kept mounted.
          We toggle visibility with CSS display:none / display:contents
          instead of conditional && rendering.

          This means:
          - React state inside each tab is preserved when you switch away
          - useEffect does NOT re-fire when you return to a tab
          - NuviaCache serves data immediately without a loading flash

          display:contents is used so the child's flex/grid layout is
          not broken by an extra wrapper div.
          ─────────────────────────────────────────────────────────────────────
        */}
        <main
          className="flex-1 flex flex-col overflow-y-auto pb-28 w-full relative"
          style={{
            paddingTop: 'max(8px, env(safe-area-inset-top))',
            overscrollBehaviorY: 'none',
          }}
        >


          <div style={{ display: activeTab === 'home' ? 'contents' : 'none' }}>
              <DashboardView
                onOpenAddMeal={() => setIsAddMealOpen(true)}
                onOpenAddExercise={() => setIsAddExerciseOpen(true)}
                onNavigateTab={setActiveTab}
                onNaturalLanguageInput={handleNaturalLanguageInput}
                refreshKey={refreshKey}
              />
            </div>

            <div style={{ display: activeTab === 'meals' ? 'contents' : 'none' }}>
              <MealsListView
                onOpenAddMeal={() => setIsAddMealOpen(true)}
                refreshKey={refreshKey}
              />
            </div>

            <div style={{ display: activeTab === 'exercise' ? 'contents' : 'none' }}>
              <ExerciseListView
                onOpenAddExercise={() => setIsAddExerciseOpen(true)}
                onOpenAddMeal={() => setIsAddMealOpen(true)}
                onNavigateTab={setActiveTab}
                refreshKey={refreshKey}
                onWorkoutFinished={() => setRefreshKey((k) => k + 1)}
              />
            </div>

            <div style={{ display: activeTab === 'coach' ? 'contents' : 'none' }}>
              <AiCoachView />
            </div>

            <div style={{ display: activeTab === 'summary' ? 'contents' : 'none' }}>
              <DailySummaryView refreshKey={refreshKey} />
            </div>

            <div style={{ display: activeTab === 'goals' ? 'contents' : 'none' }}>
              <GoalsView onNavigateTab={setActiveTab} />
            </div>

            <div style={{ display: activeTab === 'profile' ? 'contents' : 'none' }}>
              <ProfileView
                onReplayOnboarding={() => setShowOnboarding(true)}
                onOpenAddMeal={() => setIsAddMealOpen(true)}
                onOpenAddExercise={() => setIsAddExerciseOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            </div>
        </main>

        {/* Bottom Tab Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAddMeal={() => setIsAddMealOpen(true)}
          onOpenAddExercise={() => setIsAddExerciseOpen(true)}
        />

        {/* MODALS */}
        <AddMealModal
          isOpen={isAddMealOpen}
          onClose={() => {
            setIsAddMealOpen(false);
            setPrefilledMealPrompt('');
          }}
          onSaveMeal={handleSaveMeal}
        />

        <AddExerciseModal
          isOpen={isAddExerciseOpen}
          onClose={() => {
            setIsAddExerciseOpen(false);
            setPrefilledExercisePrompt('');
          }}
          onSaveExercise={handleSaveExercise}
        />
      </div>
    </div>
  );
}
