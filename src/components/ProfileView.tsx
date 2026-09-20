'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { WorkoutRoutine } from '@/types/routine';
import { NuviaCache } from '@/lib/nuvia-cache';
import { Dumbbell } from 'lucide-react';

import { ProfileHeader } from './profile/ProfileHeader';
import { GoalProgressCard } from './profile/GoalProgressCard';
import { DailyPlanSection } from './profile/DailyPlanSection';
import { LongTermProgressSection } from './profile/LongTermProgressSection';
import { AboutYouSection } from './profile/AboutYouSection';
import { AIPersonalizationSection } from './profile/AIPersonalizationSection';
import { ProfileSettingsSection } from './profile/ProfileSettingsSection';
import { EditTargetsModal } from './profile/EditTargetsModal';

interface ProfileViewProps {
  onReplayOnboarding: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenAddMeal?: () => void;
  onOpenAddExercise?: () => void;
}

export function ProfileView({
  onReplayOnboarding,
  onNavigateTab,
}: ProfileViewProps) {
  const { user, profile, goals, signOut, refreshProfileAndGoals, isLoading } = useAuth();

  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [activeDaysCount, setActiveDaysCount] = useState<number>(0);
  const [totalLoggedDays, setTotalLoggedDays] = useState<number>(0);
  const [averageAdherencePercent, setAverageAdherencePercent] = useState<number | null>(null);
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false);
  const [isAboutYouEditing, setIsAboutYouEditing] = useState(false);

  // Lightweight targeted data loading for Profile
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const cacheKey = `profile_analytics_${user.id}`;
    const cached = NuviaCache.get<{
      routines: WorkoutRoutine[];
      activeDays: number;
      loggedDays: number;
      adherence: number | null;
    }>(cacheKey);

    if (cached?.data) {
      setRoutines(cached.data.routines);
      setActiveDaysCount(cached.data.activeDays);
      setTotalLoggedDays(cached.data.loggedDays);
      setAverageAdherencePercent(cached.data.adherence);
    }

    async function loadProfileMetrics() {
      try {
        const [rList, actMap] = await Promise.all([
          DataService.getWorkoutRoutines(user?.id),
          DataService.getActivityMap(user?.id),
        ]);

        if (!isMounted) return;

        setRoutines(rList);

        // Calculate this month's active days
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        let activeCount = 0;
        let loggedCount = 0;
        let totalCalorieRatio = 0;
        let ratioCount = 0;
        const calTarget = goals?.calorie_target || 2050;

        for (const [dateStr, val] of Object.entries(actMap)) {
          const [y, m] = dateStr.split('-').map(Number);
          if (y === curYear && m === curMonth + 1) {
            if (val.hasWorkout || val.hasMeal) activeCount++;
          }
          if (val.hasMeal || val.hasWorkout) {
            loggedCount++;
          }
          if (val.calories > 0 && calTarget > 0) {
            const ratio = Math.min(val.calories / calTarget, 1.3);
            totalCalorieRatio += ratio;
            ratioCount++;
          }
        }

        const adherence = ratioCount > 0 ? Math.round((totalCalorieRatio / ratioCount) * 100) : null;

        setActiveDaysCount(activeCount);
        setTotalLoggedDays(loggedCount);
        setAverageAdherencePercent(adherence);

        NuviaCache.set(
          cacheKey,
          { routines: rList, activeDays: activeCount, loggedDays: loggedCount, adherence },
          { staleTime: 120_000, gcTime: 600_000 }
        );
      } catch (err) {
        console.warn('Failed to load profile metrics:', err);
      }
    }

    loadProfileMetrics();

    return () => {
      isMounted = false;
    };
  }, [user?.id, goals?.calorie_target]);

  // Compute next planned workout for compact callout
  const nextWorkoutInfo = useMemo(() => {
    if (!routines || routines.length === 0) return null;

    const today = new Date();
    const todayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Check tomorrow first
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
    const tomorrowRoutine = routines.find((r) =>
      r.days.map((d) => d.toLowerCase()).includes(tomorrowName.toLowerCase())
    );

    if (tomorrowRoutine) {
      return {
        title: tomorrowRoutine.title,
        dayLabel: 'Tomorrow',
        focus: tomorrowRoutine.focus || 'Scheduled Session',
      };
    }

    // Check next 7 days
    for (let i = 2; i <= 7; i++) {
      const future = new Date(today);
      future.setDate(today.getDate() + i);
      const dayName = future.toLocaleDateString('en-US', { weekday: 'long' });
      const found = routines.find((r) =>
        r.days.map((d) => d.toLowerCase()).includes(dayName.toLowerCase())
      );
      if (found) {
        return {
          title: found.title,
          dayLabel: dayName,
          focus: found.focus || 'Upcoming Routine',
        };
      }
    }

    return null;
  }, [routines]);

  // SKELETON LOADING STATE
  if (isLoading && !profile && !user) {
    return (
      <div className="flex-1 flex flex-col pb-24 px-5 pt-6 w-full max-w-md mx-auto space-y-5 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-20 h-20 rounded-full bg-white/10" />
          <div className="w-32 h-5 rounded-lg bg-white/10" />
          <div className="w-44 h-3 rounded-lg bg-white/5" />
          <div className="w-24 h-7 rounded-full bg-white/10 mt-1" />
        </div>

        {/* Goal Card Skeleton */}
        <div className="ios-card p-4 h-36 bg-white/[0.04] rounded-3xl" />

        {/* Daily Plan Skeleton */}
        <div className="ios-card p-4 h-48 bg-white/[0.04] rounded-3xl" />

        {/* About You Skeleton */}
        <div className="ios-card p-4 h-56 bg-white/[0.04] rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-24 px-5 pt-3 w-full max-w-md mx-auto space-y-4">
      {/* 1. PROFILE HEADER (Personal, Apple-inspired) */}
      <ProfileHeader
        user={user}
        profile={profile}
        onEditProfile={() => setIsAboutYouEditing(true)}
      />

      {/* 2. GOAL PROGRESS (Current -> Target, Diff, Direction) */}
      <GoalProgressCard
        profile={profile}
        goals={goals}
      />

      {/* 3. YOUR DAILY PLAN (Compact targets reference) */}
      <DailyPlanSection
        goals={goals}
        onEditTargets={() => setIsTargetsModalOpen(true)}
      />

      {/* 4. COMPACT NEXT WORKOUT CALLOUT (Summary of upcoming routine) */}
      {nextWorkoutInfo && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#1C1C1E] to-[#1C1C1E] border border-[#30D158]/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#30D158]/20 text-[#30D158] flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#30D158] uppercase tracking-wider block">
                Next Planned Workout · {nextWorkoutInfo.dayLabel}
              </span>
              <p className="text-xs font-bold text-white leading-tight">
                {nextWorkoutInfo.title}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. LONG-TERM PROGRESS (Trends & Consistency) */}
      <LongTermProgressSection
        profile={profile}
        goals={goals}
        activeDaysCount={activeDaysCount}
        totalLoggedDays={totalLoggedDays}
        averageAdherencePercent={averageAdherencePercent}
        onNavigateActivity={() => onNavigateTab && onNavigateTab('exercise')}
      />

      {/* 6. ABOUT YOU (Stored profile parameters with inline editor) */}
      <AboutYouSection
        profile={profile}
        onProfileUpdated={refreshProfileAndGoals}
        onReplayOnboarding={onReplayOnboarding}
        isEditing={isAboutYouEditing}
        onOpenEdit={() => setIsAboutYouEditing(true)}
        onCloseEdit={() => setIsAboutYouEditing(false)}
      />

      {/* 7. AI PERSONALIZATION & USER CONTROL */}
      <AIPersonalizationSection
        userId={user?.id}
        profile={profile}
      />

      {/* 8. SETTINGS & ACCOUNT SESSION */}
      <ProfileSettingsSection
        onSignOut={signOut}
      />

      {/* Footer Branding */}
      <p className="text-center text-[11px] text-[#636366] pt-2 pb-1">
        Nuvia · Intelligent Health & Fitness Engine
      </p>

      {/* MODAL: EDIT GOALS & TARGETS */}
      <EditTargetsModal
        isOpen={isTargetsModalOpen}
        onClose={() => setIsTargetsModalOpen(false)}
        goals={goals}
        profile={profile}
        userId={user?.id}
        onGoalsUpdated={refreshProfileAndGoals}
      />
    </div>
  );
}
