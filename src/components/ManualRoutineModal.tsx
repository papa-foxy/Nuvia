'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Dumbbell, Search, Check, Play, ExternalLink } from 'lucide-react';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import { EXERCISE_CATALOG, searchExercises, matchExercise, extractYoutubeId } from '@/lib/exercise-catalog';
import { useAuth } from '@/lib/auth-context';

interface ManualRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineSaved: (routine: WorkoutRoutine) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs'];

export function ManualRoutineModal({
  isOpen,
  onClose,
  onRoutineSaved,
}: ManualRoutineModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday']);
  const [focus, setFocus] = useState('Full Body');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);

  // Exercise Picker State
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSelectFromCatalog = (catEx: typeof EXERCISE_CATALOG[0]) => {
    const newEx: RoutineExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: catEx.name,
      target_muscle: catEx.target_muscle,
      sets: catEx.default_sets,
      reps: catEx.default_reps,
      notes: catEx.equipment,
      thumbnail_url: catEx.thumbnail_url,
      youtube_id: catEx.youtube_id,
      youtube_url: `https://www.youtube.com/watch?v=${catEx.youtube_id}`,
    };
    setExercises([...exercises, newEx]);
    setShowPicker(false);
    setSearchQuery('');
  };

  const handleAddCustomExercise = (name: string) => {
    if (!name.trim()) return;
    const matched = matchExercise(name);
    const newEx: RoutineExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      target_muscle: matched.target_muscle,
      sets: 3,
      reps: '10-12',
      thumbnail_url: matched.thumbnail_url,
      youtube_id: matched.youtube_id,
      youtube_url: `https://www.youtube.com/watch?v=${matched.youtube_id}`,
    };
    setExercises([...exercises, newEx]);
    setShowPicker(false);
    setSearchQuery('');
  };

  const handleRemoveExercise = (id: string) => {
    setExercises(exercises.filter((e) => e.id !== id));
  };

  const handleUpdateExercise = (id: string, field: keyof RoutineExercise, val: any) => {
    setExercises(
      exercises.map((e) => {
        if (e.id !== id) return e;
        if (field === 'youtube_url') {
          const ytId = extractYoutubeId(val);
          return { ...e, youtube_url: val, youtube_id: ytId };
        }
        return { ...e, [field]: val };
      })
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || exercises.length === 0) return;

    const routine: WorkoutRoutine = {
      id: `routine-${Date.now()}`,
      user_id: user?.id || 'demo-user-001',
      title: title.trim(),
      days: selectedDays,
      focus,
      exercises,
      created_at: new Date().toISOString(),
    };

    onRoutineSaved(routine);
    onClose();
  };

  const filteredCatalog = searchExercises(searchQuery, activeCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-[#1C1C1E] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-slideUp max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div>
            <h3 className="text-base font-bold text-white">Create Workout Routine</h3>
            <p className="text-xs text-[#8E8E93]">Build and schedule your custom workout</p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
              Routine Name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Upper Body Hypertrophy or Leg Day"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
            />
          </div>

          {/* Days selector */}
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">
              Scheduled Days
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#30D158] text-black font-semibold'
                        : 'bg-[#121214] border border-white/[0.08] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Focus Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
              Focus Area
            </label>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
            >
              <option value="Upper Body">Upper Body</option>
              <option value="Abs & Core">Abs & Core</option>
              <option value="Lower Body / Legs">Lower Body / Legs</option>
              <option value="Push (Chest & Shoulders)">Push (Chest & Shoulders)</option>
              <option value="Pull (Back & Biceps)">Pull (Back & Biceps)</option>
              <option value="Full Body">Full Body</option>
              <option value="Cardio & HIIT">Cardio & HIIT</option>
            </select>
          </div>

          {/* Exercises Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                Exercises ({exercises.length})
              </label>

              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="text-xs text-[#30D158] hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Exercise</span>
              </button>
            </div>

            {exercises.length === 0 ? (
              <div
                onClick={() => setShowPicker(true)}
                className="p-6 rounded-2xl bg-[#121214] border border-dashed border-white/[0.12] text-center cursor-pointer hover:border-white/30 transition-colors"
              >
                <Dumbbell className="w-6 h-6 text-[#8E8E93] mx-auto mb-2" />
                <p className="text-xs font-medium text-white">No exercises added yet</p>
                <p className="text-[11px] text-[#8E8E93] mt-0.5">
                  Tap to choose from the exercise catalog or enter a custom movement.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((ex, idx) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-2xl bg-[#121214] border border-white/[0.08] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={ex.thumbnail_url}
                          alt={ex.name}
                          className="w-9 h-9 rounded-xl bg-black/40 p-0.5 border border-white/[0.06] object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{ex.name}</p>
                          <span className="text-[10px] text-[#30D158]">{ex.target_muscle}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(ex.id)}
                        className="p-1.5 text-[#8E8E93] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-[#8E8E93] uppercase font-semibold">Sets</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={ex.sets}
                          onChange={(e) => handleUpdateExercise(ex.id, 'sets', parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#1C1C1E] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8E8E93] uppercase font-semibold">Reps / Duration</label>
                        <input
                          type="text"
                          value={ex.reps}
                          onChange={(e) => handleUpdateExercise(ex.id, 'reps', e.target.value)}
                          placeholder="e.g. 10-12 or 45 sec"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#1C1C1E] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={!title.trim() || exercises.length === 0}
              className="w-full py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-semibold text-sm transition-colors shadow-lg shadow-[#30D158]/20"
            >
              Save Routine
            </button>
          </div>
        </form>

        {/* Exercise Picker Drawer */}
        {showPicker && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="w-full max-w-md bg-[#1C1C1E] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col animate-slideUp">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h4 className="text-sm font-bold text-white">Choose Exercise</h4>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search & Custom Input */}
              <div className="py-3 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search exercise or type custom name..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-[#121214] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
                  />
                </div>

                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors ${
                        activeCategory === cat
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#121214] text-[#8E8E93] hover:text-white border border-white/[0.06]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercise Results */}
              <div className="flex-1 overflow-y-auto space-y-2 divide-y divide-white/[0.04]">
                {filteredCatalog.map((catEx) => (
                  <div
                    key={catEx.id}
                    onClick={() => handleSelectFromCatalog(catEx)}
                    className="pt-2 pb-1 flex items-center justify-between gap-3 cursor-pointer group hover:bg-white/[0.02] rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={catEx.thumbnail_url}
                        alt={catEx.name}
                        className="w-10 h-10 rounded-xl bg-black/40 p-1 border border-white/[0.06] object-contain shrink-0"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-white group-hover:text-[#30D158] transition-colors truncate">
                          {catEx.name}
                        </p>
                        <p className="text-[10px] text-[#8E8E93]">
                          {catEx.target_muscle} · {catEx.equipment}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-full bg-[#30D158]/15 text-[#30D158] text-xs font-medium shrink-0 group-hover:bg-[#30D158] group-hover:text-black transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                ))}

                {searchQuery.trim() && (
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => handleAddCustomExercise(searchQuery)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs text-left text-white flex items-center justify-between transition-colors"
                    >
                      <span>Add custom "{searchQuery}"</span>
                      <Plus className="w-3.5 h-3.5 text-[#30D158]" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
