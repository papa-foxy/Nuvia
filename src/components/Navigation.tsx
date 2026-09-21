'use client';

import React, { useState } from 'react';
import { Calendar, Utensils, Activity, Sparkles, User, Plus, Camera, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { NuviaBottomSheet } from './NuviaBottomSheet';

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
  const { user, profile } = useAuth();
  const avatarUrl = profile?.avatar_url || user?.avatar_url;
  const displayName = profile?.name || user?.full_name || 'U';

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
          className="w-8 h-8 rounded-full bg-[#1C1C1E] border border-white/[0.15] flex items-center justify-center text-xs font-semibold text-white hover:border-[#30D158]/50 transition-all overflow-hidden shadow-sm"
          title="Profile"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : displayName ? (
            displayName.charAt(0).toUpperCase()
          ) : (
            <User className="w-3.5 h-3.5 text-[#8E8E93]" />
          )}
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
  const { user, profile } = useAuth();
  const avatarUrl = profile?.avatar_url || user?.avatar_url;
  const [showLogSheet, setShowLogSheet] = useState(false);

  return (
    <>
      <nav
        className="fixed md:absolute bottom-0 left-0 right-0 z-50 w-full h-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom,0px))] pb-[calc(4px+env(safe-area-inset-bottom,0px))] bg-black border-t border-white/[0.08] px-4 pt-1.5 flex items-center justify-between"
      >
        {/* Destination 1: Today */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 py-0.5 px-2.5 transition-colors ${
            activeTab === 'home' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Today</span>
        </button>

        {/* Destination 2: Meals */}
        <button
          onClick={() => setActiveTab('meals')}
          className={`flex flex-col items-center gap-0.5 py-0.5 px-2.5 transition-colors ${
            activeTab === 'meals' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Meals</span>
        </button>

        {/* Action Center: (+) Rotates to (×) when Log Entry sheet is open */}
        <div className="relative -top-2 z-10">
          <button
            type="button"
            onClick={() => setShowLogSheet((prev) => !prev)}
            className={`w-14 h-14 rounded-full flex items-center justify-center border-2 border-white ring-4 ring-black active:scale-95 transition-all duration-300 cursor-pointer shadow-lg ${
              showLogSheet
                ? 'bg-[#2C2C2E] text-white rotate-45 border-white/80'
                : 'bg-[#30D158] text-black rotate-0 hover:bg-[#28B84D]'
            }`}
            title={showLogSheet ? 'Close Log Menu' : 'Log Meal or Activity'}
            aria-expanded={showLogSheet}
          >
            <Plus className="w-7 h-7 stroke-[3] transition-transform duration-300" />
          </button>
        </div>

        {/* Destination 3: Activity */}
        <button
          onClick={() => setActiveTab('exercise')}
          className={`flex flex-col items-center gap-0.5 py-0.5 px-2.5 transition-colors ${
            activeTab === 'exercise' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Activity</span>
        </button>

        {/* Destination 4: Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-0.5 py-0.5 px-2.5 transition-colors ${
            activeTab === 'profile' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
          }`}
        >
          {avatarUrl ? (
            <div
              className={`w-5 h-5 rounded-full overflow-hidden border transition-all ${
                activeTab === 'profile' ? 'border-white ring-1 ring-white' : 'border-white/20'
              }`}
            >
              <img
                src={avatarUrl}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <User className="w-5 h-5" />
          )}
          <span className="text-[10px] font-semibold tracking-tight">Profile</span>
        </button>
      </nav>

      {/* Unified Compact Log Action Sheet */}
      <NuviaBottomSheet
        isOpen={showLogSheet}
        onClose={() => setShowLogSheet(false)}
        variant="compact"
        title="Log Entry"
        maxWidth="max-w-md"
      >
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              setShowLogSheet(false);
              onOpenAddMeal?.();
            }}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#30D158]/20 to-[#2C2C2E] hover:from-[#30D158]/30 border border-[#30D158]/40 text-left transition-all flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
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
            type="button"
            onClick={() => {
              setShowLogSheet(false);
              onOpenAddExercise?.();
            }}
            className="w-full p-3.5 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-left transition-colors flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
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
      </NuviaBottomSheet>
    </>
  );
}
