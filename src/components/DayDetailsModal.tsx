'use client';

import React, { useState, useRef } from 'react';
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
  Moon,
  Droplets,
} from 'lucide-react';
import { Meal, ExerciseLog, DailySummary } from '@/types/database';
import { WorkoutRoutine } from '@/types/routine';
import { BodyMuscleMap } from './BodyMuscleMap';
import { ExerciseThumbnail } from './ExerciseThumbnail';

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
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const startYRef = React.useRef(0);
  const currentDragYRef = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Keep ref synchronized with state for event handlers
  currentDragYRef.current = dragY;
  // Ref mirror of isDragging to avoid async state lag causing over-scroll jump
  const isDraggingRef = useRef(false);


  // Lock body scroll while modal is open to prevent background page from scrolling
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  // Trigger smooth entrance slide-up animation when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setIsEntering(true);
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);

      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);


  const triggerClose = () => {
    setIsClosing(true);
    setIsDragging(false);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setDragY(0);
    }, 220);
  };

  const handleTouchStart = (e: React.TouchEvent, fromHeader = false) => {
    // Only allow drag-down if content is at top or if initiating from header/handle
    if (!fromHeader && scrollRef.current && scrollRef.current.scrollTop > 5) return;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent, fromHeader = false) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startYRef.current;

    if (delta > 0) {
      setDragY(delta);
    } else {
      // Swiping up inside scrollable content — cancel sheet drag, let native scroll work
      if (!fromHeader) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragY(0);
      } else {
        setDragY(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (currentDragYRef.current > 80) {
      triggerClose();
    } else {
      setDragY(0);
    }
  };


  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    setIsDragging(true);
  };

  // Window-level mouse listener for smooth desktop drag-down
  React.useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      if (delta > 0) {
        setDragY(delta);
      } else {
        setDragY(0);
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (currentDragYRef.current > 80) {
        triggerClose();
      } else {
        setDragY(0);
      }
    };


    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  // Format date display
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const hasExercises = exercises.length > 0;
  const exerciseNames = exercises.map((e) => (e as any).exercise_name || e.exercise_type || e.description || 'Exercise');

  let targetMuscles = Array.from(
    new Set(
      exercises
        .map((e) => (e as any).target_muscle || (e as any).muscle_group)
        .filter(Boolean)
    )
  );

  if (targetMuscles.length === 0) {
    if (hasExercises) {
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
      targetMuscles = Array.from(new Set(exercisedMuscles));
      if (targetMuscles.length === 0) {
        targetMuscles = ['chest', 'abs', 'shoulders'];
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
  }

  return (
    <>
      {/* Backdrop: bounded above bottom navigation */}
      <div
        onClick={triggerClose}
        className={`fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-200 cursor-pointer ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
        }}
        aria-hidden="true"
      />

      {/* Sheet / Modal Container: sits above backdrop (z-45) directly on top of nav */}
      <div
        className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: isClosing
              ? 'translateY(100%)'
              : isEntering
              ? 'translateY(100%)'
              : `translateY(${dragY}px)`,
            transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="pointer-events-auto relative z-10 w-full max-w-md bg-[#1C1C1E] border-t border-x border-b-0 border-white/10 rounded-t-[28px] rounded-b-none max-h-[calc(100dvh-var(--bottom-nav-height,56px)-env(safe-area-inset-bottom,0px)-1rem)] flex flex-col shadow-2xl overflow-hidden will-change-transform"
        >
        {/* iOS Drag Handle */}
        <div
          onTouchStart={(e) => handleTouchStart(e, true)}
          onTouchMove={(e) => handleTouchMove(e, true)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className="flex flex-col items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing w-full touch-none select-none hover:bg-white/[0.02] transition-colors"
        >
          <div className="w-12 h-1.5 rounded-full bg-white/30 hover:bg-white/50 transition-colors" />
        </div>

        {/* Modal Top Header */}
        <div
          onTouchStart={(e) => handleTouchStart(e, true)}
          onTouchMove={(e) => handleTouchMove(e, true)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between px-5 py-2.5 border-b border-white/5 cursor-grab active:cursor-grabbing touch-none select-none"
        >
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
            onClick={triggerClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          ref={scrollRef}
          onTouchStart={(e) => handleTouchStart(e, false)}
          onTouchMove={(e) => handleTouchMove(e, false)}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto px-5 py-4 pb-6 sm:pb-8 space-y-4 overscroll-contain"
        >
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

          {/* SCHEDULED ROUTINE MOVEMENTS (If day has routine prescribed & not completed yet) */}
          {routine && !hasExercises && (
            <div className="ios-card p-4 space-y-3 border border-[#30D158]/25 bg-gradient-to-br from-[#30D158]/10 via-[#1C1C1E] to-[#121214]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#30D158]/20 text-[#30D158] flex items-center justify-center">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{routine.title}</h4>
                    <p className="text-[11px] text-[#30D158]">
                      {routine.focus || 'Training'} · {routine.exercises.length} movements
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158] text-black">
                  Scheduled
                </span>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-white">Guideline:</strong> This day is programmed for strength training. Complete your movements with controlled tempo and rest 60–90 seconds between sets.
              </p>

              {/* Exercises List */}
              <div className="space-y-1.5 pt-1">
                {routine.exercises.map((ex, idx) => (
                  <div
                    key={ex.id || idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/60 shrink-0 border border-white/10">
                        <ExerciseThumbnail exercise={ex} aspectRatio="1/1" className="w-full h-full" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate text-xs">{ex.name}</p>
                        <p className="text-[10px] text-[#8E8E93] truncate">{ex.target_muscle}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#30D158] shrink-0 ml-2">
                      {ex.sets} × {ex.reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REST DAY GUIDELINE (If no workout routine scheduled & no workout logged) */}
          {!routine && !hasExercises && (
            <div className="ios-card p-4 space-y-2.5 border border-[#0A84FF]/25 bg-gradient-to-br from-[#0A84FF]/10 via-[#1C1C1E] to-[#121214]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#0A84FF]">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Rest & Recovery Guideline</span>
                </div>
                <span className="text-[10px] font-semibold text-sky-400 px-2 py-0.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/20">
                  Active Recovery
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                No workout routine is scheduled for this day. Muscles rebuild and strengthen during recovery. Prioritize hydration, adequate protein intake, light walking, and 7–8 hours of restorative sleep.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-zinc-300">
                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
                  <span>2.5L+ Hydration</span>
                </div>
                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                  <span>Protein synthesis</span>
                </div>
                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Light 15m walk</span>
                </div>
                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>7–8h Deep sleep</span>
                </div>
              </div>
            </div>
          )}

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
                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">
                              <Utensils className="w-3.5 h-3.5 text-zinc-400" />
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
                              <span className="text-xs font-semibold text-white">{m.carbs_g}g</span>
                            </div>
                            <div className="bg-white/5 p-1 rounded-lg">
                              <span className="text-[9px] text-zinc-400 block">Protein</span>
                              <span className="text-xs font-semibold text-white">{m.protein_g}g</span>
                            </div>
                            <div className="bg-white/5 p-1 rounded-lg">
                              <span className="text-[9px] text-zinc-400 block">Fat</span>
                              <span className="text-xs font-semibold text-white">{m.fat_g}g</span>
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
    </>
  );
}
