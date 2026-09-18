'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Dumbbell, Search, Timer } from 'lucide-react';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import { CustomExercise } from '@/types/database';
import { EXERCISE_CATALOG, searchExercises, matchExercise, extractYoutubeId } from '@/lib/exercise-catalog';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { getFallbackSvg } from '@/lib/exercise-media';

interface ManualRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineSaved: (routine: WorkoutRoutine) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs', 'Full Body'];

/** Convert a CustomExercise into a RoutineExercise to add to a routine */
function customToRoutineExercise(custom: CustomExercise): RoutineExercise {
  const fallbackThumb = custom.thumbnail_url || getFallbackSvg({ name: custom.name, primary_muscles: custom.primary_muscles });
  return {
    id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    catalog_id: undefined,
    name: custom.name,
    target_muscle: custom.primary_muscles?.[0] || 'Full Body',
    sets: 3,
    reps: '10-12',
    rest_seconds: 90,
    notes: custom.equipment || '',
    thumbnail_url: fallbackThumb,
    youtube_id: custom.youtube_id || '',
    youtube_url: custom.youtube_id ? `https://www.youtube.com/watch?v=${custom.youtube_id}` : '',
  };
}

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

  // Custom exercises for this user
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  // Create-custom mini-form
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customEquipment, setCustomEquipment] = useState('');

  useEffect(() => {
    if (isOpen) {
      DataService.getCustomExercises(user?.id).then(setCustomExercises);
    }
  }, [isOpen, user?.id]);

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
      catalog_id: catEx.id,
      name: catEx.name,
      target_muscle: catEx.target_muscle,
      sets: catEx.default_sets,
      reps: catEx.default_reps,
      rest_seconds: 90,
      notes: catEx.equipment,
      thumbnail_url: catEx.thumbnail_url,
      youtube_id: catEx.youtube_id,
      youtube_url: `https://www.youtube.com/watch?v=${catEx.youtube_id}`,
    };
    setExercises([...exercises, newEx]);
    setShowPicker(false);
    setSearchQuery('');
    setActiveCategory('All');
  };

  const handleSelectCustomExercise = (custom: CustomExercise) => {
    setExercises([...exercises, customToRoutineExercise(custom)]);
    setShowPicker(false);
    setSearchQuery('');
  };

  /** Creates a new user-owned custom exercise and immediately adds it to the routine */
  const handleCreateAndAddCustom = async () => {
    if (!customName.trim()) return;

    const saved = await DataService.saveCustomExercise({
      user_id: user?.id || 'demo-user-001',
      name: customName.trim(),
      primary_muscles: customMuscle ? [customMuscle] : undefined,
      equipment: customEquipment || undefined,
    });

    setCustomExercises((prev) => [saved, ...prev]);
    setExercises([...exercises, customToRoutineExercise(saved)]);

    // Reset form
    setCustomName('');
    setCustomMuscle('');
    setCustomEquipment('');
    setShowCreateCustom(false);
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
    // Reset form
    setTitle('');
    setSelectedDays(['Monday']);
    setFocus('Full Body');
    setExercises([]);
    onClose();
  };

  // Catalog search results
  const filteredCatalog = searchExercises(searchQuery, activeCategory);
  // Custom exercise search
  const filteredCustom = customExercises.filter((c) =>
    !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
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
              <option value="Abs &amp; Core">Abs &amp; Core</option>
              <option value="Lower Body / Legs">Lower Body / Legs</option>
              <option value="Push (Chest &amp; Shoulders)">Push (Chest &amp; Shoulders)</option>
              <option value="Pull (Back &amp; Biceps)">Pull (Back &amp; Biceps)</option>
              <option value="Full Body">Full Body</option>
              <option value="Cardio &amp; HIIT">Cardio &amp; HIIT</option>
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
                  Tap to choose from the exercise catalog or create a custom movement.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-2xl bg-[#121214] border border-white/[0.08] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ExerciseThumbnail
                          exercise={ex}
                          aspectRatio="4/3"
                          className="w-12 h-9 rounded-lg"
                          rounded="rounded-lg"
                          quality="mq"
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

                    {/* Sets / Reps / Rest */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-[#8E8E93] uppercase font-semibold">Sets</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={ex.sets}
                          onChange={(e) =>
                            handleUpdateExercise(ex.id, 'sets', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#1C1C1E] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8E8E93] uppercase font-semibold">
                          Reps / Duration
                        </label>
                        <input
                          type="text"
                          value={ex.reps}
                          onChange={(e) => handleUpdateExercise(ex.id, 'reps', e.target.value)}
                          placeholder="e.g. 10-12 or 45 sec"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#1C1C1E] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8E8E93] uppercase font-semibold flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          Rest (s)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={600}
                          step={15}
                          value={ex.rest_seconds ?? 90}
                          onChange={(e) =>
                            handleUpdateExercise(
                              ex.id,
                              'rest_seconds',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
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

        {/* ── Exercise Picker Drawer ── */}
        {showPicker && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="w-full max-w-md bg-[#1C1C1E] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col animate-slideUp">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h4 className="text-sm font-bold text-white">Choose Exercise</h4>
                <button
                  type="button"
                  onClick={() => { setShowPicker(false); setShowCreateCustom(false); }}
                  className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search */}
              <div className="py-3 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-[#121214] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
                    autoFocus
                  />
                </div>

                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
              <div className="flex-1 overflow-y-auto space-y-1">
                {/* User's custom exercises */}
                {filteredCustom.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider px-2 py-1.5">
                      My Custom Exercises
                    </p>
                    {filteredCustom.map((custom) => (
                      <div
                        key={custom.id}
                        onClick={() => handleSelectCustomExercise(custom)}
                        className="flex items-center justify-between gap-3 cursor-pointer group hover:bg-white/[0.03] rounded-xl px-2 py-2 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <ExerciseThumbnail
                            exercise={{
                              name: custom.name,
                              target_muscle: custom.primary_muscles?.[0] || 'Full Body',
                              primary_muscles: custom.primary_muscles,
                              equipment: custom.equipment,
                              thumbnail_url: custom.thumbnail_url,
                              youtube_id: custom.youtube_id,
                            }}
                            aspectRatio="4/3"
                            className="w-14 h-11 rounded-xl"
                            rounded="rounded-xl"
                            quality="mq"
                          />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-white group-hover:text-[#30D158] transition-colors truncate">
                              {custom.name}
                            </p>
                            <p className="text-[10px] text-[#8E8E93]">
                              {custom.primary_muscles?.[0] || 'Custom'} · {custom.equipment || 'No equipment specified'}
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
                  </div>
                )}

                {/* Global catalog */}
                {filteredCatalog.length > 0 && (
                  <div>
                    {filteredCustom.length > 0 && (
                      <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider px-2 py-1.5 mt-1">
                        Exercise Catalog
                      </p>
                    )}
                    <div className="divide-y divide-white/[0.04]">
                      {filteredCatalog.map((catEx) => (
                        <div
                          key={catEx.id}
                          onClick={() => handleSelectFromCatalog(catEx)}
                          className="pt-2 pb-1 flex items-center justify-between gap-3 cursor-pointer group hover:bg-white/[0.02] rounded-xl px-2 transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <ExerciseThumbnail
                              exercise={catEx}
                              aspectRatio="4/3"
                              className="w-14 h-11 rounded-xl"
                              rounded="rounded-xl"
                              quality="mq"
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
                    </div>
                  </div>
                )}

                {/* Create Custom Exercise */}
                {!showCreateCustom ? (
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateCustom(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs text-left text-white flex items-center justify-between transition-colors"
                    >
                      <span>
                        {searchQuery.trim()
                          ? `Create custom "${searchQuery}"`
                          : 'Create a custom exercise'}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-[#30D158]" />
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 space-y-2 p-3 rounded-2xl bg-[#121214] border border-white/[0.08]">
                    <p className="text-xs font-semibold text-white">New Custom Exercise</p>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Exercise name *"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customMuscle}
                        onChange={(e) => setCustomMuscle(e.target.value)}
                        placeholder="Primary muscle"
                        className="px-3 py-2 text-xs rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
                      />
                      <input
                        type="text"
                        value={customEquipment}
                        onChange={(e) => setCustomEquipment(e.target.value)}
                        placeholder="Equipment"
                        className="px-3 py-2 text-xs rounded-xl bg-[#1C1C1E] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateAndAddCustom}
                        disabled={!customName.trim()}
                        className="flex-1 py-2 rounded-xl bg-[#30D158] disabled:opacity-40 text-black text-xs font-semibold"
                      >
                        Create &amp; Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateCustom(false)}
                        className="py-2 px-3 rounded-xl bg-[#2C2C2E] text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-[10px] text-[#636366]">
                      This exercise will only be visible to you.
                    </p>
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
