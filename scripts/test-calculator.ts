// Run: node --experimental-strip-types scripts/test-calculator.ts
import assert from 'node:assert/strict';
import {
  calculateTargets,
  calculateAge,
  calculateBmi,
  getUserCalculationContext,
  getMissingProfileFields,
  describeMissingFields,
  getStoredWeeklyPace,
  storeWeeklyPace,
  cleanDietaryPreference,
  isSavedTargetOutOfDate,
  paceToDailyKcal,
  dailyKcalToPace,
  KCAL_PER_KG,
  MAX_ADJUSTMENT_SHARE,
  MAX_PROTEIN_SHARE,
  MIN_FAT_G_PER_KG,
  PROTEIN_G_PER_KG,
  type CalculationInput,
  type CalculationResult,
} from '../src/lib/calculator.ts';

// In-memory localStorage so the pace storage can be tested outside a browser.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
  },
});

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

const macroKcal = (r: CalculationResult) =>
  r.protein_target * 4 + r.carbohydrate_target * 4 + r.fat_target * 9;

// ── The four example users ───────────────────────────────────────────────────
const A: CalculationInput = { age: 28, sex: 'male', height_cm: 172, weight_kg: 78, activity_level: 'moderately_active', goal: 'lose_weight', weekly_pace_kg: 0.5, target_weight_kg: 70 };
const B: CalculationInput = { age: 31, sex: 'female', height_cm: 158, weight_kg: 62, activity_level: 'lightly_active', goal: 'lose_weight', weekly_pace_kg: 0.25, target_weight_kg: 58 };
const C: CalculationInput = { age: 24, sex: 'male', height_cm: 175, weight_kg: 65, activity_level: 'very_active', goal: 'build_muscle', target_weight_kg: 70 };
const D: CalculationInput = { age: 40, sex: 'male', height_cm: 170, weight_kg: 105, activity_level: 'sedentary', goal: 'lose_weight', weekly_pace_kg: 0.75, target_weight_kg: 85 };

test('User A: male 28y 172cm 78kg, moderately active, lose 0.5 kg/wk', () => {
  const r = calculateTargets(A);
  assert.equal(r.bmr, 1720); // 780 + 1075 - 140 + 5
  assert.equal(r.tdee, 2666); // 1720 x 1.55
  assert.equal(r.adjustment, -550); // 0.5 x 7700 / 7
  assert.equal(r.calorie_target, 2116);
  assert.equal(r.limited_by, 'none');
  assert.equal(r.expected_pace_kg, 0.5);
  // BMI 26.4 -> protein/fat use the weight at BMI 25 (73.96 kg)
  assert.equal(r.reference_weight_kg, 74);
  assert.equal(r.protein_target, 148); // 2.0 g/kg
  assert.equal(r.fat_target, 59); // 25% of calories
  assert.equal(r.carbohydrate_target, 248);
  assert.equal(r.weeks_to_goal, 16); // 8 kg at 0.5 kg/wk
});

test('User B: female 31y 158cm 62kg, lightly active, lose 0.25 kg/wk', () => {
  const r = calculateTargets(B);
  assert.equal(r.bmr, 1292); // 620 + 987.5 - 155 - 161 = 1291.5
  assert.equal(r.tdee, 1776);
  assert.equal(r.adjustment, -275);
  assert.equal(r.calorie_target, 1501);
  assert.equal(r.limited_by, 'none');
  assert.equal(r.protein_target, 124); // 2.0 x 62 kg (BMI 24.8, current weight used)
  assert.equal(r.fat_target, 42);
  assert.equal(r.weeks_to_goal, 16); // 4 kg at 0.25 kg/wk
});

