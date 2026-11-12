/**
 * App icons for Profile → Connections.
 *
 * - Strava: the Strava mark, path from Simple Icons (CC0), on Strava orange.
 * - adidas Running: a simplified three-stripes mark on black (not the official
 *   artwork; swap in official assets if the app is ever published).
 * - Apple Health: a heart badge.
 *
 * Brand marks are used only to label the matching integration.
 */
import React from 'react';

export type IntegrationApp = 'strava' | 'adidas' | 'apple-health';

const STRAVA_PATH =
  'M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169';

function Glyph({ app }: { app: IntegrationApp }) {
  if (app === 'strava') {
    return (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" aria-hidden>
        <path d={STRAVA_PATH} fill="#ffffff" />
      </svg>
    );
  }
  if (app === 'adidas') {
    // Three rising stripes
    return (
      <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" aria-hidden>
        <path d="M2 19.5 5.4 17.5 8.2 22H3.8Z" fill="#ffffff" />
        <path d="M7.2 16.4 10.9 14.3 15.3 22H10.8Z" fill="#ffffff" />
        <path d="M12.6 13.2 16.4 11 22.3 22H17.9Z" fill="#ffffff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" aria-hidden>
      <path
        d="M12 21s-7.5-4.6-9.5-9.4C1.2 8.4 3.2 4.8 6.7 4.8c2 0 3.4 1.1 4.2 2.4h2.2c.8-1.3 2.2-2.4 4.2-2.4 3.5 0 5.5 3.6 4.2 6.8C19.5 16.4 12 21 12 21Z"
        fill="#ff2d55"
      />
    </svg>
  );
}

const TILE: Record<IntegrationApp, string> = {
  strava: 'bg-[#FC4C02]',
  adidas: 'bg-black ring-1 ring-white/15',
  'apple-health': 'bg-white ring-1 ring-black/10',
};

/** Rounded app-style tile. `badge` adds a small second app icon at the corner. */
export function IntegrationIcon({
  app,
  size = 36,
  badge,
  label,
}: {
  app: IntegrationApp;
  size?: number;
  badge?: IntegrationApp;
  label?: string;
}) {
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span
        className={`w-full h-full flex items-center justify-center ${TILE[app]}`}
        style={{ borderRadius: size * 0.26 }}
      >
        <Glyph app={app} />
      </span>
      {badge && (
        <span
          className={`absolute -right-1 -bottom-1 flex items-center justify-center ring-2 ring-card ${TILE[badge]}`}
          style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.14 }}
        >
          <Glyph app={badge} />
        </span>
      )}
    </span>
  );
}
