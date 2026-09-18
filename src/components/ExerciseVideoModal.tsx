'use client';

import React from 'react';
import { X, ExternalLink, Play, CheckCircle2, Dumbbell, Flame } from 'lucide-react';
import { RoutineExercise } from '@/types/routine';
import { PLAYLIST_ID, PLAYLIST_VIDEO_ID } from '@/lib/exercise-catalog';

interface ExerciseVideoModalProps {
  exercise: RoutineExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onCompleteExercise?: (exercise: RoutineExercise) => void;
}

export function ExerciseVideoModal({
  exercise,
  isOpen,
  onClose,
  onCompleteExercise,
}: ExerciseVideoModalProps) {
  if (!isOpen || !exercise) return null;

  // Play the specific video for this exercise within the user's playlist
  const targetVideoId = exercise.youtube_id || PLAYLIST_VIDEO_ID;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${targetVideoId}?list=${PLAYLIST_ID}&autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${targetVideoId}&list=${PLAYLIST_ID}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-[#1C1C1E] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slideUp flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 flex items-start justify-between border-b border-white/[0.08] bg-[#161618]">
          <div className="flex items-center gap-3 pr-2">
            <img
              src={exercise.thumbnail_url}
              alt={exercise.name}
              className="w-11 h-11 rounded-xl bg-black/40 p-1 object-contain border border-white/[0.08] shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/20">
                  {exercise.target_muscle}
                </span>
                <span className="text-xs text-[#8E8E93] font-medium">
                  {exercise.sets} sets × {exercise.reps}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5 leading-snug">
                {exercise.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player Container */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-white/[0.06]">
          <iframe
            src={embedUrl}
            title={`${exercise.name} tutorial video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>

        {/* Action Bar & Details */}
        <div className="p-4 sm:p-5 space-y-4 bg-[#1C1C1E] overflow-y-auto">
          {/* External YouTube Link & Info */}
          <div className="flex items-center justify-between gap-3 bg-[#121214] p-3 rounded-2xl border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FF0000]/15 text-[#FF0000] flex items-center justify-center">
                <Play className="w-4 h-4 fill-[#FF0000]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">YouTube Tutorial</p>
                <p className="text-[10px] text-[#8E8E93]">HD exercise form & technique</p>
              </div>
            </div>

            <a
              href={youtubeWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-medium transition-colors"
            >
              <span>Open in YouTube</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#8E8E93]" />
            </a>
          </div>

          {exercise.notes && (
            <div className="text-xs text-[#A1A1A6] bg-[#2C2C2E]/50 px-3.5 py-2.5 rounded-xl border border-white/[0.04]">
              <span className="font-semibold text-white">Focus / Setup: </span>
              {exercise.notes}
            </div>
          )}

          {/* Buttons */}
          <div className="pt-1 flex items-center gap-3">
            {onCompleteExercise && (
              <button
                type="button"
                onClick={() => {
                  onCompleteExercise(exercise);
                  onClose();
                }}
                className="flex-1 py-3 px-4 rounded-full bg-[#30D158] hover:bg-[#28B84D] text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Completed & Log</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
