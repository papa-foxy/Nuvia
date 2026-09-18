'use client';

import React, { useState, useEffect } from 'react';
import { getExerciseThumbnail, ExerciseMediaInput } from '@/lib/exercise-media';
import { Dumbbell } from 'lucide-react';

export interface ExerciseThumbnailProps {
  exercise: ExerciseMediaInput | null | undefined;
  alt?: string;
  className?: string; // Container className
  aspectRatio?: '4/3' | '16/9' | '1/1' | 'none';
  quality?: 'hq' | 'mq' | 'default';
  priority?: boolean; // If true, eager loading for above-the-fold
  showPlayOverlay?: boolean;
  rounded?: string; // e.g. 'rounded-xl', 'rounded-2xl', default is 'rounded-xl'
}

export function ExerciseThumbnail({
  exercise,
  alt,
  className = '',
  aspectRatio = '4/3',
  quality = 'hq',
  priority = false,
  showPlayOverlay = false,
  rounded = 'rounded-xl',
}: ExerciseThumbnailProps) {
  const media = getExerciseThumbnail(exercise, quality);
  const [currentSrc, setCurrentSrc] = useState(media.primaryUrl);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Update src when exercise changes
  useEffect(() => {
    setCurrentSrc(media.primaryUrl);
    setIsLoaded(false);
    setHasError(false);
  }, [media.primaryUrl]);

  const handleImageError = () => {
    if (!hasError && currentSrc !== media.fallbackUrl) {
      setCurrentSrc(media.fallbackUrl);
      setHasError(true);
      setIsLoaded(true);
    } else {
      setHasError(true);
      setIsLoaded(true);
    }
  };

  const aspectClass =
    aspectRatio === '4/3'
      ? 'aspect-[4/3]'
      : aspectRatio === '16/9'
      ? 'aspect-[16/9]'
      : aspectRatio === '1/1'
      ? 'aspect-square'
      : '';

  const exerciseName = exercise?.name || alt || 'Exercise';

  return (
    <div
      className={`relative overflow-hidden bg-[#18181A] shrink-0 select-none ${rounded} ${aspectClass} ${className}`}
    >
      {/* Subtle Skeleton Loader while image is buffering */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#242426] animate-pulse flex items-center justify-center">
          <Dumbbell className="w-4 h-4 text-white/10" />
        </div>
      )}

      {/* Main Thumbnail Image */}
      <img
        src={currentSrc}
        alt={exerciseName}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={handleImageError}
        className={`w-full h-full object-cover object-center transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Subtle inner border to fit Apple-inspired dark aesthetic */}
      <div className={`absolute inset-0 border border-white/[0.06] pointer-events-none ${rounded}`} />

      {/* Optional Play indicator overlay (e.g. for video tutorials) */}
      {showPlayOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-lg">
            <svg
              className="w-3.5 h-3.5 fill-white ml-0.5"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
