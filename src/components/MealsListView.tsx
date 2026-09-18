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
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 max-w-md mx-auto space-y-6">
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
        <span className="text-sm font-semibold text-white mb-1">
          {totalCals.toLocaleString()} <span className="text-xs text-[#8E8E93] font-normal">kcal</span>
        </span>
      </div>

      {/* Segmented Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
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
      <div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="h-16 bg-[#1C1C1E] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8E8E93]">
            No meals logged. Tap <span className="text-[#30D158] font-semibold">(+)</span> below to log.
          </div>
        ) : (
          <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
            {filtered.map((meal) => (
              <div
                key={meal.id}
                className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-[#8E8E93] uppercase">
                      {meal.meal_type}
                    </span>
                    <span className="text-[10px] text-[#636366]">
                      {new Date(meal.meal_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mt-0.5">{meal.description}</h3>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    {meal.protein_g}g protein · {meal.carbs_g}g carbs · {meal.fat_g}g fat
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-semibold text-white">{meal.calories}</span>
                    <span className="text-xs text-[#8E8E93] ml-1">kcal</span>
                  </div>
                  <button
                    onClick={() => handleDelete(meal.id)}
                    className="p-1 text-[#636366] hover:text-[#FF453A] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
