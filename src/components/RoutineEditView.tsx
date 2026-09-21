'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Dumbbell,
  Search,
  Check,
  Timer,
  Weight,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import { EXERCISE_CATALOG, searchExercises } from '@/lib/exercise-catalog';
import { ExerciseThumbnail } from './ExerciseThumbnail';

interface RoutineEditViewProps {
  routine: WorkoutRoutine;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRoutine: WorkoutRoutine) => Promise<void> | void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs', 'Full Body'];

export function RoutineEditView({
  routine,
  isOpen,
  onClose,
  onSave,
}: RoutineEditViewProps) {
  const [title, setTitle] = useState(routine.title);
  const [description, setDescription] = useState(routine.description || '');
  const [focus, setFocus] = useState(routine.focus || 'Full Body');
  const [selectedDays, setSelectedDays] = useState<string[]>(routine.days || ['Monday']);
  const [exercises, setExercises] = useState<RoutineExercise[]>(routine.exercises || []);

  // Exercise picker state
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(routine.title);
      setDescription(routine.description || '');
      setFocus(routine.focus || 'Full Body');
      setSelectedDays(routine.days || ['Monday']);
      setExercises(routine.exercises || []);
      setErrorMsg('');
      setShowPicker(false);
    }
  }, [isOpen, routine]);

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

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...exercises];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    setExercises(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === exercises.length - 1) return;
    const next = [...exercises];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    setExercises(next);
  };

  const handleRemoveExercise = (id: string) => {
    setExercises(exercises.filter((e) => e.id !== id));
  };

  const handleUpdateExercise = (id: string, field: keyof RoutineExercise, val: any) => {
    setExercises(
      exercises.map((e) => {
        if (e.id !== id) return e;
        return { ...e, [field]: val };
      })
    );
  };

  const handleAddFromCatalog = (catEx: typeof EXERCISE_CATALOG[0]) => {
    const newEx: RoutineExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      catalog_id: catEx.id,
      name: catEx.name,
      target_muscle: catEx.target_muscle,
      sets: catEx.default_sets || 3,
      reps: catEx.default_reps || '10-12',
      rest_seconds: 90,
      notes: catEx.equipment || '',
      thumbnail_url: catEx.thumbnail_url,
      youtube_id: catEx.youtube_id,
      youtube_url: `https://www.youtube.com/watch?v=${catEx.youtube_id}`,
    };
    setExercises([...exercises, newEx]);
    setShowPicker(false);
    setSearchQuery('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please provide a routine name.');
      return;
    }
    if (exercises.length === 0) {
      setErrorMsg('Please include at least one exercise.');
      return;
    }
    if (selectedDays.length === 0) {
      setErrorMsg('Please select at least one training day.');
      return;
    }

    setSaving(true);
    try {
      const updated: WorkoutRoutine = {
        ...routine,
        title: title.trim(),
        description: description.trim() || undefined,
        focus: focus.trim() || 'Workout',
        days: selectedDays,
        exercises,
        updated_at: new Date().toISOString(),
      };
      await onSave(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save routine changes.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = searchExercises(searchQuery, activeCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end justify-center p-0 pb-[calc(56px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
      <div className="w-full max-w-lg bg-[#1C1C1E] border-t border-x border-b-0 border-white/10 rounded-t-[28px] rounded-b-none p-5 sm:p-6 shadow-2xl animate-slideUp max-h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px)-0.5rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">Edit Routine</h3>
            <p className="text-[11px] text-[#8E8E93]">Customize training schedule, exercises, and targets</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
          {/* Routine Name & Focus */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">
                Routine Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Upper Body Hypertrophy"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-xs focus:outline-none focus:border-[#30D158]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Muscle Focus
                </label>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-xs focus:outline-none focus:border-[#30D158]"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c} className="bg-[#1C1C1E]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Push-up board + dumbbells"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#30D158]"
                />
              </div>
            </div>
          </div>

          {/* Training Days Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">
              Scheduled Training Days
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#30D158] text-black font-bold shadow'
                        : 'bg-white/5 text-[#8E8E93] hover:text-white border border-white/5'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exercises Header & List */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                Exercises ({exercises.length})
              </span>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="text-xs font-semibold text-[#30D158] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Exercise</span>
              </button>
            </div>

            {exercises.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-2">
                <Dumbbell className="w-6 h-6 text-zinc-600 mx-auto" />
                <p className="text-xs text-[#8E8E93]">No exercises in this routine yet.</p>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Choose from Library</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((ex, idx) => (
                  <div
                    key={ex.id || idx}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2.5"
                  >
                    {/* Top Row: Reorder, Name, Remove */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Order stepper */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveUp(idx)}
                            className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center text-zinc-300"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === exercises.length - 1}
                            onClick={() => handleMoveDown(idx)}
                            className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center text-zinc-300"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Thumbnail */}
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                          <ExerciseThumbnail exercise={ex} className="w-full h-full object-cover" />
                        </div>

                        <div>
                          <p className="text-xs font-bold text-white leading-tight">{ex.name}</p>
                          <span className="text-[10px] text-[#30D158] font-medium">{ex.target_muscle}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(ex.id)}
                        className="w-7 h-7 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Remove Exercise"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Target Configuration: Sets, Reps, Rest, Weight */}
                    <div className="grid grid-cols-4 gap-2 text-xs pt-1 border-t border-white/[0.04]">
                      <div>
                        <label className="block text-[10px] text-[#8E8E93] mb-0.5 font-medium">Sets</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={ex.sets}
                          onChange={(e) => handleUpdateExercise(ex.id, 'sets', Number(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-semibold text-center focus:outline-none focus:border-[#30D158]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#8E8E93] mb-0.5 font-medium">Reps</label>
                        <input
                          type="text"
                          value={ex.reps}
                          onChange={(e) => handleUpdateExercise(ex.id, 'reps', e.target.value)}
                          placeholder="10-12"
                          className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-semibold text-center focus:outline-none focus:border-[#30D158]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#8E8E93] mb-0.5 font-medium flex items-center gap-0.5">
                          <Timer className="w-2.5 h-2.5 text-[#30D158]" />
                          <span>Rest</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={600}
                            step={15}
                            value={ex.rest_seconds ?? 90}
                            onChange={(e) => handleUpdateExercise(ex.id, 'rest_seconds', Number(e.target.value) || 0)}
                            className="w-full px-1.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-semibold text-center focus:outline-none focus:border-[#30D158]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#8E8E93] mb-0.5 font-medium flex items-center gap-0.5">
                          <Weight className="w-2.5 h-2.5 text-[#0A84FF]" />
                          <span>Target kg</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={ex.target_weight_kg || ''}
                          placeholder="—"
                          onChange={(e) => handleUpdateExercise(ex.id, 'target_weight_kg', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-full px-1.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-semibold text-center focus:outline-none focus:border-[#30D158]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-white/10 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || exercises.length === 0}
              className="flex-1 py-3 rounded-xl bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>

        {/* ============================================================ */}
        {/* EXERCISE CATALOG PICKER OVERLAY                              */}
        {/* ============================================================ */}
        {showPicker && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md p-4 flex flex-col justify-between animate-fadeIn">
            <div className="max-w-md w-full mx-auto flex-1 flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPicker(false)}
                    className="p-1.5 rounded-lg bg-white/5 text-zinc-300"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h4 className="text-sm font-bold text-white">Select Movement from Library</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 80+ verified exercises..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#30D158]"
                />
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
                      activeCategory === cat
                        ? 'bg-[#30D158] text-black font-bold'
                        : 'bg-white/5 text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Exercise Catalog Results */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredCatalog.length === 0 ? (
                  <p className="text-center text-xs text-[#8E8E93] py-8">No exercises found.</p>
                ) : (
                  filteredCatalog.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => handleAddFromCatalog(ex)}
                      className="w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 flex items-center justify-between text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                          <img src={ex.thumbnail_url} alt={ex.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-[#30D158] transition-colors">
                            {ex.name}
                          </p>
                          <span className="text-[10px] text-[#8E8E93]">{ex.target_muscle}</span>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-[#30D158] shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
