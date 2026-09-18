'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Utensils, ChevronRight, Sparkles, Camera, Plus, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { Meal } from '@/types/database';
import { MealDetailsModal } from './MealDetailsModal';

interface MealsListViewProps {
  onOpenAddMeal: () => void;
  refreshKey?: number;
}

export function MealsListView({ onOpenAddMeal, refreshKey }: MealsListViewProps) {
  const { user } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const loadMeals = async () => {
    setLoading(true);
    const data = await DataService.getMeals(user?.id);
    setMeals(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMeals();
  }, [user, refreshKey]);

  const handleDelete = async (mealId: string) => {
    await DataService.deleteMeal(mealId, user?.id);
    await loadMeals();
  };

  const filtered = filterType === 'all' ? meals : meals.filter((m) => m.meal_type === filterType);
  const totalCals = filtered.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);

  return (
    <div className="flex-1 flex flex-col pb-24 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Nutrition & Diet
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
            Meals
          </h1>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-white whitespace-nowrap">
            {totalCals.toLocaleString()} <span className="text-xs text-[#8E8E93] font-normal">kcal</span>
          </span>
          <p className="text-[10px] text-[#8E8E93]">
            {filtered.length} {filtered.length === 1 ? 'logged meal' : 'logged meals'}
          </p>
        </div>
      </div>

      {/* Segmented Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
        {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
              filterType === tab
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Meals Table (iOS Inset Grouped List) */}
      <div className="w-full">
        {loading ? (
          <div className="space-y-2.5 w-full">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-[#1C1C1E] rounded-2xl animate-pulse w-full border border-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center space-y-3 w-full bg-[#1C1C1E]/40 rounded-2xl border border-white/[0.04] p-6">
            <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center text-zinc-500">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">No meals recorded</p>
              <p className="text-xs text-[#8E8E93] mt-1">
                {filterType === 'all'
                  ? 'Start by logging your breakfast, lunch, or dinner.'
                  : `No ${filterType} logged yet.`}
              </p>
            </div>
            <button
              onClick={onOpenAddMeal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log A Meal Now
            </button>
          </div>
        ) : (
          <div className="ios-card w-full divide-y divide-white/[0.06] overflow-hidden border border-white/10 shadow-lg">
            {filtered.map((meal) => {
              const mealDate = new Date(meal.meal_time);
              const isToday = mealDate.toDateString() === new Date().toDateString();
              const timeLabel = isToday
                ? mealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : `${mealDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${mealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

              return (
                <div
                  key={meal.id}
                  onClick={() => {
                    setSelectedMeal(meal);
                    setIsDetailsOpen(true);
                  }}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors w-full cursor-pointer group"
                >
                  {/* Left Meal Thumbnail / Icon */}
                  <div className="relative shrink-0">
                    {meal.image_url ? (
                      <img
                        src={meal.image_url}
                        alt={meal.description || 'Meal photo'}
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 group-hover:border-white/25 transition-colors"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white/10 transition-colors">
                        <Utensils className="w-5 h-5" />
                      </div>
                    )}
                    {meal.source === 'photo' && (
                      <span
                        title="AI Camera Scan"
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1C1C1E] border border-white/20 flex items-center justify-center text-zinc-300"
                      >
                        <Camera className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Center Meal Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                        {meal.meal_type}
                      </span>
                      <span className="text-[10px] text-[#636366]">
                        {timeLabel}
                      </span>
                      {meal.items && meal.items.length > 0 && (
                        <span className="text-[9px] text-[#8E8E93] bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {meal.items.length} {meal.items.length === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-sm font-semibold text-white mt-1 truncate transition-colors"
                      title={meal.description || undefined}
                    >
                      {meal.description || 'Logged Meal'}
                    </h3>
                  </div>

                  {/* Right Calories & Arrow */}
                  <div className="flex items-center gap-2 shrink-0 ml-1">
                    <div className="text-right whitespace-nowrap">
                      <span className="text-sm font-bold text-white block">
                        {meal.calories || 0}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] block">
                        kcal
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${meal.description || 'this meal'}"?`)) {
                          handleDelete(meal.id);
                        }
                      }}
                      className="p-1.5 text-[#8E8E93] hover:text-[#FF453A] transition-colors rounded-lg hover:bg-white/[0.05] cursor-pointer"
                      title="Delete meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DEDICATED MEAL DETAILS SHEET WITH SLIDE-DOWN GESTURE */}
      <MealDetailsModal
        meal={selectedMeal}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onDelete={handleDelete}
      />
    </div>
  );
}
