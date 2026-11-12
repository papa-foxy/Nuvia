'use client';

import React, { useState } from 'react';
import {
  Trash2,
  Utensils,
  Camera,
  Sparkles,
  Edit3,
  Calendar,
  Clock,
  CheckCircle2,
  PieChart,
  CalendarClock,
} from 'lucide-react';
import { Meal } from '@/types/database';
import { NuviaBottomSheet } from './NuviaBottomSheet';
import { getLocalDateString } from '@/lib/data-service';

function localYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

interface MealDetailsModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (mealId: string) => Promise<void> | void;
  /** Move the meal to another day (YYYY-MM-DD). Resolves when saved; throws on failure. */
  onMove?: (mealId: string, newDate: string) => Promise<void>;
}

export function MealDetailsModal({
  meal,
  isOpen,
  onClose,
  onDelete,
  onMove,
}: MealDetailsModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState('');
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  // Reset per-open UI when the sheet opens (adjusting state during render on prop change).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDeleting(false);
      setIsMoveOpen(false);
      setMoveError(null);
    }
  }

  // Keep rendering while closing so the shared sheet can slide out.
  if (!meal) return null;

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
      <Camera className="w-3 h-3 text-green-ink" />
    ) : meal.source === 'text' ? (
      <Sparkles className="w-3 h-3 text-blue-ink" />
    ) : (
      <Edit3 className="w-3 h-3 text-muted" />
    );

  const mealTypeColor =
    meal.meal_type === 'breakfast'
      ? 'bg-warn/20 text-orange-ink border-warn/30'
      : meal.meal_type === 'lunch'
      ? 'bg-accent/20 text-green-ink border-accent/30'
      : meal.meal_type === 'dinner'
      ? 'bg-info/20 text-blue-ink border-info/30'
      : 'bg-[#BF5AF2]/20 text-[#BF5AF2] border-[#BF5AF2]/30';

  const handleDelete = async () => {
    if (!onDelete) return;
    if (confirm(`Delete "${meal.description || 'this meal'}"?`)) {
      setDeleting(true);
      await onDelete(meal.id);
      setDeleting(false);
      onClose();
    }
  };

  const mealDateStr = getLocalDateString(new Date(meal.meal_time));
  const todayStr = getLocalDateString();
  const yesterdayStr = localYesterday();
  const shortDate = (ds: string) =>
    new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleMove = async (target: string) => {
    if (!onMove || !target || target === mealDateStr) return;
    setMoving(true);
    setMoveError(null);
    try {
      await onMove(meal.id, target);
      setIsMoveOpen(false);
      onClose();
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Could not move this meal.');
    } finally {
      setMoving(false);
    }
  };

  return (
    <NuviaBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="standard"
      ariaLabel="Meal details"
      contentClassName="space-y-4 pb-6 sm:pb-8"
      title={
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${mealTypeColor}`}
          >
            {meal.meal_type}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted">
            <Clock className="w-3 h-3" />
            <span>{formattedTime}</span>
          </div>
        </div>
      }
      headerAction={
        <>
          {onMove && (
              <button
                type="button"
                onClick={() => {
                  setIsMoveOpen((v) => !v);
                  setMoveDate(mealDateStr === todayStr ? yesterdayStr : todayStr);
                  setMoveError(null);
                }}
                aria-expanded={isMoveOpen}
                className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                  isMoveOpen ? 'bg-fg text-app' : 'bg-fg/5 hover:bg-fg/10 text-fg-soft'
                }`}
                title="Move to another day"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Move
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-muted hover:text-red-ink transition-colors cursor-pointer"
                title="Delete meal"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
        </>
      }
    >
          {/* Move to another day */}
          {onMove && isMoveOpen && (
            <section
              aria-label="Move meal to another day"
              className="rounded-[var(--radius-control)] border border-line bg-elevated/50 p-3.5 space-y-3"
            >
              <div>
                <p className="text-sm font-bold text-fg">Move to another day</p>
                <p className="text-[11px] text-muted">
                  Currently on {shortDate(mealDateStr)}. The time of day stays the same.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Yesterday', value: yesterdayStr },
                  { label: 'Today', value: todayStr },
                ]
                  .filter((o) => o.value !== mealDateStr)
                  .map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      disabled={moving}
                      onClick={() => handleMove(o.value)}
                      className="h-10 px-4 rounded-[var(--radius-control)] bg-accent text-on-accent text-xs font-extrabold hover:bg-accent-hover disabled:opacity-60 cursor-pointer"
                    >
                      Move to {o.label.toLowerCase()}
                    </button>
                  ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="move-meal-date">
                  Choose a date
                </label>
                <input
                  id="move-meal-date"
                  type="date"
                  value={moveDate}
                  max={todayStr}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-[var(--radius-control)] bg-card border border-line text-sm font-semibold text-fg [color-scheme:inherit] focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  disabled={moving || !moveDate || moveDate === mealDateStr || moveDate > todayStr}
                  onClick={() => handleMove(moveDate)}
                  className="h-10 px-4 rounded-[var(--radius-control)] bg-fg text-app text-xs font-extrabold disabled:opacity-40 cursor-pointer"
                >
                  {moving ? 'Moving…' : 'Move to date'}
                </button>
              </div>
              {moveError && (
                <p role="alert" className="text-xs font-semibold text-red-ink">
                  {moveError}
                </p>
              )}
            </section>
          )}

          {/* Meal Photo or Aesthetic Hero Header */}
          {meal.image_url ? (
            <div className="relative w-full h-52 rounded-2xl overflow-hidden border border-fg/10 shadow-lg group">
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
                    <Calendar className="w-3 h-3 text-green-ink" />
                    <span>{formattedDate}</span>
                  </div>
                </div>
                <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-fg/10 flex items-center gap-1.5 text-[11px] text-zinc-200">
                  {sourceIcon}
                  <span>{sourceLabel}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="ios-card p-4 space-y-2 border border-fg/10 bg-gradient-to-br from-fg/[0.05] to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-fg/10 flex items-center justify-center text-orange-ink">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-fg leading-tight">
                      {meal.description || 'Logged Meal'}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-muted mt-0.5">
                      <Calendar className="w-3 h-3 text-green-ink" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-fg/5 px-2.5 py-1 rounded-full border border-fg/10 flex items-center gap-1.5 text-[10px] text-zinc-300">
                  {sourceIcon}
                  <span>{sourceLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Nutrition Cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="ios-card p-3 border border-fg/10">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                Calories
              </span>
              <span className="text-lg font-bold text-fg mt-0.5 block">
                {calories}
              </span>
              <span className="text-[9px] text-muted">kcal</span>
            </div>

            <div className="ios-card p-3 border border-fg/10">
              <span className="text-[10px] font-semibold text-green-ink uppercase tracking-wider block">
                Protein
              </span>
              <span className="text-lg font-bold text-green-ink mt-0.5 block">
                {protein}
              </span>
              <span className="text-[9px] text-muted">g ({proteinPct}%)</span>
            </div>

            <div className="ios-card p-3 border border-fg/10">
              <span className="text-[10px] font-semibold text-orange-ink uppercase tracking-wider block">
                Carbs
              </span>
              <span className="text-lg font-bold text-orange-ink mt-0.5 block">
                {carbs}
              </span>
              <span className="text-[9px] text-muted">g ({carbsPct}%)</span>
            </div>

            <div className="ios-card p-3 border border-fg/10">
              <span className="text-[10px] font-semibold text-pink-ink uppercase tracking-wider block">
                Fat
              </span>
              <span className="text-lg font-bold text-pink-ink mt-0.5 block">
                {fat}
              </span>
              <span className="text-[9px] text-muted">g ({fatPct}%)</span>
            </div>
          </div>

          {/* Macro Calorie Distribution Progress Bar */}
          <div className="ios-card p-3.5 space-y-2 border border-fg/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5 font-medium">
                <PieChart className="w-3.5 h-3.5 text-green-ink" />
                Macro Calorie Split
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {calories} total kcal
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full overflow-hidden bg-fg/10 flex gap-0.5">
              <div
                style={{ width: `${proteinPct}%` }}
                className="bg-accent h-full transition-all duration-300"
                title={`Protein ${proteinPct}%`}
              />
              <div
                style={{ width: `${carbsPct}%` }}
                className="bg-warn h-full transition-all duration-300"
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
                <span className="w-2 h-2 rounded-full bg-accent" />
                Protein {proteinPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warn" />
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
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Foods & Portions ({meal.items?.length || 1})
              </span>
              {meal.confidence && (
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <CheckCircle2 className="w-3 h-3 text-green-ink" />
                  AI Confidence: <span className="capitalize font-semibold text-fg">{meal.confidence}</span>
                </span>
              )}
            </div>

            {meal.items && meal.items.length > 0 ? (
              <div className="ios-card divide-y divide-fg/[0.06] overflow-hidden border border-fg/10">
                {meal.items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-3.5 flex items-center justify-between gap-2 hover:bg-fg/[0.02] transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-fg">
                        {it.name}
                      </h4>
                      <p className="text-[11px] text-muted mt-0.5">
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
                      <span className="text-xs font-bold text-fg">
                        {it.calories || 0}
                      </span>
                      <span className="text-[10px] text-muted ml-1">kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ios-card p-3.5 border border-fg/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-fg">
                    {meal.description || 'Logged Food Item'}
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">
                    {protein}g protein · {carbs}g carbs · {fat}g fat
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-fg">{calories}</span>
                  <span className="text-[10px] text-muted ml-1">kcal</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Nutritional Insights / Notes (if available) */}
          {meal.ai_analysis && (
            <div className="ios-card p-3.5 space-y-1.5 border border-fg/10 bg-fg/[0.02]">
              <span className="text-[11px] font-semibold text-green-ink flex items-center gap-1.5">
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
    </NuviaBottomSheet>
  );
}
