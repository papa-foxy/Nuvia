/**
 * "Am I on track?" — compares the user's real weight trend with what their
 * plan expects, and decides what (if anything) should change.
 *
 * Pure functions, no I/O. The numbers are decided here by fixed, safe rules;
 * the AI only explains them in plain words (see /api/ai/progress-review).
 *
 * How it works:
 *  - Trend weight: daily weigh-ins bounce with water and food, so a smoothed
 *    trend (exponential moving average, ~10-day memory) is used, not the
 *    latest number.
 *  - Actual pace: least-squares slope of the check-ins in the last 4 weeks.
 *  - Expected pace: from the plan's daily calorie gap (1 kg ≈ 7,700 kcal).
 *  - Real energy burn (estimate): average logged intake minus the energy that
 *    the weight change accounts for. Only used when meals were logged on most
 *    days, otherwise missing logs would look like a slower metabolism.
 *  - Calorie changes are small (at most 200 kcal per check-in), never go
 *    below the safety floor, and are only ever suggested: the user approves.
 */

export const KCAL_PER_KG = 7700;

export interface ProgressCheckin {
  date: string; // YYYY-MM-DD
  weight_kg: number;
}

export type ProgressGoal =
  | 'lose_weight'
  | 'gain_weight'
  | 'build_muscle'
  | 'maintain_weight'
  | 'recomposition'
  | string;

export interface ProgressInput {
  checkins: ProgressCheckin[];
  goal: ProgressGoal;
  targetWeightKg?: number | null;
  /** Current daily calorie target. */
  calorieTarget: number;
  /** Maintenance calories from the formula (Mifflin-St Jeor × activity). */
  formulaTdee: number;
  /** The plan's pace (kg/week, negative = losing). Defaults to the calorie gap vs formulaTdee. */
  expectedKgPerWeek?: number;
  /** Safety floor for the calorie target. */
  minCalories: number;
  /** Logged food per day (YYYY-MM-DD → kcal) for at least the last 3 weeks; missing days = not logged. */
  intakeByDay: Record<string, number>;
  /** Workouts logged in the last 14 days, and how many per week the plan has. */
  workoutsLast14Days?: number;
  plannedWorkoutsPerWeek?: number | null;
  now?: Date;
}

export type ProgressStatus =
  | 'not_enough_data'
  | 'on_track'
  | 'slower' // moving towards the goal more slowly than planned (or not at all)
  | 'faster' // moving faster than planned
  | 'wrong_way' // moving away from the goal
  | 'drifting'; // maintenance goal, but weight is moving

export interface ProgressRecommendation {
  id: string;
  kind: 'calories' | 'logging' | 'training' | 'weigh_in';
  title: string;
  body: string;
  /** For kind 'calories': the suggested new daily target. */
  newCalorieTarget?: number;
}

export interface ProgressReport {
  status: ProgressStatus;
  /** Smoothed weight now. */
  trendWeightKg: number | null;
  latestWeightKg: number | null;
  /** Actual and expected change per week (negative = losing). */
  actualKgPerWeek: number | null;
  expectedKgPerWeek: number;
  /** Days between the first and last check-in used. */
  spanDays: number;
  checkinsUsed: number;
  /** Share of the last 21 days with food logged (0–1). */
  loggingRate: number;
  avgIntakeKcal: number | null;
  /** Estimated real maintenance calories, when the data supports it. */
  estimatedTdee: number | null;
  /** When the goal weight would be reached at the current pace. */
  projectedGoalDate: string | null;
  weeksToGoal: number | null;
  headline: string;
  summary: string;
  recommendations: ProgressRecommendation[];
}

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const toTime = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).getTime();
};
const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localDate = (d: Date) => fmtDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());

/** Exponential moving average with ~10-day memory, aware of gaps between weigh-ins. */
export function trendWeights(checkins: ProgressCheckin[]): { date: string; weight: number; trend: number }[] {
  const sorted = [...checkins].filter((c) => c.weight_kg > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; weight: number; trend: number }[] = [];
  let trend: number | null = null;
  let last: number | null = null;
  for (const c of sorted) {
    const t = toTime(c.date);
    if (trend === null || last === null) trend = c.weight_kg;
    else {
      const gapDays = Math.max(1, (t - last) / DAY_MS);
      const alpha = 1 - Math.pow(0.9, gapDays); // 10% per day of new information
      trend = trend + alpha * (c.weight_kg - trend);
    }
    last = t;
    out.push({ date: c.date, weight: c.weight_kg, trend: round2(trend) });
  }
  return out;
}