test('User C: male 24y 175cm 65kg, very active, build muscle', () => {
  const r = calculateTargets(C);
  assert.equal(r.bmr, 1629);
  assert.equal(r.tdee, 2810);
  assert.equal(r.adjustment, 250);
  assert.equal(r.calorie_target, 3060);
  assert.equal(r.protein_target, 117); // 1.8 x 65
  assert.equal(r.fat_target, 85);
  assert.equal(r.expected_pace_kg, 0.23);
  assert.equal(r.weeks_to_goal, 22); // 5 kg at 0.23 kg/wk
});

test('User D: male 40y 170cm 105kg, sedentary, lose 0.75 kg/wk (limited)', () => {
  const r = calculateTargets(D);
  assert.equal(r.bmr, 1918);
  assert.equal(r.tdee, 2301);
  // 0.75 kg/wk needs 825 kcal/day = 36% of maintenance -> capped at 25%
  assert.equal(r.limited_by, 'max_deficit');
  assert.equal(r.adjustment, -575);
  assert.equal(r.calorie_target, 1726);
  assert.equal(r.expected_pace_kg, 0.52);
  assert.equal(r.weekly_pace_kg, 0.75); // what was asked for is still reported
  // BMI 36.3 -> reference weight is 72.2 kg, not 105 kg
  assert.equal(r.reference_weight_kg, 72.2);
  assert.equal(r.protein_target, 144);
  assert.equal(r.weeks_to_goal, 39); // 20 kg at 0.52 kg/wk, not the 27 weeks 0.75 would promise
});

// ── Pace maths ───────────────────────────────────────────────────────────────
test('pace uses 7,700 kcal per kg', () => {
  assert.equal(KCAL_PER_KG, 7700);
  assert.equal(paceToDailyKcal(0.25), 275);
  assert.equal(paceToDailyKcal(0.5), 550);
  assert.equal(paceToDailyKcal(0.75), 825);
  assert.equal(paceToDailyKcal(1), 1100);
  assert.equal(dailyKcalToPace(-550), 0.5);
  assert.equal(dailyKcalToPace(1100), 1);
});

test('stated pace matches the deficit/surplus when no limit applies', () => {
  const big: CalculationInput = { age: 20, sex: 'male', height_cm: 200, weight_kg: 130, activity_level: 'extremely_active', goal: 'lose_weight' };
  for (const pace of [0.25, 0.5, 0.75, 1]) {
    const lose = calculateTargets({ ...big, weekly_pace_kg: pace });
    assert.equal(lose.limited_by, 'none');
    assert.equal(lose.adjustment, -paceToDailyKcal(pace));
    assert.equal(lose.expected_pace_kg, pace);
    const gain = calculateTargets({ ...big, goal: 'gain_weight', weekly_pace_kg: pace });
    assert.equal(gain.adjustment, paceToDailyKcal(pace));
    assert.equal(gain.expected_pace_kg, pace);
  }
});

test('missing or zero pace falls back to 0.5 kg/wk', () => {
  assert.equal(calculateTargets({ ...A, weekly_pace_kg: undefined }).adjustment, -550);
  assert.equal(calculateTargets({ ...A, weekly_pace_kg: 0 }).weekly_pace_kg, 0.5);
});

test('fixed-adjustment goals', () => {
  assert.equal(calculateTargets({ ...A, goal: 'maintain_weight' }).adjustment, 0);
  assert.equal(calculateTargets({ ...A, goal: 'recomposition' }).adjustment, -200);
  assert.equal(calculateTargets({ ...A, goal: 'build_muscle' }).adjustment, 250);
  // pace does not change them
  assert.equal(calculateTargets({ ...A, goal: 'build_muscle', weekly_pace_kg: 1 }).adjustment, 250);
});

