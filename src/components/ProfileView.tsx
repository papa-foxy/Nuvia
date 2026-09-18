'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Dumbbell,
  Flame,
  Utensils,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
  Heart,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { Meal, ExerciseLog, DailySummary } from '@/types/database';
import { WorkoutRoutine } from '@/types/routine';
import { MacroDonutChart } from './MacroDonutChart';
import { BodyMuscleMap } from './BodyMuscleMap';

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

  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const today = new Date();
  const todayStr = getLocalDateString(today);

  // Load profile data
  useEffect(() => {
    async function loadData() {
      const [s, m, e, r] = await Promise.all([
        DataService.getDailySummary(user?.id, todayStr),
        DataService.getMeals(user?.id, todayStr),
        DataService.getExerciseLogs(user?.id, todayStr),
        DataService.getWorkoutRoutines(user?.id),
      ]);
      setSummary(s);
      setMeals(m);
      setExercises(e);
      setRoutines(r);
    }
    loadData();
  }, [user, todayStr]);

  // Generate 7-day schedule for the current week (Monday - Sunday)
  const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distanceToMonday);

  const weekSchedule = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const dateStr = getLocalDateString(d);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });
    const isToday = dateStr === todayStr;

    // Check matching routine
    const matchedRoutine = routines.find((r) =>
      r.days.map((day) => day.toLowerCase()).includes(dayName.toLowerCase())
    );

    const isRest = !matchedRoutine;

    // Target muscles for routine
    let targetMuscles: string[] = [];
    if (matchedRoutine) {
      const focus = (matchedRoutine.focus || '').toLowerCase();
      if (focus.includes('upper')) {
        targetMuscles = ['chest', 'shoulders', 'triceps', 'biceps', 'back'];
      } else if (focus.includes('abs') || focus.includes('core')) {
        targetMuscles = ['abs'];
      } else if (focus.includes('leg')) {
        targetMuscles = ['quads', 'hamstrings', 'calves'];
      } else {
        targetMuscles = ['chest', 'abs', 'shoulders'];
      }
    }

    return {
      index: idx,
      date: d,
      dateStr,
      dayName,
      shortDay,
      dayNumber: d.getDate(),
      isToday,
      isRest,
      routine: matchedRoutine || null,
      targetMuscles,
    };
  });

  // Default selected day to Today
  useEffect(() => {
    const todayIdx = weekSchedule.findIndex((w) => w.isToday);
    if (todayIdx >= 0) {
      setSelectedDayIndex(todayIdx);
    }
  }, [routines]);

  const selectedDay = weekSchedule[selectedDayIndex] || weekSchedule[0];

  // If selected day has routine, use those muscles, else check today's logged exercises
  const activeWorkedMuscles = selectedDay.targetMuscles.length > 0
    ? selectedDay.targetMuscles
    : exercises.flatMap((ex) => {
        const desc = (ex.description || '').toLowerCase();
        const muscles: string[] = [];
        if (desc.includes('push') || desc.includes('chest')) muscles.push('chest');
        if (desc.includes('shoulder') || desc.includes('press')) muscles.push('shoulders');
        if (desc.includes('abs') || desc.includes('crunch') || desc.includes('plank')) muscles.push('abs');
        if (desc.includes('bicep') || desc.includes('curl')) muscles.push('biceps');
        if (desc.includes('tricep')) muscles.push('triceps');
        return muscles;
      });

  const calorieTarget = goals?.calorie_target || 2200;
  const proteinTarget = goals?.protein_target || 150;
  const carbsTarget = goals?.carbohydrate_target || 250;
  const fatTarget = goals?.fat_target || 70;

  const caloriesConsumed = summary?.calories_consumed || 0;
  const proteinConsumed = summary?.protein_consumed || 0;
  const carbsConsumed = summary?.carbohydrate_consumed || 0;
  const fatConsumed = summary?.fat_consumed || 0;
  const exerciseMinutes = summary?.exercise_minutes || 0;

  const avatarUrl = user?.avatar_url;
  const displayName = profile?.name || user?.full_name || user?.email?.split('@')[0] || 'Member';

  return (
    <div className="flex-1 flex flex-col pb-24 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
          Account & Training
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
          Profile
        </h1>
      </div>

      {/* USER HEADER CARD (With Google Profile Photo) */}
      <div className="ios-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          {/* Profile Photo with Google Picture support */}
          <div className="relative">
            {avatarUrl && !imgError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#30D158]/40 shadow-md shadow-emerald-500/20"
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
              Active Pro Member
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

      {/* SECTION 1: NUTRITION DONUT CHART & ACTIVITY RINGS */}
      <MacroDonutChart
        calories={caloriesConsumed}
        calorieTarget={calorieTarget}
        protein={proteinConsumed}
        proteinTarget={proteinTarget}
        carbs={carbsConsumed}
        carbsTarget={carbsTarget}
        fat={fatConsumed}
        fatTarget={fatTarget}
        exerciseMinutes={exerciseMinutes}
        exerciseTarget={45}
      />

      {/* SECTION 2: INTERACTIVE SCHEDULE CALENDAR (Workout vs Rest) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Training Schedule
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Weekly Routine & Rest Planner
            </p>
          </div>
          <span className="text-xs text-zinc-400">
            {today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* 7-Day Interactive Schedule Strip */}
        <div className="grid grid-cols-7 gap-1.5">
          {weekSchedule.map((day) => {
            const isSelected = selectedDayIndex === day.index;

            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDayIndex(day.index)}
                className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'ring-2 ring-white bg-white/15 shadow-md'
                    : day.isToday
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-[#1C1C1E] border border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <span className={`text-[10px] font-semibold ${day.isToday ? 'text-white' : 'text-zinc-500'}`}>
                  {day.shortDay}
                </span>
                <span className="text-xs font-bold text-white mt-0.5">
                  {day.dayNumber}
                </span>

                {/* Status Dot / Tag */}
                <div className="mt-1.5">
                  {day.isRest ? (
                    <span className="w-2 h-2 rounded-full bg-[#0A84FF] inline-block shadow-sm shadow-blue-500/50" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#30D158] inline-block shadow-sm shadow-emerald-500/50" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Schedule Detail Card */}
        <div className="ios-card p-4 space-y-3 border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  selectedDay.isRest
                    ? 'bg-[#0A84FF]/20 text-[#0A84FF]'
                    : 'bg-[#30D158]/20 text-[#30D158]'
                }`}
              >
                {selectedDay.isRest ? (
                  <Heart className="w-4 h-4" />
                ) : (
                  <Dumbbell className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  {selectedDay.dayName} {selectedDay.isToday && '• Today'}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {selectedDay.isRest
                    ? 'Active Recovery & Rest Day'
                    : selectedDay.routine?.title || 'Scheduled Workout'}
                </p>
              </div>
            </div>

            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                selectedDay.isRest
                  ? 'bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30'
                  : 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
              }`}
            >
              {selectedDay.isRest ? 'Rest & Rebuild' : 'Workout Day'}
            </span>
          </div>

          {/* Routine Exercises or Recovery Guidance */}
          {selectedDay.routine ? (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Prescribed Exercises ({selectedDay.routine.exercises.length})
              </span>
              <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedDay.routine.exercises.map((ex, i) => (
                  <div
                    key={ex.id || i}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                        {i + 1}
                      </span>
                      <span className="text-white font-medium truncate max-w-[200px]">
                        {ex.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {ex.sets} × {ex.reps}
                    </span>
                  </div>
                ))}
              </div>

              {selectedDay.isToday && onOpenAddExercise && (
                <button
                  onClick={onOpenAddExercise}
                  className="w-full mt-2 py-2 rounded-xl bg-[#30D158] hover:bg-[#30D158]/90 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98] shadow-md shadow-emerald-500/20"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Log This Workout Now
                </button>
              )}
            </div>
          ) : (
            <div className="pt-2 border-t border-white/5 text-xs text-zinc-400 leading-relaxed">
              <p>
                🧘 <strong className="text-white">Active Recovery Day:</strong> Focus on hydration, mobility stretching, and restful sleep to allow muscle fibers to repair and grow stronger.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: VISUAL BODY MUSCLE ACTIVATION MAP */}
      <BodyMuscleMap
        workedMuscles={activeWorkedMuscles}
        routineTitle={
          selectedDay.routine
            ? `${selectedDay.routine.focus} Activation`
            : 'Active Muscles'
        }
      />

      {/* SECTION 4: LOGGED MEALS BREAKDOWN (Detailed View) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Nutrition Logs
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Today’s Logged Meals ({meals.length})
            </p>
          </div>
          {onOpenAddMeal && (
            <button
              onClick={onOpenAddMeal}
              className="text-xs text-[#30D158] hover:underline font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Meal
            </button>
          )}
        </div>

        {meals.length === 0 ? (
          <div className="ios-card p-6 text-center space-y-3 border border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-zinc-400">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">No meals logged yet today</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Snap food with your camera or type naturally to see instant macro breakdowns.
              </p>
            </div>
            {onOpenAddMeal && (
              <button
                onClick={onOpenAddMeal}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Log First Meal
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {meals.map((m) => {
              const isExpanded = expandedMealId === m.id;

              return (
                <div
                  key={m.id}
                  className="ios-card overflow-hidden border border-white/5 transition-all"
                >
                  <div
                    onClick={() => setExpandedMealId(isExpanded ? null : m.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      {/* Meal thumbnail or type icon */}
                      {m.image_url ? (
                        <img
                          src={m.image_url}
                          alt={m.description || 'Meal'}
                          className="w-10 h-10 rounded-xl object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
                          <Utensils className="w-4 h-4 text-[#FF9500]" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white capitalize">
                            {m.meal_type}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(m.meal_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-0.5 line-clamp-1 max-w-[180px]">
                          {m.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <span className="text-sm font-bold text-white block">
                          {m.calories} <span className="text-[10px] text-zinc-400 font-normal">kcal</span>
                        </span>
                        <span className="text-[10px] text-[#30D158] font-medium block">
                          {m.protein_g}g protein
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Items & Full Macros */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-white/5 space-y-2.5 bg-black/20 text-xs">
                      {/* Macro chips */}
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[10px] text-zinc-400 block">Carbs</span>
                          <span className="text-xs font-bold text-[#FF9500]">{m.carbs_g}g</span>
                        </div>
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[10px] text-zinc-400 block">Protein</span>
                          <span className="text-xs font-bold text-[#30D158]">{m.protein_g}g</span>
                        </div>
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[10px] text-zinc-400 block">Fat</span>
                          <span className="text-xs font-bold text-[#FF375F]">{m.fat_g}g</span>
                        </div>
                      </div>

                      {/* Items list */}
                      {m.items && m.items.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Detected Food Items ({m.items.length})
                          </span>
                          {m.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0"
                            >
                              <span className="text-zinc-300">
                                {it.name} {it.estimated_quantity ? `(${it.estimated_quantity} ${it.estimated_unit || ''})` : ''}
                              </span>
                              <span className="font-medium text-white font-mono">
                                {it.calories} kcal
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 5: HEALTH DETAILS GROUP */}
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

      {/* SECTION 6: ACCOUNT SESSION CONTROLS */}
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
    </div>
  );
}
