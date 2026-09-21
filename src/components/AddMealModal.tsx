'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, X, AlertCircle, Sparkles } from 'lucide-react';
import { AiService, MealAnalysisResult } from '@/lib/ai-service';
import { MealType } from '@/types/database';
import { MealResultModal } from './MealResultModal';
import { useAuth } from '@/lib/auth-context';
import { FitnessContextService } from '@/lib/fitness-context-service';
import { NaturalLanguageLoggingContext, ContextualSuggestion } from '@/types/natural-language';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMeal: (mealData: any) => Promise<void>;
  initialMealType?: MealType;
  initialMealPrompt?: string;
  initialAnalysisResult?: MealAnalysisResult | null;
  initialContextBadge?: string;
  initialContextNote?: string;
}

// Client-side image compressor for mobile camera photos
function compressImage(fileOrDataUrl: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1280;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : URL.createObjectURL(fileOrDataUrl));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

export function AddMealModal({
  isOpen,
  onClose,
  onSaveMeal,
  initialMealType = 'lunch',
  initialMealPrompt,
  initialAnalysisResult,
  initialContextBadge,
  initialContextNote,
}: AddMealModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'photo' | 'text'>(initialMealPrompt ? 'text' : 'photo');
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [description, setDescription] = useState(initialMealPrompt || '');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [analysisResult, setAnalysisResult] = useState<MealAnalysisResult | null>(initialAnalysisResult || null);
  const [contextBadge, setContextBadge] = useState<string | undefined>(initialContextBadge);
  const [contextNote, setContextNote] = useState<string | undefined>(initialContextNote);
  const [nlContext, setNlContext] = useState<NaturalLanguageLoggingContext | null>(null);
  const [suggestions, setSuggestions] = useState<ContextualSuggestion[]>([]);

  useEffect(() => {
    if (initialAnalysisResult) {
      setAnalysisResult(initialAnalysisResult);
    }
    if (initialMealPrompt) {
      setDescription(initialMealPrompt);
      setActiveTab('text');
    }
    if (initialContextBadge) setContextBadge(initialContextBadge);
    if (initialContextNote) setContextNote(initialContextNote);
  }, [initialAnalysisResult, initialMealPrompt, initialContextBadge, initialContextNote]);

  useEffect(() => {
    if (isOpen) {
      FitnessContextService.getNaturalLanguageLoggingContext(user?.id)
        .then((ctx) => {
          setNlContext(ctx);
          const sug = FitnessContextService.generateContextualSuggestions(ctx);
          setSuggestions(sug.filter((s) => s.type === 'meal'));
        })
        .catch(console.warn);
    }
  }, [isOpen, user?.id]);

  // Hidden file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setErrorMsg('');
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      // Reset input value so user can take photo again if needed
      e.target.value = '';
    }
  };

  const handleAnalyze = async () => {
    setErrorMsg('');
    if (activeTab === 'photo' && !imagePreview && !description.trim()) {
      setErrorMsg('Please take a food picture or enter a meal description.');
      return;
    }
    if (activeTab === 'text' && !description.trim()) {
      setErrorMsg('Please describe what you ate.');
      return;
    }

    setIsAnalyzing(true);
    try {
      if (activeTab === 'text' && !imagePreview) {
        // Use unified contextual parser for rich food memory matching
        const parsed = await AiService.parseNaturalInput({
          text: description.trim(),
          context: nlContext || undefined,
        });

        if (parsed.meal_data) {
          const mappedFoods = parsed.meal_data.foods.map((f) => ({
            name: f.name,
            estimated_quantity: f.estimated_quantity,
            unit: f.unit,
            calories: f.calories,
            protein_g: f.protein_g,
            carbs_g: f.carbs_g,
            fat_g: f.fat_g,
            confidence: (f.confidence || 'high') as any,
          }));

          setAnalysisResult({
            meal_type: parsed.meal_data.meal_type || mealType,
            meal_name: parsed.meal_data.meal_name,
            foods: mappedFoods,
            total: parsed.meal_data.total,
            confidence: parsed.confidence,
            assumptions: parsed.meal_data.assumptions || [],
            notes: parsed.meal_data.notes,
          });

          if (parsed.context_match?.badge_label) {
            setContextBadge(parsed.context_match.badge_label);
            setContextNote(parsed.context_match.note || undefined);
          }
          return;
        }
      }

      const result = await AiService.analyzeMeal({
        imageBase64: imagePreview || undefined,
        mimeType: 'image/jpeg',
        textPrompt: description.trim() || undefined,
        mealType,
      });
      setAnalysisResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || "We couldn't analyze this right now. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetForm = () => {
    setImagePreview(null);
    setDescription('');
    setAnalysisResult(null);
    setErrorMsg('');
  };

  const handleCloseAll = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-0 pb-[calc(56px+env(safe-area-inset-bottom,0px))]">
        <div className="w-full max-w-md bg-[#1C1C1E] border-t border-x border-b-0 border-white/[0.08] rounded-t-[28px] rounded-b-none max-h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px)-0.5rem)] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#30D158]" />
              <h3 className="text-base font-semibold text-white">Log Meal & Calculate Calories</h3>
            </div>
            <button
              onClick={handleCloseAll}
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
                onClick={() => setActiveTab('photo')}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'photo' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-[#30D158]" />
                <span>Camera & Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'text' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
                }`}
              >
                Text
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto space-y-4">
            {/* Meal Category */}
            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                Category
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    className={`py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
                      mealType === t
                        ? 'bg-white text-black font-semibold'
                        : 'bg-[#121214] text-[#8E8E93] hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Mode */}
            {activeTab === 'photo' && (
              <div className="space-y-3">
                {/* Hidden Native File Inputs */}
                {/* 1. Phone Camera Input (triggers native mobile phone camera directly) */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* 2. Photo Library Input */}
                <input
                  type="file"
                  ref={libraryInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* State 1: Photo Preview (When image has been taken or selected) */}
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden h-52 border border-white/[0.08] bg-black shadow-lg">
                    <img src={imagePreview} alt="Captured Food" className="w-full h-full object-cover" />

                    {/* Scan Line Animation while analyzing */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#30D158]/25 to-transparent animate-pulse pointer-events-none flex flex-col justify-center items-center">
                        <div className="w-full h-1 bg-[#30D158] shadow-[0_0_15px_#30D158]" />
                        <div className="mt-3 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-[#30D158]/40 text-xs font-semibold text-[#30D158] flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Nuvia AI is calculating calories...</span>
                        </div>
                      </div>
                    )}

                    {!isAnalyzing && (
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs text-white hover:bg-black/90 flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Retake</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs text-[#FF453A] hover:bg-black/90"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* State 2: Capture / Select Options */
                  <div className="space-y-2.5">
                    {/* Primary Option: Take Photo with Phone Camera */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-[#30D158]/15 via-[#1C1C1E] to-[#121214] border border-[#30D158]/30 hover:border-[#30D158] transition-all flex items-center gap-3.5 group active:scale-[0.99]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#30D158] text-black flex items-center justify-center shrink-0 shadow-lg shadow-[#30D158]/20 group-hover:scale-105 transition-transform">
                        <Camera className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white">Take Photo</p>
                          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#30D158] text-black">
                            Camera
                          </span>
                        </div>
                        <p className="text-xs text-[#8E8E93] mt-0.5">
                          Direct phone camera capture & AI calorie calculation
                        </p>
                      </div>
                    </button>

                    {/* Secondary Option: Photo Library */}
                    <button
                      type="button"
                      onClick={() => libraryInputRef.current?.click()}
                      className="w-full text-left p-3.5 rounded-2xl bg-[#121214] hover:bg-[#2C2C2E] border border-white/[0.08] hover:border-white/[0.2] transition-colors flex items-center gap-3.5 group active:scale-[0.99]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#AF52DE]/15 text-[#AF52DE] border border-[#AF52DE]/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Choose from Photo Library</p>
                        <p className="text-xs text-[#8E8E93] mt-0.5">
                          Upload existing food photo from gallery
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {isCompressing && (
                  <p className="text-xs text-[#30D158] flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing & optimizing photo...</span>
                  </p>
                )}

                <div>
                  <label className="block text-xs text-[#8E8E93] mb-1">
                    Meal Notes / Ingredients (optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Grilled chicken breast with white rice & broccoli"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/[0.06] text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#30D158]"
                  />
                </div>
              </div>
            )}

            {/* Text Mode */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell Nuvia what you ate (e.g. 2 eggs with toast, chicken rice, or a protein shake)..."
                  className="w-full p-3.5 rounded-xl bg-[#121214] border border-white/[0.06] text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#30D158] resize-none"
                />

                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {suggestions.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDescription(preset.text)}
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
          </div>

          {/* Bottom Action */}
          <div className="p-4 border-t border-white/[0.08]">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isCompressing || (activeTab === 'photo' && !imagePreview && !description.trim())}
              className="w-full py-3.5 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#30D158]/20"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculating Calories with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-black" />
                  <span>Calculate Calories with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {analysisResult && (
        <MealResultModal
          initialData={analysisResult}
          imagePreviewUrl={imagePreview}
          source={activeTab === 'photo' ? 'photo' : 'text'}
          contextBadge={contextBadge}
          contextNote={contextNote}
          onSave={async (mealData) => {
            await onSaveMeal({
              ...mealData,
              image_url: imagePreview,
              source: activeTab === 'photo' ? 'photo' : 'text',
              ai_analysis: analysisResult,
            });
          }}
          onClose={() => {
            setAnalysisResult(null);
            handleCloseAll();
          }}
          onAddAnother={() => {
            resetForm();
          }}
        />
      )}
    </>
  );
}
