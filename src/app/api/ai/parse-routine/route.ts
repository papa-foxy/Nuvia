import { NextRequest, NextResponse } from 'next/server';
import { matchExercise, matchExerciseSafe, getCatalogNamesForPrompt, PLAYLIST_ID } from '@/lib/exercise-catalog';
import { WorkoutRoutine, RoutineExercise } from '@/types/routine';

interface ParsedRawRoutine {
  title: string;
  days: string[];
  focus?: string;
  exercises: {
    name: string;
    sets: number;
    reps: string;
    rest_seconds?: number;
    target_muscle?: string;
    notes?: string;
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const { text, userId } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Please provide exercise routine text to parse.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let parsedRoutines: ParsedRawRoutine[] = [];

    // Provide Gemini with the first 80 catalog exercise names so it can map user
    // text to existing exercises rather than inventing new ones.
    const catalogNames = getCatalogNamesForPrompt(80);
    const catalogHint = `EXERCISE LIBRARY (map user text to the closest name from this list when possible):\n${catalogNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

    // Attempt Gemini parsing if API key is present
    if (apiKey) {
      try {
        const systemPrompt = `You are an elite fitness routine parser for Nuvia.
Given raw text from a user's fitness consultation with an AI (which may contain multiple day splits or single day routines), extract all distinct workout routines into structured JSON.

CRITICAL RULE: When naming exercises, prefer the exact name from the provided EXERCISE LIBRARY below. Only use names not in the library if the exercise clearly doesn't exist there.

${catalogHint}

Return strictly valid JSON matching this schema:
{
  "routines": [
    {
      "title": "Full title line e.g. Monday & Wednesday - Upper Body",
      "days": ["Monday", "Wednesday"],
      "focus": "Upper Body",
      "exercises": [
        {
          "name": "Dumbbell bicep curls",
          "sets": 4,
          "reps": "10-12",
          "rest_seconds": 90,
          "target_muscle": "Biceps",
          "notes": "optional notes"
        }
      ]
    }
  ]
}
Normalize reps to strings like "10-12", "15", "40-60 sec", "20 per side".
Ensure sets is an integer.
Include rest_seconds if mentioned (e.g. "Rest 90 seconds" -> 90).`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    { text: `Raw consultation text:\n"""\n${text}\n"""` },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.routines) && parsed.routines.length > 0) {
              parsedRoutines = parsed.routines;
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini routine parsing fallback:', geminiErr);
      }
    }

    // Heuristic Fallback Parser if Gemini was unavailable or returned empty
    if (parsedRoutines.length === 0) {
      parsedRoutines = parseRoutineWithRegex(text);
    }

    if (parsedRoutines.length === 0) {
      return NextResponse.json(
        { error: 'Could not identify any workout routines from the text. Please check the format.' },
        { status: 422 }
      );
    }

    // Enrich all exercises with catalog thumbnails and YouTube verified video links.
    // Use matchExerciseSafe() — exercises that don't match are flagged as unmatched
    // instead of silently getting the wrong video/thumbnail.
    const unmatchedExerciseNames: string[] = [];

    const finalRoutines: WorkoutRoutine[] = parsedRoutines.map((r, rIdx) => {
      const routineId = `routine-${Date.now()}-${rIdx}`;
      const enrichedExercises: RoutineExercise[] = r.exercises.map((ex, eIdx) => {
        const safeMatch = matchExerciseSafe(ex.name);
        const matched = safeMatch ?? matchExercise(ex.name); // fallback for enrichment

        if (!safeMatch) {
          unmatchedExerciseNames.push(ex.name);
        }

        return {
          id: `ex-${routineId}-${eIdx}`,
          catalog_id: safeMatch?.id, // undefined if unmatched
          name: ex.name.trim(),
          target_muscle: ex.target_muscle || matched.target_muscle,
          sets: Number(ex.sets) || matched.default_sets || 3,
          reps: ex.reps || matched.default_reps || '10-12',
          rest_seconds: ex.rest_seconds ?? 90,
          notes: ex.notes || '',
          thumbnail_url: matched.thumbnail_url,
          youtube_id: matched.youtube_id,
          youtube_url: `https://www.youtube.com/watch?v=${matched.youtube_id}&list=${PLAYLIST_ID}`,
        };
      });

      return {
        id: routineId,
        user_id: userId || 'demo-user-001',
        title: r.title || `Workout Routine ${rIdx + 1}`,
        days: r.days && r.days.length > 0 ? r.days : ['Any Day'],
        focus: r.focus || 'General Fitness',
        exercises: enrichedExercises,
        created_at: new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      routines: finalRoutines,
      count: finalRoutines.length,
      // Surface unmatched exercises so the UI can warn the user
      unmatched_exercises: [...new Set(unmatchedExerciseNames)],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to parse workout routine.' },
      { status: 500 }
    );
  }
}