// ── Safety limits ────────────────────────────────────────────────────────────
test('deficit never exceeds 25% of maintenance and never goes under the floor', () => {
  const sexes = ['male', 'female'] as const;
  const levels = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'] as const;
  for (const sex of sexes)
    for (const activity_level of levels)
      for (const weight_kg of [45, 60, 80, 120])
        for (const pace of [0.25, 0.5, 0.75, 1]) {
          const r = calculateTargets({ age: 35, sex, height_cm: 160, weight_kg, activity_level, goal: 'lose_weight', weekly_pace_kg: pace });
          const floor = sex === 'female' ? 1200 : 1500;
          assert.equal(r.min_calories, floor);
          assert.ok(r.calorie_target <= r.tdee, 'a weight-loss target is never above maintenance');
          assert.ok(r.calorie_target >= Math.min(floor, r.tdee), 'target respects the floor');
          assert.ok(-r.adjustment <= Math.round(r.tdee * MAX_ADJUSTMENT_SHARE), 'deficit within 25%');
          // whenever the target is limited, the reported pace is the slower, honest one
          if (r.limited_by !== 'none') assert.ok(r.expected_pace_kg < pace);
          else assert.equal(r.expected_pace_kg, pace);
        }
});

test('floor: small woman asking for 0.5 kg/wk is told the pace is limited', () => {
  const r = calculateTargets({ age: 45, sex: 'female', height_cm: 150, weight_kg: 50, activity_level: 'sedentary', goal: 'lose_weight', weekly_pace_kg: 0.5 });
  assert.equal(r.tdee, 1262);
  assert.equal(r.calorie_target, 1200);
  assert.equal(r.limited_by, 'min_calories');
  assert.equal(r.expected_pace_kg, 0.06);
});

test('floor never pushes a target above maintenance', () => {
  const r = calculateTargets({ age: 70, sex: 'male', height_cm: 155, weight_kg: 45, activity_level: 'sedentary', goal: 'lose_weight' });
  assert.ok(r.tdee < 1500);
  assert.equal(r.calorie_target, r.tdee);
  assert.equal(r.limited_by, 'min_calories');
  assert.equal(r.expected_pace_kg, 0);
  assert.equal(r.weeks_to_goal, null);
});

test('surplus is capped at 25% of maintenance', () => {
  const r = calculateTargets({ age: 30, sex: 'female', height_cm: 160, weight_kg: 48, activity_level: 'sedentary', goal: 'gain_weight', weekly_pace_kg: 1 });
  assert.equal(r.limited_by, 'max_surplus');
  assert.equal(r.adjustment, Math.round(r.tdee * 0.25));
});

// ── Macros ───────────────────────────────────────────────────────────────────
test('macros add up to the calorie target, protein and fat stay in bounds', () => {
  const goals = ['lose_weight', 'recomposition', 'maintain_weight', 'build_muscle', 'gain_weight'] as const;
  const levels = ['sedentary', 'moderately_active', 'extremely_active'] as const;
  for (const sex of ['male', 'female'] as const)
    for (const goal of goals)
      for (const activity_level of levels)
        for (const height_cm of [150, 170, 190])
          for (const weight_kg of [45, 60, 80, 105, 140])
            for (const pace of [0.25, 1]) {
              const r = calculateTargets({ age: 30, sex, height_cm, weight_kg, activity_level, goal, weekly_pace_kg: pace });
              const label = JSON.stringify({ sex, goal, activity_level, height_cm, weight_kg, pace });
              assert.ok(Math.abs(macroKcal(r) - r.calorie_target) <= 2, `macros sum to target ${label}`);
              assert.ok(r.carbohydrate_target > 0, `carbs positive ${label}`);
              // protein: at most 35% of calories, at most g/kg of reference weight
              assert.ok(r.protein_target * 4 <= r.calorie_target * MAX_PROTEIN_SHARE + 2, `protein share ${label}`);
              const refWeight = Math.min(weight_kg, 25 * (height_cm / 100) ** 2);
              assert.ok(r.protein_target <= Math.round(refWeight * PROTEIN_G_PER_KG[goal]), `protein per kg ${label}`);
              assert.ok(r.protein_target <= 2.2 * refWeight + 0.5, `protein under 2.2 g/kg ${label}`);
              // fat: at least 25% of calories and at least 0.6 g/kg of reference weight
              assert.ok(r.fat_target >= Math.round(refWeight * MIN_FAT_G_PER_KG), `fat floor ${label}`);
              assert.ok(r.fat_target * 9 >= r.calorie_target * 0.25 - 5, `fat share ${label}`);
            }
});

