'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Check,
  ArrowRight,
  Play,
  AlertCircle,
  Pencil,
  ChevronUp,
  ChevronDown,
  Trash2,
  Search,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';
import { useAuth } from '@/lib/auth-context';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { EXERCISE_CATALOG, searchExercises } from '@/lib/exercise-catalog';
import { NuviaBottomSheet } from './NuviaBottomSheet';

interface PasteAiRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutinesSaved: (routines: WorkoutRoutine[]) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SAMPLE_AI_ROUTINE = `Monday & Wednesday - Upper Body (Push-up Board + Dumbbells)
• Push-ups (Blue/Chest position) - 4x10-12
• Push-ups (Yellow/Back position) - 4x10-12
• Dumbbell shoulder press - 3x10-12
• Push-ups (Red/Shoulder position) - 3x10-12
• Dumbbell bicep curls - 3x12
• Push-ups (Green/Triceps position) - 3x12
• Dumbbell lateral raises - 3x15

Tuesday & Friday - Abs (done first)
• Hanging knee raises or lying leg raises - 4x12-15
• Weighted crunches (hold dumbbell) - 4x15
• Russian twists (with dumbbell) - 4x15 per side
• Bicycle crunches - 3x20
• Plank - 3x40-60 sec
• Side plank - 3x25-35 sec per side
• Mountain climbers - 3x20 per side`;

