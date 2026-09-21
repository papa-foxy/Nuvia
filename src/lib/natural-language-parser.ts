/**
 * Deterministic Natural Language Parser & Memory Matcher for Nuvia
 *
 * Provides authoritative intent detection, personal language recognition,
 * food & activity memory lookup, and portion reasoning without LLM dependency.
 */

import {
  NaturalLanguageIntent,
  NaturalLanguageLoggingContext,
  NaturalLanguageParseResult,
  FrequentMealSummary,
  RecentMealSummary,
} from '@/types/natural-language';
import { AdaptiveTrainingEngine } from './adaptive-training-engine';
import { cleanActivityTitle } from './activity-utils';

/**
 * Normalizes input by removing generic prefixes and excessive whitespace
 */
export function cleanNaturalLanguageInput(rawText: string): string {
  let cleaned = rawText.trim();
  // Strip common generic prefixes that users may have typed or copied
  cleaned = cleaned.replace(/^(meal|activity|exercise|food|workout):\s*/i, '');
  return cleaned.trim();
}

/**
 * Deterministic fallback and rule-based parser that executes when Gemini
 * is unavailable or to disambiguate high-confidence personal phrases.
 */
export function parseNaturalLanguageLocally(
  inputText: string,
  context?: NaturalLanguageLoggingContext
): NaturalLanguageParseResult {
  const text = cleanNaturalLanguageInput(inputText);
  const lower = text.toLowerCase();

  // Safe defaults if context is omitted
  const ctx: NaturalLanguageLoggingContext = context || {
    today_date: new Date().toISOString().split('T')[0],
    day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TRAINING INTENT CLASSIFICATION (Schedule changes / Future desires)
  // ──────────────────────────────────────────────────────────────────────────
  // Check for future intent words ("tomorrow", "next week", "later", "want to run", "plan to")
  const isFutureOrIntent =
    lower.includes('tomorrow') ||
    lower.includes('next week') ||
    lower.includes('want to run') ||
    lower.includes('can i run') ||
    lower.includes('feel like running') ||
    lower.includes('want to rest') ||
    lower.includes('take a break') ||
    lower.includes('reschedule') ||
    lower.includes('skip today') ||
    lower.includes('feel sore');

  if (isFutureOrIntent) {
    const routineObj = ctx.today_routine
      ? ({
          id: ctx.today_routine.id,
          title: ctx.today_routine.title,
          days: [ctx.day_of_week],
          focus: ctx.today_routine.focus,
          exercises: ctx.today_routine.exercises.map((name) => ({ name })),
        } as any)
      : null;

    const evaluation = AdaptiveTrainingEngine.evaluateUserIntent({
      message: text,
      todayRoutine: routineObj,
      recentMuscles: [],
      routines: routineObj ? [routineObj] : [],
      logs: [],
    });

    let reply = `I've noted your training intent: "${text}".`;
    if (evaluation.proposal?.reason) {
      reply = `${evaluation.proposal.reason} ${evaluation.proposal.recovery_analysis || ''}`;
    }

    return {
      intent: 'training_intent',
      confidence: 'high',
      requires_clarification: false,
      training_intent_data: {
        proposal: evaluation.proposal,
        intent_summary: evaluation.intentSummary,
        reply: reply.trim(),
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. QUESTION / INQUIRY INTENT
  // ──────────────────────────────────────────────────────────────────────────
  const isQuestion =
    lower.endsWith('?') ||
    lower.startsWith('how many') ||
    lower.startsWith('what is') ||
    lower.startsWith("what's") ||
    lower.startsWith('can i') ||
    lower.startsWith('should i') ||
    lower.includes('calories do i have left') ||
    lower.includes('calories remaining') ||
    lower.includes('protein remaining');

  if (isQuestion) {
    const calsConsumed = ctx.today_summary?.calories_consumed || 0;
    const calTarget = ctx.targets?.calorie_target || 2000;
    const remainingCals = Math.max(0, calTarget - calsConsumed);

    const protConsumed = ctx.today_summary?.protein_consumed || 0;
    const protTarget = ctx.targets?.protein_target || 140;
    const remainingProt = Math.max(0, protTarget - protConsumed);

    let reply = `You have ${remainingCals.toLocaleString()} kcal remaining today (consumed ${calsConsumed} / ${calTarget} kcal).`;
    if (lower.includes('protein')) {
      reply = `You have ${remainingProt}g protein remaining today (consumed ${protConsumed}g / ${protTarget}g target).`;
    }

    return {
      intent: 'question',
      confidence: 'high',
      requires_clarification: false,
      question_data: { reply },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. WORKOUT & PARTIAL ROUTINE AWARENESS
  // ──────────────────────────────────────────────────────────────────────────
  const isWorkoutReference =
    lower.includes("today's workout") ||
    lower.includes('finished today') ||
    lower.includes('did today') ||
    lower.includes('done with workout') ||
    lower.includes('completed my workout') ||
    lower.includes('only did half') ||
    lower.includes('stopped after') ||
    lower.includes('half of my workout') ||
    lower.includes('first four exercises') ||
    lower.includes('first 4 exercises') ||
    (ctx.today_routine && lower.includes(ctx.today_routine.title.toLowerCase()));

  if (isWorkoutReference) {
    const routineTitle = ctx.today_routine
      ? ctx.today_routine.title
      : 'Scheduled Workout Session';
    const routineId = ctx.today_routine?.id;

    // Detect partial workout statements
    const isPartial =
      lower.includes('half') ||
      lower.includes('stopped after') ||
      lower.includes('only did') ||
      lower.includes('first 4') ||
      lower.includes('first four') ||
      lower.includes('partially');

    let pct = isPartial ? 50 : 100;
    let stoppedAfter: string | undefined;

    if (lower.includes('shoulder press')) stoppedAfter = 'Dumbbell Shoulder Press';
    if (lower.includes('first 4') || lower.includes('first four')) pct = 60;

    const totalEx = ctx.today_routine?.total_exercises || 6;
    const completedEx = isPartial ? Math.max(1, Math.round((pct / 100) * totalEx)) : totalEx;
    const estCalories = Math.round((isPartial ? 180 : 320) * (pct / 100));

    return {
      intent: isPartial ? 'partial_workout' : 'workout',
      confidence: 'high',
      requires_clarification: false,
      context_match: {
        matched_history: true,
        matched_name: routineTitle,
        confidence: 0.95,
        badge_label: isPartial
          ? "Today's Routine (Partial)"
          : "Matched today's scheduled workout",
        note: ctx.today_routine
          ? `Found today's scheduled routine: ${routineTitle}.`
          : undefined,
      },
      workout_data: {
        routine_id: routineId,
        routine_title: routineTitle,
        is_partial: isPartial,
        completion_percentage: pct,
        completed_exercise_count: completedEx,
        total_exercise_count: totalEx,
        stopped_after: stoppedAfter,
        duration_minutes: isPartial ? 25 : 45,
        estimated_calories_burned: estCalories,
        notes: isPartial
          ? `Partial completion (${pct}%). Remaining exercises saved.`
          : `Full ${routineTitle} session completed.`,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ACTIVITY & HABITUAL CARDIO MEMORY
  // ──────────────────────────────────────────────────────────────────────────
  const activityKeywords = [
    'walk', 'walked', 'walks', 'walking',
    'run', 'ran', 'jog', 'jogged', 'jogging',
    'cycle', 'cycled', 'biked', 'cycling',
    'badminton', 'tennis', 'swim', 'swam',
    'cardio', 'hiit', 'pilates', 'yoga',
  ];
  const isActivity = activityKeywords.some((k) => lower.includes(k));

  if (isActivity) {
    const isHabitualWalk =
      lower.includes('usual walk') ||
      lower.includes('saturday walk') ||
      lower.includes('weekend walk') ||
      (lower.includes('walk') && ctx.habitual_cardio);

    if (isHabitualWalk && ctx.habitual_cardio) {
      const distance = ctx.habitual_cardio.distance_km || 4.5;
      const duration = Math.round(distance * 13.3); // ~60 min for 4.5 km
      const calories = Math.round(3.8 * (ctx.user_weight_kg || 70) * (duration / 60));

      return {
        intent: 'activity',
        confidence: 'high',
        requires_clarification: false,
        context_match: {
          matched_history: true,
          matched_name: `${ctx.habitual_cardio.type}`,
          confidence: 0.92,
          badge_label: `Matched with your usual ${ctx.day_of_week} walk`,
          note: `Your recent walks are usually around ${distance} km.`,
        },
        activity_data: {
          exercise_type: 'Brisk Walking (Outdoor)',
          duration_minutes: duration,
          intensity: 'moderate',
          distance_km: distance,
          calories_burned: calories,
          ai_tip: 'Consistent outdoor walking supports cardiovascular health and active recovery.',
        },
      };
    }

    // Explicit distance / duration extraction
    let distance: number | null = null;
    const distMatch = lower.match(/(\d+(\.\d+)?)\s*(km|k|miles)/i);
    if (distMatch) distance = parseFloat(distMatch[1]);

    let duration = 35;
    const timeMatch = lower.match(/(\d+)\s*(min|mins|minutes|hour|hours|hr|hrs)/i);
    if (timeMatch) {
      const val = parseInt(timeMatch[1], 10);
      duration = timeMatch[2].startsWith('h') ? val * 60 : val;
    } else if (distance) {
      duration = Math.round(distance * (lower.includes('run') ? 6 : 13));
    }

    let exerciseType = 'Cardio Workout';
    let met = 5.0;
    if (lower.includes('run') || lower.includes('jog')) {
      exerciseType = 'Running';
      met = 8.5;
    } else if (lower.includes('walk')) {
      exerciseType = 'Brisk Walking';
      met = 3.8;
    } else if (lower.includes('badminton')) {
      exerciseType = 'Badminton';
      met = 6.0;
    } else if (lower.includes('cycle') || lower.includes('bike')) {
      exerciseType = 'Cycling';
      met = 7.0;
    }

    const burned = Math.round(met * (ctx.user_weight_kg || 70) * (duration / 60));

    return {
      intent: 'activity',
      confidence: 'high',
      requires_clarification: false,
      context_match: {
        matched_history: false,
        confidence: 0.85,
      },
      activity_data: {
        exercise_type: exerciseType,
        duration_minutes: duration,
        intensity: duration > 45 || met >= 8 ? 'high' : 'moderate',
        distance_km: distance,
        calories_burned: burned,
        ai_tip: 'Great session! Remember to hydrate and hit your daily protein goal.',
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. USER FOOD MEMORY & MEAL PARSING
  // ──────────────────────────────────────────────────────────────────────────
  // Check for vague statements ("Had something nice")
  if (
    lower === 'had something' ||
    lower === 'had something nice' ||
    lower === 'ate food' ||
    lower === 'i ate'
  ) {
    return {
      intent: 'meal',
      confidence: 'low',
      requires_clarification: true,
      clarification_prompt:
        "What did you have? Tell Nuvia what you ate (e.g. chicken rice, eggs and toast, or a sandwich).",
    };
  }

  // Check for "same breakfast" or "usual breakfast"
  const isBreakfastRef =
    lower.includes('usual breakfast') ||
    lower.includes('same breakfast') ||
    lower.includes('normal breakfast');

  if (isBreakfastRef) {
    const breakfastHistory = ctx.recent_meals.filter(
      (m) => m.meal_type === 'breakfast'
    );
    const uniqueBreakfasts = Array.from(
      new Set(breakfastHistory.map((b) => b.name.toLowerCase().trim()))
    );

    // If multiple plausible matches exist, ask for clarification
    if (uniqueBreakfasts.length > 1) {
      const option1 = uniqueBreakfasts[0];
      const option2 = uniqueBreakfasts[1];
      return {
        intent: 'meal',
        confidence: 'medium',
        requires_clarification: true,
        clarification_prompt: `Which one do you mean — your usual ${option1} or your ${option2}?`,
      };
    }

    // Match the single frequent breakfast or fallback
    const matched =
      breakfastHistory[0] ||
      ctx.frequent_meals.find((m) => m.common_meal_type === 'breakfast');

    if (matched) {
      const cals: number =
        Number(
          'recent_average_calories' in matched
            ? matched.recent_average_calories
            : (matched as any).calories
        ) || 350;
      const prot: number =
        Number(
          'recent_average_protein_g' in matched
            ? matched.recent_average_protein_g
            : (matched as any).protein_g
        ) || 20;

      return {
        intent: 'meal',
        confidence: 'high',
        requires_clarification: false,
        context_match: {
          matched_history: true,
          matched_name: matched.name,
          confidence: 0.92,
          badge_label: 'Using your recent meals',
          note: `Matched your usual breakfast (${cals} kcal, ${prot}g protein).`,
        },
        meal_data: {
          meal_type: 'breakfast',
          meal_name: matched.name,
          foods: [
            {
              name: matched.name,
              estimated_quantity: 1,
              unit: 'serving',
              calories: cals,
              protein_g: prot,
              carbs_g: Math.round(cals * 0.1),
              fat_g: Math.round(cals * 0.04),
              confidence: 'high',
            },
          ],
          total: {
            calories: cals,
            protein_g: prot,
            carbs_g: Math.round(cals * 0.1),
            fat_g: Math.round(cals * 0.04),
          },
          notes: `Matched from your frequent breakfast logs.`,
        },
      };
    }
  }

  // Check for portion modifiers ("smaller portion", "half plate", "large portion")
  const isSmallerPortion =
    lower.includes('smaller portion') ||
    lower.includes('small portion') ||
    lower.includes('half portion') ||
    lower.includes('half plate') ||
    lower.includes('less rice');

  const isLargerPortion =
    lower.includes('larger portion') ||
    lower.includes('big portion') ||
    lower.includes('extra portion') ||
    lower.includes('double');

  const portionScale = isSmallerPortion ? 0.65 : isLargerPortion ? 1.35 : 1.0;

  // Search frequent meals and recent meals for recurring foods
  let matchedMeal: FrequentMealSummary | RecentMealSummary | undefined;
  for (const fMeal of ctx.frequent_meals) {
    const fLower = fMeal.name.toLowerCase();
    if (lower.includes(fLower) || fLower.includes(lower.replace(/^(had|ate|i had|i ate)\s*/i, '').trim())) {
      matchedMeal = fMeal;
      break;
    }
  }
  if (!matchedMeal) {
    for (const rMeal of ctx.recent_meals) {
      const rLower = rMeal.name.toLowerCase();
      if (lower.includes(rLower) || rLower.includes(lower.replace(/^(had|ate|i had|i ate)\s*/i, '').trim())) {
        matchedMeal = rMeal;
        break;
      }
    }
  }

  // Ambiguous check: if user says "chicken rice" and there are multiple variants (e.g. steamed vs roasted vs ayam penyet)
  if (lower === 'had chicken rice' || lower === 'chicken rice' || lower === 'i had chicken rice') {
    const chickenVariants = ctx.frequent_meals.filter((m) =>
      m.name.toLowerCase().includes('chicken') || m.name.toLowerCase().includes('ayam')
    );
    if (chickenVariants.length > 1) {
      return {
        intent: 'meal',
        confidence: 'medium',
        requires_clarification: true,
        clarification_prompt: `Which chicken rice did you have — ${chickenVariants[0].name} or ${chickenVariants[1].name}?`,
      };
    }
  }

  if (matchedMeal) {
    const baseCals =
      'recent_average_calories' in matchedMeal
        ? matchedMeal.recent_average_calories
        : matchedMeal.calories;
    const baseProt =
      'recent_average_protein_g' in matchedMeal
        ? matchedMeal.recent_average_protein_g
        : matchedMeal.protein_g;

    const scaledCals = Math.round(baseCals * portionScale);
    const scaledProt = Math.round(baseProt * portionScale * 10) / 10;

    let note = `Your recent entries were around ${baseCals} kcal.`;
    if (isSmallerPortion) {
      note = `Adjusted portion downward from your usual ${baseCals} kcal baseline (~${scaledCals} kcal).`;
    } else if (isLargerPortion) {
      note = `Adjusted portion upward from your usual ${baseCals} kcal baseline (~${scaledCals} kcal).`;
    }

    return {
      intent: 'meal',
      confidence: 'high',
      requires_clarification: false,
      context_match: {
        matched_history: true,
        matched_name: matchedMeal.name,
        confidence: 0.9,
        badge_label: 'Using your recent meals',
        note,
      },
      meal_data: {
        meal_type:
          ('common_meal_type' in matchedMeal && matchedMeal.common_meal_type) ||
          ('meal_type' in matchedMeal && (matchedMeal.meal_type as any)) ||
          'lunch',
        meal_name: matchedMeal.name,
        foods: [
          {
            name: matchedMeal.name,
            estimated_quantity: 1,
            unit: 'plate',
            calories: scaledCals,
            protein_g: scaledProt,
            carbs_g: Math.round(scaledCals * 0.1),
            fat_g: Math.round(scaledCals * 0.04),
            confidence: 'high',
          },
        ],
        total: {
          calories: scaledCals,
          protein_g: scaledProt,
          carbs_g: Math.round(scaledCals * 0.1),
          fat_g: Math.round(scaledCals * 0.04),
        },
        notes: note,
      },
    };
  }

  // Fallback: General meal parsing (e.g. fresh food name like "burger", "nasi ayam", "eggs")
  const cleanedDish = text
    .replace(/^(i had|i ate|had|ate|having)\s+/i, '')
    .replace(/\s+(for lunch|for dinner|for breakfast|today|again)$/i, '')
    .trim();

  let estCals = 550;
  let estProt = 25;
  let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch';

  if (lower.includes('breakfast') || lower.includes('egg') || lower.includes('toast')) {
    mealType = 'breakfast';
    estCals = 380;
    estProt = 20;
  } else if (lower.includes('shake') || lower.includes('milo') || lower.includes('snack')) {
    mealType = 'snack';
    estCals = 220;
    estProt = 24;
  } else if (lower.includes('nasi ayam') || lower.includes('chicken rice')) {
    estCals = 640;
    estProt = 32;
  } else if (lower.includes('burger')) {
    estCals = 650;
    estProt = 30;
  }

  const finalCals = Math.round(estCals * portionScale);
  const finalProt = Math.round(estProt * portionScale * 10) / 10;

  return {
    intent: 'meal',
    confidence: 'high',
    requires_clarification: false,
    context_match: {
      matched_history: false,
      confidence: 0.75,
    },
    meal_data: {
      meal_type: mealType,
      meal_name: cleanedDish || 'Logged Meal',
      foods: [
        {
          name: cleanedDish || 'Food Item',
          estimated_quantity: 1,
          unit: 'portion',
          calories: finalCals,
          protein_g: finalProt,
          carbs_g: Math.round(finalCals * 0.1),
          fat_g: Math.round(finalCals * 0.04),
          confidence: 'medium',
        },
      ],
      total: {
        calories: finalCals,
        protein_g: finalProt,
        carbs_g: Math.round(finalCals * 0.1),
        fat_g: Math.round(finalCals * 0.04),
      },
      notes: isSmallerPortion
        ? 'Estimated with smaller portion adjustment.'
        : undefined,
    },
  };
}
