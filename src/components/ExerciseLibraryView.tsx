'use client';

import React, { useMemo, useState } from 'react';
import { Search, X, PlayCircle, SearchX } from 'lucide-react';
import { EXERCISE_CATALOG, type CatalogExercise } from '@/lib/exercise-catalog';
import type { RoutineExercise } from '@/types/routine';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { NuviaBottomSheet } from './NuviaBottomSheet';
import { Chip, EmptyState } from './ui';

/** Muscle groups exactly as the catalog defines them (no invented sub-groups). */
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Legs', 'Full Body'] as const;

/** Equipment groups derived from the catalog's free-text `equipment` field. */
const EQUIPMENT: { id: string; label: string; match: (e: string) => boolean }[] = [
  { id: 'bodyweight', label: 'Bodyweight', match: (e) => /bodyweight|floor|mat|push-up board|pull-up bar/.test(e) },
  { id: 'dumbbell', label: 'Dumbbells', match: (e) => e.includes('dumbbell') },
  { id: 'barbell', label: 'Barbell', match: (e) => e.includes('barbell') },
  { id: 'machine', label: 'Machine & cable', match: (e) => /machine|cable|gym/.test(e) },
  { id: 'kettlebell', label: 'Kettlebell', match: (e) => e.includes('kettlebell') },
  { id: 'bench', label: 'Bench', match: (e) => e.includes('bench') },
];

/**
 * Many catalog names are raw video titles ("Barbell Bench Press | Proper Form & Technique").
 * Show only the exercise name; the catalog entry itself is left untouched.
 */
function cleanText(raw: string): string {
  // Some entries contain a literal backslash-u0026 sequence instead of "&".
  const literal = String.fromCharCode(92) + 'u0026';
  return raw.split(literal).join('&').split('&amp;').join('&');
}

function displayName(raw: string): string {
  const decoded = cleanText(raw);
  return decoded.split(' | ')[0].split(' ｜ ')[0].trim() || decoded;
}

function toRoutineExercise(c: CatalogExercise): RoutineExercise {
  return {
    id: `library-${c.id}`,
    catalog_id: c.id,
    name: displayName(c.name),
    target_muscle: c.target_muscle,
    sets: c.default_sets,
    reps: c.default_reps,
    thumbnail_url: c.thumbnail_url,
    youtube_id: c.youtube_id,
    youtube_url: c.youtube_id ? `https://www.youtube.com/watch?v=${c.youtube_id}` : '',
  };
}

export function ExerciseLibraryView() {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogExercise | null>(null);
  const [video, setVideo] = useState<RoutineExercise | null>(null);

  // Only offer equipment filters that actually match something in the catalog.
  const equipmentOptions = useMemo(
    () => EQUIPMENT.filter((g) => EXERCISE_CATALOG.some((e) => g.match(e.equipment.toLowerCase()))),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const eq = EQUIPMENT.find((g) => g.id === equipment);
    return EXERCISE_CATALOG.filter((e) => {
      if (muscle && e.target_muscle !== muscle) return false;
      if (eq && !eq.match(e.equipment.toLowerCase())) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.target_muscle.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q) ||
        e.keywords.some((k) => k.includes(q))
      );
    }).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  }, [query, muscle, equipment]);

  const hasFilters = !!(query || muscle || equipment);

  return (
    <div className="space-y-4">
      {/* Search */}
      <label className="relative block">
        <span className="sr-only">Search exercises</span>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${EXERCISE_CATALOG.length} exercises`}
          className="w-full h-11 pl-10 pr-10 rounded-[var(--radius-control)] bg-card border border-line text-sm font-medium text-fg placeholder:text-subtle focus:outline-none focus:border-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-fg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </label>

      {/* Filters */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Muscle group</p>
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 [scrollbar-width:none]">
          <Chip selected={muscle === null} onClick={() => setMuscle(null)}>
            All
          </Chip>
          {MUSCLES.map((m) => (
            <Chip key={m} selected={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {m}
            </Chip>
          ))}
        </div>
        <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Equipment</p>
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 [scrollbar-width:none]">
          <Chip selected={equipment === null} onClick={() => setEquipment(null)}>
            Any
          </Chip>
          {equipmentOptions.map((g) => (
            <Chip key={g.id} selected={equipment === g.id} onClick={() => setEquipment(equipment === g.id ? null : g.id)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted tabular-nums" aria-live="polite">
          {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setMuscle(null);
              setEquipment(null);
            }}
            className="text-xs font-semibold text-muted hover:text-fg cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-card border border-line/60">
          <EmptyState icon={SearchX} title="No matching exercises" body="Try another search term or remove a filter." />
        </div>
      ) : (
        <ul className="rounded-[var(--radius-card)] bg-card border border-line/60 divide-y divide-line overflow-hidden">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelected(e)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-elevated/40 transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 shrink-0">
                  <ExerciseThumbnail exercise={e} aspectRatio="1/1" rounded="rounded-[10px]" className="w-14 h-14" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-fg truncate">{displayName(e.name)}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted truncate">
                    {e.target_muscle} · {e.equipment}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-subtle tabular-nums">
                    {e.default_sets} sets · {e.default_reps} reps
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail */}
      <NuviaBottomSheet
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? displayName(selected.name) : undefined}
        subtitle={selected ? `${selected.target_muscle} · ${selected.category}` : undefined}
      >
        {selected && (
          <div className="space-y-4">
            <ExerciseThumbnail exercise={selected} aspectRatio="16/9" rounded="rounded-[14px]" showPlayOverlay={!!selected.youtube_id} />
            <dl className="grid grid-cols-3 gap-2">
              {[
                ['Target', selected.target_muscle],
                ['Equipment', selected.equipment],
                ['Default', `${selected.default_sets} × ${selected.default_reps}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[var(--radius-control)] bg-elevated/60 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{k}</dt>
                  <dd className="mt-1 text-xs font-bold text-fg leading-snug">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">How to</p>
              <p className="mt-1.5 text-sm text-fg-soft leading-relaxed">{cleanText(selected.description)}</p>
            </div>
            {selected.youtube_id && (
              <button
                type="button"
                onClick={() => setVideo(toRoutineExercise(selected))}
                className="w-full h-12 rounded-[var(--radius-control)] bg-accent text-on-accent text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer"
              >
                <PlayCircle className="w-5 h-5" />
                Watch demonstration
              </button>
            )}
          </div>
        )}
      </NuviaBottomSheet>

      <ExerciseVideoModal exercise={video} isOpen={!!video} onClose={() => setVideo(null)} />
    </div>
  );
}
