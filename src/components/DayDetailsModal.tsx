'use client';

import React, { useState } from 'react';
import {
  X,
  Dumbbell,
  Utensils,
  Flame,
  Heart,
  Zap,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Meal, ExerciseLog, DailySummary } from '@/types/database';
import { WorkoutRoutine } from '@/types/routine';
import { BodyMuscleMap } from './BodyMuscleMap';

interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string; // YYYY-MM-DD
  summary: DailySummary | null;
  meals: Meal[];
  exercises: ExerciseLog[];
  routine: WorkoutRoutine | null;
  isToday: boolean;
  onOpenAddMeal?: () => void;
  onOpenAddExercise?: () => void;
}

export function DayDetailsModal({
  isOpen,
  onClose,
  dateStr,
  summary,
  meals,
  exercises,
  routine,
  isToday,
  onOpenAddMeal,
  onOpenAddExercise,
}: DayDetailsModalProps) {
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  if (!isOpen) return null;

  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const hasExercises = exercises.length > 0;

  // Extract worked muscles from logged exercises
  const exercisedMuscles = exercises.flatMap((ex) => {
    const desc = `${ex.exercise_type} ${ex.description || ''}`.toLowerCase();
    const list: string[] = [];
    if (desc.includes('push') || desc.includes('chest') || desc.includes('bench')) list.push('chest');
    if (desc.includes('shoulder') || desc.includes('press') || desc.includes('lateral')) list.push('shoulders');
    if (desc.includes('abs') || desc.includes('crunch') || desc.includes('plank') || desc.includes('twist') || desc.includes('knee raise') || desc.includes('core')) list.push('abs');
    if (desc.includes('bicep') || desc.includes('curl')) list.push('biceps');
    if (desc.includes('tricep')) list.push('triceps');
    if (desc.includes('back') || desc.includes('row') || desc.includes('pull')) list.push('back');
    if (desc.includes('leg') || desc.includes('squat') || desc.includes('lunge')) list.push('quads');
    return list;
  });

  let targetMuscles: string[] = [];
  if (hasExercises) {
    targetMuscles = Array.from(new Set(exercisedMuscles));
    if (targetMuscles.length === 0) {
      targetMuscles = ['chest', 'abs', 'shoulders']; // Default pump
    }
  } else if (routine) {
    const focus = (routine.focus || '').toLowerCase();
    if (focus.includes('upper')) {
      targetMuscles = ['chest', 'shoulders', 'triceps', 'biceps', 'back'];
    } else if (focus.includes('abs') || focus.includes('core')) {
      targetMuscles = ['abs'];
    } else if (focus.includes('leg')) {
      targetMuscles = ['quads', 'hamstrings', 'calves'];
    }
  }

  const exerciseNames = exercises.map((e) => e.exercise_type || e.description || 'Exercise');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Sheet */}
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl z-10">
        {/* Grab Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
              <Calendar className="w-4 h-4 text-[#30D158]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Day Details</h2>
              <p className="text-[11px] text-[#8E8E93]">{formattedDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Status Banner */}
          <div className="ios-card p-4 space-y-3 border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    hasExercises
                      ? 'bg-[#30D158]/20 text-[#30D158]'
                      : routine
                      ? 'bg-[#FF9500]/20 text-[#FF9500]'
                      : 'bg-[#0A84FF]/20 text-[#0A84FF]'
                  }`}
                >
                  {hasExercises ? (
                    <Dumbbell className="w-5 h-5" />
                  ) : routine ? (
                    <Zap className="w-5 h-5" />
                  ) : (
                    <Heart className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {hasExercises
                      ? `Workout Logged (${exercises.length} ${exercises.length === 1 ? 'Exercise' : 'Exercises'})`
                      : routine
                      ? `Scheduled: ${routine.title}`
                      : 'Active Recovery & Rest Day'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {isToday ? 'Today' : formattedDate}
                  </p>
                </div>
              </div>

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  hasExercises
                    ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
                    : routine
                    ? 'bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30'
                    : 'bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30'
                }`}
              >
                {hasExercises ? 'Completed' : routine ? 'Prescribed' : 'Rest Day'}
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-black/30 rounded-xl p-2 text-center border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Intake</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {summary?.calories_consumed || 0} <span className="text-[9px] font-normal text-zinc-400">kcal</span>
                </span>
              </div>
              <div className="bg-black/30 rounded-xl p-2 text-center border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Burned</span>
                <span className="text-sm font-bold text-[#FF9500] mt-0.5 block">
                  {summary?.calories_burned || 0} <span className="text-[9px] font-normal text-zinc-400">kcal</span>
                </span>
              </div>
              <div className="bg-black/30 rounded-xl p-2 text-center border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Protein</span>
                <span className="text-sm font-bold text-[#30D158] mt-0.5 block">
                  {summary?.protein_consumed || 0} <span className="text-[9px] font-normal text-zinc-400">g</span>
                </span>
              </div>
            </div>
          </div>

          {/* MUSCLE ACTIVATION PUMP HEATMAP */}
          <BodyMuscleMap
            workedMuscles={targetMuscles}
            isPumpActive={hasExercises}
            exercisesPerformed={exerciseNames}
            routineTitle={
              hasExercises
                ? `Muscle Pump (${targetMuscles.join(', ')})`
                : routine
                ? `Target Muscles: ${routine.focus}`
                : 'Muscles In Rest & Recovery'
            }
          />

          {/* LOGGED MEALS ON THIS SPECIFIC DAY */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                Meals Logged ({meals.length})
              </span>
              {isToday && onOpenAddMeal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAddMeal();
                  }}
                  className="text-xs text-[#30D158] hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Meal
                </button>
              )}
            </div>

            {meals.length === 0 ? (
              <div className="ios-card p-4 text-center space-y-1.5 border border-white/5">
                <Utensils className="w-5 h-5 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-400">
                  {isToday ? 'No meals logged yet today.' : 'No meal records logged for this day.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {meals.map((m) => {
                  const isExpanded = expandedMealId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="ios-card overflow-hidden border border-white/5"
                    >
                      <div
                        onClick={() => setExpandedMealId(isExpanded ? null : m.id)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-2.5">
                          {m.image_url ? (
                            <img
                              src={m.image_url}
                              alt={m.description || 'Meal'}
                              className="w-9 h-9 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white">
                              <Utensils className="w-3.5 h-3.5 text-[#FF9500]" />
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white capitalize">
                                {m.meal_type}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono">
                                {new Date(m.meal_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 line-clamp-1 max-w-[170px]">
                              {m.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {m.calories} <span className="text-[9px] text-zinc-400 font-normal">kcal</span>
                            </span>
                            <span className="text-[10px] text-[#30D158] font-medium block">
                              {m.protein_g}g protein
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t border-white/5 space-y-2 bg-black/20 text-xs">
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div className="bg-white/5 p-1 rounded-lg">
                              <span className="text-[9px] text-zinc-400 block">Carbs</span>
                              <span className="text-xs font-bold text-[#FF9500]">{m.carbs_g}g</span>
                            </div>
                            <div className="bg-white/5 p-1 rounded-lg">
                              <span className="text-[9px] text-zinc-400 block">Protein</span>
                              <span className="text-xs font-bold text-[#30D158]">{m.protein_g}g</span>
                            </div>
                            <div className="bg-white/5 p-1 rounded-lg">
                              <span className="text-[9px] text-zinc-400 block">Fat</span>
                              <span className="text-xs font-bold text-[#FF375F]">{m.fat_g}g</span>
                            </div>
                          </div>

                          {m.items && m.items.length > 0 && (
                            <div className="space-y-0.5 pt-1">
                              {m.items.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between py-0.5 text-[11px]"
                                >
                                  <span className="text-zinc-300">
                                    {it.name} {it.estimated_quantity ? `(${it.estimated_quantity} ${it.estimated_unit || ''})` : ''}
                                  </span>
                                  <span className="font-mono text-white">{it.calories} kcal</span>
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
        </div>
      </div>
    </div>
  );
}
