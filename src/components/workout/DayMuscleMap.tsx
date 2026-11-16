'use client';

import React, { useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Card } from '@/components/ui';
import type { ExerciseLog } from '@/types/database';
import type { WorkoutRoutine } from '@/types/routine';
import { MUSCLE_INFO, muscleWork, plannedMuscles, type MuscleId, type MuscleWork } from '@/lib/muscle-recovery';
import { AnatomyFigure, type AnatomyView } from './AnatomyFigure';

/** Highlight strength by sets: light work → heavy work, all in the accent colour. */
function workColor(sets: number, max: number): string {
  const share = max > 0 ? sets / max : 0;
  const pct = Math.round(45 + share * 55); // 45%–100% accent
  return `color-mix(in srgb, var(--theme-accent) ${pct}%, var(--theme-card))`;
}

const PLANNED_COLOR = 'color-mix(in srgb, var(--theme-accent) 40%, var(--theme-card))';

const setsLabel = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} set${n === 1 ? '' : 's'}`;

interface DayMuscleMapProps {
  /** Logs of that day. */
  exercises: ExerciseLog[];
  /** The routine scheduled that day, if any (shown as planned when nothing was logged). */
  routine?: WorkoutRoutine | null;
}

/**
 * Which muscles a day's workouts worked, on the same anatomical figure as the
 * Workout tab's recovery map. Nothing is guessed: with no logged sets and no
 * scheduled routine, the figure stays neutral.
 */
export function DayMuscleMap({ exercises, routine }: DayMuscleMapProps) {
  const worked = useMemo(() => muscleWork(exercises), [exercises]);
  const planned = useMemo(
    () => (worked.length === 0 && routine ? plannedMuscles(routine.exercises || []) : []),
    [worked.length, routine],
  );
  const mode: 'worked' | 'planned' | 'rest' = worked.length ? 'worked' : planned.length ? 'planned' : 'rest';
  const list: MuscleWork[] = mode === 'worked' ? worked : planned;
  const byId = useMemo(() => new Map(list.map((w) => [w.id, w])), [list]);
  const max = list[0]?.sets || 0;

  // Start on the side with more work.
  const [view, setView] = useState<AnatomyView>(() => {
    const backSets = list.filter((w) => MUSCLE_INFO[w.id].view === 'back').reduce((a, w) => a + w.sets, 0);
    const frontSets = list.filter((w) => MUSCLE_INFO[w.id].view === 'front').reduce((a, w) => a + w.sets, 0);
    return backSets > frontSets ? 'back' : 'front';
  });
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const detail = selected ? byId.get(selected) : null;

  const fillFor = (id: MuscleId) => {
    const w = byId.get(id);
    if (!w) return null;
    return mode === 'planned' ? PLANNED_COLOR : workColor(w.sets, max);
  };

  const title =
    mode === 'worked' ? 'Muscles worked' : mode === 'planned' ? 'Planned muscles' : 'Rest day';
  const subtitle =
    mode === 'worked'
      ? `${worked.length} muscle${worked.length === 1 ? '' : 's'} from your logged sets`
      : mode === 'planned'
        ? `${routine?.title || 'Scheduled routine'} · not logged yet`
        : 'No workout logged this day';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-fg">{title}</h3>
          <p className="text-[11px] text-subtle truncate">{subtitle}</p>
        </div>
        <div className="flex bg-elevated p-0.5 rounded-lg shrink-0" role="group" aria-label="Body view">
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

      <div className="anatomy-stage relative flex justify-center">
        <div key={view} className="anatomy-turn">
          <AnatomyFigure
            view={view}
            className="h-64 w-32"
            label={`${title}, ${view} view`}
            fillFor={fillFor}
            describe={(id) => {
              const w = byId.get(id);
              return w ? `${MUSCLE_INFO[id].label}, ${setsLabel(w.sets)}` : `${MUSCLE_INFO[id].label}, not worked`;
            }}
            selected={selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
          />
        </div>
        <button
          type="button"
          onClick={() => setView(view === 'front' ? 'back' : 'front')}
          aria-label={`Turn to ${view === 'front' ? 'back' : 'front'} view`}
          className="absolute bottom-0 right-1/2 translate-x-[5.5rem] w-8 h-8 rounded-full bg-elevated text-muted hover:text-fg flex items-center justify-center border border-line/60"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {selected && (
        <p className="text-xs text-muted bg-surface border border-line/60 rounded-xl px-3 py-2" role="status">
          <strong className="text-fg">{MUSCLE_INFO[selected].label}</strong>
          {detail
            ? ` · ${mode === 'planned' ? 'planned ' : ''}${setsLabel(detail.sets)} · ${detail.exercises.slice(0, 3).join(', ')}`
            : ' · not worked this day'}
        </p>
      )}

      {list.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {list.map((w) => {
            const isSelected = selected === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  if (MUSCLE_INFO[w.id].view !== view && !(w.id === 'deltoids' || w.id === 'forearm')) {
                    setView(MUSCLE_INFO[w.id].view);
                  }
                  setSelected(isSelected ? null : w.id);
                }}
                aria-pressed={isSelected}
                className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                  isSelected ? 'border-fg/40 bg-elevated text-fg' : 'border-line/60 bg-surface text-fg'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: mode === 'planned' ? PLANNED_COLOR : workColor(w.sets, max) }}
                  aria-hidden="true"
                />
                {w.label}
                <span className="text-subtle font-medium tabular-nums">{setsLabel(w.sets)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted text-center">Muscles rebuild on rest days. Nothing was logged for this day.</p>
      )}

      {mode === 'worked' && (
        <p className="text-[10px] text-subtle text-center">Stronger colour = more sets. Tap a muscle for details.</p>
      )}
    </Card>
  );
}
