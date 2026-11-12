'use client';

import React, { useState } from 'react';
import { House, Dumbbell, Utensils, TrendingUp, Activity, User, Plus, Camera, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { NuviaBottomSheet } from './NuviaBottomSheet';

export type TabType = 'home' | 'meals' | 'exercise' | 'progress' | 'coach' | 'profile' | 'summary' | 'goals';

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
    <header className="sticky top-0 z-40 w-full ios-blur border-b border-fg/[0.08] px-5 py-3 flex items-center justify-between">
      <div 
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setActiveTab('home')}
      >
        <span className="text-base font-semibold tracking-tight text-fg">
          Nuvia
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('coach')}
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
            activeTab === 'coach'
              ? 'bg-fg text-app font-semibold'
              : 'text-muted hover:text-fg'
          }`}
        >
          Nuvia
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className="w-8 h-8 rounded-full bg-card border border-fg/[0.15] flex items-center justify-center text-xs font-semibold text-fg hover:border-accent/50 transition-all overflow-hidden shadow-sm"
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
            <User className="w-3.5 h-3.5 text-muted" />
          )}
        </button>
      </div>
    </header>
  );
}

function NavItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 h-12 min-w-[56px] transition-colors cursor-pointer ${
        active ? 'text-fg' : 'text-subtle hover:text-fg'
      }`}
    >
      <Icon className={`w-[22px] h-[22px] ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
      <span className={`text-[10.5px] tracking-tight ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
      {active && <span className="absolute -top-1.5 h-[3px] w-6 rounded-full bg-accent" aria-hidden />}
    </button>
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
      <nav
        aria-label="Primary"
        className="absolute bottom-0 left-0 right-0 z-50 w-full h-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom,0px))] pb-[calc(4px+env(safe-area-inset-bottom,0px))] bg-app/95 backdrop-blur-xl border-t border-line px-3 pt-1.5 grid grid-cols-5 items-center"
      >
        <NavItem label="Home" icon={House} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavItem
          label="Workout"
          icon={Dumbbell}
          active={activeTab === 'exercise'}
          onClick={() => setActiveTab('exercise')}
        />

        {/* Action Center: (+) rotates to (×) while the Log Entry sheet is open */}
        <div className="relative -top-2 z-10 flex justify-center">
          <button
            type="button"
            onClick={() => setShowLogSheet((prev) => !prev)}
            className={`w-14 h-14 rounded-full flex items-center justify-center ring-4 ring-app active:scale-95 transition-all duration-300 cursor-pointer shadow-lg shadow-black/20 ${
              showLogSheet
                ? 'bg-elevated text-fg rotate-45'
                : 'bg-accent text-on-accent rotate-0 hover:bg-accent-hover'
            }`}
            aria-label={showLogSheet ? 'Close log menu' : 'Log meal or activity'}
            aria-expanded={showLogSheet}
          >
            <Plus className="w-7 h-7 stroke-[2.75] transition-transform duration-300" />
          </button>
        </div>

        <NavItem
          label="Nutrition"
          icon={Utensils}
          active={activeTab === 'meals' || activeTab === 'summary'}
          onClick={() => setActiveTab('meals')}
        />
        <NavItem
          label="Progress"
          icon={TrendingUp}
          active={activeTab === 'progress'}
          onClick={() => setActiveTab('progress')}
        />
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
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-accent/20 to-elevated hover:from-accent/30 border border-accent/40 text-left transition-all flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent text-on-accent flex items-center justify-center shrink-0 shadow-md">
              <Camera className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-fg">Log Meal</p>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-accent text-on-accent">
                  AI Camera
                </span>
              </div>
              <p className="text-xs text-muted">Photo capture & instant calorie calculation</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowLogSheet(false);
              onOpenAddExercise?.();
            }}
            className="w-full p-3.5 rounded-2xl bg-elevated hover:bg-elevated-2 text-left transition-colors flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-xl bg-info/15 text-blue-ink flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-fg">Log Activity</p>
              <p className="text-xs text-muted">Workout, run, gym, or sports</p>
            </div>
          </button>
        </div>
      </NuviaBottomSheet>
    </>
  );
}
