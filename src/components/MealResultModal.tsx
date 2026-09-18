'use client';

import React, { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { MealAnalysisResult } from '@/lib/ai-service';
import { MealType, EntrySource, ConfidenceLevel } from '@/types/database';

interface MealResultModalProps {
  initialData: MealAnalysisResult;
  imagePreviewUrl?: string | null;
  source: EntrySource;
  onSave: (savedMeal: {
    meal_type: MealType;
    meal_time: string;
    description: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: ConfidenceLevel;
    items: {
      name: string;
      estimated_quantity: number;
      estimated_unit: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      confidence: ConfidenceLevel;
    }[];
  }) => Promise<void>;
  onClose: () => void;
  onAddAnother: () => void;
}

export function MealResultModal({
  initialData,
  imagePreviewUrl,
  source,
  onSave,
  onClose,
  onAddAnother,
}: MealResultModalProps) {
  const [mealType, setMealType] = useState<MealType>(initialData.meal_type || 'lunch');
  const [mealName, setMealName] = useState(initialData.meal_name || 'Logged Meal');
  const [foods, setFoods] = useState(initialData.foods || []);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New item draft
  const [newItemName, setNewItemName] = useState('');
  const [newItemCals, setNewItemCals] = useState('');

  // Live recalculations
  const totalCalories = foods.reduce((acc, f) => acc + (Number(f.calories) || 0), 0);
  const totalProtein = foods.reduce((acc, f) => acc + (Number(f.protein_g) || 0), 0);
  const totalCarbs = foods.reduce((acc, f) => acc + (Number(f.carbs_g) || 0), 0);
  const totalFat = foods.reduce((acc, f) => acc + (Number(f.fat_g) || 0), 0);

  const removeItem = (idx: number) => {
    setFoods(foods.filter((_, i) => i !== idx));
  };

  const updateItemQty = (idx: number, delta: number) => {
    setFoods(
      foods.map((f, i) => {
        if (i !== idx) return f;
        const newQty = Math.max(10, (f.estimated_quantity || 100) + delta);
        const ratio = newQty / (f.estimated_quantity || 100);
        return {
          ...f,
          estimated_quantity: newQty,
          calories: Math.round((f.calories || 0) * ratio),
          protein_g: Math.round((f.protein_g || 0) * ratio),
          carbs_g: Math.round((f.carbs_g || 0) * ratio),
          fat_g: Math.round((f.fat_g || 0) * ratio),
        };
      })
    );
  };

  const handleAddNewItem = () => {
    if (!newItemName.trim()) return;
    const cals = Number(newItemCals) || 100;
    setFoods([
      ...foods,
      {
        name: newItemName.trim(),
        estimated_quantity: 100,
        unit: 'g',
        calories: cals,
        protein_g: 5,
        carbs_g: Math.round(cals * 0.1),
        fat_g: Math.round(cals * 0.05),
        confidence: 'medium',
      },
    ]);
    setNewItemName('');
    setNewItemCals('');
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    await onSave({
      meal_type: mealType,
      meal_time: new Date().toISOString(),
      description: mealName,
      calories: totalCalories,
      protein_g: totalProtein,
      carbs_g: totalCarbs,
      fat_g: totalFat,
      confidence: initialData.confidence || 'medium',
      items: foods.map((f) => ({
        name: f.name,
        estimated_quantity: f.estimated_quantity,
        estimated_unit: f.unit,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
        confidence: f.confidence,
      })),
    });
    setSaving(false);
    setSavedSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#1C1C1E] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              {mealType}
            </span>
            <span className="text-xs text-[#636366]">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Captured Food Photo Preview */}
          {imagePreviewUrl && (
            <div className="relative rounded-2xl overflow-hidden h-44 border border-white/[0.08] shadow-lg bg-black">
              <img src={imagePreviewUrl} alt="Analyzed Food" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
                <span>AI Photo Analyzed</span>
              </div>
            </div>
          )}

          {/* Meal Title */}
          <div>
            <input
              type="text"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="bg-transparent text-white font-bold text-2xl tracking-tight focus:outline-none w-full"
            />
          </div>

          {/* Primary Nutrition Stats (Typography Hierarchy) */}
          <div className="bg-[#121214] p-4 rounded-2xl border border-white/[0.06] flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Total Calories
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-semibold text-white tracking-tight">
                  {totalCalories}
                </span>
                <span className="text-xs text-[#8E8E93]">kcal (est.)</span>
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <p className="text-white font-medium">{totalProtein}g <span className="text-[#8E8E93]">protein</span></p>
              <p className="text-[#8E8E93]">{totalCarbs}g carbs · {totalFat}g fat</p>
            </div>
          </div>

          {/* Inline Nuvia Contextual Note */}
          <div className="bg-[#121214] p-3.5 rounded-2xl border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
              <span>Nuvia Estimation Note</span>
            </div>
            <p className="text-xs text-[#D1D1D6] leading-relaxed">
              {initialData.assumptions?.[0] || 'Values estimated from portion and ingredient visibility. Review or adjust items before saving.'}
            </p>
          </div>

          {/* Food Items Breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Ingredients ({foods.length})
            </p>

            <div className="bg-[#121214] rounded-2xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
              {foods.map((food, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">{food.name}</p>
                    <p className="text-[11px] text-[#8E8E93]">
                      {food.calories} kcal · {food.protein_g}g P
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#2C2C2E] rounded-lg px-2 py-0.5">
                      <button
                        type="button"
                        onClick={() => updateItemQty(idx, -20)}
                        className="text-[#8E8E93] hover:text-white px-1"
                      >
                        -
                      </button>
                      <span className="px-1.5 text-[11px] font-medium text-white">
                        {food.estimated_quantity}{food.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateItemQty(idx, 20)}
                        className="text-[#8E8E93] hover:text-white px-1"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1 text-[#636366] hover:text-[#FF453A]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Row */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add missing ingredient..."
                className="flex-1 px-3 py-2 bg-[#121214] border border-white/[0.06] rounded-xl text-xs text-white placeholder-[#8E8E93]"
              />
              <input
                type="number"
                value={newItemCals}
                onChange={(e) => setNewItemCals(e.target.value)}
                placeholder="kcal"
                className="w-16 px-2 py-2 bg-[#121214] border border-white/[0.06] rounded-xl text-xs text-white placeholder-[#8E8E93]"
              />
              <button
                onClick={handleAddNewItem}
                className="px-3 py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white rounded-xl text-xs font-semibold"
              >
                Add
              </button>
            </div>
          </div>

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-[#30D158]/15 border border-[#30D158]/30 flex items-center gap-2">
              <Check className="w-4 h-4 text-[#30D158] shrink-0" />
              <span className="text-xs text-[#30D158] font-bold">
                Recorded +{totalCalories} kcal to today's daily calories!
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/[0.08] flex gap-2">
          {!savedSuccess ? (
            <>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] text-black font-bold text-sm transition-colors shadow-lg shadow-[#30D158]/20 flex items-center justify-center gap-1.5"
              >
                {saving ? 'Recording...' : 'Record to Daily Calories'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-3.5 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onAddAnother}
                className="flex-1 py-3.5 rounded-2xl bg-[#2C2C2E] text-white font-semibold text-sm hover:bg-[#3A3A3C] transition-colors"
              >
                Add Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl bg-[#30D158] text-black font-bold text-sm hover:bg-[#28B84D] transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
