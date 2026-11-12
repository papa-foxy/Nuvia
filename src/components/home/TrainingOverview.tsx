'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '@/lib/data-service';
import { NuviaCache, exerciseLogsKey } from '@/lib/nuvia-cache';
import type { ExerciseLog } from '@/types/database';
import type { WorkoutRoutine } from '@/types/routine';
import type { StreakData } from '@/types/streak';
import { Card, ProgressRing, Skeleton, StatTile } from '@/components/ui';
import { currentWeekDays, formatMinutes, weeklyWorkoutGoal } from '@/lib/training-stats';

export function useTrainingOverview(userId: string | undefined, refreshKey?: number) {
  const [logs, setLogs] = useState<ExerciseLog[] | null>(
    () => NuviaCache.get<ExerciseLog[]>(exerciseLogsKey(userId))?.data ?? null,
  );
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([DataService.getExerciseLogs(userId), DataService.getStreakData(userId)])
      .then(([l, s]) => {
        if (cancelled) return;
        NuviaCache.set(exerciseLogsKey(userId), l);
        setLogs(l);
        setStreak(s);
      })
      .catch((e) => {
        console.error('Training overview load failed', e);
        if (!cancelled) setLogs((prev) => prev ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  return { logs, streak };
}

/** WHOOP-style "how am I doing this week" card with one guidance sentence (Oura). */
export function WeekOverviewCard({
  logs,
  routines,
  onOpenProgress,
}: {
  logs: ExerciseLog[] | null;
  routines: WorkoutRoutine[];
  onOpenProgress: () => void;
}) {
  const days = useMemo(() => currentWeekDays(logs ?? []), [logs]);
  const goal = weeklyWorkoutGoal(routines);
  const done = days.filter((d) => d.workouts > 0).length;
  const minutes = days.reduce((n, d) => n + d.minutes, 0);
  const maxMin = Math.max(30, ...days.map((d) => d.minutes));

  if (logs === null) return <Skeleton className="h-[188px] !rounded-[var(--radius-card)]" />;

  const message = !goal
    ? done === 0
      ? 'No workouts yet this week. Schedule a routine to set a weekly goal.'
      : `${done} training ${done === 1 ? 'day' : 'days'} this week.`
    : done >= goal
      ? `Weekly goal reached: ${done} of ${goal} training days.`
      : `${done} of ${goal} training days done. ${goal - done} to go this week.`;

  return (
    <Card as="section" aria-label="This week" className="p-5">
      <button type="button" onClick={onOpenProgress} className="w-full text-left cursor-pointer group">
        <div className="flex items-center gap-5">
          <ProgressRing value={done} max={goal ?? Math.max(done, 1)} label="Training days this week">
            <span className="text-[26px] leading-none font-extrabold tabular-nums text-fg">{done}</span>
            <span className="mt-0.5 text-[10px] font-bold text-muted tabular-nums">/ {goal ?? '–'}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">This week</p>
            <p className="mt-1.5 text-sm font-semibold text-fg leading-snug">{message}</p>
            <p className="mt-1.5 text-xs font-medium text-muted tabular-nums">
              {formatMinutes(minutes)} active
              <span className="text-subtle group-hover:text-fg transition-colors"> · See progress →</span>
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2" aria-label="Active minutes per day">
          {days.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div className="w-full h-12 rounded-[8px] bg-elevated/60 flex items-end overflow-hidden">
                {d.minutes > 0 && (
                  <div
                    className={`w-full rounded-[8px] ${d.isToday ? 'bg-accent' : 'bg-fg/35'}`}
                    style={{ height: `${Math.max(14, (d.minutes / maxMin) * 100)}%` }}
                    title={`${d.minutes} min`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-bold ${
                  d.isToday ? 'text-fg' : d.isFuture ? 'text-subtle/60' : 'text-subtle'
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </button>
    </Card>
  );
}

/** Four headline stats; each opens the screen where it can be changed or explored. */
export function HomeStatsGrid({
  logs,
  streak,
  weightKg,
  targetWeightKg,
  onOpenProgress,
  onOpenProfile,
}: {
  logs: ExerciseLog[] | null;
  streak: StreakData | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  onOpenProgress: () => void;
  onOpenProfile: () => void;
}) {
  if (logs === null) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] !rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }
  const totalMinutes = logs.reduce((n, l) => n + (l.duration_minutes || 0), 0);
  const avgMinutes = logs.length ? Math.round(totalMinutes / logs.length) : 0;
  const diff = weightKg && targetWeightKg ? weightKg - targetWeightKg : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label="Body weight"
        value={weightKg ?? '—'}
        unit={weightKg ? 'kg' : undefined}
        hint={
          diff === null
            ? weightKg
              ? 'No target set'
              : 'Add in Profile'
            : Math.abs(diff) < 0.05
              ? 'At target'
              : `${Math.abs(diff).toFixed(1)} kg to target`
        }
        onClick={onOpenProfile}
      />
      <StatTile label="Total workouts" value={logs.length} hint="All time" onClick={onOpenProgress} />
      <StatTile
        label="Avg. duration"
        value={avgMinutes || '—'}
        unit={avgMinutes ? 'min' : undefined}
        hint={logs.length ? `${formatMinutes(totalMinutes)} in total` : 'Per workout'}
        onClick={onOpenProgress}
      />
      <StatTile
        label="Consistency"
        value={streak ? `${Math.round(streak.monthlyConsistencyPct)}%` : '—'}
        hint={streak ? `Active days this month · ${streak.currentStreak}-day streak` : undefined}
        onClick={onOpenProgress}
      />
    </div>
  );
}
