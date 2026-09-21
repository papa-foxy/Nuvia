import { NextRequest, NextResponse } from 'next/server';
import {
  NaturalLanguageLoggingContext,
  NaturalLanguageParseResult,
} from '@/types/natural-language';
import {
  cleanNaturalLanguageInput,
  parseNaturalLanguageLocally,
} from '@/lib/natural-language-parser';

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
];

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { text, context } = (await req.json()) as {
      text: string;
      context?: NaturalLanguageLoggingContext;
    };

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Empty text prompt provided.' },
        { status: 400 }
      );
    }

    const cleanedText = cleanNaturalLanguageInput(text);
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      // Build compact context representations
      const frequentMealsContext = (context?.frequent_meals || [])
        .slice(0, 6)
        .map(
          (m) =>
            `${m.name} (logged ${m.count}x, avg ${m.recent_average_calories} kcal, ${m.recent_average_protein_g}g protein)`
        )
        .join('; ');

      const recentMealsContext = (context?.recent_meals || [])
        .slice(0, 6)
        .map((m) => `${m.name} (${m.calories} kcal, ${m.protein_g}g protein)`)
        .join('; ');

      const cardioHabitsContext = context?.habitual_cardio
        ? `${context.habitual_cardio.type}, typical distance ${context.habitual_cardio.distance_km || 4.5} km on ${context.habitual_cardio.typical_days.join(', ')}`
        : 'None recorded';

      const todayRoutineContext = context?.today_routine
        ? `Scheduled routine: "${context.today_routine.title}" (${context.today_routine.exercises.length} exercises: ${context.today_routine.exercises.slice(0, 5).join(', ')}), completed: ${context.today_routine.is_completed}`
        : 'No routine scheduled today';

      const systemPrompt = `You are Nuvia's authoritative Natural Language Fitness & Nutrition Interpreter.
You specialize in conversational parsing without requiring any syntax, prefixes, or rigid labels.
The user speaks to you naturally as a personal companion who ALREADY KNOWS them.

AUTHORITATIVE USER CONTEXT:
- Today: ${context?.day_of_week || 'Today'} (${context?.today_date || ''})
- Today's Routine: ${todayRoutineContext}
- Habitual Cardio: ${cardioHabitsContext}
- Frequent Food Memory: ${frequentMealsContext || 'None yet'}
- Recent Meals: ${recentMealsContext || 'None yet'}
- User Weight: ${context?.user_weight_kg || 70} kg
- Primary Goal: ${context?.goal || 'Healthy fitness'}

CRITICAL INTERPRETATION RULES:
1. ZERO REQUIRED PREFIXES: Never expect "meal:", "activity:", or "exercise:".
2. INTENT CLASSIFICATION:
   - "training_intent": Future workout desires, schedule changes, or rest intentions (e.g. "I want to run tomorrow", "Can I take a rest tomorrow?"). CRITICAL: DO NOT log this as an activity or meal! Set intent="training_intent".
   - "workout" or "partial_workout": References to today's routine (e.g. "Finished today's workout", "I only did half of today's workout", "Stopped after shoulder press"). Match to today's scheduled routine.
   - "activity": Cardio, walks, running, cycling, sports (e.g. "I walked 4.5 km with my mom", "Did my usual Saturday walk").
   - "meal": Food or drink consumed (e.g. "Had nasi ayam for lunch", "usual chicken rice", "had a burger").
   - "question": Inquiries (e.g. "How many calories do I have left?").
3. USER MEMORY & PORTION REASONING:
   - If user refers to "usual walk" or "usual Saturday walk", match habitual cardio (~4.5 km brisk walk).
   - If user says "usual chicken rice" or "had nasi ayam again", match previous frequent meals (~640 kcal, ~32g protein). Add badge_label="Using your recent meals".
   - If user says "smaller portion", adjust calories downward from their usual baseline (~400-450 kcal).
   - If user says "same breakfast" and multiple distinct breakfasts exist in history, set requires_clarification=true with a clarifying question.
   - If user says something completely vague like "Had something nice", do NOT guess; set requires_clarification=true.
4. OVERRIDE RULE: Explicit user text ALWAYS overrides historical patterns. (If user usually eats chicken rice but says "I had a burger today", the food is burger!).
5. INDEPENDENCE: Calorie targets must NEVER distort estimated calories.

OUTPUT SCHEMA (Return strictly JSON):
{
  "intent": "meal" | "activity" | "workout" | "partial_workout" | "training_intent" | "question" | "other",
  "confidence": "high" | "medium" | "low",
  "requires_clarification": boolean,
  "clarification_prompt": string | null,
  "context_match": {
    "matched_history": boolean,
    "matched_name": string | null,
    "confidence": number,
    "badge_label": string | null,
    "note": string | null
  },
  "meal_data": {
    "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
    "meal_name": "Dish name",
    "foods": [
      {
        "name": "Food item",
        "estimated_quantity": 1,
        "unit": "plate",
        "calories": 640,
        "protein_g": 32,
        "carbs_g": 65,
        "fat_g": 20,
        "confidence": "high"
      }
    ],
    "total": {
      "calories": 640,
      "protein_g": 32,
      "carbs_g": 65,
      "fat_g": 20
    },
    "notes": "Contextual notes"
  } | null,
  "activity_data": {
    "exercise_type": "Brisk Walking",
    "duration_minutes": 60,
    "intensity": "moderate",
    "distance_km": 4.5,
    "calories_burned": 250,
    "ai_tip": "Concise tip"
  } | null,
  "workout_data": {
    "routine_id": string | null,
    "routine_title": "Upper Body A",
    "is_partial": boolean,
    "completion_percentage": number,
    "completed_exercise_count": number,
    "total_exercise_count": number,
    "stopped_after": string | null,
    "duration_minutes": 45,
    "estimated_calories_burned": 280,
    "notes": "Session notes"
  } | null,
  "training_intent_data": {
    "intent_summary": "User wants to run tomorrow",
    "reply": "Coaching adaptation advice"
  } | null,
  "question_data": {
    "reply": "Concise factual answer"
  } | null
}`;

      for (const model of GEMINI_MODELS) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: systemPrompt },
                      { text: `User natural language input: "${cleanedText}"` },
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
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const cleaned = cleanJsonString(rawText);
              const parsed: NaturalLanguageParseResult = JSON.parse(cleaned);

              // Quick schema sanity check
              if (parsed && parsed.intent) {
                return NextResponse.json({
                  success: true,
                  source: 'gemini',
                  model,
                  data: parsed,
                });
              }
            }
          }
        } catch (mErr) {
          console.warn(`Gemini model ${model} parse error:`, mErr);
        }
      }
    }

    // Deterministic Local Fallback (guarantees zero failure and exact scenario compliance)
    const localResult = parseNaturalLanguageLocally(cleanedText, context);
    return NextResponse.json({
      success: true,
      source: 'local_engine',
      data: localResult,
    });
  } catch (err: any) {
    console.error('Natural language parsing fatal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to interpret natural language.',
      },
      { status: 500 }
    );
  }
}