/**
 * Robust regex-based fallback parser for AI exercise routines
 */
function parseRoutineWithRegex(rawText: string): ParsedRawRoutine[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const routines: ParsedRawRoutine[] = [];
  let currentRoutine: ParsedRawRoutine | null = null;

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const matchedDays = dayNames.filter((d) => lower.includes(d));

    const isHeader =
      matchedDays.length > 0 ||
      lower.includes('routine') ||
      lower.includes('upper body') ||
      lower.includes('lower body') ||
      lower.includes('workout') ||
      lower.includes('day 1') ||
      lower.includes('day 2');

    const isBullet = /^[•\-*\d.]+\s*/.test(line);

    if (isHeader && !isBullet) {
      if (currentRoutine && currentRoutine.exercises.length > 0) {
        routines.push(currentRoutine);
      }

      let focus = 'Workout';
      if (lower.includes('upper')) focus = 'Upper Body';
      else if (lower.includes('abs') || lower.includes('core')) focus = 'Abs & Core';
      else if (lower.includes('lower') || lower.includes('leg')) focus = 'Legs';
      else if (lower.includes('push')) focus = 'Push';
      else if (lower.includes('pull')) focus = 'Pull';

      currentRoutine = {
        title: line.replace(/^#+\s*/, ''),
        days: matchedDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1)),
        focus,
        exercises: [],
      };
      continue;
    }

    const cleaned = line.replace(/^[•\-*\d.]+\s*/, '').trim();
    if (!cleaned) continue;

    // Detect rest lines like "Rest 90 seconds between sets"
    const restLineMatch = cleaned.toLowerCase().match(/rest\s+(\d+)\s*(sec|second|min|minute)/i);
    if (restLineMatch) {
      const val = parseInt(restLineMatch[1], 10);
      const unit = restLineMatch[2].toLowerCase();
      const restSeconds = unit.startsWith('min') ? val * 60 : val;
      if (currentRoutine && currentRoutine.exercises.length > 0) {
        // Apply rest to the last added exercise
        const lastEx = currentRoutine.exercises[currentRoutine.exercises.length - 1];
        lastEx.rest_seconds = restSeconds;
      }
      continue;
    }

    const parts = cleaned.split(/\s*[-–—]\s*(?=\d+\s*[x×])/i);
    let name = cleaned;
    let sets = 3;
    let reps = '10-12';
    let notes = '';
    let rest_seconds: number | undefined;

    if (parts.length >= 2) {
      name = parts[0].trim();
      const setRepPart = parts.slice(1).join(' - ').trim();
      const setRepMatch = setRepPart.match(/(\d+)\s*[x×]\s*([^\s,]+(?:\s+sec|\s+per\s+side|\s+seconds)?)/i);
      if (setRepMatch) {
        sets = parseInt(setRepMatch[1], 10);
        reps = setRepMatch[2].trim();
      } else {
        reps = setRepPart;
      }

      // Extract rest from the same line e.g. "3x10 (90s rest)"
      const inlineRest = setRepPart.match(/(\d+)\s*s\s+rest|\brest\s+(\d+)\s*s/i);
      if (inlineRest) {
        rest_seconds = parseInt(inlineRest[1] || inlineRest[2], 10);
      }
    } else {
      const inlineMatch = cleaned.match(/(.+?)\s*[-–—]?\s*(\d+)\s*[x×]\s*([^\s,]+(?:\s+sec|\s+per\s+side|\s+seconds)?)$/i);
      if (inlineMatch) {
        name = inlineMatch[1].trim();
        sets = parseInt(inlineMatch[2], 10);
        reps = inlineMatch[3].trim();
      }
    }

    const noteMatch = name.match(/\(([^)]+)\)/);
    if (noteMatch) {
      notes = noteMatch[1];
    }

    if (!currentRoutine) {
      currentRoutine = {
        title: 'Custom AI Workout Routine',
        days: ['Monday', 'Wednesday', 'Friday'],
        focus: 'Full Body',
        exercises: [],
      };
    }

    currentRoutine.exercises.push({ name, sets, reps, rest_seconds, notes });
  }

  if (currentRoutine && currentRoutine.exercises.length > 0) {
    routines.push(currentRoutine);
  }

  return routines;
}
