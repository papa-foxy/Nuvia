/**
 * Personal Health Sync keys (server only).
 *
 * A key is "<userId>.<signature>", where the signature is an HMAC of the user
 * id. Nothing is stored: the server re-computes the signature to verify a key.
 * A key can only ADD workouts to its own user's account; it cannot read data.
 *
 * Signing secret: HEALTH_SYNC_SECRET if set, otherwise derived from
 * SUPABASE_SERVICE_ROLE_KEY. Changing either invalidates every issued key.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';

function signingKey(): string | null {
  const explicit = process.env.HEALTH_SYNC_SECRET;
  if (explicit) return explicit;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return null;
  return createHmac('sha256', service).update('nuvia-health-sync-key').digest('hex');
}

function sign(userId: string, key: string): string {
  return createHmac('sha256', key).update(`${VERSION}:${userId}`).digest('base64url');
}

export function createHealthSyncToken(userId: string): string | null {
  const key = signingKey();
  if (!key) return null;
  return `${userId}.${sign(userId, key)}`;
}

/** Returns the user id for a valid key, otherwise null. */
export function verifyHealthSyncToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const key = signingKey();
  if (!key) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId, key));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  // Supabase auth ids are UUIDs
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  return userId;
}
