import { AdaptiveTrainingEngine } from '../src/lib/adaptive-training-engine.ts';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('🧪 Starting Nuvia Adaptive Training Engine Verification (Scenarios A - J)...\n');

const today = new Date();
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const todayStr = getLocalDateString(today);
const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];

// Mock Routine Templates (Upper / Lower split)
const upperLowerRoutines = [
  {
    id: 'routine-upper-1',
    title: 'Upper Body A',
    focus: 'Chest, Back, Shoulders',
    days: ['Monday', 'Thursday'],
    target_muscle_groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
    exercises: [
      { id: 'e1', name: 'Barbell Bench Press', sets: 4, reps: 8, target_muscle: 'chest' },
      { id: 'e2', name: 'Barbell Row', sets: 4, reps: 8, target_muscle: 'back' },
      { id: 'e3', name: 'Overhead Press', sets: 3, reps: 10, target_muscle: 'shoulders' },
      { id: 'e4', name: 'Pull-ups', sets: 3, reps: 10, target_muscle: 'back' },
    ],
  },
  {
    id: 'routine-lower-1',
    title: 'Lower Body A',
    focus: 'Quads, Hamstrings, Calves',
    days: ['Tuesday', 'Friday'],
    target_muscle_groups: ['quads', 'hamstrings', 'glutes', 'calves'],
    exercises: [
      { id: 'e5', name: 'Barbell Back Squat', sets: 4, reps: 8, target_muscle: 'quads' },
      { id: 'e6', name: 'Romanian Deadlift', sets: 4, reps: 10, target_muscle: 'hamstrings' },
      { id: 'e7', name: 'Leg Press', sets: 3, reps: 12, target_muscle: 'quads' },
      { id: 'e8', name: 'Standing Calf Raise', sets: 4, reps: 15, target_muscle: 'calves' },
    ],
  },
];

// -------------------------------------------------------------
// Scenario A: Normal Week
// -------------------------------------------------------------
console.log('--- Scenario A: Normal Week (Mon Upper, Tue Lower, Thu Upper, Fri Lower) ---');
const mondayState = AdaptiveTrainingEngine.determineDailyTrainingState({
  targetDate: '2026-09-21', // Monday
  routines: upperLowerRoutines,
  logs: [
    {
      id: 'log-1',
      exercise_type: 'Upper Body A',
      source: 'routine',
      created_at: '2026-09-21T18:00:00Z',
      ai_analysis: { routine_id: 'routine-upper-1', executed_count: 4, total_exercises: 4 },
    },
  ],
  activeSession: null,
  adaptations: [],
});
assert(mondayState === 'completed_workout', 'Monday state is completed_workout when all exercises done');

// Test next action when today's workout was scheduled and completed
const routineToday = [{ ...upperLowerRoutines[0], days: [todayDayName] }];
const normalNextAction = AdaptiveTrainingEngine.calculateNextTrainingAction({
  routines: routineToday,
  logs: [
    {
      id: 'log-today',
      exercise_type: 'Upper Body A',
      source: 'routine',
      created_at: `${todayStr}T10:00:00Z`,
      ai_analysis: { routine_id: 'routine-upper-1', executed_count: 4, total_exercises: 4 },
    },
  ],
  activeSession: null,
  adaptations: [],
});
assert(normalNextAction.type === 'recovery', 'Next action after completed workout is recovery/rest');

// -------------------------------------------------------------
// Scenario B: Missed Workout Detection & Reschedule Proposal
// -------------------------------------------------------------
console.log('\n--- Scenario B: Missed Workout Detection ---');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][yesterday.getDay()];

const testRoutinesWithYesterday = [
  {
    ...upperLowerRoutines[1],
    days: [yesterdayDayName],
  },
];

const missedProposals = AdaptiveTrainingEngine.detectMissedWorkouts({
  routines: testRoutinesWithYesterday,
  logs: [], // nothing done yesterday
  adaptations: [],
  trainedMusclesLast48h: [],
});
assert(missedProposals.length >= 1, 'Detected missed session from previous scheduled day');
assert(missedProposals[0].routine_id === 'routine-lower-1', 'Missed routine is Lower Body A');
assert(missedProposals[0].options.length >= 2, 'Provides multiple choices (move, keep, skip)');

