/**
 * Request helpers around meal-personalization: reads the client's local time
 * from the request body and loads the user's personal context for the AI.
 */
export { loadPersonalContext } from './meal-personalization';

export interface PersonalOptions {
  localTimeLabel?: string;
  timeZoneOffsetMinutes?: number;
}

/** `localTime` ("Fri 8:12am") and `tzOffset` (minutes east of UTC, e.g. 480) sent by the app. */
export function personalOptionsFromBody(body: unknown): PersonalOptions {
  const b = (body ?? {}) as { localTime?: unknown; tzOffset?: unknown };
  const tz = Number(b.tzOffset);
  return {
    localTimeLabel: typeof b.localTime === 'string' ? b.localTime.slice(0, 40) : undefined,
    timeZoneOffsetMinutes: Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : undefined,
  };
}