test('protein has no cliff: it never drops when calories rise', () => {
  // Old code: crossing 35% of calories dropped protein to 30%, so a lower-calorie
  // plan could get MORE protein than a slightly higher one.
  let previous = 0;
  for (const pace of [1, 0.75, 0.5, 0.25]) {
    const r = calculateTargets({ ...B, weekly_pace_kg: pace });
    assert.ok(r.protein_target >= previous, `protein at pace ${pace}`);
    previous = r.protein_target;
  }
});

test('protein uses a reference weight for higher body weights', () => {
  const lean = calculateTargets({ ...D, goal: 'maintain_weight', weight_kg: 72 });
  const heavy = calculateTargets({ ...D, goal: 'maintain_weight', weight_kg: 105 });
  // 33 kg heavier at the same height -> same reference weight -> same protein per kg basis
  assert.equal(lean.reference_weight_kg, 72);
  assert.equal(heavy.reference_weight_kg, 72.2);
  assert.ok(Math.abs(heavy.protein_target - lean.protein_target) <= 2);
});

// ── Age / BMI ────────────────────────────────────────────────────────────────
test('age counts the birthday properly', () => {
  const now = new Date(2026, 10, 16); // 16 Nov 2026
  assert.equal(calculateAge('1998-11-16', now), 28); // birthday today
  assert.equal(calculateAge('1998-11-17', now), 27); // birthday tomorrow
  assert.equal(calculateAge('1998-01-01', now), 28);
  assert.equal(calculateAge('1998-12-31', now), 27); // year subtraction alone would say 28
  assert.equal(calculateAge('1998-11-16T00:00:00+00:00', now), 28);
  assert.equal(calculateAge(null, now), null);
  assert.equal(calculateAge('', now), null);
  assert.equal(calculateAge('not a date', now), null);
  assert.equal(calculateAge('2030-01-01', now), null); // future
  assert.equal(calculateAge('2020-01-01', now), null); // implausible for this app
});

test('BMI', () => {
  assert.equal(Math.round(calculateBmi(78, 172)! * 10) / 10, 26.4);
  assert.equal(calculateBmi(null, 172), null);
  assert.equal(calculateBmi(78, 0), null);
});

// ── Missing data ─────────────────────────────────────────────────────────────
const fullProfile = {
  id: 'user-1',
  name: 'Test',
  date_of_birth: '1998-06-01',
  sex: 'male' as const,
  height_cm: 172,
  weight_kg: 78,
  activity_level: 'moderately_active' as const,
  goal: 'lose_weight' as const,
  target_weight_kg: 70,
  dietary_preference: 'Halal',
  allergies: [],
};

test('complete profile: nothing missing, values passed through unchanged', () => {
  const ctx = getUserCalculationContext(fullProfile, null);
  assert.deepEqual(ctx.missing_fields, []);
  assert.equal(ctx.sex, 'male');
  assert.equal(ctx.height_cm, 172);
  assert.equal(ctx.weight_kg, 78);
  assert.equal(ctx.goal, 'lose_weight');
  assert.equal(ctx.target_weight_kg, 70);
  assert.equal(ctx.weekly_pace_kg, 0.5);
});