export function PasteAiRoutineModal({
  isOpen,
  onClose,
  onRoutinesSaved,
  triggerRef,
}: PasteAiRoutineModalProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedPreview, setParsedPreview] = useState<WorkoutRoutine[] | null>(null);
  const [unmatchedExercises, setUnmatchedExercises] = useState<string[]>([]);

  // Replacement picker for a specific routine & exercise
  const [editingExerciseTarget, setEditingExerciseTarget] = useState<{
    routineIndex: number;
    exerciseId: string;
  } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setText(SAMPLE_AI_ROUTINE);
    setErrorMsg('');
    setParsedPreview(null);
  };

  const handleClear = () => {
    setText('');
    setErrorMsg('');
    setParsedPreview(null);
  };

  const handleParse = async () => {
    if (!text.trim()) {
      setErrorMsg('Please paste your exercise routine text first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/ai/parse-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          userId: user?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to parse routine.');
      }

      setParsedPreview(json.routines);
      setUnmatchedExercises(json.unmatched_exercises || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error analyzing routine. Please check format.');
    } finally {
      setLoading(false);
    }
  };

  // Review & Correction Handlers
  const handleToggleDay = (rIdx: number, day: string) => {
    if (!parsedPreview) return;
    const next = [...parsedPreview];
    const routine = { ...next[rIdx] };
    const currentDays = routine.days.filter((d) => d !== 'Any Day');

    if (currentDays.includes(day)) {
      routine.days = currentDays.filter((d) => d !== day);
    } else {
      routine.days = [...currentDays, day];
    }
    next[rIdx] = routine;
    setParsedPreview(next);
  };

  const handleUpdateExerciseSets = (rIdx: number, exId: string, delta: number) => {
    if (!parsedPreview) return;
    const next = [...parsedPreview];
    const routine = { ...next[rIdx] };
    routine.exercises = routine.exercises.map((e) =>
      e.id === exId ? { ...e, sets: Math.max(1, (Number(e.sets) || 3) + delta) } : e
    );
    next[rIdx] = routine;
    setParsedPreview(next);
  };

  const handleUpdateExerciseReps = (rIdx: number, exId: string, reps: string) => {
    if (!parsedPreview) return;
    const next = [...parsedPreview];
    const routine = { ...next[rIdx] };
    routine.exercises = routine.exercises.map((e) =>
      e.id === exId ? { ...e, reps } : e
    );
    next[rIdx] = routine;
    setParsedPreview(next);
  };

  const handleMoveExercise = (rIdx: number, eIdx: number, direction: 'up' | 'down') => {
    if (!parsedPreview) return;
    const next = [...parsedPreview];
    const routine = { ...next[rIdx] };
    const list = [...routine.exercises];
    const targetIdx = direction === 'up' ? eIdx - 1 : eIdx + 1;

    if (targetIdx < 0 || targetIdx >= list.length) return;
    const [moved] = list.splice(eIdx, 1);
    list.splice(targetIdx, 0, moved);

    routine.exercises = list.map((e, idx) => ({ ...e, order_in_routine: idx }));
    next[rIdx] = routine;
    setParsedPreview(next);
  };

  const handleRemoveExercise = (rIdx: number, exId: string) => {
    if (!parsedPreview) return;
    const next = [...parsedPreview];
    const routine = { ...next[rIdx] };
    routine.exercises = routine.exercises.filter((e) => e.id !== exId);
    next[rIdx] = routine;
    setParsedPreview(next);
  };

  const handleReplaceExerciseWithCatalog = (catEx: typeof EXERCISE_CATALOG[0]) => {
    if (!parsedPreview || !editingExerciseTarget) return;
    const { routineIndex, exerciseId } = editingExerciseTarget;

    const next = [...parsedPreview];
    const routine = { ...next[routineIndex] };

    routine.exercises = routine.exercises.map((e) => {
      if (e.id !== exerciseId) return e;
      return {
        ...e,
        catalog_id: catEx.id,
        name: catEx.name,
        target_muscle: catEx.target_muscle,
        thumbnail_url: catEx.thumbnail_url,
        youtube_id: catEx.youtube_id,
        youtube_url: `https://www.youtube.com/watch?v=${catEx.youtube_id}`,
      };
    });

    next[routineIndex] = routine;
    setParsedPreview(next);
    setEditingExerciseTarget(null);
    setCatalogSearch('');
  };

  const handleConfirmSave = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    // Ensure all routines have at least one day and current user ID
    const validated = parsedPreview.map((r) => ({
      ...r,
      user_id: user?.id || r.user_id || 'demo-user-001',
      days: r.days && r.days.length > 0 && !r.days.includes('Any Day') ? r.days : ['Monday', 'Wednesday', 'Friday'],
    }));

    onRoutinesSaved(validated);
    onClose();
    setText('');
    setParsedPreview(null);
    setUnmatchedExercises([]);
  };

  const catalogSearchResults = searchExercises(catalogSearch, 'All');

  return (
    <NuviaBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      triggerRef={triggerRef}
      title={
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#30D158] to-[#0A84FF] flex items-center justify-center text-black">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-base font-bold text-white">Import Routine from AI</span>
        </div>
      }
      subtitle={
        parsedPreview
          ? 'Review and customize your split before saving'
          : 'Paste text from ChatGPT, Claude, or coach'
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!parsedPreview ? (
          /* STEP 1: Paste Raw AI Text */
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#8E8E93]">
                  Workout Routine Text:
                </label>
                <div className="flex items-center gap-3">
                  {text.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      title="Clear textarea"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePasteSample}
                    className="text-xs text-[#30D158] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Use example</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your workout split here...&#10;&#10;Tap 'Use example' above to see the recommended format."
                className="w-full p-3.5 text-xs font-mono rounded-2xl bg-[#121214] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158] leading-relaxed resize-none"
              />
            </div>

            <div className="p-3 rounded-2xl bg-[#121214] border border-white/[0.06] text-[11px] text-[#8E8E93] space-y-1">
              <p className="font-semibold text-white">✨ What Nuvia AI will do:</p>
              <p>• Extract each routine split, target days, and exercise movements</p>
              <p>• Automatically bind verified exercise library thumbnails & videos</p>
              <p>• Let you review and customize all sets, reps, and days before saving</p>
            </div>

            <button
              type="button"
              disabled={loading || !text.trim()}
              onClick={handleParse}
              className="w-full py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing & Building Routine...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze & Review Routine</span>
                </>
              )}
            </button>
          </>
        ) : (
          /* STEP 2: Interactive Review & Verification Screen */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#30D158] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{parsedPreview.length} Routine Split(s) Detected</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setParsedPreview(null);
                  setUnmatchedExercises([]);
                }}
                className="text-xs text-[#8E8E93] hover:text-white cursor-pointer"
              >
                Edit Input Text
              </button>
            </div>

            {unmatchedExercises.length > 0 && (
              <div className="p-3 rounded-xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 text-[#FF9F0A] text-xs space-y-1">
                <p className="font-semibold">⚠ {unmatchedExercises.length} uncertain exercise match(es):</p>
                <p className="text-[11px] opacity-80">
                  Use the Edit button on any movement below to select the exact catalog match.
                </p>
              </div>
            )}

            {/* List of routines to review */}
            <div className="space-y-4">
              {parsedPreview.map((routine, rIdx) => {
                const hasDays = routine.days.some((d) => d !== 'Any Day');

                return (
                  <div
                    key={routine.id || rIdx}
                    className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08] space-y-3"
                  >
                    {/* Title & Focus */}
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">{routine.title}</h4>
                      <span className="text-[10px] text-[#30D158] font-semibold">{routine.focus}</span>
                    </div>

                    {/* Training Day Toggle Pills */}
                    <div className="space-y-1 pt-1 border-t border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
                          Assigned Days:
                        </label>
                        {!hasDays && (
                          <span className="text-[10px] text-[#FF9F0A] font-semibold">Select at least 1 day</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.map((day) => {
                          const isSelected = routine.days.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleDay(rIdx, day)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
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

                    {/* Exercises in Routine */}
                    <div className="space-y-2 pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                        Exercises ({routine.exercises.length})
                      </span>

                      <div className="space-y-2">
                        {routine.exercises.map((ex, eIdx) => {
                          const isExact = Boolean(ex.catalog_id);

                          return (
                            <div
                              key={ex.id || eIdx}
                              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                {/* Order steppers */}
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={eIdx === 0}
                                    onClick={() => handleMoveExercise(rIdx, eIdx, 'up')}
                                    className="w-4 h-4 rounded bg-white/5 disabled:opacity-20 flex items-center justify-center text-zinc-300 cursor-pointer"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={eIdx === routine.exercises.length - 1}
                                    onClick={() => handleMoveExercise(rIdx, eIdx, 'down')}
                                    className="w-4 h-4 rounded bg-white/5 disabled:opacity-20 flex items-center justify-center text-zinc-300 cursor-pointer"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                                  <ExerciseThumbnail exercise={ex} className="w-full h-full object-cover" />
                                </div>

                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">{isExact ? '✓' : '⚠️'}</span>
                                    <p className="font-bold text-white text-xs truncate">{ex.name}</p>
                                  </div>
                                  <p className="text-[10px] text-[#8E8E93]">{ex.target_muscle}</p>
                                </div>
                              </div>

                              {/* Sets & Reps quick inline controls */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-lg border border-white/5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateExerciseSets(rIdx, ex.id, -1)}
                                    className="text-[#8E8E93] hover:text-white cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="font-bold text-white">{ex.sets}s</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateExerciseSets(rIdx, ex.id, 1)}
                                    className="text-[#8E8E93] hover:text-white cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  value={ex.reps}
                                  onChange={(e) => handleUpdateExerciseReps(rIdx, ex.id, e.target.value)}
                                  className="w-14 px-1 py-0.5 bg-black/40 text-center text-[10px] font-semibold text-white rounded border border-white/5 focus:outline-none focus:border-[#30D158]"
                                />

                                {/* Replace from catalog */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingExerciseTarget({ routineIndex: rIdx, exerciseId: ex.id })
                                  }
                                  className="p-1 rounded hover:bg-white/10 text-[#30D158] cursor-pointer"
                                  title="Swap with catalog match"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveExercise(rIdx, ex.id)}
                                  className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 cursor-pointer"
                                  title="Remove movement"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirm & Save Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmSave}
                className="flex-1 py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm Plan & Save to My Routines</span>
              </button>

              <button
                type="button"
                onClick={() => setParsedPreview(null)}
                className="py-3.5 px-5 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-xs font-medium cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL OVERLAY: Swap uncertain AI exercise with catalog match */}
      {editingExerciseTarget && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md p-4 flex flex-col justify-between animate-fadeIn">
          <div className="max-w-md w-full mx-auto flex-1 flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="text-sm font-bold text-white">Select Verified Catalog Movement</h4>
              <button
                type="button"
                onClick={() => setEditingExerciseTarget(null)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-3" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search catalog exercises..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#30D158]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {catalogSearchResults.map((catEx) => (
                <button
                  key={catEx.id}
                  type="button"
                  onClick={() => handleReplaceExerciseWithCatalog(catEx)}
                  className="w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                      <img src={catEx.thumbnail_url} alt={catEx.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{catEx.name}</p>
                      <span className="text-[10px] text-[#8E8E93]">{catEx.target_muscle}</span>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-[#30D158]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </NuviaBottomSheet>
  );
}
