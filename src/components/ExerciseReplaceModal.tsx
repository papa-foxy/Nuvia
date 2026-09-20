'use client';

import React, { useState } from 'react';
import { X, Search, Check, RefreshCw, ArrowRight } from 'lucide-react';
import { RoutineExercise } from '@/types/routine';
import { EXERCISE_CATALOG, searchExercises } from '@/lib/exercise-catalog';
import { FitnessContextService } from '@/lib/fitness-context-service';

interface ExerciseReplaceModalProps {
  exercise: RoutineExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (originalExId: string, replacement: RoutineExercise) => void;
}

const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs', 'Full Body'];

export function ExerciseReplaceModal({
  exercise,
  isOpen,
  onClose,
  onReplace,
}: ExerciseReplaceModalProps) {
  if (!isOpen || !exercise) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(
    CATEGORIES.includes(exercise.target_muscle) ? exercise.target_muscle : 'All'
  );
  const [onlyMyEquipment, setOnlyMyEquipment] = useState(true);

  const storedPrefs = FitnessContextService.getStoredPreferences();
  const userEquipList = (storedPrefs.constraints.available_equipment || ['dumbbells', 'push_up_board', 'bodyweight']).map(
    (e) => e.toLowerCase().replace(/_/g, ' ')
  );

  const isEquipmentCompatible = (itemEquipment?: string): boolean => {
    if (!itemEquipment) return true;
    const eqLower = itemEquipment.toLowerCase();
    if (eqLower.includes('bodyweight') || eqLower.includes('none') || eqLower.includes('mat')) return true;
    return userEquipList.some((ue) => eqLower.includes(ue) || (ue.includes('dumbbell') && eqLower.includes('dumbbell')));
  };

  const rawFiltered = searchExercises(searchQuery, activeCategory).filter(
    (c) => c.name.toLowerCase() !== exercise.name.toLowerCase()
  );

  const filteredCatalog = onlyMyEquipment
    ? rawFiltered.filter((c) => isEquipmentCompatible(c.equipment))
    : rawFiltered;

  const handleSelectReplacement = (catEx: typeof EXERCISE_CATALOG[0]) => {
    const replacement: RoutineExercise = {
      ...exercise,
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      catalog_id: catEx.id,
      name: catEx.name,
      target_muscle: catEx.target_muscle,
      // Preserve existing sets & reps from the planned routine!
      sets: exercise.sets,
      reps: exercise.reps,
      rest_seconds: exercise.rest_seconds ?? 90,
      thumbnail_url: catEx.thumbnail_url,
      youtube_id: catEx.youtube_id,
      youtube_url: `https://www.youtube.com/watch?v=${catEx.youtube_id}`,
      notes: catEx.equipment ? `${catEx.equipment} (Replaced from ${exercise.name})` : `Replaced from ${exercise.name}`,
    };

    onReplace(exercise.id, replacement);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-[#1C1C1E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-slideUp max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-[#FF9500] flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Replace Exercise</h3>
              <p className="text-[11px] text-[#8E8E93]">Choose a compatible substitute movement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Current Exercise Pill */}
        <div className="mt-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between text-xs shrink-0">
          <span className="text-[#8E8E93]">Replacing:</span>
          <span className="font-bold text-white truncate max-w-[200px]">{exercise.name}</span>
          <span className="text-[10px] text-[#30D158] font-semibold bg-[#30D158]/10 px-1.5 py-0.5 rounded">
            {exercise.target_muscle}
          </span>
        </div>

        {/* Search */}
        <div className="relative mt-3 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeCategory} alternatives...`}
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#30D158]"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-2 shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors shrink-0 ${
                activeCategory === cat
                  ? 'bg-[#30D158] text-black font-bold'
                  : 'bg-white/5 text-[#8E8E93] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Equipment Constraint Toggle */}
        <div className="flex items-center justify-between px-1 py-1.5 shrink-0 text-[11px]">
          <span className="text-[#8E8E93]">Equipment Filter:</span>
          <button
            type="button"
            onClick={() => setOnlyMyEquipment((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1.5 ${
              onlyMyEquipment
                ? 'bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30'
                : 'bg-white/5 text-[#8E8E93] border border-white/10 hover:text-white'
            }`}
          >
            <span>{onlyMyEquipment ? 'Matching My Equipment (Home)' : 'All Gym Equipment'}</span>
          </button>
        </div>

        {/* Alternatives List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-1">
          {filteredCatalog.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8E8E93]">
              No alternatives found for this muscle group.
            </div>
          ) : (
            filteredCatalog.map((catEx) => (
              <button
                key={catEx.id}
                type="button"
                onClick={() => handleSelectReplacement(catEx)}
                className="w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 flex items-center justify-between text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                    <img src={catEx.thumbnail_url} alt={catEx.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-[#30D158] transition-colors leading-snug">
                      {catEx.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#8E8E93] mt-0.5">
                      <span>{catEx.target_muscle}</span>
                      {catEx.equipment && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[120px]">{catEx.equipment}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#30D158] shrink-0">
                  <span>Swap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