test('missing data is reported, never silently invented', () => {
  const empty = getUserCalculationContext(null, null);
  assert.deepEqual(empty.missing_fields, ['date_of_birth', 'sex', 'height_cm', 'weight_kg', 'activity_level', 'goal']);
  // No invented weight-loss goal or target weight
  assert.equal(empty.goal, 'maintain_weight');
  assert.equal(empty.target_weight_kg, null);
  assert.equal(empty.sex, null);
  assert.equal(calculateTargets(empty).adjustment, 0);

  const noDob = { ...fullProfile, date_of_birth: null };
  assert.deepEqual(getMissingProfileFields(noDob), ['date_of_birth']);
  assert.equal(describeMissingFields(['date_of_birth']), 'date of birth');
  assert.equal(describeMissingFields(['date_of_birth', 'sex', 'height_cm']), 'date of birth, sex and height');
  assert.equal(describeMissingFields([]), '');
});

test('unknown sex uses the midpoint of the two equations', () => {
  const male = calculateTargets({ ...A, goal: 'maintain_weight' });
  const female = calculateTargets({ ...A, sex: 'female', goal: 'maintain_weight' });
  const unknown = calculateTargets({ ...A, sex: null, goal: 'maintain_weight' });
  assert.equal(unknown.bmr, Math.round((male.bmr + female.bmr) / 2));
});

test('goals row target weight wins over the profile one', () => {
  const goals = { id: 'g', user_id: 'user-1', calorie_target: 2000, protein_target: 150, carbohydrate_target: 200, fat_target: 60, exercise_minutes_target: 45, target_weight_kg: 68 };
  assert.equal(getUserCalculationContext(fullProfile, goals).target_weight_kg, 68);
});

// ── Pace storage ─────────────────────────────────────────────────────────────
test('weekly pace is stored per user and used by every screen', () => {
  memory.clear();
  assert.equal(getStoredWeeklyPace(fullProfile), 0.5);
  storeWeeklyPace('user-1', 0.75);
  assert.equal(getStoredWeeklyPace(fullProfile), 0.75);
  assert.equal(getUserCalculationContext(fullProfile, null).weekly_pace_kg, 0.75);
  assert.equal(getStoredWeeklyPace({ id: 'someone-else', dietary_preference: null }), 0.5);
  // an explicit override (the pace editor preview) still wins
  assert.equal(getUserCalculationContext(fullProfile, null, 0.25).weekly_pace_kg, 0.25);
  storeWeeklyPace('user-1', -1); // ignored
  assert.equal(getStoredWeeklyPace(fullProfile), 0.75);
  memory.clear();
});

test('old "pace:x" tag in dietary_preference is still read but hidden', () => {
  memory.clear();
  const legacy = { ...fullProfile, dietary_preference: 'pace:0.75' };
  assert.equal(getStoredWeeklyPace(legacy), 0.75);
  assert.equal(cleanDietaryPreference('pace:0.75'), null);
  assert.equal(cleanDietaryPreference(' Halal '), 'Halal');
  assert.equal(cleanDietaryPreference(''), null);
  assert.equal(cleanDietaryPreference(null), null);
});

// ── Saved goals vs recalculated ──────────────────────────────────────────────
test('saved goals are flagged when they no longer match the profile', () => {
  const calc = calculateTargets(A);
  const saved = { id: 'g', user_id: 'u', calorie_target: calc.calorie_target, protein_target: calc.protein_target, carbohydrate_target: calc.carbohydrate_target, fat_target: calc.fat_target, exercise_minutes_target: 45, target_weight_kg: 70 };
  assert.equal(isSavedTargetOutOfDate(saved, calc), false);
  assert.equal(isSavedTargetOutOfDate(null, calc), false);
  // targets saved by the old formula (2166 kcal / 156 g protein)
  assert.equal(isSavedTargetOutOfDate({ ...saved, calorie_target: 2166, protein_target: 156, carbohydrate_target: 251, fat_target: 60 }, calc), true);
  // weight changed by 3 kg since the goals were saved
  assert.equal(isSavedTargetOutOfDate(saved, calculateTargets({ ...A, weight_kg: 75 })), true);
});

console.log(`\n${passed} tests passed`);
