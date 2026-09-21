'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  Utensils,
  Camera,
  Sparkles,
  Edit3,
  Calendar,
  Clock,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import { Meal } from '@/types/database';

interface MealDetailsModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (mealId: string) => Promise<void> | void;
}

export function MealDetailsModal({
  meal,
  isOpen,
  onClose,
  onDelete,
}: MealDetailsModalProps) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const startYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  currentDragYRef.current = dragY;
  // Use a ref alongside isDragging state so touch handlers always read the live value
  // (state updates are async and can cause the over-scroll jump bug)
  const isDraggingRef = useRef(false);


  // Lock body scroll while modal is open to prevent background page from scrolling
  useEffect(() => {
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
  useEffect(() => {
    if (isOpen) {
      setIsEntering(true);
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
      setDeleting(false);

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
      // Swiping up inside scrollable area — cancel sheet drag, let native scroll work
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

  // Window-level mouse move & up listeners for smooth desktop drag-down
  useEffect(() => {
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


  if (!isOpen || !meal) return null;

  const mealDate = new Date(meal.meal_time);
  const formattedDate = mealDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = mealDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const calories = Number(meal.calories) || 0;
  const protein = Number(meal.protein_g) || 0;
  const carbs = Number(meal.carbs_g) || 0;
  const fat = Number(meal.fat_g) || 0;

  // Calorie calculations from macros: Protein=4, Carbs=4, Fat=9
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const macroCalsSum = proteinCals + carbsCals + fatCals || 1;

  const proteinPct = Math.round((proteinCals / macroCalsSum) * 100);
  const carbsPct = Math.round((carbsCals / macroCalsSum) * 100);
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

  // Source metadata badge
  const sourceLabel =
    meal.source === 'photo'
      ? 'Camera AI Scan'
      : meal.source === 'text'
      ? 'AI Natural Language'
      : meal.source === 'routine'
      ? 'Routine Plan'
      : 'Manual Entry';

  const sourceIcon =
    meal.source === 'photo' ? (
      <Camera className="w-3 h-3 text-[#30D158]" />
    ) : meal.source === 'text' ? (
      <Sparkles className="w-3 h-3 text-[#0A84FF]" />
    ) : (
      <Edit3 className="w-3 h-3 text-[#8E8E93]" />
    );

  const mealTypeColor =
    meal.meal_type === 'breakfast'
      ? 'bg-[#FF9500]/20 text-[#FF9500] border-[#FF9500]/30'
      : meal.meal_type === 'lunch'
      ? 'bg-[#30D158]/20 text-[#30D158] border-[#30D158]/30'
      : meal.meal_type === 'dinner'
      ? 'bg-[#0A84FF]/20 text-[#0A84FF] border-[#0A84FF]/30'
      : 'bg-[#BF5AF2]/20 text-[#BF5AF2] border-[#BF5AF2]/30';

  const handleDelete = async () => {
    if (!onDelete) return;
    if (confirm(`Delete "${meal.description || 'this meal'}"?`)) {
      setDeleting(true);
      await onDelete(meal.id);
      setDeleting(false);
      triggerClose();
    }
  };

  return (
    <>
      {/* Backdrop: bounded above bottom navigation */}
      <div
        className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity"
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
          opacity: isClosing || isEntering ? 0 : Math.max(0.1, 1 - dragY / 300),
          transitionDuration: isDragging ? '0ms' : isEntering ? '320ms' : '220ms',
        }}
        onClick={triggerClose}
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
            transform: isClosing || isEntering
              ? 'translateY(100%)'
              : `translateY(${dragY}px)`,
            transition: isDragging
              ? 'none'
              : isEntering
              ? 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
          className="pointer-events-auto relative w-full max-w-md bg-[#161618] border-t border-x border-b-0 border-white/10 rounded-t-[28px] rounded-b-none max-h-[calc(100dvh-var(--bottom-nav-height,56px)-env(safe-area-inset-bottom,0px)-1rem)] flex flex-col overflow-hidden shadow-2xl z-10 select-none sm:select-auto will-change-transform"
        >
        {/* Grab Handle */}
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
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${mealTypeColor}`}
            >
              {meal.meal_type}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-[#8E8E93]">
              <Clock className="w-3 h-3" />
              <span>{formattedTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8E8E93] hover:text-[#FF453A] transition-colors cursor-pointer"
                title="Delete meal"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={triggerClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div
          ref={scrollRef}
          onTouchStart={(e) => handleTouchStart(e, false)}
          onTouchMove={(e) => handleTouchMove(e, false)}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto px-5 py-4 pb-6 sm:pb-8 space-y-4 overscroll-contain"
        >
          {/* Meal Photo or Aesthetic Hero Header */}
          {meal.image_url ? (
            <div className="relative w-full h-52 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
              <img
                src={meal.image_url}
                alt={meal.description || 'Meal photo'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <h3 className="text-base font-bold text-white leading-tight drop-shadow-md">
                    {meal.description || 'Logged Meal'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-300">
                    <Calendar className="w-3 h-3 text-[#30D158]" />
                    <span>{formattedDate}</span>
                  </div>
                </div>
                <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-[11px] text-zinc-200">
                  {sourceIcon}
                  <span>{sourceLabel}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="ios-card p-4 space-y-2 border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#FF9500]">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      {meal.description || 'Logged Meal'}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-[#8E8E93] mt-0.5">
                      <Calendar className="w-3 h-3 text-[#30D158]" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-[10px] text-zinc-300">
                  {sourceIcon}
                  <span>{sourceLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Nutrition Cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="ios-card p-3 border border-white/10">
              <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                Calories
              </span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {calories}
              </span>
              <span className="text-[9px] text-[#8E8E93]">kcal</span>
            </div>

            <div className="ios-card p-3 border border-white/10">
              <span className="text-[10px] font-semibold text-[#30D158] uppercase tracking-wider block">
                Protein
              </span>
              <span className="text-lg font-bold text-[#30D158] mt-0.5 block">
                {protein}
              </span>
              <span className="text-[9px] text-[#8E8E93]">g ({proteinPct}%)</span>
            </div>

            <div className="ios-card p-3 border border-white/10">
              <span className="text-[10px] font-semibold text-[#FF9500] uppercase tracking-wider block">
                Carbs
              </span>
              <span className="text-lg font-bold text-[#FF9500] mt-0.5 block">
                {carbs}
              </span>
              <span className="text-[9px] text-[#8E8E93]">g ({carbsPct}%)</span>
            </div>

            <div className="ios-card p-3 border border-white/10">
              <span className="text-[10px] font-semibold text-[#FF375F] uppercase tracking-wider block">
                Fat
              </span>
              <span className="text-lg font-bold text-[#FF375F] mt-0.5 block">
                {fat}
              </span>
              <span className="text-[9px] text-[#8E8E93]">g ({fatPct}%)</span>
            </div>
          </div>

          {/* Macro Calorie Distribution Progress Bar */}
          <div className="ios-card p-3.5 space-y-2 border border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8E8E93] flex items-center gap-1.5 font-medium">
                <PieChart className="w-3.5 h-3.5 text-[#30D158]" />
                Macro Calorie Split
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {calories} total kcal
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full overflow-hidden bg-white/10 flex gap-0.5">
              <div
                style={{ width: `${proteinPct}%` }}
                className="bg-[#30D158] h-full transition-all duration-300"
                title={`Protein ${proteinPct}%`}
              />
              <div
                style={{ width: `${carbsPct}%` }}
                className="bg-[#FF9500] h-full transition-all duration-300"
                title={`Carbs ${carbsPct}%`}
              />
              <div
                style={{ width: `${fatPct}%` }}
                className="bg-[#FF375F] h-full transition-all duration-300"
                title={`Fat ${fatPct}%`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#30D158]" />
                Protein {proteinPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF9500]" />
                Carbs {carbsPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF375F]" />
                Fat {fatPct}%
              </span>
            </div>
          </div>

          {/* Food Items & Ingredients Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                Foods & Portions ({meal.items?.length || 1})
              </span>
              {meal.confidence && (
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <CheckCircle2 className="w-3 h-3 text-[#30D158]" />
                  AI Confidence: <span className="capitalize font-semibold text-white">{meal.confidence}</span>
                </span>
              )}
            </div>

            {meal.items && meal.items.length > 0 ? (
              <div className="ios-card divide-y divide-white/[0.06] overflow-hidden border border-white/10">
                {meal.items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-3.5 flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        {it.name}
                      </h4>
                      <p className="text-[11px] text-[#8E8E93] mt-0.5">
                        {it.estimated_quantity
                          ? `${it.estimated_quantity} ${it.estimated_unit || ''}`
                          : 'Portion recorded'}
                        {(it.protein_g !== null || it.carbs_g !== null || it.fat_g !== null) && (
                          <span className="ml-1 text-zinc-400">
                            · {it.protein_g || 0}g P · {it.carbs_g || 0}g C · {it.fat_g || 0}g F
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <span className="text-xs font-bold text-white">
                        {it.calories || 0}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] ml-1">kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ios-card p-3.5 border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    {meal.description || 'Logged Food Item'}
                  </h4>
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">
                    {protein}g protein · {carbs}g carbs · {fat}g fat
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white">{calories}</span>
                  <span className="text-[10px] text-[#8E8E93] ml-1">kcal</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Nutritional Insights / Notes (if available) */}
          {meal.ai_analysis && (
            <div className="ios-card p-3.5 space-y-1.5 border border-white/10 bg-white/[0.02]">
              <span className="text-[11px] font-semibold text-[#30D158] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Health & Nutrition Summary
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {typeof meal.ai_analysis === 'string'
                  ? meal.ai_analysis
                  : meal.ai_analysis?.notes ||
                    meal.ai_analysis?.summary ||
                    `Balanced ${meal.meal_type} with ${protein}g protein supporting lean muscle preservation and recovery.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
