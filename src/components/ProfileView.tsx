'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { Meal, ExerciseLog, DailySummary } from '@/types/database';
import { WorkoutRoutine } from '@/types/routine';
import { DayDetailsModal } from './DayDetailsModal';

interface ProfileViewProps {
  onReplayOnboarding: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenAddMeal?: () => void;
  onOpenAddExercise?: () => void;
}

export function ProfileView({
  onReplayOnboarding,
  onNavigateTab,
  onOpenAddMeal,
  onOpenAddExercise,
}: ProfileViewProps) {
  const { user, profile, goals, signOut } = useAuth();

  const today = new Date();
  const todayStr = getLocalDateString(today);

  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [inspectDateStr, setInspectDateStr] = useState<string>(todayStr);

  const [activityMap, setActivityMap] = useState<Record<string, { hasMeal: boolean; hasWorkout: boolean; calories: number; burned: number }>>({});
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);

  // Selected Day Details for Modal
  const [inspectSummary, setInspectSummary] = useState<DailySummary | null>(null);
  const [inspectMeals, setInspectMeals] = useState<Meal[]>([]);
  const [inspectExercises, setInspectExercises] = useState<ExerciseLog[]>([]);

  const [imgError, setImgError] = useState(false);

  // Load monthly activity map & routines
  useEffect(() => {
    async function loadInitialData() {
      const [act, r] = await Promise.all([
        DataService.getActivityMap(user?.id),
        DataService.getWorkoutRoutines(user?.id),
      ]);
      setActivityMap(act);
      setRoutines(r);
    }
    loadInitialData();
  }, [user]);

  // Load modal day details whenever inspectDateStr is clicked
  const handleDayClick = async (dateStr: string) => {
    setInspectDateStr(dateStr);
    setIsDayModalOpen(true);

    const [s, m, e] = await Promise.all([
      DataService.getDailySummary(user?.id, dateStr),
      DataService.getMeals(user?.id, dateStr),
      DataService.getExerciseLogs(user?.id, dateStr),
    ]);
    setInspectSummary(s);
    setInspectMeals(m);
    setInspectExercises(e);
  };

  // Compute viewed month in Calendar
  const viewedDate = new Date(today.getFullYear(), today.getMonth() + selectedMonthOffset, 1);
  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth(); // 0-indexed
  const monthName = viewedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Compute first day and number of days (Monday as week start: 1..7 -> index 0..6)
  const firstDayIndex = (new Date(viewedYear, viewedMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate();

  // Find routine matching the inspect day
  const [iY, iM, iD] = inspectDateStr.split('-').map(Number);
  const inspectDateObj = new Date(iY, iM - 1, iD);
  const inspectDayName = inspectDateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const inspectRoutine = routines.find((r) =>
    r.days.map((d) => d.toLowerCase()).includes(inspectDayName.toLowerCase())
  );

  const avatarUrl = user?.avatar_url;
  const displayName = profile?.name || user?.full_name || user?.email?.split('@')[0] || 'Member';

  return (
    <div className="flex-1 flex flex-col pb-24 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
          Account & Calendar
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
          Profile
        </h1>
      </div>

      {/* USER HEADER CARD (With Google Profile Photo) */}
      <div className="ios-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            {avatarUrl && !imgError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#30D158]/50 shadow-md shadow-emerald-500/20"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#30D158] to-[#0A84FF] flex items-center justify-center text-white font-bold text-xl shadow-md shadow-emerald-500/20">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1C1C1E] border-2 border-[#121214] flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30D158]" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-white tracking-tight">
                {displayName}
              </h2>
              {avatarUrl && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-white/10 text-zinc-300 border border-white/10">
                  <ShieldCheck className="w-2.5 h-2.5 text-[#30D158]" />
                  Google
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E8E93] mt-0.5 truncate max-w-[200px]">
              {user?.email || 'Nuvia Member'}
            </p>
            <span className="inline-block text-[10px] text-[#30D158] font-medium mt-1">
              Active Member
            </span>
          </div>
        </div>

        <button
          onClick={onReplayOnboarding}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
        >
          Edit Goals
        </button>
      </div>

      {/* SECTION 1: MONTHLY CALENDAR WITH HIGHLIGHTED CIRCLE COLORS */}
      <div className="ios-card p-4 space-y-3.5">
        {/* Calendar Month Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block">
              Activity History & Planner
            </span>
            <span className="text-base font-bold text-white mt-0.5 block">{monthName}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonthOffset((prev) => prev - 1)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedMonthOffset(0)}
              className={`px-2.5 h-8 rounded-lg text-[11px] font-semibold transition-colors ${
                selectedMonthOffset === 0
                  ? 'text-zinc-500 bg-transparent'
                  : 'text-zinc-300 bg-white/5 hover:bg-white/10'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedMonthOffset((prev) => prev + 1)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500 uppercase">
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
          <span>Su</span>
        </div>

        {/* Monthly Grid with highlighted circles */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Leading empty spacers */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`blank-${i}`} className="h-9" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const d = new Date(viewedYear, viewedMonth, dayNum);
            const dateStr = getLocalDateString(d);
            const isToday = dateStr === todayStr;
            const act = activityMap[dateStr];
            const hasWorkout = Boolean(act?.hasWorkout);
            const hasMeal = Boolean(act?.hasMeal);

            // Routine match for day of week
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const routineScheduled = routines.some((r) =>
              r.days.map((x) => x.toLowerCase()).includes(dayName.toLowerCase())
            );
            const isRest = !routineScheduled;

            // Highlight circle styling
            let circleStyle = 'text-zinc-400 hover:bg-white/5';
            let dotIndicator = null;

            if (hasWorkout && hasMeal) {
              circleStyle = 'bg-gradient-to-tr from-[#30D158] to-[#FF9500] text-black font-extrabold shadow-sm shadow-emerald-500/20 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-white mt-0.5" />;
            } else if (hasWorkout) {
              circleStyle = 'bg-[#30D158] text-black font-extrabold shadow-sm shadow-emerald-500/20 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-black/60 mt-0.5" />;
            } else if (hasMeal) {
              circleStyle = 'bg-[#FF9500] text-black font-extrabold shadow-sm shadow-orange-500/20 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-black/60 mt-0.5" />;
            } else if (isRest) {
              circleStyle = 'border border-[#0A84FF]/35 text-zinc-300 hover:bg-blue-500/10 active:scale-95';
            }

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(dateStr)}
                className={`relative h-9 rounded-xl flex flex-col items-center justify-center text-xs transition-all cursor-pointer ${circleStyle} ${
                  isToday && !hasWorkout && !hasMeal ? 'ring-1 ring-white/60 font-bold' : ''
                }`}
              >
                <span className="leading-none text-[11px]">{dayNum}</span>
                {dotIndicator}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between text-[10px] text-zinc-400 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30D158]" />
              Workout Done
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />
              Meal Logged
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-[#0A84FF]/40" />
              Rest Day
            </span>
          </div>
          <span className="text-zinc-500 font-medium">Click any day for details ›</span>
        </div>
      </div>

      {/* SECTION 2: HEALTH DETAILS GROUP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
            Health Parameters
          </span>
          <button
            onClick={onReplayOnboarding}
            className="text-xs text-[#30D158] hover:underline font-medium"
          >
            Recalculate Plan
          </button>
        </div>

        <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Biological Sex</span>
            <span className="font-semibold text-white capitalize">{profile?.sex || 'Male'}</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Height</span>
            <span className="font-semibold text-white">{profile?.height_cm || 176} cm</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Current Weight</span>
            <span className="font-semibold text-white">{profile?.weight_kg || 73} kg</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Target Goal</span>
            <span className="font-semibold text-[#30D158] capitalize">
              {profile?.goal ? profile.goal.replace('_', ' ') : 'Build Muscle'} ({profile?.target_weight_kg || 68} kg)
            </span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Dietary Preference</span>
            <span className="font-semibold text-white">{profile?.dietary_preference || 'Halal / Balanced'}</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: ACCOUNT SESSION CONTROLS */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
          Account Session
        </span>

        <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
          <button
            onClick={signOut}
            className="w-full p-3.5 flex justify-between items-center text-left text-[#FF453A] font-medium hover:bg-white/[0.02]"
          >
            <span>Sign Out of Nuvia</span>
            <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#636366] pt-2">
        Nuvia PWA · Intelligent Health & Fitness Engine
      </p>

      {/* DEDICATED DAY DETAILS MODAL (Opens when clicking any calendar day) */}
      <DayDetailsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        dateStr={inspectDateStr}
        summary={inspectSummary}
        meals={inspectMeals}
        exercises={inspectExercises}
        routine={inspectRoutine || null}
        isToday={inspectDateStr === todayStr}
        onOpenAddMeal={onOpenAddMeal}
        onOpenAddExercise={onOpenAddExercise}
      />
    </div>
  );
}
