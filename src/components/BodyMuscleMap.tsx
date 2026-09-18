'use client';

import React, { useState } from 'react';
import { Dumbbell, Sparkles, CheckCircle2, Info } from 'lucide-react';

export interface MuscleGroup {
  id: string;
  name: string;
  view: 'front' | 'back' | 'both';
  exercisesCount?: number;
}

interface BodyMuscleMapProps {
  workedMuscles?: string[]; // e.g. ['chest', 'shoulders', 'triceps', 'abs', 'back']
  routineTitle?: string;
  onSelectMuscle?: (muscleId: string) => void;
}

export function BodyMuscleMap({
  workedMuscles = [],
  routineTitle,
  onSelectMuscle,
}: BodyMuscleMapProps) {
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  // Normalize worked muscles set for case-insensitive check
  const workedSet = new Set(
    workedMuscles.map((m) => m.toLowerCase().trim())
  );

  const isWorked = (id: string) => {
    if (workedSet.has(id.toLowerCase())) return true;
    // Map aliases
    if (id === 'core' && workedSet.has('abs')) return true;
    if (id === 'abs' && (workedSet.has('core') || workedSet.has('abdominals'))) return true;
    if (id === 'arms' && (workedSet.has('biceps') || workedSet.has('triceps'))) return true;
    return false;
  };

  const handleMuscleClick = (id: string) => {
    setSelectedMuscle(selectedMuscle === id ? null : id);
    if (onSelectMuscle) onSelectMuscle(id);
  };

  const getMuscleColor = (id: string) => {
    const worked = isWorked(id);
    const selected = selectedMuscle === id;

    if (selected) return '#30D158'; // Bright Emerald selected
    if (worked) return '#FF9500'; // Active Amber
    return '#2C2C2E'; // Neutral dark
  };

  const getMuscleFilter = (id: string) => {
    if (selectedMuscle === id) return 'drop-shadow(0 0 8px rgba(48, 209, 88, 0.8))';
    if (isWorked(id)) return 'drop-shadow(0 0 6px rgba(255, 149, 0, 0.6))';
    return 'none';
  };

  const muscleLabels: Record<string, string> = {
    chest: 'Chest / Pectorals',
    shoulders: 'Shoulders / Deltoids',
    biceps: 'Biceps',
    triceps: 'Triceps',
    abs: 'Abs & Core',
    back: 'Upper Back & Lats',
    quads: 'Quadriceps',
    hamstrings: 'Hamstrings & Glutes',
    calves: 'Calves',
  };

  return (
    <div className="ios-card p-4 space-y-3.5">
      {/* Header & View Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Muscle Activation Heatmap
            </span>
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#FF9500]/20 text-[#FF9500]">
              LIVE
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-0.5">
            {routineTitle || 'Targeted Muscle Groups'}
          </p>
        </div>

        <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveView('front')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              activeView === 'front'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setActiveView('back')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              activeView === 'back'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Back
          </button>
        </div>
      </div>

      {/* Interactive Silhouette Display */}
      <div className="relative bg-[#141416] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center min-h-[260px]">
        {/* SVG Body Diagram */}
        <div className="relative w-44 h-56 flex items-center justify-center">
          {activeView === 'front' ? (
            /* FRONT VIEW SVG */
            <svg viewBox="0 0 160 220" className="w-full h-full">
              {/* Head / Neck */}
              <circle cx="80" cy="20" r="14" fill="#2C2C2E" />
              <path d="M74 34 L86 34 L88 44 L72 44 Z" fill="#2C2C2E" />

              {/* Shoulders (Deltoids) */}
              <path
                id="shoulders-left"
                d="M52 46 C48 46 44 50 42 58 C41 64 45 68 50 66 C53 60 55 52 56 47 Z"
                fill={getMuscleColor('shoulders')}
                style={{ filter: getMuscleFilter('shoulders'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('shoulders')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="shoulders-right"
                d="M108 46 C112 46 116 50 118 58 C119 64 115 68 110 66 C107 60 105 52 104 47 Z"
                fill={getMuscleColor('shoulders')}
                style={{ filter: getMuscleFilter('shoulders'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('shoulders')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Chest (Pectorals) */}
              <path
                id="chest-left"
                d="M57 48 C66 48 76 52 78 66 C73 73 60 74 55 70 C54 62 55 54 57 48 Z"
                fill={getMuscleColor('chest')}
                style={{ filter: getMuscleFilter('chest'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('chest')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="chest-right"
                d="M103 48 C94 48 84 52 82 66 C87 73 100 74 105 70 C106 62 105 54 103 48 Z"
                fill={getMuscleColor('chest')}
                style={{ filter: getMuscleFilter('chest'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('chest')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Biceps (Front Arms) */}
              <path
                id="biceps-left"
                d="M40 68 C38 74 37 84 41 90 C45 90 48 84 47 76 C47 71 44 68 40 68 Z"
                fill={getMuscleColor('biceps')}
                style={{ filter: getMuscleFilter('biceps'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('biceps')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="biceps-right"
                d="M120 68 C122 74 123 84 119 90 C115 90 112 84 113 76 C113 71 116 68 120 68 Z"
                fill={getMuscleColor('biceps')}
                style={{ filter: getMuscleFilter('biceps'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('biceps')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Forearms */}
              <path d="M38 94 L32 120 L40 120 L44 94 Z" fill="#242426" />
              <path d="M122 94 L128 120 L120 120 L116 94 Z" fill="#242426" />

              {/* Abs & Core (Abdominals) */}
              <path
                id="abs"
                d="M66 74 L94 74 C96 86 96 100 93 112 C88 116 72 116 67 112 C64 100 64 86 66 74 Z"
                fill={getMuscleColor('abs')}
                style={{ filter: getMuscleFilter('abs'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('abs')}
                className="cursor-pointer hover:opacity-80"
              />
              {/* Abdominal six-pack dividing lines */}
              <line x1="80" y1="74" x2="80" y2="112" stroke="#161618" strokeWidth="1.5" />
              <line x1="68" y1="87" x2="92" y2="87" stroke="#161618" strokeWidth="1.5" />
              <line x1="68" y1="99" x2="92" y2="99" stroke="#161618" strokeWidth="1.5" />

              {/* Hips / Waist */}
              <path d="M64 114 L96 114 L92 126 L68 126 Z" fill="#2C2C2E" />

              {/* Quads / Front Thighs */}
              <path
                id="quads-left"
                d="M62 128 C62 142 63 158 66 168 C73 168 76 156 77 138 C77 130 76 126 73 126 Z"
                fill={getMuscleColor('quads')}
                style={{ filter: getMuscleFilter('quads'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('quads')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="quads-right"
                d="M98 128 C98 142 97 158 94 168 C87 168 84 156 83 138 C83 130 84 126 87 126 Z"
                fill={getMuscleColor('quads')}
                style={{ filter: getMuscleFilter('quads'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('quads')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Knees */}
              <circle cx="68" cy="172" r="4" fill="#242426" />
              <circle cx="92" cy="172" r="4" fill="#242426" />

              {/* Calves Front */}
              <path
                id="calves-left"
                d="M65 178 C63 186 63 198 66 210 L72 210 C74 198 74 186 71 178 Z"
                fill={getMuscleColor('calves')}
                style={{ filter: getMuscleFilter('calves'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('calves')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="calves-right"
                d="M95 178 C97 186 97 198 94 210 L88 210 C86 198 86 186 89 178 Z"
                fill={getMuscleColor('calves')}
                style={{ filter: getMuscleFilter('calves'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('calves')}
                className="cursor-pointer hover:opacity-80"
              />
            </svg>
          ) : (
            /* BACK VIEW SVG */
            <svg viewBox="0 0 160 220" className="w-full h-full">
              {/* Head / Back of Neck */}
              <circle cx="80" cy="20" r="14" fill="#2C2C2E" />
              <path d="M74 34 L86 34 L88 44 L72 44 Z" fill="#2C2C2E" />

              {/* Rear Deltoids */}
              <path
                id="rear-delts-left"
                d="M52 46 C48 46 44 50 42 58 C41 64 45 68 50 66 C53 60 55 52 56 47 Z"
                fill={getMuscleColor('shoulders')}
                style={{ filter: getMuscleFilter('shoulders'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('shoulders')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="rear-delts-right"
                d="M108 46 C112 46 116 50 118 58 C119 64 115 68 110 66 C107 60 105 52 104 47 Z"
                fill={getMuscleColor('shoulders')}
                style={{ filter: getMuscleFilter('shoulders'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('shoulders')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Back (Upper Back, Traps & Lats) */}
              <path
                id="back"
                d="M56 46 L104 46 L96 76 C94 92 88 106 80 112 C72 106 66 92 64 76 Z"
                fill={getMuscleColor('back')}
                style={{ filter: getMuscleFilter('back'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('back')}
                className="cursor-pointer hover:opacity-80"
              />
              <line x1="80" y1="46" x2="80" y2="112" stroke="#161618" strokeWidth="1.5" />

              {/* Triceps (Back Arms) */}
              <path
                id="triceps-left"
                d="M40 68 C38 74 37 84 41 90 C45 90 48 84 47 76 C47 71 44 68 40 68 Z"
                fill={getMuscleColor('triceps')}
                style={{ filter: getMuscleFilter('triceps'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('triceps')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="triceps-right"
                d="M120 68 C122 74 123 84 119 90 C115 90 112 84 113 76 C113 71 116 68 120 68 Z"
                fill={getMuscleColor('triceps')}
                style={{ filter: getMuscleFilter('triceps'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('triceps')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Forearms */}
              <path d="M38 94 L32 120 L40 120 L44 94 Z" fill="#242426" />
              <path d="M122 94 L128 120 L120 120 L116 94 Z" fill="#242426" />

              {/* Glutes / Lower Back */}
              <path
                id="glutes"
                d="M64 114 L96 114 C98 126 95 136 88 140 C84 140 82 134 80 128 C78 134 76 140 72 140 C65 136 62 126 64 114 Z"
                fill={getMuscleColor('hamstrings')}
                style={{ filter: getMuscleFilter('hamstrings'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('hamstrings')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Hamstrings (Back of Thighs) */}
              <path
                id="hamstrings-left"
                d="M64 142 C64 156 65 166 67 170 C73 170 76 162 76 148 C76 142 75 138 72 140 Z"
                fill={getMuscleColor('hamstrings')}
                style={{ filter: getMuscleFilter('hamstrings'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('hamstrings')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="hamstrings-right"
                d="M96 142 C96 156 95 166 93 170 C87 170 84 162 84 148 C84 142 85 138 88 140 Z"
                fill={getMuscleColor('hamstrings')}
                style={{ filter: getMuscleFilter('hamstrings'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('hamstrings')}
                className="cursor-pointer hover:opacity-80"
              />

              {/* Calves Back (Gastrocnemius) */}
              <path
                id="calves-back-left"
                d="M65 178 C62 186 63 198 66 210 L72 210 C75 198 75 186 71 178 Z"
                fill={getMuscleColor('calves')}
                style={{ filter: getMuscleFilter('calves'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('calves')}
                className="cursor-pointer hover:opacity-80"
              />
              <path
                id="calves-back-right"
                d="M95 178 C98 186 97 198 94 210 L88 210 C85 198 85 186 89 178 Z"
                fill={getMuscleColor('calves')}
                style={{ filter: getMuscleFilter('calves'), transition: 'all 0.3s' }}
                onClick={() => handleMuscleClick('calves')}
                className="cursor-pointer hover:opacity-80"
              />
            </svg>
          )}
        </div>

        {/* Selected / Hover Info Pill */}
        {selectedMuscle && (
          <div className="absolute bottom-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white flex items-center gap-1.5 shadow-lg">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getMuscleColor(selectedMuscle) }}
            />
            <span className="font-semibold">{muscleLabels[selectedMuscle] || selectedMuscle}</span>
            <span className="text-[10px] text-zinc-400">
              {isWorked(selectedMuscle) ? '• Trained' : '• Resting'}
            </span>
          </div>
        )}
      </div>

      {/* Muscle Status Pills / Badges */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {['chest', 'shoulders', 'triceps', 'biceps', 'abs', 'back'].map((m) => {
          const trained = isWorked(m);
          return (
            <button
              key={m}
              onClick={() => handleMuscleClick(m)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 border ${
                trained
                  ? 'bg-[#FF9500]/15 text-[#FF9500] border-[#FF9500]/30 shadow-sm'
                  : 'bg-white/[0.03] text-zinc-400 border-white/5 hover:text-white'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${trained ? 'bg-[#FF9500]' : 'bg-zinc-600'}`} />
              <span className="capitalize">{m}</span>
              {trained && <span className="text-[9px] opacity-75">🔥</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
