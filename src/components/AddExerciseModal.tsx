'use client';

import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { AiService, ExerciseAnalysisResult } from '@/lib/ai-service';
import { useAuth } from '@/lib/auth-context';
import { IntensityLevel, EntrySource } from '@/types/database';

interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExercise: (exerciseData: any) => Promise<void>;
}

export function AddExerciseModal({
  isOpen,
  onClose,
  onSaveExercise,
}: AddExerciseModalProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

  // Manual mode state
  const [exerciseType, setExerciseType] = useState('Running');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [intensity, setIntensity] = useState<IntensityLevel>('moderate');
  const [distanceKm, setDistanceKm] = useState('');

  // AI Prompt state
  const [textPrompt, setTextPrompt] = useState('');

  // Result state
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedResult, setParsedResult] = useState<ExerciseAnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleParse = async () => {
    setErrorMsg('');
    setIsParsing(true);

    try {
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#1C1C1E] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
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
                placeholder="e.g. Ran 5km this morning for about 32 minutes"
                className="w-full p-3.5 rounded-xl bg-[#121214] border border-white/[0.06] text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#30D158] resize-none"
              />

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Ran 5km in 30 minutes',
                  'Chest and triceps workout for 45 min',
                  'Played badminton for 1 hour',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTextPrompt(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#121214] text-[#8E8E93] hover:text-white border border-white/[0.04]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
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
