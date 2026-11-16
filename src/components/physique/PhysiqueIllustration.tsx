'use client';

import React from 'react';
import {
  PHYSIQUE_SHAPES,
  PHYSIQUE_VIEWBOX,
  buildFigure,
  femaleShape,
  type FigurePart,
} from './physique-shapes';

export type PhysiqueGender = 'male' | 'female' | 'other';

export type PhysiqueType =
  | 'lean'
  | 'average'
  | 'soft'
  | 'soft_low_muscle'
  | 'higher_body_fat'
  | 'muscular'
  | 'muscular_some_fat'
  | 'not_sure'
  | 'athletic'
  | 'lean_muscular'
  | 'strong'
  | 'strong_powerful'
  | 'general_fitness'
  | 'custom';

interface PhysiqueIllustrationProps {
  sex?: PhysiqueGender;
  type: PhysiqueType | string;
  className?: string;
  selected?: boolean;
}

const ALIASES: Record<string, string> = {
  soft_low_muscle: 'soft',
  muscular_some_fat: 'muscular',
  strong_powerful: 'strong',
};

const LABELS: Record<string, string> = {
  lean: 'Lean',
  average: 'Average',
  soft: 'Soft',
  higher_body_fat: 'Higher body fat',
  muscular: 'Muscular',
  athletic: 'Athletic',
  lean_muscular: 'Lean and muscular',
  strong: 'Strong',
  general_fitness: 'General fitness',
  not_sure: 'Not sure',
  custom: 'Custom',
};

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, var(--theme-card))`;

// Same palette as the Workout muscle map (AnatomyFigure).
const NON_MUSCLE = mix('var(--theme-fg)', 13);
const ACCENT_MUSCLE = 'var(--theme-accent)';
const ACCENT_NON_MUSCLE = mix('var(--theme-accent)', 45);
const GLYPH = mix('var(--theme-fg)', 60);

const figureCache = new Map<string, FigurePart[]>();

function figureFor(type: string, female: boolean): FigurePart[] {
  const key = `${type}:${female ? 'f' : 'm'}`;
  let parts = figureCache.get(key);
  if (!parts) {
    const base = PHYSIQUE_SHAPES[type] ?? PHYSIQUE_SHAPES.average;
    parts = buildFigure(female ? femaleShape(base) : base);
    figureCache.set(key, parts);
  }
  return parts;
}

/**
 * Front anatomy figure in the Workout muscle-map style, reshaped per
 * physique (frame width, muscle size, definition and softness).
 */
export function PhysiqueIllustration({
  sex = 'male',
  type,
  className = 'w-full h-full',
  selected = false,
}: PhysiqueIllustrationProps) {
  const normalized = ALIASES[type] ?? type;
  const isUnknown = normalized === 'not_sure' || normalized === 'custom';
  const shapeKey = isUnknown || !PHYSIQUE_SHAPES[normalized] ? 'average' : normalized;
  const shape = PHYSIQUE_SHAPES[shapeKey];
  const parts = figureFor(shapeKey, sex === 'female');

  const muscleFill = selected ? ACCENT_MUSCLE : mix('var(--theme-fg)', shape.tone);
  const otherFill = selected ? ACCENT_NON_MUSCLE : NON_MUSCLE;
  // Gaps between muscles: card colour for crisp definition, blended toward
  // the muscle colour for softer types.
  const gap =
    shape.definition >= 1
      ? 'var(--theme-card)'
      : `color-mix(in srgb, ${muscleFill} ${Math.round((1 - shape.definition) * 100)}%, var(--theme-card))`;
  const label = `${LABELS[normalized] ?? 'Body'} physique illustration`;

  return (
    <svg
      viewBox={PHYSIQUE_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity={isUnknown ? (selected ? 0.75 : 0.6) : 1} strokeLinejoin="round">
        {shape.padding > 0 && (
          // Soft-tissue layer: the muscles grown outward, filling the gaps.
          <g fill={muscleFill} stroke={muscleFill} strokeWidth={shape.padding * 2}>
            {parts.map((p, i) =>
              p.muscle || p.slug === 'knees' || p.slug === 'ankles' ? (
                <path key={i} d={p.d} transform={p.transform} />
              ) : null,
            )}
          </g>
        )}
        {parts.map((p, i) =>
          p.muscle ? (
            <path
              key={i}
              d={p.d}
              transform={p.transform}
              fill={muscleFill}
              stroke={gap}
              strokeWidth={shape.stroke}
            />
          ) : (
            <path key={i} d={p.d} transform={p.transform} fill={otherFill} />
          ),
        )}
      </g>

      {isUnknown && (
        <g>
          <circle
            cx="364"
            cy="560"
            r="150"
            fill="var(--theme-card)"
            stroke={selected ? 'var(--theme-accent)' : GLYPH}
            strokeWidth="14"
            strokeDasharray="34 26"
          />
          {normalized === 'not_sure' ? (
            <text
              x="364"
              y="560"
              dy="0.36em"
              textAnchor="middle"
              fontSize="210"
              fontWeight="800"
              fill={selected ? 'var(--theme-fg)' : GLYPH}
            >
              ?
            </text>
          ) : (
            // Pencil
            <g
              transform="translate(364 560) rotate(45)"
              fill="none"
              stroke={selected ? 'var(--theme-fg)' : GLYPH}
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M-26 -78 h52 v120 l-26 40 l-26 -40 z" />
              <path d="M-26 42 h52" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
