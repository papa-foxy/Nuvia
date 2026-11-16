'use client';

import React, { useMemo, useState } from 'react';
import type { ExerciseLog } from '@/types/database';
import type { RoutineExercise } from '@/types/routine';
import {
  MUSCLE_GROUPS,
  MUSCLE_INFO,
  groupStatus,
  muscleStatus,
  musclesForExercise,
  type MuscleGroup,
  type MuscleId,
} from '@/lib/muscle-recovery';
import { AnatomyFigure, type AnatomyView } from './AnatomyFigure';
import { FRESH_AT, recoveryColor } from './MuscleRecoveryCard';

const BACK_VIEW: MuscleGroup[] = ['Back', 'Triceps'];

/**
 * The muscle groups a routine trains, each with a small anatomy figure and how
 * recovered that group is right now (from recent logs).
 */
export function RoutineMuscleStrip({ exercises, logs }: { exercises: RoutineExercise[]; logs: ExerciseLog[] }) {
  const [now] = useState(() => new Date());
  const recovery = useMemo(
    () => new Map(groupStatus(muscleStatus(logs, now)).map((g) => [g.group, g])),
    [logs, now],
  );

  // Groups this routine trains as a primary target, with planned sets and the muscles involved.
  const groups = useMemo(() => {
    const map = new Map<MuscleGroup, { sets: number; muscles: Set<MuscleId> }>();
    for (const ex of exercises) {
      const load = musclesForExercise(ex.name, ex.target_muscle);
      for (const [id, weight] of Object.entries(load) as [MuscleId, number][]) {
        if (weight < 0.7) continue; // helpers don't get their own tile
        const group = MUSCLE_INFO[id].group;
        const cur = map.get(group) || { sets: 0, muscles: new Set<MuscleId>() };
        cur.muscles.add(id);
        map.set(group, cur);
      }
      const primaryGroups = new Set(
        (Object.entries(load) as [MuscleId, number][]).filter(([, w]) => w >= 0.7).map(([id]) => MUSCLE_INFO[id].group),
      );
      for (const g of primaryGroups) map.get(g)!.sets += Number(ex.sets) || 0;
    }
    return MUSCLE_GROUPS.filter((g) => map.has(g))
      .map((g) => ({ group: g, ...map.get(g)! }))
      .sort((a, b) => b.sets - a.sets);
  }, [exercises]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted block px-1">Muscles in this workout</span>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="list">
        {groups.map(({ group, sets, muscles }) => {
          const percent = recovery.get(group)?.percent ?? 100;
          const view: AnatomyView = BACK_VIEW.includes(group) ? 'back' : 'front';
          const fresh = percent >= FRESH_AT;
          return (
            <div
              key={group}
              role="listitem"
              className="shrink-0 w-[84px] rounded-[var(--radius-card)] bg-card border border-line/60 p-2 flex flex-col items-center text-center"
            >
              <div className="relative">
                <AnatomyFigure
                  view={view}
                  className="w-10 h-20"
                  label={`${group}, ${percent}% recovered`}
                  fillFor={(id) => (muscles.has(id) ? recoveryColor(percent) || 'color-mix(in srgb, var(--theme-fg) 55%, var(--theme-card))' : null)}
                />
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[10px] font-extrabold tabular-nums border-2 border-card"
                  style={{
                    backgroundColor: recoveryColor(percent) || 'var(--theme-elevated)',
                    color: fresh ? 'var(--theme-fg)' : 'var(--theme-on-accent)',
                  }}
                >
                  {percent}%
                </span>
              </div>
              <span className="mt-2 text-[11px] font-bold text-fg leading-tight">{group}</span>
              <span className="text-[10px] text-subtle">{sets} sets</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-subtle px-1">Percent = how recovered each muscle group is now.</p>
    </div>
  );
}
