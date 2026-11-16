'use client';

import React, { useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Card } from '@/components/ui';
import type { ExerciseLog } from '@/types/database';
import {
  daysSinceLastWorkout,
  MUSCLE_INFO,
  muscleStatus,
  type MuscleId,
  type MuscleStatus,
} from '@/lib/muscle-recovery';
import { AnatomyFigure, type AnatomyBadge, type AnatomyView } from './AnatomyFigure';

export const FRESH_AT = 90;

/** Colour for a recovery percentage: red (just trained) → amber → lime (nearly ready); fresh = neutral. */
export function recoveryColor(percent: number): string | null {
  if (percent >= FRESH_AT) return null;
  if (percent < 40) return 'var(--theme-danger)';
  if (percent < 70) return 'var(--theme-warn)';
  return 'var(--theme-accent)';
}

export function recoveryLabel(r: { percent: number; readyInHours: number }): string {
  if (r.percent >= FRESH_AT) return 'Fresh';
  if (r.readyInHours <= 0) return 'Almost ready';
  return r.readyInHours >= 36 ? `Ready in ~${Math.round(r.readyInHours / 24)} days` : `Ready in ~${r.readyInHours} h`;
}

function agoLabel(iso: string, now: Date): string {
  const hours = (now.getTime() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const setsLabel = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} set${n === 1 ? '' : 's'}`;

/** Which muscles get a % badge in each view (only where the muscle is drawn). */
const VIEW_MUSCLES: Record<AnatomyView, MuscleId[]> = {
  front: ['chest', 'deltoids', 'biceps', 'forearm', 'abs', 'obliques', 'quadriceps', 'adductors', 'tibialis'],
  back: ['trapezius', 'deltoids', 'upper-back', 'lower-back', 'triceps', 'gluteal', 'hamstring', 'calves', 'forearm'],
};

export function MuscleRecoveryCard({ logs }: { logs: ExerciseLog[] }) {
  const [view, setView] = useState<AnatomyView>('front');
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const [now] = useState(() => new Date());

  const statuses = useMemo(() => muscleStatus(logs, now), [logs, now]);
  const byId = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const daysSince = useMemo(() => daysSinceLastWorkout(logs, now), [logs, now]);
  const fresh = statuses.filter((s) => s.percent >= FRESH_AT).length;
  const recovering = [...statuses].filter((s) => s.percent < FRESH_AT).sort((a, b) => a.percent - b.percent);
  const detail = selected ? byId.get(selected)! : null;

  // Badges: the least recovered muscles visible in this view (a few, to stay readable).
  const badges: AnatomyBadge[] = recovering
    .filter((s) => VIEW_MUSCLES[view].includes(s.id))
    .slice(0, 5)
    .map((s) => ({ id: s.id, label: `${s.percent}%`, color: recoveryColor(s.percent)! }));

  const select = (id: MuscleId) => {
    setSelected((cur) => (cur === id ? null : id));
  };
  const selectFromList = (s: MuscleStatus) => {
    // Turn the figure to the side where this muscle is drawn.
    if (!VIEW_MUSCLES[view].includes(s.id)) setView(MUSCLE_INFO[s.id].view);
    select(s.id);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-fg">Muscle recovery</h3>
          <p className="text-[11px] text-subtle">From your logged workouts. Tap a muscle.</p>
        </div>
        <div className="flex bg-elevated p-0.5 rounded-lg" role="group" aria-label="Body view">
          {(['front', 'back'] as AnatomyView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                view === v ? 'bg-card text-fg shadow-sm' : 'text-muted'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
        <div className="text-center">
          <p className="text-4xl font-extrabold text-fg tabular-nums leading-none">{daysSince ?? '–'}</p>
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted leading-tight">
            {daysSince === 1 ? 'Day' : 'Days'} since
            <br />
            last workout
          </p>
        </div>

        <div className="anatomy-stage relative">
          <div key={view} className="anatomy-turn">
            <AnatomyFigure
              view={view}
              className="h-72 w-36 sm:h-80 sm:w-40"
              label={`Muscle recovery, ${view} view`}
              fillFor={(id) => recoveryColor(byId.get(id)?.percent ?? 100)}
              describe={(id) => `${MUSCLE_INFO[id].label}, ${byId.get(id)?.percent ?? 100}% recovered`}
              selected={selected}
              onSelect={select}
              badges={badges}
            />
          </div>
          <button
            type="button"
            onClick={() => setView(view === 'front' ? 'back' : 'front')}
            aria-label={`Turn to ${view === 'front' ? 'back' : 'front'} view`}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-elevated text-muted hover:text-fg flex items-center justify-center border border-line/60"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center">
          <p className="text-4xl font-extrabold text-fg tabular-nums leading-none">{fresh}</p>
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted leading-tight">
            Fresh
            <br />
            muscle{fresh === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Selected muscle: recovery, last workout and history */}
      {detail && (
        <div className="rounded-2xl bg-surface border border-line/60 p-3 space-y-2.5" role="status">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-fg">{detail.label}</p>
              <p className="text-[11px] text-muted">
                {detail.lastTrained
                  ? `Last trained ${dateLabel(detail.lastTrained)} (${agoLabel(detail.lastTrained, now)})`
                  : 'Not trained in the last 30 days'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-extrabold text-fg tabular-nums leading-none">{detail.percent}%</p>
              <p className="text-[10px] text-subtle mt-0.5">{recoveryLabel(detail)}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden" aria-hidden="true">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${detail.percent}%`, backgroundColor: recoveryColor(detail.percent) || 'var(--theme-success)' }}
            />
          </div>
          {detail.history.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Last 30 days · {setsLabel(detail.weeklySets)} this week
              </p>
              <ul className="space-y-1">
                {detail.history.slice(0, 4).map((h) => (
                  <li key={h.date} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate text-fg">
                      <span className="font-semibold">{dateLabel(h.date)}</span>
                      <span className="text-muted"> · {h.exercises.slice(0, 2).join(', ')}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{setsLabel(h.sets)}</span>
                  </li>
                ))}
              </ul>
              {detail.history.length > 4 && (
                <p className="text-[10px] text-subtle mt-1">+{detail.history.length - 4} earlier sessions</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-subtle">No sessions logged for this muscle yet.</p>
          )}
        </div>
      )}

      {/* Recovering muscles, least recovered first */}
      {recovering.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {recovering.map((s) => {
            const isSelected = selected === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectFromList(s)}
                aria-pressed={isSelected}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-colors ${
                  isSelected ? 'border-fg/40 bg-elevated' : 'border-line/60 bg-surface'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: recoveryColor(s.percent)! }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-fg truncate">{s.label}</span>
                  <span className="block text-[10px] text-subtle truncate">{recoveryLabel(s)}</span>
                </span>
                <span className="text-sm font-bold text-fg tabular-nums">{s.percent}%</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted text-center">
          {daysSince === null ? 'Log a workout to see which muscles are recovering.' : 'Every muscle is fresh. Good day to train.'}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-subtle">
        {[
          ['var(--theme-danger)', 'Just trained'],
          ['var(--theme-warn)', 'Recovering'],
          ['var(--theme-accent)', 'Nearly ready'],
          ['color-mix(in srgb, var(--theme-fg) 24%, var(--theme-card))', 'Fresh'],
        ].map(([c, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}
