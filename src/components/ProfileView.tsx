'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  ShieldCheck,
  Sparkles,
  Dumbbell,
  Heart,
  Zap,
  CheckCircle2,
  AlertCircle,
  Flame,
  ArrowRight,
  Droplets,
  Moon,
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

  // ── Smart Activity & Tomorrow Guideline Computation ──
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);
  const tomorrowDayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
  const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' });

  // Today's activity & routine
  const todayAct = activityMap[todayStr];
  const todayHasWorkout = Boolean(todayAct?.hasWorkout);
  const todayHasMeal = Boolean(todayAct?.hasMeal);
  const todayRoutine = routines.find((r) =>
    r.days.map((d) => d.toLowerCase()).includes(todayDayName.toLowerCase())
  );

  // Tomorrow's scheduled routine
  const tomorrowRoutine = routines.find((r) =>
    r.days.map((d) => d.toLowerCase()).includes(tomorrowDayName.toLowerCase())
  );
  const isTomorrowRest = routines.length > 0 && !tomorrowRoutine;

  // Next scheduled routine if tomorrow is rest
  const nextScheduled = (() => {
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'long' });
      const found = routines.find((r) =>
        r.days.map((d) => d.toLowerCase()).includes(dayName.toLowerCase())
      );
      if (found) {
        return {
          routine: found,
          dayName,
          daysAhead: i,
          dateStr: getLocalDateString(futureDate),
          dateFormatted: futureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        };
      }
    }
    return null;
  })();

  const avatarUrl = user?.avatar_url;
  const displayName = profile?.name || user?.full_name || user?.email?.split('@')[0] || 'Member';

  return (
    <div className="flex-1 flex flex-col pb-24 px-5 pt-4 w-full max-w-md mx-auto space-y-5">
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

      {/* ── SECTION 1: SMART ACTIVITY & TRAINING GUIDELINE (WHAT USER SHOULD DO) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#30D158]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Training & Rest Guideline
            </span>
          </div>
          <span className="text-[11px] text-[#8E8E93] font-medium">
            {todayDayName} → {tomorrowDayName}
          </span>
        </div>

        {/* Today's Context Banner */}
        <div className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              todayHasWorkout
                ? 'bg-[#30D158]/20 text-[#30D158]'
                : todayRoutine
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-[#0A84FF]/15 text-[#0A84FF]'
            }`}>
              {todayHasWorkout ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : todayRoutine ? (
                <Dumbbell className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#8E8E93] uppercase font-bold block">
                Today ({todayDayName})
              </span>
              <p className="text-xs font-semibold text-white truncate">
                {todayHasWorkout
                  ? `Workout Logged (+${todayAct?.burned || 0} kcal burned)`
                  : todayRoutine
                  ? `Scheduled: ${todayRoutine.title}`
                  : routines.length > 0
                  ? 'Active Recovery Day'
                  : 'No scheduled workout'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleDayClick(todayStr)}
            className="text-[11px] text-[#30D158] font-semibold hover:underline shrink-0 ml-2"
          >
            Details ›
          </button>
        </div>

        {/* Tomorrow's Actionable Guideline Card */}
        {tomorrowRoutine ? (
          /* CASE 1: Tomorrow has a created workout routine scheduled */
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#30D158]/15 via-[#1C1C1E] to-[#121214] border border-[#30D158]/35 shadow-lg shadow-emerald-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#30D158] text-black">
                Tomorrow: Workout Day
              </span>
              <span className="text-xs text-white/70 font-semibold flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5 text-[#30D158]" />
                {tomorrowRoutine.exercises.length} movements
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                {tomorrowRoutine.title}
              </h3>
              <p className="text-xs text-[#30D158] font-medium mt-0.5">
                Focus: {tomorrowRoutine.focus || 'Strength & Conditioning'}
              </p>
            </div>

            {/* Personalized coaching advice based on today's state */}
            <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] text-xs text-zinc-300 leading-relaxed">
              {todayHasWorkout ? (
                <>
                  <strong className="text-white">Guideline:</strong> You trained today! Since tomorrow is another session with{' '}
                  <span className="text-[#30D158] font-semibold">{tomorrowRoutine.title}</span>, prioritize recovery tonight: hydrate with 2.5L+ water, consume 25–30g of protein, and get 7–8 hours of restorative sleep to be ready.
                </>
              ) : todayRoutine ? (
                <>
                  <strong className="text-white">Guideline:</strong> You haven&apos;t logged today&apos;s routine yet. Rest up tonight, get adequate sleep, and prepare to hit{' '}
                  <span className="text-[#30D158] font-semibold">{tomorrowRoutine.title}</span> with high energy tomorrow!
                </>
              ) : (
                <>
                  <strong className="text-white">Guideline:</strong> Today was an active recovery day, meaning your muscle glycogen and energy stores are replenished. Tomorrow is game day for{' '}
                  <span className="text-[#30D158] font-semibold">{tomorrowRoutine.title}</span>. Lay out your workout gear tonight!
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDayClick(tomorrowStr)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] text-black text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow"
              >
                <span>View Tomorrow&apos;s Movements</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('workouts')}
                  className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                >
                  Workouts Tab
                </button>
              )}
            </div>
          </div>
        ) : isTomorrowRest ? (
          /* CASE 2: Tomorrow is an Active Recovery / Rest Day */
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#0A84FF]/15 via-[#1C1C1E] to-[#121214] border border-[#0A84FF]/35 shadow-lg shadow-blue-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#0A84FF] text-white">
                Tomorrow: Rest & Recovery Day
              </span>
              <span className="text-xs text-sky-400 font-semibold flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-[#0A84FF]" />
                Muscle Rebuilding
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                Programmed Active Recovery Day
              </h3>
              <p className="text-xs text-sky-400 font-medium mt-0.5">
                No workout routines scheduled for {tomorrowDayName}
              </p>
            </div>

            {/* Coaching advice */}
            <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] text-xs text-zinc-300 leading-relaxed">
              {todayHasWorkout ? (
                <>
                  <strong className="text-white">Guideline:</strong> Great effort logging today&apos;s workout! Muscles adapt and grow during rest, not during training. Keep tomorrow strictly for active recovery: light 20-min walking, mobility stretches, and hitting your protein goal.
                </>
              ) : (
                <>
                  <strong className="text-white">Guideline:</strong> Tomorrow continues your recovery cycle. Keep your body mobile with light stretching.
                  {nextScheduled && (
                    <span> Your next scheduled workout will be <span className="text-[#30D158] font-semibold">{nextScheduled.routine.title}</span> on <strong>{nextScheduled.dayName}</strong> ({nextScheduled.dateFormatted}).</span>
                  )}
                </>
              )}
            </div>

            {/* Recovery Checklist */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
              <div className="p-2 rounded-xl bg-black/30 border border-white/[0.05] flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
                <span>2.5L+ Water intake</span>
              </div>
              <div className="p-2 rounded-xl bg-black/30 border border-white/[0.05] flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                <span>Hit {goals?.protein_target || 140}g protein</span>
              </div>
              <div className="p-2 rounded-xl bg-black/30 border border-white/[0.05] flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span>15m Light mobility walk</span>
              </div>
              <div className="p-2 rounded-xl bg-black/30 border border-white/[0.05] flex items-center gap-2">
                <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>7–8 Hours deep sleep</span>
              </div>
            </div>

            {nextScheduled && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleDayClick(nextScheduled.dateStr)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#0A84FF]/20 hover:bg-[#0A84FF]/30 text-sky-200 border border-[#0A84FF]/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Next Workout: {nextScheduled.routine.title} ({nextScheduled.dayName})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* CASE 3: No workout routines created yet */
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#FF9500]/15 via-[#1C1C1E] to-[#121214] border border-[#FF9500]/30 space-y-3">
            <div className="flex items-center gap-2 text-[#FF9500]">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">No Workout Routine Created</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              You haven&apos;t set up any workout routines yet. Create or paste your routine in the Workouts tab to get automated daily workout vs rest guidelines on your calendar!
            </p>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('workouts')}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FF9500] hover:bg-[#E08500] text-black text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Build or Paste AI Routine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 2: MONTHLY CALENDAR WITH CLEAR STATUS CIRCLES ── */}
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
              aria-label="Previous Month"
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
              aria-label="Next Month"
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
            const matchingRoutine = routines.find((r) =>
              r.days.map((x) => x.toLowerCase()).includes(dayName.toLowerCase())
            );
            const hasRoutineScheduled = Boolean(matchingRoutine);
            const isRest = routines.length > 0 && !hasRoutineScheduled;

            // Highlight circle styling
            let circleStyle = 'text-zinc-400 hover:bg-white/5';
            let dotIndicator: React.ReactNode = null;
            let tooltipText = `${dayName}, ${monthName.split(' ')[0]} ${dayNum}`;

            if (hasWorkout && hasMeal) {
              circleStyle = 'bg-gradient-to-tr from-[#30D158] to-[#FF9500] text-black font-extrabold shadow-sm shadow-emerald-500/20 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-black/80 mt-0.5" />;
              tooltipText += ' · Workout & Meals Logged';
            } else if (hasWorkout) {
              circleStyle = 'bg-[#30D158] text-black font-extrabold shadow-sm shadow-emerald-500/20 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-black/80 mt-0.5" />;
              tooltipText += ' · Workout Completed';
            } else if (hasMeal) {
              circleStyle = 'bg-[#FF9500] text-black font-extrabold shadow-sm shadow-orange-500/20 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-black/80 mt-0.5" />;
              tooltipText += ' · Meal Logged';
            } else if (hasRoutineScheduled) {
              // Scheduled workout day pending or upcoming
              circleStyle = 'border-2 border-[#30D158]/60 bg-[#30D158]/10 text-white font-bold hover:bg-[#30D158]/20 active:scale-95';
              dotIndicator = <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] mt-0.5" />;
              tooltipText += matchingRoutine ? ` · Scheduled: ${matchingRoutine.title}` : ' · Scheduled Workout';
            } else if (isRest) {
              // Programmed rest day
              circleStyle = 'border border-[#0A84FF]/30 bg-[#0A84FF]/5 text-sky-200/90 hover:bg-[#0A84FF]/15 active:scale-95';
              dotIndicator = <span className="w-1 h-1 rounded-full bg-[#0A84FF]/60 mt-0.5" />;
              tooltipText += ' · Rest & Recovery Day';
            }

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(dateStr)}
                title={tooltipText}
                className={`relative h-9 rounded-xl flex flex-col items-center justify-center text-xs transition-all cursor-pointer ${circleStyle} ${
                  isToday
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1C1C1E] z-10 font-black'
                    : ''
                }`}
              >
                <span className="leading-none text-[11px]">{dayNum}</span>
                {dotIndicator}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between text-[10px] text-zinc-400 gap-y-2 gap-x-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30D158]" />
              <span>Workout Done</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />
              <span>Meal Logged</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-[#30D158] bg-[#30D158]/20" />
              <span>Scheduled Routine</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-[#0A84FF]/50 bg-[#0A84FF]/15" />
              <span>Rest Day</span>
            </span>
          </div>
          <span className="text-zinc-500 font-medium text-[10px]">Tap any day for details ›</span>
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
