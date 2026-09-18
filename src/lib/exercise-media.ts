import { makeSvgThumbnail } from './exercise-catalog';

export interface ExerciseMediaInput {
  name?: string;
  target_muscle?: string;
  primary_muscles?: string[];
  equipment?: string;
  thumbnail_url?: string;
  youtube_id?: string;
  youtube_url?: string;
  image_url?: string;
}

/**
 * Resolves the primary visual thumbnail for an exercise following Nuvia's priority:
 * 1. Explicit image_url (custom photo / uploaded image)
 * 2. YouTube thumbnail (hqdefault or mqdefault) derived from verified youtube_id
 * 3. Existing thumbnail_url (e.g. SVG data URI)
 * 4. Muscle-themed SVG fallback
 */
export function getExerciseThumbnail(
  exercise: ExerciseMediaInput | null | undefined,
  quality: 'hq' | 'mq' | 'default' = 'hq'
): {
  primaryUrl: string;
  fallbackUrl: string;
  isYouTube: boolean;
} {
  if (!exercise) {
    const fallback = makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'EXERCISE');
    return { primaryUrl: fallback, fallbackUrl: fallback, isYouTube: false };
  }

  // 1. Explicit custom image
  if (exercise.image_url && exercise.image_url.trim()) {
    const fallback = getFallbackSvg(exercise);
    return { primaryUrl: exercise.image_url.trim(), fallbackUrl: fallback, isYouTube: false };
  }

  // 2. YouTube thumbnail (if valid youtube_id exists)
  const ytId = exercise.youtube_id?.trim() || extractYoutubeId(exercise.youtube_url);
  if (ytId && ytId !== 'DEFAULT') {
    // hqdefault is standard 4:3 (480x360), mqdefault is 16:9 (320x180)
    const ytFile = quality === 'mq' ? 'mqdefault.jpg' : quality === 'default' ? 'default.jpg' : 'hqdefault.jpg';
    const primaryUrl = `https://img.youtube.com/vi/${ytId}/${ytFile}`;
    const fallbackUrl = exercise.thumbnail_url?.trim() || getFallbackSvg(exercise);
    return { primaryUrl, fallbackUrl, isYouTube: true };
  }

  // 3. Existing thumbnail_url (e.g. data:image/svg+xml or external URL)
  if (exercise.thumbnail_url && exercise.thumbnail_url.trim()) {
    const fallback = getFallbackSvg(exercise);
    return { primaryUrl: exercise.thumbnail_url.trim(), fallbackUrl: fallback, isYouTube: false };
  }

  // 4. Default fallback
  const fallback = getFallbackSvg(exercise);
  return { primaryUrl: fallback, fallbackUrl: fallback, isYouTube: false };
}

/**
 * Helper to safely extract YouTube ID from string or URL
 */
function extractYoutubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Generates an appropriate color-themed SVG thumbnail based on target muscle
 */
export function getFallbackSvg(exercise: ExerciseMediaInput): string {
  const muscle = (exercise.target_muscle || exercise.primary_muscles?.[0] || 'Full Body').toLowerCase();
  
  if (muscle.includes('chest')) {
    return makeSvgThumbnail('#0F172A', '#38BDF8', 'pushup', 'CHEST');
  }
  if (muscle.includes('back') || muscle.includes('lat')) {
    return makeSvgThumbnail('#1E1B4B', '#A855F7', 'pullup', 'BACK');
  }
  if (muscle.includes('shoulder') || muscle.includes('delt')) {
    return makeSvgThumbnail('#2A1215', '#F87171', 'dumbbell', 'SHOULDERS');
  }
  if (muscle.includes('bicep') || muscle.includes('arm')) {
    return makeSvgThumbnail('#1E1B4B', '#60A5FA', 'dumbbell', 'ARMS');
  }
  if (muscle.includes('tricep')) {
    return makeSvgThumbnail('#052E16', '#34D399', 'pushup', 'TRICEPS');
  }
  if (muscle.includes('leg') || muscle.includes('quad') || muscle.includes('glute') || muscle.includes('hamstring') || muscle.includes('calf')) {
    return makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS');
  }
  if (muscle.includes('ab') || muscle.includes('core') || muscle.includes('oblique')) {
    return makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'core', 'CORE');
  }
  return makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'WORKOUT');
}
