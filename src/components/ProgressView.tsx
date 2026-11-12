'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dumbbell, Trophy, Scale, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { NuviaCache, exerciseLogsKey, workoutRoutinesKey } from '@/lib/nuvia-cache';
import type { ExerciseLog } from '@/types/database';
import type { WorkoutRoutine } from '@/types/routine';
import type { StreakData } from '@/types/streak';
import type { TabType } from '@/components/Navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  BarChart,
  Card,
  EmptyState,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  StatTile,
} from '@/components/ui';
import {
  formatMinutes,
  formatVolume,
  muscleDistribution,
  personalRecords,
  weeklyBuckets,
  weeklyWorkoutGoal,
} from '@/lib/training-stats';

type Range = '4' | '12' | '26';
type Metric = 'workouts' | 'minutes' | 'volume';

const RANGES: { value: Range; label: string }[] = [
  { value: '4', label: '4 weeks' },
  { value: '12', label: '12 weeks' },
  { value: '26', label: '6 months' },
];

const METRICS: { value: Metric; label: string }[] = [
  { value: 'workouts', label: 'Workouts' },
  { value: 'minutes', label: 'Time' },
  { value: 'volume', label: 'Volume' },
];

export function ProgressView({
  onNavigateTab,
  refreshKey,
}: {
  onNavigateTab: (tab: TabType) => void;
  refreshKey?: number;
}) {
  const { user, profile, goals } = useAuth();
  const userId = user?.id;

  const [logs, setLogs] = useState<ExerciseLog[] | null>(
    () => NuviaCache.get<ExerciseLog[]>(exerciseLogsKey(userId))?.data ?? null,
  );
  const [routines, setRoutines] = useState<WorkoutRoutine[]>(
    () => NuviaCache.get<WorkoutRoutine[]>(workoutRoutinesKey(userId))?.data ?? [],
  );
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('12');
  const [metric, setMetric] = useState<Metric>('workouts');

  const [reloadTick, setReloadTick] = useState(0);
  const retry = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      DataService.getExerciseLogs(userId),
      DataService.getWorkoutRoutines(userId),
      DataService.getStreakData(userId),
    ])
      .then(([l, r, st]) => {
        if (cancelled) return;
        NuviaCache.set(exerciseLogsKey(userId), l);
        NuviaCache.set(workoutRoutinesKey(userId), r);
        setLogs(l);
        setRoutines(r);
        setStreak(st);
        setError(null);
      })
      .catch((e) => {
        console.error('ProgressView load failed', e);
        if (cancelled) return;
        setError('Could not load your training history.');
        setLogs((prev) => prev ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, reloadTick]);

  const weeks = Number(range);
  const buckets = useMemo(() => weeklyBuckets(logs ?? [], weeks), [logs, weeks]);
  const goal = useMemo(() => weeklyWorkoutGoal(routines), [routines]);
  const prs = useMemo(() => personalRecords(logs ?? []).slice(0, 6), [logs]);
  const muscles = useMemo(() => {
    const since = new Date(`${buckets[0].start}T00:00:00`);
    return muscleDistribution(logs ?? [], since);
  }, [logs, buckets]);

  const totals = useMemo(() => {
    const workouts = buckets.reduce((n, b) => n + b.workouts, 0);
    const minutes = buckets.reduce((n, b) => n + b.minutes, 0);
    const volume = buckets.reduce((n, b) => n + b.volumeKg, 0);
    const goalWeeks = goal ? buckets.filter((b) => !b.isCurrent && b.workouts >= goal).length : 0;
    return { workouts, minutes, volume, goalWeeks, perWeek: workouts / Math.max(1, weeks) };
  }, [buckets, goal, weeks]);

  const labelEvery = weeks <= 4 ? 1 : weeks <= 12 ? 3 : 6;
  const chartData = buckets.map((b, i) => ({
    // Label every Nth week (counted back from the current week) to keep the axis readable.
    label: (buckets.length - 1 - i) % labelEvery === 0 ? (b.isCurrent ? 'Now' : b.label) : '',
    value: metric === 'workouts' ? b.workouts : metric === 'minutes' ? b.minutes : b.volumeKg,
    highlight: b.isCurrent,
    title: `Week of ${b.label}`,
  }));
  const fmt = (v: number) =>
    metric === 'workouts' ? String(Math.round(v)) : metric === 'minutes' ? formatMinutes(v) : formatVolume(v);
  const latest = chartData[chartData.length - 1]?.value ?? 0;
  const avg = chartData.length ? chartData.reduce((n, d) => n + d.value, 0) / chartData.length : 0;

  const loading = logs === null;
  const hasAny = (logs?.length ?? 0) > 0;
  const maxMuscle = muscles[0]?.sets ?? 1;

  const weight = profile?.weight_kg ?? null;
  const target = goals?.target_weight_kg ?? profile?.target_weight_kg ?? null;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <ScreenHeader
        eyebrow="Your training over time"
        title="Progress"
        onOpenProfile={() => onNavigateTab('profile')}
      />

      <div className="px-5">
        <SegmentedControl ariaLabel="Time range" options={RANGES} value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="mx-5 rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-4 py-3 text-xs font-semibold text-red-ink flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={retry} className="underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Summary tiles */}
      <section className="px-5 grid grid-cols-2 gap-3" aria-label="Summary">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] !rounded-[var(--radius-card)]" />)
        ) : (
          <>
            <StatTile
              label="Workouts"
              value={totals.workouts}
              hint={`${totals.perWeek.toFixed(1)} per week`}
              emphasis
            />
            <StatTile label="Training time" value={formatMinutes(totals.minutes)} hint={`Last ${RANGES.find((r) => r.value === range)!.label}`} />
            <StatTile
              label="Volume lifted"
              value={totals.volume > 0 ? formatVolume(totals.volume) : '—'}
              hint={totals.volume > 0 ? 'Weight × reps, completed sets' : 'Log weights in a routine'}
            />
            <StatTile
              label="Streak"
              value={streak?.currentStreak ?? 0}
              unit="days"
              hint={streak ? `Best ${streak.longestStreak} days` : undefined}
            />
          </>
        )}
      </section>

      {/* Trend chart */}
      <Card className="mx-5 p-5">
        <SegmentedControl ariaLabel="Chart metric" options={METRICS} value={metric} onChange={setMetric} />
        <div className="mt-5">
          <div>
            <p className="text-xs font-semibold text-muted">This week</p>
            <p className="mt-1 text-[32px] leading-none font-extrabold tabular-nums tracking-tight text-fg">{fmt(latest)}</p>
            <p className="mt-1.5 text-[11px] font-medium text-subtle">
              Avg {fmt(avg)} / week
              {metric === 'workouts' && goal ? ` · goal ${goal}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-6">
          {loading ? (
            <Skeleton className="h-[140px]" />
          ) : hasAny ? (
            <BarChart
              data={chartData}
              height={140}
              goal={metric === 'workouts' ? goal ?? undefined : undefined}
              formatValue={fmt}
              ariaLabel={`${METRICS.find((m) => m.value === metric)!.label} per week`}
            />
          ) : (
            <EmptyState
              compact
              icon={Activity}
              title="No workouts yet"
              body="Finish a workout and your weekly trend appears here."
              actionLabel="Go to Workout"
              onAction={() => onNavigateTab('exercise')}
            />
          )}
        </div>
        {metric === 'workouts' && goal && hasAny && (
          <p className="mt-4 pt-4 border-t border-line text-xs text-muted">
            Goal hit in <span className="font-bold text-fg">{totals.goalWeeks}</span> of the last{' '}
            {weeks - 1} completed weeks. Your goal is the number of days your routines are scheduled.
          </p>
        )}
      </Card>

      {/* Personal records */}
      <section className="px-5 space-y-3" aria-labelledby="prs">
        <SectionHeader title="Personal records" />
        <Card>
          {loading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : prs.length === 0 ? (
            <EmptyState
              compact
              icon={Trophy}
              title="No records yet"
              body="Enter weight and reps for your sets during a routine workout to start tracking your best lifts."
            />
          ) : (
            <ul className="divide-y divide-line">
              {prs.map((pr) => (
                <li key={pr.exercise} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-tint-green flex items-center justify-center text-green-ink shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-fg truncate">{pr.exercise}</p>
                    <p className="text-[11px] font-medium text-muted">
                      {pr.muscle}
                      {pr.date ? ` · ${new Date(pr.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold tabular-nums text-fg whitespace-nowrap">
                    {pr.weightKg} kg <span className="text-muted font-semibold">× {pr.reps}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Muscle distribution */}
      <section className="px-5 space-y-3">
        <SectionHeader title="Sets by muscle group" />
        <Card className="p-4">
          {loading ? (
            <Skeleton className="h-24" />
          ) : muscles.length === 0 ? (
            <EmptyState
              compact
              icon={Dumbbell}
              title="No sets logged in this range"
              body="Completed sets from routine workouts are counted per target muscle."
            />
          ) : (
            <ul className="space-y-3">
              {muscles.map((m) => (
                <li key={m.muscle} className="grid grid-cols-[88px_1fr_32px] items-center gap-3">
                  <span className="text-xs font-semibold text-fg-soft truncate">{m.muscle}</span>
                  <ProgressBar value={m.sets} max={maxMuscle} label={`${m.muscle} sets`} />
                  <span className="text-xs font-bold tabular-nums text-fg text-right">{m.sets}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Body weight */}
      <section className="px-5 space-y-3">
        <SectionHeader title="Body weight" action="Edit" onAction={() => onNavigateTab('profile')} />
        <Card className="p-4">
          {weight ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted">Current</p>
                <p className="mt-1 text-[28px] leading-none font-extrabold tabular-nums text-fg">
                  {weight}
                  <span className="ml-1 text-sm font-semibold text-muted">kg</span>
                </p>
              </div>
              {target ? (
                <div className="text-right">
                  <p className="text-xs font-semibold text-muted">Target</p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-fg">{target} kg</p>
                  <p className="text-[11px] font-semibold text-subtle tabular-nums">
                    {Math.abs(weight - target) < 0.05
                      ? 'At target'
                      : `${Math.abs(weight - target).toFixed(1)} kg to ${weight > target ? 'lose' : 'gain'}`}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              compact
              icon={Scale}
              title="No weight recorded"
              body="Add your current weight in Profile."
              actionLabel="Open profile"
              onAction={() => onNavigateTab('profile')}
            />
          )}
          {weight ? (
            <p className="mt-4 pt-3 border-t border-line text-[11px] text-subtle leading-relaxed">
              Nuvia stores your current weight only, so there is no history chart yet. Update it in Profile when it changes.
            </p>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
