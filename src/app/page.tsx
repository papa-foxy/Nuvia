'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { TopBar, BottomNav, TabType } from '@/components/Navigation';
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
import { Flame } from 'lucide-react';

export default function HomePage() {
  const { user, profile, goals, isLoading, hasCompletedOnboarding, refreshProfileAndGoals } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
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

  // If no authenticated or demo user is active, show Landing
  if (!user) {
    return (
      <LandingView
        onStartOnboarding={() => setShowOnboarding(true)}
        onEnterDashboard={() => setActiveTab('home')}
      />
    );
  }

  // If user has not completed onboarding or explicitly opened it
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
      'run',
      'jog',
      'walk',
      'gym',
      'workout',
      'cardio',
      'hiit',
      'bench',
      'lift',
      'cycle',
      'bike',
      'swim',
      'badminton',
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
    setRefreshKey((k) => k + 1);
    await refreshProfileAndGoals();
  };

  return (
    // h-dvh = dynamic viewport height — handles iOS PWA safe area correctly
    <div className="h-dvh bg-black text-white flex items-center justify-center p-0 sm:py-6 relative overflow-hidden">
      {/* Main Mobile App Container */}
      <div className="w-full max-w-md h-full sm:h-[92vh] sm:max-h-[92vh] sm:rounded-[36px] bg-black sm:border sm:border-[#2C2C2E] shadow-2xl flex flex-col relative overflow-hidden">
        {/* PWA Install Banner */}
        <PwaInstallBanner />

        {/* Fixed Top Bar */}
        <TopBar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Tab Content — pb-20 keeps content above the fixed bottom nav */}
        <main className="flex-1 flex flex-col overflow-y-auto pb-20">
          {activeTab === 'home' && (
            <DashboardView
              onOpenAddMeal={() => setIsAddMealOpen(true)}
              onOpenAddExercise={() => setIsAddExerciseOpen(true)}
              onNavigateTab={setActiveTab}
              onNaturalLanguageInput={handleNaturalLanguageInput}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'meals' && (
            <MealsListView
              onOpenAddMeal={() => setIsAddMealOpen(true)}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'exercise' && (
            <ExerciseListView
              onOpenAddExercise={() => setIsAddExerciseOpen(true)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'coach' && <AiCoachView />}

          {activeTab === 'summary' && <DailySummaryView refreshKey={refreshKey} />}

          {activeTab === 'goals' && <GoalsView />}

          {activeTab === 'profile' && (
            <ProfileView onReplayOnboarding={() => setShowOnboarding(true)} />
          )}
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
