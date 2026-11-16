// Run: node --experimental-strip-types scripts/test-progress-tracker.ts
import assert from 'node:assert/strict';
import { assessProgress, trendWeights, type ProgressInput } from '../src/lib/progress-tracker.ts';

const now = new Date(2026, 10, 17, 9, 0, 0); // 17 Nov 2026
const dayStr = (offset: number) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Weigh-ins every `every` days for `days` days, changing `perWeek` kg per week. */
const series = (start: number, perWeek: number, days = 28, every = 2, noise = 0) =>
  Array.from({ length: Math.floor(days / every) + 1 }, (_, i) => {
    const off = -days + i * every;
    return { date: dayStr(off), weight_kg: Math.round((start + (perWeek * (off + days)) / 7 + (i % 2 ? noise : -noise)) * 10) / 10 };
  });
const intake = (kcal: number, rate = 1) => {
  const out: Record<string, number> = {};
  for (let i = 1; i <= 21; i++) if (i / 21 <= rate) out[dayStr(-i)] = kcal;
  return out;
};
const base: Omit<ProgressInput, 'checkins' | 'intakeByDay'> = {
  goal: 'lose_weight', targetWeightKg: 70, calorieTarget: 2100, formulaTdee: 2650, minCalories: 1500, now,
  workoutsLast14Days: 6, plannedWorkoutsPerWeek: 3,
};
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('ok  ', name); };

test('no check-ins -> not enough data, asks for a first check-in', () => {
  const r = assessProgress({ ...base, checkins: [], intakeByDay: {} });
  assert.equal(r.status, 'not_enough_data');
  assert.ok(r.recommendations.some((x) => x.kind === 'weigh_in'));
});

test('two check-ins -> still building the trend', () => {
  const r = assessProgress({ ...base, checkins: series(80, -0.5, 4, 4), intakeByDay: intake(2100) });
  assert.equal(r.status, 'not_enough_data');
});

test('expected pace comes from the calorie gap (550 kcal/day = -0.5 kg/week)', () => {
  const r = assessProgress({ ...base, checkins: series(80, -0.5), intakeByDay: intake(2100) });
  assert.equal(r.expectedKgPerWeek, -0.5);
});

test('losing 0.5 kg/week on a 0.5 plan -> on track, no calorie change', () => {
  const r = assessProgress({ ...base, checkins: series(80, -0.5, 28, 2, 0.3), intakeByDay: intake(2100) });
  assert.equal(r.status, 'on_track');
  assert.ok(!r.recommendations.some((x) => x.kind === 'calories'));
  assert.ok(r.projectedGoalDate && r.weeksToGoal! > 10);
});

test('not losing despite logging every day -> lower target, based on real burn', () => {
  const r = assessProgress({ ...base, checkins: series(80, 0, 28, 2, 0.2), intakeByDay: intake(2100) });
  assert.equal(r.status, 'slower');
  assert.ok(r.estimatedTdee! >= 2050 && r.estimatedTdee! <= 2200, `tdee ${r.estimatedTdee}`);
  const cal = r.recommendations.find((x) => x.kind === 'calories');
  assert.ok(cal, 'calorie suggestion');
  assert.equal(cal!.newCalorieTarget, 1900, 'capped at a 200 kcal change');
});

test('not losing but logging rarely -> keep target, ask for logging', () => {
  const r = assessProgress({ ...base, checkins: series(80, 0, 28, 2, 0.2), intakeByDay: intake(2100, 0.3) });
  assert.ok(!r.recommendations.some((x) => x.kind === 'calories'));
  assert.ok(r.recommendations.some((x) => x.kind === 'logging'));
});

test('losing more than 1% body weight a week -> eat more, even with patchy logging', () => {
  const r = assessProgress({ ...base, checkins: series(80, -1.2), intakeByDay: intake(1600, 0.3) });
  const cal = r.recommendations.find((x) => x.kind === 'calories');
  assert.ok(cal && cal.newCalorieTarget! > 2100);
});

test('never suggests below the safety floor', () => {
  const r = assessProgress({ ...base, calorieTarget: 1550, formulaTdee: 2100, checkins: series(80, 0, 28, 2), intakeByDay: intake(1550) });
  const cal = r.recommendations.find((x) => x.kind === 'calories');
  assert.ok(!cal || cal.newCalorieTarget! >= 1500);
});

test('gaining on a loss goal -> wrong way', () => {
  const r = assessProgress({ ...base, checkins: series(80, 0.4), intakeByDay: intake(2600) });
  assert.equal(r.status, 'wrong_way');
});

test('maintenance goal, weight stable -> on track', () => {
  const r = assessProgress({ ...base, goal: 'maintain_weight', calorieTarget: 2650, checkins: series(75, 0.05, 28, 2, 0.2), intakeByDay: intake(2650) });
  assert.equal(r.status, 'on_track');
});

test('few workouts vs plan -> training suggestion', () => {
  const r = assessProgress({ ...base, checkins: series(80, -0.5), intakeByDay: intake(2100), workoutsLast14Days: 1 });
  assert.ok(r.recommendations.some((x) => x.kind === 'training'));
});

test('old last check-in -> weigh-in reminder', () => {
  const old = series(80, -0.5).map((c) => ({ ...c, date: c.date })).slice(0, -5);
  const r = assessProgress({ ...base, checkins: old, intakeByDay: intake(2100) });
  assert.ok(r.recommendations.some((x) => x.kind === 'weigh_in'));
});

test('trend smooths day-to-day noise', () => {
  const noisy = [80, 81.2, 79.4, 80.9, 79.6, 80.8].map((w, i) => ({ date: dayStr(-10 + i * 2), weight_kg: w }));
  const t = trendWeights(noisy);
  const swing = Math.max(...t.map((x) => x.trend)) - Math.min(...t.map((x) => x.trend));
  assert.ok(swing < 0.8, `trend swing ${swing}`);
});

console.log(`\n${passed} tests passed`);
