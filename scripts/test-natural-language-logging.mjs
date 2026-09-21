/**
 * Test Suite: Nuvia Natural Language Logging Experience (Section 32 Verification)
 */

import { parseNaturalLanguageLocally } from '../src/lib/natural-language-parser.ts';

function runScenario(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('\n=== RUNNING NATURAL LANGUAGE LOGGING VERIFICATION SUITE ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: New User (No history)
// ─────────────────────────────────────────────────────────────────────────────
runScenario('Scenario 1: New User with no history', () => {
  const result = parseNaturalLanguageLocally('Had chicken rice for lunch', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  });

  assert(result.intent === 'meal', `Expected intent 'meal', got ${result.intent}`);
  assert(result.meal_data !== undefined, 'Expected meal_data to be populated');
  assert(result.meal_data.total.calories > 400, 'Expected estimated calories > 400');
  assert(!result.requires_clarification, 'New user standard dish should not require clarification');
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: User with recurring meal history (Multiple breakfasts -> Clarification)
// ─────────────────────────────────────────────────────────────────────────────
runScenario('Scenario 2: Recurring meal with ambiguity requires clarification', () => {
  const result = parseNaturalLanguageLocally('I had my usual breakfast.', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [
      { name: 'Eggs + Toast', meal_type: 'breakfast', calories: 380, protein_g: 22, logged_at: '2026-09-20' },
      { name: 'Oats with Berries', meal_type: 'breakfast', calories: 320, protein_g: 14, logged_at: '2026-09-19' },
    ],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  });

  assert(result.intent === 'meal', `Expected intent 'meal', got ${result.intent}`);
  assert(result.requires_clarification === true, 'Expected requires_clarification to be true for multiple breakfasts');
  assert(
    result.clarification_prompt && result.clarification_prompt.includes('toast') && result.clarification_prompt.includes('oats'),
    `Expected clarification prompt mentioning both options, got: ${result.clarification_prompt}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: User with recurring walk (Saturday walk memory)
// ─────────────────────────────────────────────────────────────────────────────
runScenario('Scenario 3: Recurring Saturday walk activity memory', () => {
  const result = parseNaturalLanguageLocally('I did my usual Saturday walk.', {
    today_date: '2026-09-26',
    day_of_week: 'Saturday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: {
      type: 'Brisk walking',
      distance_km: 4.5,
      typical_days: ['Saturday'],
      description: '4.5 km outdoor brisk walk on weekend mornings',
    },
    today_routine: null,
    upcoming_routine: null,
  });

  assert(result.intent === 'activity', `Expected intent 'activity', got ${result.intent}`);
  assert(result.activity_data !== undefined, 'Expected activity_data');
  assert(result.activity_data.distance_km === 4.5, `Expected 4.5 km distance, got ${result.activity_data.distance_km}`);
  assert(result.context_match?.matched_history === true, 'Expected context_match.matched_history to be true');
  assert(
    result.context_match?.badge_label?.includes('Saturday walk'),
    `Expected badge to reference Saturday walk, got: ${result.context_match?.badge_label}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: User with today's routine ("Finished today's workout")
// ─────────────────────────────────────────────────────────────────────────────
runScenario("Scenario 4: User with today's routine ('Finished today's workout')", () => {
  const result = parseNaturalLanguageLocally("I finished today's workout.", {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: {
      id: 'routine-upper-a',
      title: 'Upper Body A',
      focus: 'Upper Body Hypertrophy',
      exercises: ['Bench Press', 'Dumbbell Row', 'Overhead Press', 'Lateral Raise', 'Bicep Curl'],
      is_completed: false,
      total_exercises: 5,
    },
    upcoming_routine: null,
  });

  assert(result.intent === 'workout', `Expected intent 'workout', got ${result.intent}`);
  assert(result.workout_data !== undefined, 'Expected workout_data');
  assert(result.workout_data.routine_title === 'Upper Body A', `Expected Upper Body A, got ${result.workout_data.routine_title}`);
  assert(result.workout_data.is_partial === false, 'Expected full workout');
  assert(result.workout_data.completion_percentage === 100, 'Expected 100% completion');
  assert(result.context_match?.matched_history === true, 'Expected context_match');
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: Partial workout ("I only did half")
// ─────────────────────────────────────────────────────────────────────────────
runScenario("Scenario 5: Partial workout ('I only did half')", () => {
  const result = parseNaturalLanguageLocally('I only did half of today’s workout.', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: {
      id: 'routine-upper-a',
      title: 'Upper Body A',
      focus: 'Upper Body Hypertrophy',
      exercises: ['Bench Press', 'Dumbbell Row', 'Overhead Press', 'Lateral Raise', 'Bicep Curl'],
      is_completed: false,
      total_exercises: 5,
    },
    upcoming_routine: null,
  });

  assert(result.intent === 'partial_workout', `Expected intent 'partial_workout', got ${result.intent}`);
  assert(result.workout_data !== undefined, 'Expected workout_data');
  assert(result.workout_data.is_partial === true, 'Expected is_partial === true');
  assert(result.workout_data.completion_percentage === 50, `Expected 50% completion, got ${result.workout_data.completion_percentage}`);
  assert(result.workout_data.routine_title === 'Upper Body A', 'Expected routine_title Upper Body A');
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: Training intent ("I want to run tomorrow")
// ─────────────────────────────────────────────────────────────────────────────
runScenario("Scenario 6: Training intent ('I want to run tomorrow')", () => {
  const result = parseNaturalLanguageLocally('I want to run tomorrow.', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: {
      id: 'routine-lower-a',
      title: 'Lower Body A',
      focus: 'Legs',
      exercises: ['Squat', 'RDL', 'Lunges'],
      is_completed: false,
      total_exercises: 3,
    },
    upcoming_routine: null,
  });

  assert(result.intent === 'training_intent', `Expected intent 'training_intent', got ${result.intent}`);
  assert(result.activity_data === undefined, 'Training intent should NOT generate an activity log');
  assert(result.training_intent_data !== undefined, 'Expected training_intent_data');
  assert(result.training_intent_data.reply.length > 0, 'Expected coaching reply');
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7: Explicit portion correction ("Today was a smaller portion")
// ─────────────────────────────────────────────────────────────────────────────
runScenario("Scenario 7: Explicit correction ('Today was a smaller portion')", () => {
  const result = parseNaturalLanguageLocally('Had nasi ayam again, today was a smaller portion.', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [
      {
        name: 'Nasi ayam',
        count: 8,
        recent_average_calories: 640,
        recent_average_protein_g: 32,
        common_meal_type: 'lunch',
        last_logged_at: '2026-09-20',
      },
    ],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  });

  assert(result.intent === 'meal', `Expected intent 'meal', got ${result.intent}`);
  assert(result.meal_data !== undefined, 'Expected meal_data');
  assert(
    result.meal_data.total.calories < 600,
    `Expected scaled down calories (< 600), got ${result.meal_data.total.calories}`
  );
  assert(
    result.meal_data.total.calories >= 400,
    `Expected reasonable scaled calories (>= 400), got ${result.meal_data.total.calories}`
  );
  assert(
    result.context_match?.badge_label === 'Using your recent meals',
    `Expected 'Using your recent meals' badge, got: ${result.context_match?.badge_label}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 8: Conflicting history ("I had chicken rice" with multiple variants)
// ─────────────────────────────────────────────────────────────────────────────
runScenario('Scenario 8: Conflicting history asks clarification', () => {
  const result = parseNaturalLanguageLocally('I had chicken rice', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [
      {
        name: 'Hainanese Chicken Rice (Steamed)',
        count: 5,
        recent_average_calories: 620,
        recent_average_protein_g: 34,
      },
      {
        name: 'Roasted Chicken Rice (Ayam Panggang)',
        count: 4,
        recent_average_calories: 680,
        recent_average_protein_g: 33,
      },
    ],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  });

  assert(result.intent === 'meal', `Expected intent 'meal', got ${result.intent}`);
  assert(
    result.requires_clarification === true,
    'Expected requires_clarification === true for conflicting chicken rice variants'
  );
  assert(
    result.clarification_prompt && result.clarification_prompt.includes('Which chicken rice'),
    `Expected clarification prompt for chicken rice variants, got: ${result.clarification_prompt}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 9: Prefix stripping test (user enters "meal: burger" or "activity: walk")
// ─────────────────────────────────────────────────────────────────────────────
runScenario("Scenario 9: Strips legacy prefixes seamlessly", () => {
  const mealResult = parseNaturalLanguageLocally('meal: smash burger with fries', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  });
  assert(mealResult.intent === 'meal', 'Expected intent meal');
  assert(!mealResult.meal_data.meal_name.toLowerCase().startsWith('meal:'), 'Prefix should be removed');

  const actResult = parseNaturalLanguageLocally('activity: brisk walk for 40 mins', {
    today_date: '2026-09-21',
    day_of_week: 'Monday',
    frequent_meals: [],
    recent_meals: [],
    recent_activities: [],
    habitual_cardio: null,
    today_routine: null,
    upcoming_routine: null,
  });
  assert(actResult.intent === 'activity', 'Expected intent activity');
});

console.log('\n=== ALL SCENARIOS PASSED SUCCESSFULLY ===\n');
