'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { RoutineExercise } from '@/types/routine';
import { PLAYLIST_ID, PLAYLIST_VIDEO_ID } from '@/lib/exercise-catalog';
import { ExerciseThumbnail } from './ExerciseThumbnail';

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
  const [videoFailed, setVideoFailed] = useState(false);

  if (!isOpen || !exercise) return null;

  const targetVideoId = exercise.youtube_id || PLAYLIST_VIDEO_ID;
  const hasVideo = !!targetVideoId && targetVideoId !== '';
  const embedUrl = hasVideo
    ? `https://www.youtube-nocookie.com/embed/${targetVideoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : '';
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${targetVideoId}`;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-card border border-fg/[0.12] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slideUp flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 flex items-start justify-between border-b border-fg/[0.08] bg-surface">
          <div className="flex items-center gap-3 pr-2">
            <ExerciseThumbnail
              exercise={exercise}
              aspectRatio="1/1"
              rounded="rounded-xl"
              className="w-11 h-11 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-green-ink border border-accent/20">
                  {exercise.target_muscle}
                </span>
                <span className="text-xs text-muted font-medium">
                  {exercise.sets} sets × {exercise.reps}
                </span>
              </div>
              <h3 className="text-base font-bold text-fg mt-0.5 leading-snug">
                {exercise.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-elevated hover:bg-elevated-2 flex items-center justify-center text-muted hover:text-fg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player or Fallback */}
        {hasVideo && !videoFailed ? (
          <div className="relative w-full aspect-video bg-app flex items-center justify-center overflow-hidden border-b border-fg/[0.06]">
            {/* We use an invisible overlay to detect iframe load failures */}
            <iframe
              key={targetVideoId}
              src={embedUrl}
              title={`${exercise.name} tutorial video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
              onError={() => setVideoFailed(true)}
            />
          </div>
        ) : (
          /* Fallback: show exercise description / instructions when video unavailable */
          <div className="border-b border-fg/[0.06] bg-app/40 px-5 py-6 space-y-3">
            {videoFailed && (
              <div className="flex items-center gap-2 text-orange-ink text-xs mb-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Video unavailable — showing exercise guide instead.</span>
              </div>
            )}
            {!hasVideo && (
              <div className="flex items-center gap-2 text-muted text-xs mb-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>No video linked for this custom exercise.</span>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                How to perform
              </p>
              <p className="text-sm text-fg leading-relaxed">
                {exercise.notes || `Perform ${exercise.sets} sets of ${exercise.reps} with proper form and controlled movement. Focus on your ${exercise.target_muscle.toLowerCase()} muscles throughout the entire range of motion.`}
              </p>
              {exercise.rest_seconds && (
                <p className="text-xs text-muted">
                  Rest {exercise.rest_seconds}s between sets.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Bar & Details */}
        <div className="p-4 sm:p-5 space-y-4 bg-card overflow-y-auto">
          {/* External YouTube Link (only if video exists) */}
          {hasVideo && (
            <div className="flex items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-fg/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF0000]/15 text-[#FF0000] flex items-center justify-center">
                  <Play className="w-4 h-4 fill-[#FF0000]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-fg">YouTube Tutorial</p>
                  <p className="text-[10px] text-muted">HD exercise form &amp; technique</p>
                </div>
              </div>

              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fg/[0.08] hover:bg-fg/[0.15] text-fg text-xs font-medium transition-colors"
              >
                <span>Open in YouTube</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </a>
            </div>
          )}

          {exercise.notes && (
            <div className="text-xs text-[#A1A1A6] bg-elevated/50 px-3.5 py-2.5 rounded-xl border border-fg/[0.04]">
              <span className="font-semibold text-fg">Focus / Setup: </span>
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
                className="flex-1 py-3 px-4 rounded-full bg-accent hover:bg-accent-hover text-on-accent font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Completed &amp; Log</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-full bg-elevated hover:bg-elevated-2 text-fg font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
