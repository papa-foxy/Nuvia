/**
 * NuviaCache — a module-level, stale-while-revalidate cache.
 *
 * Lives at the module scope so it persists across component mounts/unmounts.
 * When a user switches tabs and returns, components read from this cache
 * immediately (no loading state), then optionally refresh in the background.
 *
 * Design principles:
 *  - Zero external dependencies
 *  - Works for both Supabase users and localStorage demo users
 *  - Targeted invalidation (by key or prefix) after mutations
 *  - Automatic garbage collection of expired entries
 */

interface CacheEntry<T = unknown> {
  data: T;
  storedAt: number;    // Date.now() when entry was written
  staleAt: number;     // storedAt + staleTime — after this, background-refetch
  expiresAt: number;   // storedAt + gcTime   — after this, entry is evicted
}

export interface CacheOptions {
  /** How long (ms) before data is considered stale and a background refetch is triggered.
   *  Data is still shown while stale. Default: 60_000 (1 min) */
  staleTime?: number;
  /** How long (ms) to keep unused entries in memory before eviction.
   *  Default: 300_000 (5 min) */
  gcTime?: number;
}

const DEFAULT_STALE_TIME = 60_000;  // 1 minute
const DEFAULT_GC_TIME   = 300_000;  // 5 minutes

// The single shared store — module-level, lives as long as the JS runtime.
const store = new Map<string, CacheEntry<unknown>>();

function gc() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

// Run GC every 2 minutes
if (typeof window !== 'undefined') {
  setInterval(gc, 120_000);
}

export const NuviaCache = {
  /**
   * Retrieve a cached entry.
   * Returns `{ data, isStale }` if a non-expired entry exists, otherwise `null`.
   */
  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return { data: entry.data, isStale: now > entry.staleAt };
  },

  /**
   * Write a value to the cache.
   */
  set<T>(key: string, data: T, opts: CacheOptions = {}): void {
    const staleTime = opts.staleTime ?? DEFAULT_STALE_TIME;
    const gcTime    = opts.gcTime   ?? DEFAULT_GC_TIME;
    const now = Date.now();
    store.set(key, {
      data,
      storedAt:  now,
      staleAt:   now + staleTime,
      expiresAt: now + gcTime,
    });
  },

  /**
   * Invalidate a single key, removing it from the cache.
   * The next read will trigger a fresh fetch.
   */
  invalidate(key: string): void {
    store.delete(key);
  },

  /**
   * Invalidate all keys that start with a given prefix.
   * Useful for invalidating a group of related queries.
   *
   * Example: NuviaCache.invalidatePrefix('today:') clears all today-* keys.
   */
  invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /**
   * Check if a key exists and is still fresh (not stale).
   */
  isFresh(key: string): boolean {
    const entry = store.get(key);
    if (!entry) return false;
    return Date.now() <= entry.staleAt;
  },

  /** Clear the entire cache (use only on sign-out). */
  clear(): void {
    store.clear();
  },

  /** Expose the store size for debugging. */
  size(): number {
    return store.size;
  },
};

// ─── Convenience cache key builders ──────────────────────────────────────────

export function todaySummaryKey(userId: string | undefined, date: string) {
  return `today-summary:${userId ?? 'demo'}:${date}`;
}

export function todayMealsKey(userId: string | undefined, date: string) {
  return `today-meals:${userId ?? 'demo'}:${date}`;
}

export function todayActivityKey(userId: string | undefined, date: string) {
  return `today-activity:${userId ?? 'demo'}:${date}`;
}

export function allMealsKey(userId: string | undefined) {
  return `all-meals:${userId ?? 'demo'}`;
}

export function workoutRoutinesKey(userId: string | undefined) {
  return `workout-routines:${userId ?? 'demo'}`;
}

export function exerciseLogsKey(userId: string | undefined) {
  return `exercise-logs:${userId ?? 'demo'}`;
}

export function scheduleAdaptationsKey(userId: string | undefined) {
  return `schedule-adaptations:${userId ?? 'demo'}`;
}

export function adaptiveTrainingKey(userId: string | undefined) {
  return `adaptive-training:${userId ?? 'demo'}`;
}

