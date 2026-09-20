import { ExerciseLog } from '@/types/database';

/**
 * Strips routine scheduling days and cleans the display title.
 * For example:
 *   "Monday & Wednesday - Upper Body (Push-up Board + Dumbbells)"
 *   -> { title: "Upper Body", equipmentSubtitle: "Push-up Board · Dumbbells", rawTitle: "..." }
 * 
 *   "Tuesday & Friday - Abs (done first)"
 *   -> { title: "Abs", equipmentSubtitle: undefined, rawTitle: "..." }
 * 
 *   "Walking"
 *   -> { title: "Walking", equipmentSubtitle: undefined, rawTitle: "..." }
 */
export function cleanActivityTitle(rawTitle: string): {
  title: string;
  equipmentSubtitle?: string;
  schedulePrefix?: string;
} {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { title: 'Workout Session' };
  }

  let working = rawTitle.trim();

  // Regex to match leading schedule days like:
  // "Monday & Wednesday - ", "Mon, Wed, Fri - ", "Tuesday + Friday: ", "Every Monday - "
  const scheduleRegex = /^(?:every\s+)?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*[\s,&/+\-and]*)+[-–—:]\s*/i;
  const match = working.match(scheduleRegex);
  let schedulePrefix: string | undefined;

  if (match) {
    schedulePrefix = match[0].replace(/[-–—:]\s*$/, '').trim();
    working = working.slice(match[0].length).trim();
  }

  // Extract equipment or notes in parentheses at the end:
  // e.g. "(Push-up Board + Dumbbells)" or "(done first)"
  let equipmentSubtitle: string | undefined;
  const parenMatch = working.match(/\(([^)]+)\)$/);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    working = working.replace(/\(([^)]+)\)$/, '').trim();

    // Check if inside is equipment or notes
    const lower = inside.toLowerCase();
    if (!lower.includes('done first') && !lower.includes('warmup first')) {
      // Convert "Push-up Board + Dumbbells" to "Push-up Board · Dumbbells"
      equipmentSubtitle = inside.replace(/\s*\+\s*/g, ' · ');
    }
  }

  // Fallback if title became empty
  const cleanTitle = working || rawTitle;

  return {
    title: cleanTitle,
    equipmentSubtitle,
    schedulePrefix,
  };
}

export interface ActivityDisplayData {
  cleanTitle: string;
  equipmentSubtitle?: string;
  isRoutine: boolean;
  isPartial: boolean;
  statusLabel: string;
  movementsSummary?: string;
  caloriesBurned: number;
  durationMinutes: number;
  headerDate: string; // e.g. "FRI, SEP 18"
  fullDate: string;   // e.g. "Friday, September 18, 2026"
  timeStr: string;    // e.g. "10:30 AM"
  sourceLabel: string;
}

/**
 * Determines whether a workout log represents a partial workout or full completion,
 * separates routine schedule from session reality, and formats historical timestamps.
 */
export function getActivityDisplayData(log: ExerciseLog): ActivityDisplayData {
  const isRoutine = log.source === 'routine' || Boolean(log.ai_analysis?.routine_id);
  const { title: cleanTitle, equipmentSubtitle } = cleanActivityTitle(log.exercise_type);

  // Check partial vs completed status
  let isPartial = false;
  let statusLabel = 'Completed';
  let movementsSummary: string | undefined;

  const analysis = log.ai_analysis;
  if (isRoutine && analysis) {
    const executed = Number(analysis.executed_count);
    const total = Number(analysis.total_exercises);

    if (!isNaN(executed) && !isNaN(total) && total > 0) {
      movementsSummary = `${executed} / ${total} movements`;
      if (executed < total) {
        isPartial = true;
        statusLabel = 'Partial workout';
      } else {
        isPartial = false;
        statusLabel = 'Completed';
      }
    }
  }

  // Fallback check on description if ai_analysis didn't have numbers
  if (isRoutine && !movementsSummary && log.description) {
    const descMatch = log.description.match(/Completed\s+(\d+)\/(\d+)\s+sets\s*\((\d+)\/(\d+)\s+exercises\)/i);
    if (descMatch) {
      const execEx = parseInt(descMatch[3], 10);
      const totalEx = parseInt(descMatch[4], 10);
      if (totalEx > 0) {
        movementsSummary = `${execEx} / ${totalEx} movements`;
        if (execEx < totalEx) {
          isPartial = true;
          statusLabel = 'Partial workout';
        }
      }
    }
  }

  // Date parsing strictly from log.created_at
  const dateObj = log.created_at ? new Date(log.created_at) : new Date();
  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

  const headerDate = validDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();

  const fullDate = validDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const timeStr = validDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sourceLabel =
    log.source === 'routine'
      ? 'Routine Session'
      : log.source === 'photo'
      ? 'Camera AI Scan'
      : log.source === 'text'
      ? 'AI Consultation'
      : 'Manual Activity';

  return {
    cleanTitle,
    equipmentSubtitle,
    isRoutine,
    isPartial,
    statusLabel,
    movementsSummary,
    caloriesBurned: Number(log.calories_burned) || 0,
    durationMinutes: Number(log.duration_minutes) || 0,
    headerDate,
    fullDate,
    timeStr,
    sourceLabel,
  };
}
