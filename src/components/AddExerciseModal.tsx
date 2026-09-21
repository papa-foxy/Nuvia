'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Sparkles } from 'lucide-react';
import { AiService, ExerciseAnalysisResult } from '@/lib/ai-service';
import { useAuth } from '@/lib/auth-context';
import { IntensityLevel, EntrySource } from '@/types/database';
import { FitnessContextService } from '@/lib/fitness-context-service';
import {
  NaturalLanguageLoggingContext,
  ContextualSuggestion,
} from '@/types/natural-language';

interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExercise: (exerciseData: any) => Promise<void>;
  prefilledExercisePrompt?: string;
  initialParsedResult?: ExerciseAnalysisResult | null;
  initialContextBadge?: string;
  initialContextNote?: string;
}

export function AddExerciseModal({
  isOpen,
  onClose,
  onSaveExercise,
  prefilledExercisePrompt,
  initialParsedResult,
  initialContextBadge,
  initialContextNote,
}: AddExerciseModalProps) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>(
    prefilledExercisePrompt || initialParsedResult ? 'ai' : 'manual'
  );

  // Manual mode state
  const [exerciseType, setExerciseType] = useState('Running');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [intensity, setIntensity] = useState<IntensityLevel>('moderate');
  const [distanceKm, setDistanceKm] = useState('');

  // AI Prompt state
  const [textPrompt, setTextPrompt] = useState(prefilledExercisePrompt || '');

  // Result state
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedResult, setParsedResult] = useState<ExerciseAnalysisResult | null>(
    initialParsedResult || null
  );
  const [contextBadge, setContextBadge] = useState<string | undefined>(initialContextBadge);
  const [contextNote, setContextNote] = useState<string | undefined>(initialContextNote);
  const [nlContext, setNlContext] = useState<NaturalLanguageLoggingContext | null>(null);
  const [suggestions, setSuggestions] = useState<ContextualSuggestion[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialParsedResult) {
      setParsedResult(initialParsedResult);
      setActiveTab('ai');
    }
    if (prefilledExercisePrompt) {
      setTextPrompt(prefilledExercisePrompt);
      setActiveTab('ai');
    }
    if (initialContextBadge) setContextBadge(initialContextBadge);
    if (initialContextNote) setContextNote(initialContextNote);
  }, [initialParsedResult, prefilledExercisePrompt, initialContextBadge, initialContextNote]);

  useEffect(() => {
    if (isOpen) {
      FitnessContextService.getNaturalLanguageLoggingContext(user?.id)
        .then((ctx) => {
          setNlContext(ctx);
          const sug = FitnessContextService.generateContextualSuggestions(ctx);
          setSuggestions(
            sug.filter((s) => s.type === 'activity' || s.type === 'workout')
          );
        })
        .catch(console.warn);
    }
  }, [isOpen, user?.id]);

  // Restore draft when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem('nuvia_exercise_modal_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.activeTab) setActiveTab(draft.activeTab);
          if (draft.textPrompt) setTextPrompt(draft.textPrompt);
          if (draft.exerciseType) setExerciseType(draft.exerciseType);
          if (draft.durationMinutes) setDurationMinutes(draft.durationMinutes);
          if (draft.intensity) setIntensity(draft.intensity);
          if (draft.distanceKm) setDistanceKm(draft.distanceKm);
        }
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  // Persist draft to localStorage on edit
  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem(
          'nuvia_exercise_modal_draft',
          JSON.stringify({
            activeTab,
            textPrompt,
            exerciseType,
            durationMinutes,
            intensity,
            distanceKm,
          })
        );
      } catch {
        // ignore
      }
    }
  }, [isOpen, activeTab, textPrompt, exerciseType, durationMinutes, intensity, distanceKm]);

  if (!isOpen) return null;

  const handleParse = async () => {
    setErrorMsg('');
    setIsParsing(true);

    try {
      if (activeTab === 'ai') {
        const parsed = await AiService.parseNaturalInput({
          text: textPrompt.trim(),
          context: nlContext || undefined,
        });

        if (parsed.activity_data) {
          setParsedResult({
            exercise_type: parsed.activity_data.exercise_type,
            duration_minutes: parsed.activity_data.duration_minutes,
            intensity: parsed.activity_data.intensity,
            distance_km: parsed.activity_data.distance_km,
            calories_burned: parsed.activity_data.calories_burned,
            confidence: parsed.confidence,
            ai_tip: parsed.activity_data.ai_tip || 'Consistent training fuels steady progress.',
          });
          if (parsed.context_match?.badge_label) {
            setContextBadge(parsed.context_match.badge_label);
            setContextNote(parsed.context_match.note || undefined);
          }
          return;
        }
      }

      const res = await AiService.parseExercise({
        textPrompt: activeTab === 'ai' ? textPrompt.trim() : undefined,
        userWeightKg: profile?.weight_kg || 70,
        manualData:
          activeTab === 'manual'
            ? {
                exercise_type: exerciseType,
                duration_minutes: Number(durationMinutes) || 30,
                intensity,
                distance_km: distanceKm ? Number(distanceKm) : null,
              }
            : undefined,
      });

      setParsedResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "We couldn't analyze this exercise right now.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveToLog = async () => {
    if (!parsedResult) return;
    setSaving(true);
    await onSaveExercise({
      exercise_type: parsedResult.exercise_type,
      duration_minutes: parsedResult.duration_minutes,
      intensity: parsedResult.intensity,
      distance_km: parsedResult.distance_km,
      calories_burned: parsedResult.calories_burned,
      source: (activeTab === 'ai' ? 'text' : 'manual') as EntrySource,
      description: textPrompt || `${parsedResult.exercise_type} (${parsedResult.duration_minutes}m)`,
      confidence: parsedResult.confidence,
      ai_analysis: parsedResult,
    });
    setSaving(false);
    try {
      localStorage.removeItem('nuvia_exercise_modal_draft');
    } catch {
      // ignore
    }
    setTextPrompt('');
    setParsedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 pb-[calc(56px+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-md bg-[#1C1C1E] border-t border-x border-b-0 border-white/[0.08] rounded-t-[28px] rounded-b-none max-h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px)-0.5rem)] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Log Activity</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="p-4 pb-0">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#121214] rounded-xl border border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('manual');
                setParsedResult(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'manual' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
              }`}
            >
              Select Activity
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('ai');
                setParsedResult(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ai' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
              }`}
            >
              Prompt
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                  Activity
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    'Running',
                    'Strength Training',
                    'Cycling',
                    'Walking',
                    'HIIT',
                    'Badminton',
                    'Swimming',
                    'Yoga',
                  ].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setExerciseType(type)}
                      className={`p-3 rounded-xl text-xs font-medium text-left transition-colors ${
                        exerciseType === type
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#121214] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8E8E93] mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="30"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-[#30D158]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#8E8E93] mb-1">
                    Distance (km, optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    placeholder="e.g. 5.0"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-[#30D158]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#8E8E93] mb-1">
                  Intensity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'moderate', 'high'] as IntensityLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
                        intensity === lvl
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#121214] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-3">
              <textarea
                rows={3}
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                placeholder="Tell Nuvia what you did (e.g. Ran 5km in 30 minutes, or did my usual Saturday walk)..."
                className="w-full p-3.5 rounded-xl bg-[#121214] border border-white/[0.06] text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#30D158] resize-none"
              />

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {suggestions.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTextPrompt(preset.text)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-[#121214] hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-white border border-white/[0.06] transition-colors flex items-center gap-1.5"
                    >
                      {preset.badge && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#30D158]/20 text-[#30D158] font-bold">
                          {preset.badge}
                        </span>
                      )}
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-[#FF453A] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </p>
          )}

          {/* Parsed Result (Apple Health Inset Cell) */}
          {parsedResult && (
            <div className="bg-[#121214] p-4 rounded-2xl border border-white/[0.08] space-y-2">
              {contextBadge && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#30D158]/10 border border-[#30D158]/25 text-xs text-[#30D158] mb-1">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">{contextBadge}</span>
                  {contextNote && <span className="text-[#8E8E93] text-[11px]">· {contextNote}</span>}
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <div>
                  <h4 className="text-base font-semibold text-white">
                    {parsedResult.exercise_type}
                  </h4>
                  <p className="text-xs text-[#8E8E93]">
                    {parsedResult.duration_minutes} min
                    {parsedResult.distance_km ? ` · ${parsedResult.distance_km} km` : ''} ·{' '}
                    <span className="capitalize">{parsedResult.intensity}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">~{parsedResult.calories_burned}</span>
                  <span className="text-xs text-[#8E8E93] ml-1">kcal</span>
                </div>
              </div>

              {parsedResult.ai_tip && (
                <p className="text-xs text-[#A1A1A6] pt-1 border-t border-white/[0.06]">
                  <span className="font-semibold text-white">Nuvia: </span>
                  {parsedResult.ai_tip}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08]">
          {!parsedResult ? (
            <button
              onClick={handleParse}
              disabled={isParsing}
              className="w-full py-3.5 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-semibold text-sm transition-colors"
            >
              {isParsing ? 'Calculating...' : 'Calculate Expenditure'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSaveToLog}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl bg-[#30D158] text-black font-semibold text-sm"
              >
                {saving ? 'Saving...' : 'Save Activity'}
              </button>
              <button
                onClick={() => setParsedResult(null)}
                className="px-4 py-3.5 rounded-2xl bg-[#2C2C2E] text-white font-medium text-sm"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