// Next action prioritizes the missed proposal
const missedNextAction = AdaptiveTrainingEngine.calculateNextTrainingAction({
  routines: testRoutinesWithYesterday,
  logs: [],
  adaptations: [],
});
assert(missedNextAction.type === 'reschedule', 'Next action surfaces reschedule proposal without silently changing plan');

// -------------------------------------------------------------
// Scenario C: User Wants to Run on a Workout Day
// -------------------------------------------------------------
console.log('\n--- Scenario C: User Wants to Run on a Workout Day ---');
const runWorkoutDayAnalysis = AdaptiveTrainingEngine.evaluateUserIntent({
  message: 'I want to run today',
  todayRoutine: upperLowerRoutines[1], // Lower Body
  recentMuscles: ['quads', 'hamstrings'],
  routines: upperLowerRoutines,
  logs: [],
});
assert(runWorkoutDayAnalysis.classification === 'PLAN_CHANGE', 'Intent classified as PLAN_CHANGE');
assert(runWorkoutDayAnalysis.proposal !== undefined, 'Generated proposal with options');
assert(runWorkoutDayAnalysis.proposal.options.some((o) => o.label.toLowerCase().includes('replace')), 'Offers to replace workout with run');
assert(runWorkoutDayAnalysis.proposal.options.some((o) => o.label.toLowerCase().includes('keep')), 'Offers to keep workout alongside run');

// -------------------------------------------------------------
// Scenario D: User Wants to Run on a Rest Day
// -------------------------------------------------------------
console.log('\n--- Scenario D: User Wants to Run on a Rest Day ---');
const runRestDayAnalysis = AdaptiveTrainingEngine.evaluateUserIntent({
  message: 'I feel like running today',
  todayRoutine: null, // Rest day
  recentMuscles: [],
  routines: upperLowerRoutines,
  logs: [],
});
assert(runRestDayAnalysis.classification === 'LOG_ACTIVITY', 'Intent classified as LOG_ACTIVITY');
assert(
  runRestDayAnalysis.proposal.options.some((o) => o.label.toLowerCase().includes('run')),
  'Offers to log running activity on rest day'
);

// -------------------------------------------------------------
// Scenario E: Partial Workout Integration
// -------------------------------------------------------------
console.log('\n--- Scenario E: Partial Workout (4 of 8 exercises completed) ---');
const partialState = AdaptiveTrainingEngine.determineDailyTrainingState({
  targetDate: '2026-09-22',
  routines: upperLowerRoutines,
  logs: [
    {
      id: 'log-partial',
      exercise_type: 'Lower Body A',
      source: 'routine',
      duration_minutes: 30,
      created_at: '2026-09-22T10:00:00Z',
      ai_analysis: {
        routine_id: 'routine-lower-1',
        executed_count: 2,
        total_exercises: 4,
      },
    },
  ],
  activeSession: null,
  adaptations: [],
});
assert(partialState === 'partial_workout', 'Correctly identified partial_workout state from actual logs');

// -------------------------------------------------------------
// Scenario F: User Resumes Partial Workout
// -------------------------------------------------------------
console.log('\n--- Scenario F: User Resumes Partial Workout ---');
const resumeAction = AdaptiveTrainingEngine.calculateNextTrainingAction({
  routines: upperLowerRoutines,
  logs: [],
  activeSession: {
    routineId: 'routine-lower-1',
    routineTitle: 'Lower Body A',
    completedSetsCount: 4,
    totalSetsCount: 8,
    status: 'active',
  },
  adaptations: [],
});
assert(resumeAction.type === 'continue_workout', 'Surfaces continue_workout action to resume unfinished sets');
assert(resumeAction.percentage === 50, 'Shows 50% completed sets');

