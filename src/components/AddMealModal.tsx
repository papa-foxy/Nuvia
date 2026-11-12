'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, X, AlertCircle, Sparkles } from 'lucide-react';
import { AiService, MealAnalysisResult } from '@/lib/ai-service';
import { MealAnalysisRunner, useMealAnalysis } from '@/lib/meal-analysis-runner';
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
  // Photo analysis runs in MealAnalysisRunner so it survives closing the sheet or the app.
  const analysis = useMealAnalysis();
  const backgroundBusy = analysis.status === 'analyzing';
  const analyzing = isAnalyzing || backgroundBusy;
  const shownImage = imagePreview ?? (analysis.status !== 'idle' ? analysis.image : null);
  const shownResult = analysisResult ?? (analysis.status === 'done' ? analysis.result ?? null : null);
  const shownError = errorMsg || (analysis.status === 'failed' ? analysis.error || '' : '');
  const resultSource: 'photo' | 'text' = shownImage ? 'photo' : activeTab === 'photo' ? 'photo' : 'text';

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
    MealAnalysisRunner.clear();
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

      MealAnalysisRunner.start({
        image: imagePreview,
        textPrompt: description.trim() || undefined,
        mealType,
      });
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
    // Closing while the photo is analyzing keeps it running in the background.
    if (analysis.status !== 'analyzing') MealAnalysisRunner.clear();
    onClose();
  };

  return (
    <>
      {/* Backdrop: bounded above bottom navigation */}
      <div
        className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity"
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={handleCloseAll}
        aria-hidden="true"
      />

      {/* Sheet / Modal Container: sits above backdrop (z-45) directly on top of nav */}
      <div
        className="fixed md:absolute left-0 right-0 z-45 flex items-end justify-center p-0 pointer-events-none"
        style={{
          bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto w-full max-w-md bg-card border-t border-x border-b-0 border-fg/[0.08] rounded-t-[28px] rounded-b-none max-h-[var(--sheet-max-h)] flex flex-col overflow-hidden shadow-2xl animate-slideUp"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-fg/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-green-ink" />
              <h3 className="text-base font-semibold text-fg">Log Meal & Calculate Calories</h3>
            </div>
            <button
              onClick={handleCloseAll}
              className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center text-muted hover:text-fg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="p-4 pb-0">
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface rounded-xl border border-fg/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('photo')}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'photo' ? 'bg-elevated text-fg shadow' : 'text-muted'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-green-ink" />
                <span>Camera & Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'text' ? 'bg-elevated text-fg shadow' : 'text-muted'
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
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
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
                        ? 'bg-fg text-app font-semibold'
                        : 'bg-surface text-muted hover:text-fg border border-fg/[0.04]'
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
                {shownImage ? (
                  <div className="relative rounded-2xl overflow-hidden h-52 border border-fg/[0.08] bg-app shadow-lg">
                    <img src={shownImage} alt="Captured Food" className="w-full h-full object-cover" />

                    {/* Scan Line Animation while analyzing */}
                    {analyzing && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/25 to-transparent animate-pulse pointer-events-none flex flex-col justify-center items-center">
                        <div className="w-full h-1 bg-accent shadow-[0_0_15px_var(--theme-accent)]" />
                        <div className="mt-3 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-accent/40 text-xs font-semibold text-green-ink flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Nuvia AI is calculating calories...</span>
                        </div>
                        {backgroundBusy && (
                          <p className="mt-2 px-3 py-1 rounded-full bg-black/70 text-[11px] font-medium text-white/90">
                            You can close Nuvia. We&apos;ll finish in the background.
                          </p>
                        )}
                      </div>
                    )}

                    {!analyzing && (
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
                          onClick={() => {
                            setImagePreview(null);
                            MealAnalysisRunner.clear();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs text-red-ink hover:bg-black/90"
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
                      className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-accent/15 via-card to-surface border border-accent/30 hover:border-accent transition-all flex items-center gap-3.5 group active:scale-[0.99]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-accent text-on-accent flex items-center justify-center shrink-0 shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
                        <Camera className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-fg">Take Photo</p>
                          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-accent text-on-accent">
                            Camera
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          Direct phone camera capture & AI calorie calculation
                        </p>
                      </div>
                    </button>

                    {/* Secondary Option: Photo Library */}
                    <button
                      type="button"
                      onClick={() => libraryInputRef.current?.click()}
                      className="w-full text-left p-3.5 rounded-2xl bg-surface hover:bg-elevated border border-fg/[0.08] hover:border-fg/[0.2] transition-colors flex items-center gap-3.5 group active:scale-[0.99]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#AF52DE]/15 text-[#AF52DE] border border-[#AF52DE]/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-fg">Choose from Photo Library</p>
                        <p className="text-xs text-muted mt-0.5">
                          Upload existing food photo from gallery
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {isCompressing && (
                  <p className="text-xs text-green-ink flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing & optimizing photo...</span>
                  </p>
                )}

                <div>
                  <label className="block text-xs text-muted mb-1">
                    Meal Notes / Ingredients (optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Grilled chicken breast with white rice & broccoli"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-fg/[0.06] text-xs text-fg placeholder-muted focus:outline-none focus:border-accent"
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
                  className="w-full p-3.5 rounded-xl bg-surface border border-fg/[0.06] text-xs text-fg placeholder-muted focus:outline-none focus:border-accent resize-none"
                />

                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {suggestions.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDescription(preset.text)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-surface hover:bg-elevated text-muted hover:text-fg border border-fg/[0.06] transition-colors flex items-center gap-1.5"
                      >
                        {preset.badge && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-accent/20 text-green-ink font-bold">
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

            {shownError && (
              <p className="text-xs text-red-ink flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{shownError}</span>
              </p>
            )}
          </div>

          {/* Bottom Action */}
          <div className="p-4 border-t border-fg/[0.08]">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || isCompressing || (activeTab === 'photo' && !shownImage && !description.trim())}
              className="w-full py-3.5 rounded-2xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
            >
              {analyzing ? (
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

      {shownResult && (
        <MealResultModal
          initialData={shownResult}
          imagePreviewUrl={shownImage}
          source={resultSource}
          contextBadge={contextBadge}
          contextNote={contextNote}
          onSave={async (mealData) => {
            await onSaveMeal({
              ...mealData,
              image_url: shownImage,
              source: resultSource,
              ai_analysis: shownResult,
            });
            // Saved: keep showing it here, but don't offer it again on the next launch.
            if (analysis.status === 'done') {
              setAnalysisResult(shownResult);
              setImagePreview(shownImage);
              MealAnalysisRunner.clear();
            }
          }}
          onClose={() => {
            setAnalysisResult(null);
            MealAnalysisRunner.clear();
            handleCloseAll();
          }}
          onAddAnother={() => {
            resetForm();
            MealAnalysisRunner.clear();
          }}
        />
      )}
    </>
  );
}