/** Least-squares slope (kg per week) of the check-ins since `fromTime`. */
function weeklySlope(points: { date: string; weight: number }[], fromTime: number): { rate: number; n: number; span: number } | null {
  const pts = points.filter((p) => toTime(p.date) >= fromTime);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => (toTime(p.date) - toTime(pts[0].date)) / DAY_MS);
  const ys = pts.map((p) => p.weight);
  const span = xs[xs.length - 1];
  if (span < 1) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return { rate: (num / den) * 7, n: pts.length, span };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const roundTo10 = (n: number) => Math.round(n / 10) * 10;

export function assessProgress(input: ProgressInput): ProgressReport {
  const now = input.now ?? new Date();
  const today = toTime(localDate(now));
  const series = trendWeights(input.checkins);
  const latest = series[series.length - 1];
  const expected = round2(input.expectedKgPerWeek ?? ((input.calorieTarget - input.formulaTdee) * 7) / KCAL_PER_KG);
  const direction = Math.sign(expected); // -1 lose, +1 gain, 0 maintain
  const isMaintain = Math.abs(expected) < 0.1;

  // Logging in the last 21 days (yesterday back; today may still be in progress).
  let logged = 0;
  let intakeSum = 0;
  for (let i = 1; i <= 21; i++) {
    const kcal = input.intakeByDay[fmtDate(today - i * DAY_MS)];
    if (kcal && kcal > 300) {
      logged++;
      intakeSum += kcal;
    }
  }
  const loggingRate = round2(logged / 21);
  const avgIntake = logged ? Math.round(intakeSum / logged) : null;

  const slope = weeklySlope(series, today - 28 * DAY_MS);
  const enough = !!slope && slope.n >= 3 && slope.span >= 10;
  const actual = enough ? round2(slope!.rate) : null;

  const base: Omit<ProgressReport, 'status' | 'headline' | 'summary' | 'recommendations'> = {
    trendWeightKg: latest ? round1(latest.trend) : null,
    latestWeightKg: latest ? latest.weight : null,
    actualKgPerWeek: actual,
    expectedKgPerWeek: expected,
    spanDays: slope ? Math.round(slope.span) : 0,
    checkinsUsed: slope?.n ?? series.length,
    loggingRate,
    avgIntakeKcal: avgIntake,
    estimatedTdee: null,
    projectedGoalDate: null,
    weeksToGoal: null,
  };
  const recs: ProgressRecommendation[] = [];

  // Weigh-in reminder: last check-in over a week ago.
  if (!latest || today - toTime(latest.date) > 8 * DAY_MS) {
    recs.push({
      id: 'weigh-in',
      kind: 'weigh_in',
      title: latest ? 'Time for a check-in' : 'Log your first check-in',
      body: 'Weigh yourself in the morning, after the toilet and before eating, for the most comparable numbers.',
    });
  }

  if (!enough || actual === null) {
    const have = series.length;
    return {
      ...base,
      status: 'not_enough_data',
      headline: have === 0 ? 'Start tracking your progress' : 'Building your trend',
      summary:
        have === 0
          ? 'Log your weight once a week (or more). After about two weeks Nuvia can tell whether your plan is working.'
          : `You have ${have} check-in${have === 1 ? '' : 's'}. Nuvia needs at least 3 over about 10 days to see a reliable trend.`,
      recommendations: recs,
    };
  }

  // Real maintenance estimate: intake minus energy stored/released by the weight change.
  const reliableLogging = loggingRate >= 0.7 && base.spanDays >= 14 && avgIntake !== null;
  const estimatedTdee = reliableLogging ? Math.round(avgIntake! - (actual * KCAL_PER_KG) / 7) : null;
  base.estimatedTdee = estimatedTdee;

  // Goal projection.
  if (input.targetWeightKg && latest) {
    const toGo = input.targetWeightKg - latest.trend;
    if (Math.abs(toGo) < 0.3) {
      base.projectedGoalDate = localDate(now);
      base.weeksToGoal = 0;
    } else if (Math.sign(toGo) === Math.sign(actual) && Math.abs(actual) >= 0.05) {
      const weeks = toGo / actual;
      base.weeksToGoal = Math.round(weeks);
      base.projectedGoalDate = fmtDate(today + Math.round(weeks * 7) * DAY_MS);
    }
  }

  // Status.
  const tol = Math.max(0.15, Math.abs(expected) * 0.35);
  let status: ProgressStatus;
  if (isMaintain) status = Math.abs(actual) <= 0.25 ? 'on_track' : 'drifting';
  else if (Math.sign(actual) === -direction && Math.abs(actual) > 0.1) status = 'wrong_way';
  else if (Math.abs(actual - expected) <= tol) status = 'on_track';
  else status = Math.abs(actual) < Math.abs(expected) ? 'slower' : 'faster';

  // Losing more than 1% of body weight per week is too fast regardless of the plan.
  const tooFast = actual < 0 && latest && Math.abs(actual) > latest.trend * 0.01;

  // Calorie suggestion.
  const kcalPerDayFor = (kgPerWeek: number) => (kgPerWeek * KCAL_PER_KG) / 7;
  let newTarget: number | null = null;
  let why = '';
  if (tooFast || (status === 'faster' && direction < 0)) {
    newTarget = input.calorieTarget + (tooFast ? 200 : 150);
    why = tooFast
      ? 'You are losing more than 1% of your body weight a week. That risks losing muscle and energy, so eat a little more.'
      : 'You are losing faster than planned. A little more food keeps your energy and muscle while you still progress.';
  } else if (reliableLogging && status !== 'on_track') {
    const needed = estimatedTdee! + kcalPerDayFor(isMaintain ? 0 : expected);
    const change = clamp(needed - input.calorieTarget, -200, 200);
    if (Math.abs(change) >= 50) {
      newTarget = input.calorieTarget + change;
      why =
        change < 0
          ? `Your food logs and weight trend show your body burns about ${estimatedTdee!.toLocaleString()} kcal a day. Eating ${Math.abs(roundTo10(change))} kcal less brings you back to your planned pace.`
          : `Your food logs and weight trend show your body burns about ${estimatedTdee!.toLocaleString()} kcal a day. You can eat ${roundTo10(change)} kcal more and still keep your planned pace.`;
    }
  }
  if (newTarget !== null) {
    const safe = roundTo10(Math.max(input.minCalories, newTarget));
    if (safe !== input.calorieTarget) {
      recs.unshift({
        id: 'calories',
        kind: 'calories',
        title: safe < input.calorieTarget ? `Lower your target to ${safe.toLocaleString()} kcal` : `Raise your target to ${safe.toLocaleString()} kcal`,
        body: why + (safe === input.minCalories && newTarget < input.minCalories ? ' (Kept at your safe minimum.)' : ''),
        newCalorieTarget: safe,
      });
    }
  }

  // Not enough logging to judge food intake.
  if (status !== 'on_track' && !reliableLogging && !recs.some((r) => r.kind === 'calories')) {
    recs.push({
      id: 'logging',
      kind: 'logging',
      title: 'Log meals on most days',
      body: `Food was logged on ${logged} of the last 21 days. Your target stays the same for now: with 2 weeks of steady logging Nuvia can tell whether the plan or the logging needs to change.`,
    });
  }

  // Training consistency (matters most for muscle goals).
  if (input.plannedWorkoutsPerWeek && input.workoutsLast14Days !== undefined) {
    const perWeek = input.workoutsLast14Days / 2;
    if (perWeek < input.plannedWorkoutsPerWeek * 0.6) {
      recs.push({
        id: 'training',
        kind: 'training',
        title: 'Train a bit more regularly',
        body: `You averaged ${round1(perWeek)} workouts a week against ${input.plannedWorkoutsPerWeek} planned. Even a shorter session keeps your progress going, especially for muscle.`,
      });
    }
  }

  const abs = (n: number) => Math.abs(n).toFixed(2).replace(/0$/, '');
  const verb = (n: number) => (n < 0 ? 'losing' : 'gaining');
  const headline = {
    on_track: 'You are on track',
    slower: 'Progress is slower than planned',
    faster: 'You are moving faster than planned',
    wrong_way: 'Your weight is moving the other way',
    drifting: 'Your weight is drifting',
    not_enough_data: '',
  }[status];
  const actualText = Math.abs(actual) < 0.05 ? 'holding steady' : `${verb(actual)} about ${abs(actual)} kg a week`;
  const plannedText = isMaintain ? 'staying steady' : `${verb(expected)} ${abs(expected)} kg a week`;
  const summary = `Over the last ${base.spanDays} days your trend shows you ${actualText}. Your plan aims for ${plannedText}.`;

  return { ...base, status, headline, summary, recommendations: recs };
}
