'use client';

import React from 'react';
import { MUSCLE_IDS, MUSCLE_INFO, type MuscleId } from '@/lib/muscle-recovery';
import { ANATOMY_PATHS, ANATOMY_VIEWBOX, type AnatomySlug } from './anatomy-data';

export type AnatomyView = 'front' | 'back';

export interface AnatomyBadge {
  id: MuscleId;
  label: string;
  color: string;
}

/** Badge position per muscle and view, in the SVG's own units. */
const BADGE_AT: Record<AnatomyView, Partial<Record<MuscleId, [number, number]>>> = {
  front: {
    chest: [395, 405],
    deltoids: [525, 300],
    biceps: [570, 480],
    forearm: [595, 610],
    abs: [362, 545],
    obliques: [455, 600],
    quadriceps: [440, 850],
    adductors: [362, 760],
    tibialis: [465, 1090],
    trapezius: [362, 300],
  },
  back: {
    trapezius: [1086, 320],
    deltoids: [1240, 335],
    'upper-back': [1086, 450],
    'lower-back': [1086, 600],
    triceps: [1245, 475],
    forearm: [1305, 610],
    gluteal: [1086, 705],
    hamstring: [1160, 870],
    calves: [1165, 1155],
  },
};

const MUSCLE_SET = new Set<string>(MUSCLE_IDS);
// Mixed from the text colour so muscles stay visible in both themes.
const NEUTRAL = 'color-mix(in srgb, var(--theme-fg) 24%, var(--theme-card))';
const NON_MUSCLE = 'color-mix(in srgb, var(--theme-fg) 13%, var(--theme-card))';

interface AnatomyFigureProps {
  view: AnatomyView;
  /** Fill for a muscle; null = neutral (fresh / not highlighted). */
  fillFor: (id: MuscleId) => string | null;
  selected?: MuscleId | null;
  onSelect?: (id: MuscleId) => void;
  /** Accessible name for a muscle button, e.g. "Chest, 28% recovered". */
  describe?: (id: MuscleId) => string;
  badges?: AnatomyBadge[];
  className?: string;
  label?: string;
}

/**
 * Anatomical muscle figure (front or back). Each muscle is a separate,
 * selectable shape with hover, focus and selected states.
 */
export function AnatomyFigure({ view, fillFor, selected, onSelect, describe, badges = [], className, label }: AnatomyFigureProps) {
  const paths = ANATOMY_PATHS[view];
  const slugs = Object.keys(paths) as AnatomySlug[];
  // Draw the selected muscle last so its outline sits on top.
  const ordered = [...slugs].sort((a, b) => Number(a === selected) - Number(b === selected));
  const interactive = !!onSelect;

  return (
    <svg
      viewBox={ANATOMY_VIEWBOX[view]}
      className={className}
      role={interactive ? 'group' : 'img'}
      aria-label={label || `Muscle map, ${view} view`}
    >
      {ordered.map((slug) => {
        const ds = paths[slug] || [];
        if (!MUSCLE_SET.has(slug)) {
          return (
            <g key={slug} fill={NON_MUSCLE} aria-hidden="true">
              {ds.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          );
        }
        const id = slug as MuscleId;
        const isSelected = selected === id;
        const fill = fillFor(id) || NEUTRAL;
        return (
          <g
            key={slug}
            fill={fill}
            stroke={isSelected ? 'var(--theme-fg)' : 'var(--theme-card)'}
            strokeWidth={isSelected ? 7 : 2.5}
            strokeLinejoin="round"
            className={interactive ? 'anatomy-muscle' : undefined}
            style={{ transition: 'fill 0.3s, filter 0.2s' }}
            {...(interactive
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': isSelected,
                  'aria-label': describe ? describe(id) : MUSCLE_INFO[id].label,
                  onClick: () => onSelect(id),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(id);
                    }
                  },
                }
              : { 'aria-hidden': true })}
          >
            {ds.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        );
      })}

      {badges.map((b) => {
        const at = BADGE_AT[view][b.id];
        if (!at) return null;
        const w = 46 + b.label.length * 21;
        return (
          <g key={b.id} transform={`translate(${at[0] - w / 2}, ${at[1] - 28})`} pointerEvents="none" aria-hidden="true">
            <rect width={w} height="56" rx="28" fill={b.color} stroke="var(--theme-card)" strokeWidth="6" />
            <text x={w / 2} y="40" textAnchor="middle" fontSize="36" fontWeight="800" fill="var(--theme-on-accent)">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
