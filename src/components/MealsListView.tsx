'use client';

import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { Meal } from '@/types/database';

interface MealsListViewProps {
  onOpenAddMeal: () => void;
  refreshKey?: number;
}

export function MealsListView({ onOpenAddMeal, refreshKey }: MealsListViewProps) {
  const { user } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

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
    if (confirm('Delete this meal entry?')) {
      await DataService.deleteMeal(mealId, user?.id);
      loadMeals();
    }
  };

  const filtered = filterType === 'all' ? meals : meals.filter((m) => m.meal_type === filterType);
  const totalCals = filtered.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
            Nutrition
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
            Meals
          </h1>
        </div>
        <span className="text-sm font-semibold text-white mb-1 whitespace-nowrap">
          {totalCals.toLocaleString()} <span className="text-xs text-[#8E8E93] font-normal">kcal</span>
        </span>
      </div>

      {/* Segmented Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
        {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
              filterType === tab
                ? 'bg-white text-black font-semibold'
                : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Meals Table (iOS Inset Grouped List) */}
      <div className="w-full">
        {loading ? (
          <div className="space-y-2 w-full">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-[#1C1C1E] rounded-2xl animate-pulse w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8E8E93] w-full bg-[#1C1C1E]/40 rounded-2xl border border-white/[0.04]">
            No meals logged for this filter.
          </div>
        ) : (
          <div className="ios-card w-full divide-y divide-white/[0.06] overflow-hidden">
            {filtered.map((meal) => {
              const mealDate = new Date(meal.meal_time);
              const isToday = mealDate.toDateString() === new Date().toDateString();
              const timeLabel = isToday
                ? mealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : `${mealDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${mealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

              return (
                <div
                  key={meal.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors w-full"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                        {meal.meal_type}
                      </span>
                      <span className="text-[10px] text-[#636366]">
                        {timeLabel}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-0.5 truncate" title={meal.description || undefined}>
                      {meal.description}
                    </h3>
                    <p className="text-xs text-[#8E8E93] mt-0.5 truncate">
                      {meal.protein_g}g protein · {meal.carbs_g}g carbs · {meal.fat_g}g fat
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <div className="text-right whitespace-nowrap">
                      <span className="text-sm font-semibold text-white">{meal.calories}</span>
                      <span className="text-xs text-[#8E8E93] ml-1">kcal</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(meal.id)}
                      className="p-1.5 text-[#8E8E93] hover:text-[#FF453A] transition-colors rounded-lg hover:bg-white/[0.05]"
                      title="Delete meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
