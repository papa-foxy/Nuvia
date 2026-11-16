'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Scale, Sparkles, Trash2, X } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui';
import { NuviaBottomSheet } from '@/components/NuviaBottomSheet';
import { DataService, getLocalDateString } from '@/lib/data-service';
import { NuviaCache } from '@/lib/nuvia-cache';
import {
  calculateTargets,
  getCalorieCorrection,
  getUserCalculationContext,
  storeCalorieCorrection,
} from '@/lib/calculator';
import { assessProgress, trendWeights, type ProgressRecommendation, type ProgressReport } from '@/lib/progress-tracker';
import { weeklyWorkoutGoal } from '@/lib/training-stats';
import type { BodyCheckin, ExerciseLog, Goal, Profile } from '@/types/database';
import type { WorkoutRoutine } from '@/types/routine';

interface Props {
  userId?: string;
  profile: Profile | null;
  goals: Goal | null;
  routines: WorkoutRoutine[];
  logs: ExerciseLog[] | null;
  onChanged: () => Promise<void> | void;
}

const STATUS_STYLE: Record<ProgressReport['status'], { label: string; className: string }> = {
  on_track: { label: 'On track', className: 'bg-accent/15 text-green-ink' },
  slower: { label: 'Slower than planned', className: 'bg-warn/15 text-orange-ink' },
  faster: { label: 'Faster than planned', className: 'bg-warn/15 text-orange-ink' },
  wrong_way: { label: 'Off track', className: 'bg-danger/15 text-red-ink' },
  drifting: { label: 'Drifting', className: 'bg-warn/15 text-orange-ink' },
  not_enough_data: { label: 'Building trend', className: 'bg-elevated text-muted' },
};

const shortDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
/** Date with the year when it isn't this year (e.g. a goal date). */
const longDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', opts);
};
const signed = (n: number, digits = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

const dismissKey = (uid: string | undefined) => `nuvia_progress_dismissed_${uid || 'demo'}`;
const reviewKey = (uid: string | undefined) => `nuvia_progress_review_${uid || 'demo'}`;
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

/** Weight check-ins, the on-track assessment and suggested changes. */
export function BodyProgressSection({ userId, profile, goals, routines, logs, onChanged }: Props) {
  const [checkins, setCheckins] = useState<BodyCheckin[] | null>(null);
  const [intakeByDay, setIntakeByDay] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, true>>(() => readJson(dismissKey(userId), {}));
  const [review, setReview] = useState<{ key: string; message: string; tips: string[] } | null>(() =>
    readJson(reviewKey(userId), null),
  );
  const [notice, setNotice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [c, meals] = await Promise.all([DataService.getCheckins(userId), DataService.getMeals(userId)]);
    const byDay: Record<string, number> = {};
    for (const m of meals) {
      const d = getLocalDateString(new Date(m.meal_time));
      byDay[d] = (byDay[d] || 0) + (Number(m.calories) || 0);
    }
    return { c, byDay };
  }, [userId]);

  const load = useCallback(async () => {
    const { c, byDay } = await fetchData();
    setCheckins(c);
    setIntakeByDay(byDay);
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    fetchData().then(({ c, byDay }) => {
      if (cancelled) return;
      setCheckins(c);
      setIntakeByDay(byDay);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const calc = useMemo(() => calculateTargets(getUserCalculationContext(profile, goals)), [profile, goals]);
  const calorieTarget = Number(goals?.calorie_target) || calc.calorie_target;
  const latestCheckin = checkins?.[checkins.length - 1] ?? null;

  const report = useMemo<ProgressReport | null>(() => {
    if (!checkins) return null;
    const now = new Date();
    const since = now.getTime() - 14 * 86_400_000;
    const workoutsLast14Days = (logs || []).filter((l) => l.created_at && new Date(l.created_at).getTime() >= since).length;
    const pace = calc.expected_pace_kg;
    const goal = profile?.goal || 'maintain_weight';
    const sign = calc.adjustment - getCalorieCorrection(userId) < 0 ? -1 : 1;
    return assessProgress({
      checkins,
      goal,
      targetWeightKg: Number(goals?.target_weight_kg) || Number(profile?.target_weight_kg) || null,
      calorieTarget,
      formulaTdee: calc.tdee,
      expectedKgPerWeek: pace ? sign * pace : 0,
      minCalories: calc.min_calories,
      intakeByDay,
      workoutsLast14Days,
      plannedWorkoutsPerWeek: weeklyWorkoutGoal(routines),
      now,
    });
  }, [checkins, logs, calc, profile, goals, calorieTarget, intakeByDay, routines, userId]);

  const reviewId = report && latestCheckin ? `${latestCheckin.date}:${report.status}:${report.recommendations.map((r) => r.id).join(',')}` : null;

  // AI note: once per check-in result (saved on the device).
  useEffect(() => {
    if (!report || !reviewId || (review && review.key === reviewId) || report.status === 'not_enough_data') return;
    let cancelled = false;
    fetch('/api/ai/progress-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: profile?.goal,
        status: report.status,
        headline: report.headline,
        summary: report.summary,
        trendWeightKg: report.trendWeightKg,
        targetWeightKg: Number(goals?.target_weight_kg) || null,
        actualKgPerWeek: report.actualKgPerWeek,
        expectedKgPerWeek: report.expectedKgPerWeek,
        loggingRate: report.loggingRate,
        estimatedTdee: report.estimatedTdee,
        weeksToGoal: report.weeksToGoal,
        energy: latestCheckin?.energy ?? null,
        note: latestCheckin?.note ?? null,
        recommendations: report.recommendations.map((r) => ({ title: r.title, body: r.body })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { message?: string; tips?: string[]; source?: string } | null) => {
        if (cancelled || !j?.message || j.source !== 'ai') return;
        const next = { key: reviewId, message: j.message, tips: j.tips || [] };
        setReview(next);
        writeJson(reviewKey(userId), next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [report, reviewId, review, profile?.goal, goals?.target_weight_kg, latestCheckin, userId]);

  const visibleRecs = (report?.recommendations || []).filter((r) => !dismissed[`${r.id}:${latestCheckin?.date || ''}`]);

  const dismiss = (r: ProgressRecommendation) => {
    const next = { ...dismissed, [`${r.id}:${latestCheckin?.date || ''}`]: true as const };
    setDismissed(next);
    writeJson(dismissKey(userId), next);
  };

  const acceptCalories = async (r: ProgressRecommendation) => {
    if (!userId || !r.newCalorieTarget) return;
    // Store it as a correction on the formula target (which already includes any
    // earlier correction), so every screen and later recalculations land on the
    // number the user accepted.
    storeCalorieCorrection(userId, getCalorieCorrection(userId) + (r.newCalorieTarget - calc.calorie_target));
    const next = calculateTargets(getUserCalculationContext(profile, goals));
    await DataService.saveGoals({
      id: goals?.id || '',
      user_id: userId,
      calorie_target: next.calorie_target,
      protein_target: next.protein_target,
      carbohydrate_target: next.carbohydrate_target,
      fat_target: next.fat_target,
      exercise_minutes_target: goals?.exercise_minutes_target || next.exercise_minutes_target,
      target_weight_kg: goals?.target_weight_kg ?? profile?.target_weight_kg ?? null,
    });
    NuviaCache.invalidatePrefix('today-');
    dismiss(r);
    setNotice(`Daily target is now ${next.calorie_target.toLocaleString()} kcal.`);
    await onChanged();
  };

  const series = useMemo(() => trendWeights(checkins || []).slice(-30), [checkins]);
  const target = Number(goals?.target_weight_kg) || Number(profile?.target_weight_kg) || null;
  const status = report ? STATUS_STYLE[report.status] : null;

  return (
    <section className="px-5 space-y-3" aria-labelledby="body-progress-heading">
      <SectionHeader title="Weight & progress" action={checkins && checkins.length ? 'History' : undefined} onAction={() => setHistoryOpen(true)} />
      <h2 id="body-progress-heading" className="sr-only">
        Weight and progress
      </h2>

      <Card className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">Trend weight</p>
            <p className="mt-1 text-[28px] leading-none font-extrabold tabular-nums text-fg">
              {report?.trendWeightKg ?? profile?.weight_kg ?? '–'}
              <span className="ml-1 text-sm font-semibold text-muted">kg</span>
            </p>
            {latestCheckin && (
              <p className="mt-1 text-[11px] text-subtle tabular-nums">
                Last weigh-in {latestCheckin.weight_kg} kg · {shortDate(latestCheckin.date)}
              </p>
            )}
          </div>
          {target ? (
            <div className="text-right">
              <p className="text-xs font-semibold text-muted">Goal</p>
              <p className="mt-1 text-lg font-extrabold tabular-nums text-fg">{target} kg</p>
              {report?.projectedGoalDate && report.weeksToGoal !== null && report.weeksToGoal > 0 && (
                <p className="text-[11px] font-semibold text-subtle">~{longDate(report.projectedGoalDate)}</p>
              )}
            </div>
          ) : null}
        </div>

        {series.length >= 2 && <WeightChart series={series} target={target} />}

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full h-11 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log weight
        </button>
      </Card>

      {report && status && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-fg">{report.headline}</h3>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${status.className}`}>{status.label}</span>
          </div>

          {report.actualKgPerWeek !== null && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Your pace" value={`${signed(report.actualKgPerWeek)} kg/wk`} />
              <Stat label="Planned" value={`${signed(report.expectedKgPerWeek)} kg/wk`} />
              {report.estimatedTdee && <Stat label="Your real burn" value={`~${report.estimatedTdee.toLocaleString()} kcal`} hint="from food vs weight" />}
              <Stat label="Meals logged" value={`${Math.round(report.loggingRate * 100)}%`} hint="last 3 weeks" />
            </div>
          )}

          <p className="text-[13px] text-fg-soft leading-relaxed">
            {review && review.key === reviewId ? review.message : report.summary}
          </p>
          {review && review.key === reviewId && review.tips.length > 0 && (
            <ul className="space-y-1">
              {review.tips.map((t) => (
                <li key={t} className="flex gap-2 text-xs text-muted">
                  <Sparkles className="w-3.5 h-3.5 text-green-ink shrink-0 mt-0.5" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          )}

          {visibleRecs.length > 0 && (
            <div className="space-y-2 pt-1">
              {visibleRecs.map((r) => (
                <div key={r.id} className="rounded-2xl border border-line/60 bg-surface p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-fg">{r.title}</p>
                    <button type="button" onClick={() => dismiss(r)} aria-label="Dismiss" className="w-6 h-6 -mr-1 -mt-1 flex items-center justify-center text-subtle hover:text-fg">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{r.body}</p>
                  {r.kind === 'calories' && r.newCalorieTarget && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void acceptCalories(r)}
                        className="flex-1 h-10 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Use {r.newCalorieTarget.toLocaleString()} kcal
                      </button>
                      <button type="button" onClick={() => dismiss(r)} className="h-10 px-4 rounded-xl bg-card border border-line/60 text-xs font-semibold text-fg">
                        Not now
                      </button>
                    </div>
                  )}
                  {r.kind === 'weigh_in' && (
                    <button type="button" onClick={() => setSheetOpen(true)} className="text-xs font-semibold text-green-ink flex items-center gap-0.5">
                      Log weight <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {notice && (
            <p className="text-xs font-semibold text-green-ink" role="status">
              {notice}
            </p>
          )}
          <p className="text-[10px] text-subtle">Suggestions only change your plan when you accept them.</p>
        </Card>
      )}

      <CheckinSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        userId={userId}
        lastWeight={latestCheckin?.weight_kg ?? Number(profile?.weight_kg) ?? null}
        onSaved={async () => {
          setSheetOpen(false);
          setNotice(null);
          await load();
          await onChanged();
        }}
      />

      <NuviaBottomSheet isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Check-in history" variant="standard">
        <ul className="divide-y divide-line/60">
          {[...(checkins || [])].reverse().map((c) => (
            <li key={c.date} className="py-2.5 flex items-center gap-3">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-fg tabular-nums">{c.weight_kg} kg</span>
                <span className="block text-[11px] text-subtle">
                  {shortDate(c.date)}
                  {c.waist_cm ? ` · waist ${c.waist_cm} cm` : ''}
                  {c.energy ? ` · feeling ${c.energy}/5` : ''}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Delete check-in on ${shortDate(c.date)}`}
                onClick={async () => {
                  if (!userId) return;
                  await DataService.deleteCheckin(userId, c.date);
                  await load();
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-subtle hover:text-red-ink"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </NuviaBottomSheet>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface border border-line/60 px-3 py-2">
      <p className="text-[10px] font-semibold text-muted">{label}</p>
      <p className="text-sm font-extrabold text-fg tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-subtle">{hint}</p>}
    </div>
  );
}

/** Weigh-ins (dots), smoothed trend (line) and goal (dashed). */
function WeightChart({ series, target }: { series: { date: string; weight: number; trend: number }[]; target: number | null }) {
  const W = 320;
  const H = 120;
  const pad = 8;
  const values = series.flatMap((s) => [s.weight, s.trend]).concat(target ? [target] : []);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2;
    lo = mid - 1;
    hi = mid + 1;
  }
  const t0 = new Date(series[0].date).getTime();
  const t1 = new Date(series[series.length - 1].date).getTime();
  const x = (d: string) => pad + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
  const trendPath = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.date).toFixed(1)},${y(s.trend).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Weight over time with the smoothed trend">
        {target && target >= lo && target <= hi && (
          <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} stroke="var(--theme-accent)" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.7" />
        )}
        <path d={trendPath} fill="none" stroke="var(--theme-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((s) => (
          <circle key={s.date} cx={x(s.date)} cy={y(s.weight)} r="2.5" fill="color-mix(in srgb, var(--theme-fg) 45%, var(--theme-card))" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-subtle tabular-nums">
        <span>{shortDate(series[0].date)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-fg) 45%, var(--theme-card))' }} />
            Weigh-ins
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-accent" />
            Trend
          </span>
        </span>
        <span>{shortDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

function CheckinSheet({
  open,
  onClose,
  userId,
  lastWeight,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
  lastWeight: number | null;
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState(() => getLocalDateString());
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDate(getLocalDateString());
      setWeight(lastWeight ? String(lastWeight) : '');
      setWaist('');
      setEnergy(null);
      setNote('');
    }
  }
  const w = Number(weight);
  const valid = w >= 25 && w <= 350;
  const field = 'w-full h-12 px-4 rounded-2xl bg-card border border-line/60 text-base text-fg font-semibold placeholder:text-subtle placeholder:font-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25';

  return (
    <NuviaBottomSheet isOpen={open} onClose={onClose} title="Log weight" subtitle="Best: mornings, before eating" variant="standard">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || !userId) return;
          setSaving(true);
          try {
            await DataService.saveCheckin({
              user_id: userId,
              date,
              weight_kg: Math.round(w * 10) / 10,
              waist_cm: Number(waist) > 0 ? Math.round(Number(waist) * 10) / 10 : null,
              energy,
              note: note.trim() || null,
            });
            await onSaved();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-semibold text-fg-soft mb-1.5">Weight</span>
            <span className="relative block">
              <input type="number" inputMode="decimal" step="0.1" min={25} max={350} required value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 72.4" className={field} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">kg</span>
            </span>
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-fg-soft mb-1.5">Date</span>
            <input type="date" max={getLocalDateString()} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-fg-soft mb-1.5">
            Waist <span className="font-normal text-subtle">(optional)</span>
          </span>
          <span className="relative block">
            <input type="number" inputMode="decimal" step="0.5" min={40} max={250} value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="At the belly button" className={field} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">cm</span>
          </span>
        </label>
        <div>
          <span className="block text-sm font-semibold text-fg-soft mb-1.5">
            How do you feel? <span className="font-normal text-subtle">(optional)</span>
          </span>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="How do you feel">
            {['😫', '😕', '😐', '🙂', '💪'].map((emoji, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={energy === i + 1}
                aria-label={['Drained', 'Tired', 'Okay', 'Good', 'Great'][i]}
                onClick={() => setEnergy(energy === i + 1 ? null : i + 1)}
                className={`h-11 rounded-xl border text-lg transition-colors ${energy === i + 1 ? 'border-accent bg-accent/15' : 'border-line/60 bg-card'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-fg-soft mb-1.5">
            Note <span className="font-normal text-subtle">(optional)</span>
          </span>
          <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. busy week, slept badly" className={field} />
        </label>
        <button
          type="submit"
          disabled={!valid || saving}
          className="w-full h-12 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Scale className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save check-in'}
        </button>
      </form>
    </NuviaBottomSheet>
  );
}
