'use client';

import React, { useState } from 'react';
import { Calendar, Utensils, Activity, Sparkles, User, Plus, Camera, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export type TabType = 'home' | 'meals' | 'exercise' | 'coach' | 'profile' | 'summary' | 'goals';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenAddMeal?: () => void;
  onOpenAddExercise?: () => void;
}

export function TopBar({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full ios-blur border-b border-white/[0.08] px-5 py-3 flex items-center justify-between">
      <div 
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setActiveTab('home')}
      >
        <span className="text-base font-semibold tracking-tight text-white">
          Nuvia
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('coach')}
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
            activeTab === 'coach'
              ? 'bg-white text-black font-semibold'
              : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          Nuvia
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className="w-7 h-7 rounded-full bg-[#1C1C1E] border border-white/[0.12] flex items-center justify-center text-xs font-semibold text-white hover:border-white/30 transition-all overflow-hidden"
          title="Profile"
        >
          {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5 text-[#8E8E93]" />}
        </button>
      </div>
    </header>
  );
}

export function BottomNav({
  activeTab,
  setActiveTab,
  onOpenAddMeal,
  onOpenAddExercise,
}: NavigationProps) {
  const [showLogSheet, setShowLogSheet] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 w-full ios-blur border-t border-white/[0.08] px-4 pt-2 flex items-center justify-between shrink-0" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {/* Destination 1: Today */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
            activeTab === 'home' ? 'text-[#30D158]' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Today</span>
        </button>

        {/* Destination 2: Meals */}
        <button
          onClick={() => setActiveTab('meals')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
            activeTab === 'meals' ? 'text-[#30D158]' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Meals</span>
        </button>

        {/* Action Center: (+) Visually Dominant */}
        <div className="relative -top-2">
          <button
            onClick={() => setShowLogSheet(true)}
            className="w-12 h-12 rounded-full bg-[#30D158] text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Log Meal or Activity"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Destination 3: Activity */}
        <button
          onClick={() => setActiveTab('exercise')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
            activeTab === 'exercise' ? 'text-[#30D158]' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Activity</span>
        </button>

        {/* Destination 4: Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
            activeTab === 'profile' ? 'text-[#30D158]' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Profile</span>
        </button>
      </nav>

      {/* iOS-Style Contextual Log Action Sheet */}
      {showLogSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="w-full max-w-sm ios-sheet border border-white/[0.12] rounded-3xl p-5 shadow-2xl space-y-4 animate-slideUp">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">
                Log Entry
              </span>
              <button
                onClick={() => setShowLogSheet(false)}
                className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowLogSheet(false);
                  onOpenAddMeal?.();
                }}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#30D158]/20 to-[#2C2C2E] hover:from-[#30D158]/30 border border-[#30D158]/40 text-left transition-all flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#30D158] text-black flex items-center justify-center shrink-0 shadow-md">
                  <Camera className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-white">Log Meal</p>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#30D158] text-black">
                      AI Camera
                    </span>
                  </div>
                  <p className="text-xs text-[#8E8E93]">Photo capture & instant calorie calculation</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowLogSheet(false);
                  onOpenAddExercise?.();
                }}
                className="w-full p-3.5 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-left transition-colors flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Log Activity</p>
                  <p className="text-xs text-[#8E8E93]">Workout, run, gym, or sports</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
