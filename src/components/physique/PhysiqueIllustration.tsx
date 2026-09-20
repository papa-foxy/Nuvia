'use client';

import React from 'react';

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

export function PhysiqueIllustration({
  sex = 'male',
  type,
  className = 'w-full h-full',
  selected = false,
}: PhysiqueIllustrationProps) {
  const isFemale = sex === 'female';

  // Normalize aliases
  const normalizedType = (() => {
    switch (type) {
      case 'soft_low_muscle':
        return 'soft';
      case 'muscular_some_fat':
        return 'muscular';
      case 'strong_powerful':
        return 'strong';
      default:
        return type;
    }
  })();

  // Colors
  const fillGradientId = `body-grad-${sex}-${normalizedType}-${selected ? 'active' : 'idle'}`;
  const contourColor = selected ? '#30D158' : '#52525B';
  const detailColor = selected ? '#30D158' : '#71717A';

  // Head and neutral features common across models for uniform scale
  const renderHead = () => (
    <g>
      {/* Head */}
      <ellipse cx="50" cy="20" rx="7.5" ry="9.5" fill={`url(#${fillGradientId})`} stroke={contourColor} strokeWidth="1.4" />
      {/* Neck */}
      <path
        d="M46 29 C46 33 45 35 44 38 L56 38 C55 35 54 33 54 29 Z"
        fill={`url(#${fillGradientId})`}
        stroke={contourColor}
        strokeWidth="1.2"
      />
    </g>
  );

  // Fallback / Not Sure / Custom
  if (normalizedType === 'not_sure' || normalizedType === 'custom') {
    return (
      <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={selected ? '#1C3824' : '#27272A'} />
            <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
          </linearGradient>
        </defs>
        {renderHead()}
        {/* Neutral silhouette */}
        <path
          d="M44 38 C35 39 31 43 27 50 C24 56 22 72 20 85 C19 92 19 105 21 112 C22 115 24 117 25 116 C27 114 28 100 29 88 C31 82 34 81 35 83 C36 89 36 100 37 114 L35 152 L36 186 C36 189 39 191 42 191 C45 191 46 188 46 184 L48 140 L50 128 L52 140 L54 184 C54 188 55 191 58 191 C61 191 64 189 64 186 L65 152 L63 114 C64 100 64 89 65 83 C66 81 69 82 71 88 C72 100 73 114 75 116 C76 117 78 115 79 112 C81 105 81 92 80 85 C78 72 76 56 73 50 C69 43 65 39 56 38 Z"
          fill={`url(#${fillGradientId})`}
          stroke={contourColor}
          strokeWidth="1.4"
          strokeDasharray={normalizedType === 'not_sure' ? '3 3' : 'none'}
        />
        {normalizedType === 'not_sure' ? (
          <text x="50" y="80" textAnchor="middle" fill={selected ? '#30D158' : '#A1A1AA'} fontSize="16" fontWeight="bold">
            ?
          </text>
        ) : (
          <path
            d="M50 68 L50 88 M40 78 L60 78"
            stroke={selected ? '#30D158' : '#A1A1AA'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  }

  // MALE MODELS
  if (!isFemale) {
    switch (normalizedType) {
      case 'lean':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 38 C36 40 33 43 30 49 C27 55 25 72 23 86 C21 95 20 108 22 113 C23 115 25 115 26 114 C28 111 29 97 30 86 C32 80 36 78 37 80 C38 88 38 100 38 113 L36 152 L38 186 C38 189 41 191 43 191 C46 191 47 188 47 184 L49 140 L50 126 L51 140 L53 184 C53 188 54 191 57 191 C59 191 62 189 62 186 L64 152 L62 113 C62 100 62 88 63 80 C64 78 68 80 70 86 C71 97 72 111 74 114 C75 115 77 115 78 113 C80 108 79 95 77 86 C75 72 73 55 70 49 C67 43 64 40 56 38 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M44 43 Q50 46 56 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M42 55 Q50 59 58 55" stroke={detailColor} strokeWidth="0.9" strokeLinecap="round" />
            <line x1="50" y1="56" x2="50" y2="78" stroke={detailColor} strokeWidth="0.8" strokeDasharray="1 2" />
          </svg>
        );

      case 'average':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 38 C34 40 30 44 27 50 C24 57 22 73 20 86 C19 96 18 108 20 113 C22 115 24 115 25 113 C27 110 28 97 30 85 C32 80 35 79 36 82 C37 90 37 101 37 114 L35 152 L36 186 C36 189 39 191 42 191 C45 191 46 188 47 184 L49 140 L50 126 L51 140 L53 184 C54 188 55 191 58 191 C61 191 64 189 64 186 L65 152 L63 114 C63 101 63 90 64 82 C65 79 68 80 70 85 C72 97 73 110 75 113 C76 115 78 115 80 113 C82 108 81 96 80 86 C78 73 76 57 73 50 C70 44 66 40 56 38 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M43 43 Q50 46 57 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M41 57 Q50 61 59 57" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <line x1="50" y1="58" x2="50" y2="82" stroke={detailColor} strokeWidth="0.8" strokeDasharray="2 2" />
          </svg>
        );

      case 'soft':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 38 C34 40 29 44 26 51 C23 58 21 74 19 88 C18 97 17 109 19 114 C21 116 23 116 24 114 C26 110 27 98 29 86 C32 82 33 83 34 86 C35 95 35 104 35 115 L34 152 L35 186 C35 189 38 191 41 191 C44 191 46 188 46 184 L48 140 L50 128 L52 140 L54 184 C54 188 56 191 59 191 C62 191 65 189 65 186 L66 152 L65 115 C65 104 65 95 66 86 C67 83 68 82 71 86 C73 98 74 110 76 114 C77 116 79 116 81 114 C83 109 82 97 81 88 C79 74 77 58 74 51 C71 44 66 40 56 38 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M43 44 Q50 47 57 44" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M40 68 Q50 75 60 68" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M42 85 Q50 90 58 85" stroke={detailColor} strokeWidth="0.8" strokeLinecap="round" />
          </svg>
        );

      case 'higher_body_fat':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 38 C33 40 27 45 24 52 C21 60 19 76 17 90 C16 99 15 110 17 115 C19 117 21 117 22 115 C25 111 26 99 28 88 C31 84 31 87 32 92 C33 102 33 110 33 118 L33 153 L34 186 C34 189 37 191 41 191 C44 191 45 188 46 184 L48 142 L50 130 L52 142 L54 184 C55 188 56 191 59 191 C63 191 66 189 66 186 L67 153 L67 118 C67 110 67 102 68 92 C69 87 69 84 72 88 C74 99 75 111 78 115 C79 117 81 117 83 115 C85 110 84 99 83 90 C81 76 79 60 76 52 C73 45 67 40 56 38 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M42 45 Q50 48 58 45" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M38 72 Q50 82 62 72" stroke={detailColor} strokeWidth="1.1" strokeLinecap="round" />
            <path d="M40 92 Q50 100 60 92" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          </svg>
        );

      case 'muscular':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 37 C33 38 27 42 23 48 C19 55 17 73 16 86 C15 96 16 109 18 114 C20 116 22 116 24 113 C26 109 28 96 30 84 C33 76 35 77 36 82 C37 90 37 101 37 114 L34 152 L36 186 C36 189 40 191 43 191 C46 191 47 188 47 184 L49 140 L50 126 L51 140 L53 184 C53 188 54 191 57 191 C60 191 64 189 64 186 L66 152 L63 114 C63 101 63 90 64 82 C65 77 67 76 70 84 C72 96 74 109 76 113 C78 116 80 116 82 114 C84 109 85 96 84 86 C83 73 81 55 77 48 C73 42 67 38 56 37 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M40 54 Q50 58 60 54" stroke={detailColor} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="50" y1="55" x2="50" y2="88" stroke={detailColor} strokeWidth="1" />
            <path d="M43 65 L57 65" stroke={detailColor} strokeWidth="0.9" strokeLinecap="round" />
            <path d="M44 76 L56 76" stroke={detailColor} strokeWidth="0.9" strokeLinecap="round" />
            <path d="M26 53 Q30 58 31 66" stroke={detailColor} strokeWidth="0.9" />
            <path d="M74 53 Q70 58 69 66" stroke={detailColor} strokeWidth="0.9" />
          </svg>
        );

      case 'athletic':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 38 C34 39 29 43 25 49 C21 56 20 73 19 86 C18 95 19 108 21 113 C22 115 24 115 26 113 C28 109 29 96 31 84 C34 77 36 78 37 81 C38 89 38 100 38 113 L35 152 L37 186 C37 189 40 191 43 191 C46 191 47 188 48 184 L49 140 L50 126 L51 140 L52 184 C53 188 54 191 57 191 C60 191 63 189 63 186 L65 152 L62 113 C62 100 62 89 63 81 C64 78 66 77 69 84 C71 96 72 109 74 113 C76 115 78 115 79 113 C81 108 82 95 81 86 C80 73 79 56 75 49 C71 43 66 39 56 38 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M42 43 Q50 46 58 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M41 55 Q50 59 59 55" stroke={detailColor} strokeWidth="1.1" strokeLinecap="round" />
            <line x1="50" y1="56" x2="50" y2="82" stroke={detailColor} strokeWidth="0.9" />
            <path d="M44 68 L56 68" stroke={detailColor} strokeWidth="0.8" strokeLinecap="round" />
          </svg>
        );

      case 'lean_muscular':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 37 C33 38 27 42 24 48 C20 55 18 73 17 86 C16 96 17 109 19 114 C21 116 23 116 25 113 C27 109 29 96 31 84 C34 76 36 77 37 81 C38 89 38 100 38 113 L35 152 L37 186 C37 189 40 191 43 191 C46 191 47 188 48 184 L49 140 L50 126 L51 140 L52 184 C53 188 54 191 57 191 C60 191 63 189 63 186 L65 152 L62 113 C62 100 62 89 63 81 C64 77 66 76 69 84 C71 96 73 109 75 113 C77 116 79 116 81 114 C83 109 84 96 83 86 C82 73 80 55 76 48 C73 42 67 38 56 37 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M41 54 Q50 58 59 54" stroke={detailColor} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="50" y1="55" x2="50" y2="86" stroke={detailColor} strokeWidth="1" />
            <path d="M43 65 L57 65" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M44 75 L56 75" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M45 84 L55 84" stroke={detailColor} strokeWidth="0.9" strokeLinecap="round" />
          </svg>
        );

      case 'strong':
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 36 C31 37 25 41 21 48 C18 56 16 74 15 88 C14 98 15 110 17 115 C19 117 22 117 24 114 C26 110 28 97 30 85 C33 78 35 79 36 84 C37 93 37 103 37 116 L34 153 L36 186 C36 189 40 191 44 191 C47 191 48 188 48 184 L50 142 L50 128 L50 142 L52 184 C52 188 53 191 56 191 C60 191 64 189 64 186 L66 153 L63 116 C63 103 63 93 64 84 C65 79 67 78 70 85 C72 97 74 110 76 114 C78 117 81 117 83 115 C85 110 86 98 85 88 C84 74 82 56 79 48 C75 41 69 37 56 36 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M39 56 Q50 61 61 56" stroke={detailColor} strokeWidth="1.3" strokeLinecap="round" />
            <line x1="50" y1="57" x2="50" y2="88" stroke={detailColor} strokeWidth="1" />
            <path d="M41 72 L59 72" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          </svg>
        );

      case 'general_fitness':
      default:
        return (
          <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
                <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
              </linearGradient>
            </defs>
            {renderHead()}
            <path
              d="M44 38 C34 40 29 44 26 50 C23 57 21 73 20 86 C19 95 19 108 21 113 C22 115 24 115 26 113 C28 109 29 97 31 85 C33 80 36 79 37 82 C38 90 38 101 38 114 L35 152 L37 186 C37 189 40 191 43 191 C46 191 47 188 47 184 L49 140 L50 126 L51 140 L53 184 C53 188 54 191 57 191 C60 191 63 189 63 186 L65 152 L62 114 C62 101 62 90 63 82 C64 79 67 80 69 85 C71 97 72 109 74 113 C76 115 78 115 79 113 C81 108 81 95 80 86 C79 73 77 57 74 50 C71 44 66 40 56 38 Z"
              fill={`url(#${fillGradientId})`}
              stroke={contourColor}
              strokeWidth="1.4"
            />
            <path d="M43 44 Q50 47 57 44" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
            <path d="M42 57 Q50 61 58 57" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          </svg>
        );
    }
  }

  // FEMALE MODELS
  switch (normalizedType) {
    case 'lean':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 38 C38 40 34 44 31 50 C28 56 26 73 24 87 C22 96 21 108 23 113 C24 115 26 115 27 113 C29 110 30 96 32 84 C35 77 37 77 38 80 C39 88 38 98 37 113 L36 152 L38 186 C38 189 40 191 43 191 C45 191 46 188 47 184 L48 140 L50 126 L52 140 L53 184 C54 188 55 191 57 191 C60 191 62 189 62 186 L64 152 L63 113 C62 98 61 88 62 80 C63 77 65 77 68 84 C70 96 71 110 73 113 C74 115 76 115 77 113 C79 108 78 96 76 87 C74 73 72 56 69 50 C66 44 62 40 55 38 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M44 43 Q50 46 56 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M43 55 Q50 58 57 55" stroke={detailColor} strokeWidth="0.9" strokeLinecap="round" />
        </svg>
      );

    case 'average':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 38 C37 40 33 44 30 50 C27 57 25 73 23 87 C21 96 20 108 22 113 C23 115 25 115 27 113 C29 110 30 96 32 84 C35 77 38 78 39 82 C40 90 39 101 37 114 L35 152 L37 186 C37 189 40 191 43 191 C45 191 47 188 47 184 L48 140 L50 126 L52 140 L53 184 C53 188 55 191 57 191 C60 191 63 189 63 186 L65 152 L63 114 C61 101 60 90 61 82 C62 78 65 77 68 84 C70 96 71 110 73 113 C75 115 77 115 78 113 C80 108 79 96 77 87 C75 73 73 57 70 50 C67 44 63 40 55 38 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M44 43 Q50 46 56 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M42 56 Q50 60 58 56" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'soft':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 38 C36 40 31 44 28 51 C25 58 23 74 21 88 C19 97 19 109 21 114 C22 116 24 116 26 114 C28 110 29 97 31 85 C34 79 37 81 38 85 C39 94 38 103 36 115 L35 152 L36 186 C36 189 39 191 42 191 C45 191 46 188 47 184 L48 140 L50 128 L52 140 L53 184 C54 188 55 191 58 191 C61 191 64 189 64 186 L65 152 L64 115 C62 103 61 94 62 85 C63 81 66 79 69 85 C71 97 72 110 74 114 C76 116 78 116 79 114 C81 109 81 97 79 88 C77 74 75 58 72 51 C69 44 64 40 55 38 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M44 44 Q50 47 56 44" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M41 70 Q50 76 59 70" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'higher_body_fat':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 38 C35 40 29 45 26 52 C23 60 21 76 19 90 C18 99 17 110 19 115 C21 117 23 117 25 115 C27 111 28 98 30 87 C33 82 35 85 36 90 C37 99 36 108 35 118 L34 153 L35 186 C35 189 38 191 42 191 C44 191 46 188 46 184 L48 142 L50 130 L52 142 L54 184 C54 188 56 191 58 191 C62 191 65 189 65 186 L66 153 L65 118 C64 108 63 99 64 90 C65 85 67 82 70 87 C72 98 73 111 75 115 C77 117 79 117 81 115 C83 110 82 99 81 90 C79 76 77 60 74 52 C71 45 65 40 55 38 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M43 45 Q50 48 57 45" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M39 74 Q50 82 61 74" stroke={detailColor} strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );

    case 'muscular':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 37 C36 38 31 42 27 48 C23 55 21 73 20 86 C19 96 19 109 21 114 C23 116 25 116 27 113 C29 109 30 96 32 84 C35 77 38 78 39 81 C40 89 39 100 37 113 L35 152 L37 186 C37 189 40 191 43 191 C46 191 47 188 47 184 L49 140 L50 126 L51 140 L53 184 C53 188 54 191 57 191 C60 191 63 189 63 186 L65 152 L63 113 C61 100 60 89 61 81 C62 78 65 77 68 84 C70 96 71 109 73 113 C75 116 77 116 79 114 C81 109 81 96 80 86 C79 73 77 55 73 48 C69 42 64 38 55 37 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M43 43 Q50 46 57 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M42 55 Q50 59 58 55" stroke={detailColor} strokeWidth="1.1" strokeLinecap="round" />
          <line x1="50" y1="56" x2="50" y2="78" stroke={detailColor} strokeWidth="0.8" />
          <path d="M44 68 L56 68" stroke={detailColor} strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      );

    case 'athletic':
    case 'lean_muscular':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 38 C37 39 32 43 28 49 C24 56 22 73 21 86 C20 95 20 108 22 113 C23 115 25 115 27 113 C29 109 30 96 32 84 C35 77 38 78 39 81 C40 89 39 100 37 113 L35 152 L37 186 C37 189 40 191 43 191 C46 191 47 188 47 184 L49 140 L50 126 L51 140 L53 184 C53 188 54 191 57 191 C60 191 63 189 63 186 L65 152 L63 113 C61 100 60 89 61 81 C62 78 65 77 68 84 C70 96 71 109 73 113 C75 115 77 115 78 113 C80 108 80 95 79 86 C78 73 76 56 72 49 C68 43 63 39 55 38 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M43 43 Q50 46 57 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M42 55 Q50 59 58 55" stroke={detailColor} strokeWidth="1.1" strokeLinecap="round" />
          <line x1="50" y1="56" x2="50" y2="76" stroke={detailColor} strokeWidth="0.8" />
        </svg>
      );

    case 'strong':
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 37 C35 38 30 42 26 48 C22 55 20 73 19 86 C18 96 18 109 20 114 C22 116 24 116 26 113 C28 109 30 96 32 84 C35 77 38 78 39 82 C40 90 39 101 37 115 L35 153 L37 186 C37 189 40 191 44 191 C46 191 47 188 47 184 L49 141 L50 127 L51 141 L53 184 C53 188 54 191 57 191 C60 191 63 189 63 186 L65 153 L63 115 C61 101 60 90 61 82 C62 78 65 77 68 84 C70 96 72 109 74 113 C76 116 78 116 80 114 C82 109 82 96 81 86 C80 73 78 55 74 48 C70 42 65 38 55 37 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M42 55 Q50 59 58 55" stroke={detailColor} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M42 68 L58 68" stroke={detailColor} strokeWidth="0.9" strokeLinecap="round" />
        </svg>
      );

    case 'general_fitness':
    default:
      return (
        <svg viewBox="0 0 100 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected ? '#1C3824' : '#2A2A2E'} />
              <stop offset="100%" stopColor={selected ? '#14291A' : '#18181B'} />
            </linearGradient>
          </defs>
          {renderHead()}
          <path
            d="M45 38 C37 40 33 44 30 50 C27 57 25 73 23 87 C21 96 20 108 22 113 C23 115 25 115 27 113 C29 110 30 96 32 84 C35 77 38 78 39 82 C40 90 39 101 37 114 L35 152 L37 186 C37 189 40 191 43 191 C45 191 47 188 47 184 L48 140 L50 126 L52 140 L53 184 C53 188 55 191 57 191 C60 191 63 189 63 186 L65 152 L63 114 C61 101 60 90 61 82 C62 78 65 77 68 84 C70 96 71 110 73 113 C75 115 77 115 78 113 C80 108 79 96 77 87 C75 73 73 57 70 50 C67 44 63 40 55 38 Z"
            fill={`url(#${fillGradientId})`}
            stroke={contourColor}
            strokeWidth="1.4"
          />
          <path d="M44 43 Q50 46 56 43" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
          <path d="M42 56 Q50 60 58 56" stroke={detailColor} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
  }
}
