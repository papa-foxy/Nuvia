'use client';

import React, { useState } from 'react';
import { X, Sparkles, Wand2, Check, ArrowRight, Play, AlertCircle } from 'lucide-react';
import { WorkoutRoutine } from '@/types/routine';
import { useAuth } from '@/lib/auth-context';

interface PasteAiRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutinesSaved: (routines: WorkoutRoutine[]) => void;
}

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
}: PasteAiRoutineModalProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedPreview, setParsedPreview] = useState<WorkoutRoutine[] | null>(null);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setText(SAMPLE_AI_ROUTINE);
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
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error analyzing routine. Please check format.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSave = () => {
    if (parsedPreview && parsedPreview.length > 0) {
      onRoutinesSaved(parsedPreview);
      onClose();
      setText('');
      setParsedPreview(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-[#1C1C1E] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-slideUp max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#30D158] to-[#0A84FF] flex items-center justify-center text-black">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Routine from AI</h3>
              <p className="text-xs text-[#8E8E93]">Paste consultation text from your AI Coach</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!parsedPreview ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                    AI Consultation Text
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteSample}
                    className="text-xs text-[#30D158] hover:underline font-medium flex items-center gap-1"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Paste Sample Routine</span>
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your AI workout split here, for example:&#10;&#10;Monday & Wednesday - Upper Body (Push-up Board + Dumbbells)&#10;• Push-ups (Blue/Chest position) - 4x10-12&#10;• Dumbbell shoulder press - 3x10-12&#10;• Dumbbell bicep curls - 3x12"
                  className="w-full p-3.5 text-xs font-mono rounded-2xl bg-[#121214] border border-white/[0.08] text-white focus:outline-none focus:border-[#30D158] leading-relaxed resize-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#121214] border border-white/[0.06] text-[11px] text-[#8E8E93] space-y-1">
                <p className="font-semibold text-white">✨ What Nuvia AI will do:</p>
                <p>• Extract each routine split, target days, and exercise list</p>
                <p>• Automatically bind small pictures/thumbnails for each movement</p>
                <p>• Link verified YouTube tutorial videos with in-app player</p>
              </div>

              <button
                type="button"
                disabled={loading || !text.trim()}
                onClick={handleParse}
                className="w-full py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing & Building Routine...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Identify & Build Routine</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* Parsed Routine Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#30D158] uppercase tracking-wider">
                  ✓ {parsedPreview.length} Routine(s) Identified
                </span>
                <button
                  type="button"
                  onClick={() => setParsedPreview(null)}
                  className="text-xs text-[#8E8E93] hover:text-white"
                >
                  Edit Input Text
                </button>
              </div>

              <div className="space-y-3">
                {parsedPreview.map((routine, rIdx) => (
                  <div
                    key={routine.id || rIdx}
                    className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white">{routine.title}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {routine.days.map((d) => (
                            <span
                              key={d}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#A1A1A6]"
                            >
                              {d}
                            </span>
                          ))}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158]">
                            {routine.exercises.length} exercises
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Exercise List preview with small pictures */}
                    <div className="divide-y divide-white/[0.04]">
                      {routine.exercises.map((ex) => (
                        <div key={ex.id} className="py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <img
                              src={ex.thumbnail_url}
                              alt={ex.name}
                              className="w-8 h-8 rounded-lg bg-black/40 p-0.5 border border-white/[0.06] shrink-0 object-contain"
                            />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-white truncate">{ex.name}</p>
                              <p className="text-[10px] text-[#8E8E93]">
                                {ex.target_muscle} · {ex.sets} sets × {ex.reps}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-5 h-5 rounded-full bg-[#FF0000]/15 text-[#FF0000] flex items-center justify-center">
                              <Play className="w-2.5 h-2.5 fill-[#FF0000]" />
                            </span>
                            <span className="text-[10px] text-[#8E8E93]">Video Ready</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="flex-1 py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save to My Routines</span>
                </button>

                <button
                  type="button"
                  onClick={() => setParsedPreview(null)}
                  className="py-3.5 px-5 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-xs font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
