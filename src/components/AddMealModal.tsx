'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Video, RefreshCw, X, AlertCircle, Sparkles, FlipHorizontal, Check } from 'lucide-react';
import { AiService, MealAnalysisResult } from '@/lib/ai-service';
import { MealType } from '@/types/database';
import { MealResultModal } from './MealResultModal';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMeal: (mealData: any) => Promise<void>;
  initialMealType?: MealType;
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
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
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
}: AddMealModalProps) {
  const [activeTab, setActiveTab] = useState<'photo' | 'text'>('photo');
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [analysisResult, setAnalysisResult] = useState<MealAnalysisResult | null>(null);

  // In-app live camera viewfinder state
  const [isLiveCamera, setIsLiveCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Hidden file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  // Live camera stream refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // stopCameraStream must be defined BEFORE the useEffect that calls it
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsLiveCamera(false);
  };

  // Clean up camera stream on close or unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const startLiveCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setErrorMsg('');
    setCameraError(null);
    stopCameraStream();

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Camera access not supported in this browser. Please use Phone Camera button.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsLiveCamera(true);
      setFacingMode(facing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Live camera error:', err);
      setCameraError(err.message || 'Could not access device camera.');
      setIsLiveCamera(false);
    }
  };

  const flipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startLiveCamera(nextFacing);
  };

  const captureLiveFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawData = canvas.toDataURL('image/jpeg', 0.9);

    stopCameraStream();
    setIsCompressing(true);
    try {
      const compressed = await compressImage(rawData);
      setImagePreview(compressed);
      setErrorMsg('');
    } catch (e) {
      setImagePreview(rawData);
    } finally {
      setIsCompressing(false);
    }
  };

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
    stopCameraStream();
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
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full max-w-md bg-[#1C1C1E] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
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
                onClick={() => {
                  stopCameraStream();
                  setActiveTab('photo');
                }}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'photo' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-[#30D158]" />
                <span>Camera & Photo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setActiveTab('text');
                }}
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

                {/* State 1: Live In-App Camera Viewfinder */}
                {isLiveCamera && (
                  <div className="relative rounded-2xl overflow-hidden bg-black border border-white/[0.15] aspect-[4/3] flex flex-col justify-between">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Viewfinder Target Frame Overlay */}
                    <div className="absolute inset-4 border-2 border-white/40 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                      <div className="flex justify-between text-[10px] text-white/70 font-mono tracking-wider">
                        <span>[ NUVIA AI LENS ]</span>
                        <span>{facingMode.toUpperCase()}</span>
                      </div>
                      <p className="text-center text-xs text-white/90 bg-black/50 py-1 px-3 rounded-full mx-auto backdrop-blur-md">
                        Center food plate in viewfinder
                      </p>
                    </div>

                    {/* Live Camera Controls Header */}
                    <div className="relative z-10 p-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="px-2.5 py-1 rounded-lg bg-black/60 text-xs text-white backdrop-blur-md hover:bg-black/80"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={flipCamera}
                        className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/80"
                        title="Flip Camera"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Live Camera Shutter Button Footer */}
                    <div className="relative z-10 p-4 flex items-center justify-center bg-gradient-to-t from-black/80 to-transparent">
                      <button
                        type="button"
                        onClick={captureLiveFrame}
                        className="w-16 h-16 rounded-full border-4 border-white bg-white/20 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-2xl"
                        title="Snap Food Picture"
                      >
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <Camera className="w-6 h-6 text-black" />
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* State 2: Photo Preview */}
                {!isLiveCamera && imagePreview && (
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
                )}

                {/* State 3: Capture Buttons (When no image preview and not in live camera) */}
                {!isLiveCamera && !imagePreview && (
                  <div className="space-y-2.5">
                    {/* Primary Option: Take Picture with Phone Camera */}
                    <div
                      onClick={() => cameraInputRef.current?.click()}
                      className="group cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-[#30D158]/15 via-[#1C1C1E] to-[#121214] border border-[#30D158]/30 hover:border-[#30D158] transition-all flex items-center gap-3.5 active:scale-[0.99]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#30D158] text-black flex items-center justify-center shrink-0 shadow-lg shadow-[#30D158]/20 group-hover:scale-105 transition-transform">
                        <Camera className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white">Take Picture with Phone</p>
                          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#30D158] text-black">
                            Camera
                          </span>
                        </div>
                        <p className="text-xs text-[#8E8E93] mt-0.5">
                          Direct phone camera capture & AI calorie calculation
                        </p>
                      </div>
                    </div>

                    {/* Secondary Option: In-App Live Camera or Photo Library */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => startLiveCamera('environment')}
                        className="p-3 rounded-xl bg-[#121214] hover:bg-[#2C2C2E] border border-white/[0.08] hover:border-white/[0.2] transition-colors flex flex-col items-center justify-center gap-1.5 text-center group"
                      >
                        <Video className="w-5 h-5 text-[#0A84FF] group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-white">Live Viewfinder</span>
                        <span className="text-[10px] text-[#8E8E93]">In-app shutter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => libraryInputRef.current?.click()}
                        className="p-3 rounded-xl bg-[#121214] hover:bg-[#2C2C2E] border border-white/[0.08] hover:border-white/[0.2] transition-colors flex flex-col items-center justify-center gap-1.5 text-center group"
                      >
                        <ImageIcon className="w-5 h-5 text-[#AF52DE] group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-white">Photo Library</span>
                        <span className="text-[10px] text-[#8E8E93]">From camera roll</span>
                      </button>
                    </div>

                    {cameraError && (
                      <p className="text-xs text-[#FF9500] px-1">{cameraError}</p>
                    )}
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
                  placeholder="e.g. 2 eggs, 2 slices of wholemeal toast, and a cup of latte"
                  className="w-full p-3.5 rounded-xl bg-[#121214] border border-white/[0.06] text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#30D158] resize-none"
                />

                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Ayam gepuk with rice & sambal',
                    'Nasi lemak ayam goreng berempah',
                    'Roti canai with dhal',
                    'Hainanese chicken rice',
                    'Nasi kandar kuah campur',
                    'Mee goreng mamak with egg',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDescription(preset)}
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
