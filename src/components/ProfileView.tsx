'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ChevronRight, Target, TrendingUp } from 'lucide-react';

import { ProfileHeader } from './profile/ProfileHeader';
import { AboutYouSection } from './profile/AboutYouSection';
import { AIPersonalizationSection } from './profile/AIPersonalizationSection';
import { ProfileSettingsSection } from './profile/ProfileSettingsSection';

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
  const { user, profile, signOut, refreshProfileAndGoals, isLoading } = useAuth();

  const [isAboutYouEditing, setIsAboutYouEditing] = useState(false);

  // SKELETON LOADING STATE
  if (isLoading && !profile && !user) {
    return (
      <div className="flex-1 flex flex-col pb-24 px-5 pt-6 w-full max-w-md mx-auto space-y-5 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-20 h-20 rounded-full bg-fg/10" />
          <div className="w-32 h-5 rounded-lg bg-fg/10" />
          <div className="w-44 h-3 rounded-lg bg-fg/5" />
          <div className="w-24 h-7 rounded-full bg-fg/10 mt-1" />
        </div>

        {/* Links Skeleton */}
        <div className="ios-card p-4 h-28 bg-fg/[0.04] rounded-3xl" />

        {/* About You Skeleton */}
        <div className="ios-card p-4 h-56 bg-fg/[0.04] rounded-3xl" />
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

      {/* Goals, targets and history each have their own screen; link to them
          instead of repeating them here. */}
      <nav aria-label="Goals and progress" className="ios-card divide-y divide-fg/[0.05] overflow-hidden">
        {[
          { label: 'Goals & daily targets', hint: 'Weight goal, calories and macros', icon: Target, tab: 'goals' },
          { label: 'Progress & history', hint: 'Workouts, records, body weight', icon: TrendingUp, tab: 'progress' },
        ].map((row) => (
          <button
            key={row.tab}
            type="button"
            onClick={() => onNavigateTab?.(row.tab)}
            className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-fg/[0.03] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-[10px] bg-accent/15 text-green-ink flex items-center justify-center shrink-0">
                <row.icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-fg">{row.label}</span>
                <span className="block text-[11px] text-muted truncate">{row.hint}</span>
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted shrink-0" />
          </button>
        ))}
      </nav>

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
      <p className="text-center text-[11px] text-subtle pt-2 pb-1">
        Nuvia · Intelligent Health & Fitness Engine
      </p>
    </div>
  );
}