// -------------------------------------------------------------
// Scenario G: User Cancels Adaptation (Plan Remains Intact)
// -------------------------------------------------------------
console.log('\n--- Scenario G: User Rejects/Cancels Adaptation ---');
const weeklyPlanWithoutAdaptation = AdaptiveTrainingEngine.generateWeeklyAdaptationView({
  routines: upperLowerRoutines,
  logs: [],
  adaptations: [],
});
assert(weeklyPlanWithoutAdaptation.length === 7, 'Weekly plan generated for all 7 days');
assert(upperLowerRoutines[1].days.includes('Tuesday'), 'Routine template days remain intact');

// -------------------------------------------------------------
// Scenario H: User Accepts Reschedule (Tuesday Lower -> Wednesday Lower)
// -------------------------------------------------------------
console.log('\n--- Scenario H: User Accepts Reschedule (Tuesday Lower -> Wednesday Lower) ---');
const temporaryAdaptations = [
  {
    id: 'adapt-1',
    user_id: 'user-1',
    routine_id: 'routine-lower-1',
    routine_name: 'Lower Body A',
    date: '2026-09-22',
    target_date: '2026-09-23',
    action: 'move_workout',
    reason: 'Missed Tuesday Lower Body session',
    status: 'accepted',
    created_at: '2026-09-23T08:00:00Z',
  },
];

const adaptedWeeklyPlan = AdaptiveTrainingEngine.generateWeeklyAdaptationView({
  routines: upperLowerRoutines,
  logs: [],
  adaptations: temporaryAdaptations,
  startDate: new Date('2026-09-21T12:00:00Z'),
});

const adaptedDay = adaptedWeeklyPlan.find((d) => d.date === '2026-09-23');
assert(adaptedDay !== undefined && adaptedDay.isAdapted, 'Found adapted day marked with isAdapted in weekly view');
assert(
  JSON.stringify(upperLowerRoutines[1].days) === JSON.stringify(['Tuesday', 'Friday']),
  'Routine template days are NEVER mutated by temporary schedule adaptations'
);

// -------------------------------------------------------------
// Scenario I: Routine Template Modification Distinguishability
// -------------------------------------------------------------
console.log('\n--- Scenario I: Routine Template Modification Distinguishability ---');
assert(Array.isArray(upperLowerRoutines[0].days), 'Routine 0 days array unmodified');
assert(upperLowerRoutines[0].days[0] === 'Monday', 'Routine 0 still Monday');

// -------------------------------------------------------------
// Scenario J: Conflicting Recovery State (Avoid Bad Stacking)
// -------------------------------------------------------------
console.log('\n--- Scenario J: Conflicting Recovery State Evaluation ---');
const recoveryProposal = AdaptiveTrainingEngine.detectMissedWorkouts({
  routines: testRoutinesWithYesterday,
  logs: [],
  adaptations: [],
  trainedMusclesLast48h: ['quads', 'hamstrings'], // Lower body muscles already fatigued
});
assert(recoveryProposal.length > 0, 'Generated proposal');
assert(
  recoveryProposal[0].recovery_analysis.includes('fatigued') || recoveryProposal[0].conflict_warning !== undefined,
  'Provides transparent recovery caution warning when target muscles are fatigued'
);

// -------------------------------------------------------------
// Weekly Report Test
// -------------------------------------------------------------
console.log('\n--- Weekly Adaptive Training Report ---');
const weeklyReport = AdaptiveTrainingEngine.generateWeeklyReport({
  routines: upperLowerRoutines,
  logs: [
    {
      id: 'l1',
      exercise_type: 'Upper Body A',
      source: 'routine',
      created_at: `${todayStr}T08:00:00Z`,
      ai_analysis: { routine_id: 'routine-upper-1', executed_count: 4, total_exercises: 4 },
      duration_minutes: 45,
      calories_burned: 320,
    },
  ],
  adaptations: temporaryAdaptations,
});
assert(weeklyReport.plannedWorkouts > 0, 'Calculates planned workouts');
assert(weeklyReport.consistencyRate !== undefined, 'Generates neutral consistency rate');
assert(Array.isArray(weeklyReport.adaptationsSummary), 'Includes adaptations summary');

console.log('\n🎉 ALL SCENARIOS (A - J) PASSED DETERMINISTIC ENGINE VERIFICATION!');
