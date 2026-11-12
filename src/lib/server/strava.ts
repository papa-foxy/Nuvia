/**
 * Server-only Strava API client.
 * Docs: https://developers.strava.com/docs/authentication/ and /docs/webhooks/
 *
 * Env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN.
 * Tokens live in public.strava_connections (server-only table, see
 * supabase/migrations/20261112_strava_connections.sql).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeType } from '@/lib/health-workout-parse';
import type { IngestWorkout } from './activity-ingest';

const OAUTH = 'https://www.strava.com/oauth';
const API = 'https://www.strava.com/api/v3';
/** Read every activity incl. "Only You" ones; activity:read* also enables webhooks. */
export const STRAVA_SCOPE = 'read,activity:read_all';

export interface StravaConfig {
  clientId: string;
  clientSecret: string;
  verifyToken: string;
}

export function stravaConfig(): StravaConfig | null {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!clientId || !clientSecret || !verifyToken) return null;
  return { clientId, clientSecret, verifyToken };
}

/* ── OAuth state: signed { user id, expiry } so the callback knows who connected ── */

function stateKey(): string | null {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return base ? createHmac('sha256', base).update('nuvia-strava-oauth-state').digest('hex') : null;
}

export function createOAuthState(userId: string): string | null {
  const key = stateKey();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: Date.now() + 15 * 60_000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

export function verifyOAuthState(state: string | null): string | null {
  const key = stateKey();
  if (!state || !key) return null;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(createHmac('sha256', key).update(payload).digest('base64url'));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; exp: number };
    return typeof u === 'string' && Date.now() < exp ? u : null;
  } catch {
    return null;
  }
}

export function authorizeUrl(cfg: StravaConfig, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${q}`;
}

/* ── Tokens ─────────────────────────────────────────────────────────────── */

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function tokenRequest(cfg: StravaConfig, params: Record<string, string>): Promise<StravaTokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status})`);
  return (await res.json()) as StravaTokenResponse;
}

export const exchangeCode = (cfg: StravaConfig, code: string) =>
  tokenRequest(cfg, { code, grant_type: 'authorization_code' });

export interface StravaConnection {
  user_id: string;
  athlete_id: number;
  athlete_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  last_sync_at: string | null;
}

/**
 * Returns a usable access token, refreshing it when it expires within a
 * minute. Strava rotates refresh tokens, so the new pair is saved right away.
 */
export async function validAccessToken(
  supabase: SupabaseClient,
  cfg: StravaConfig,
  conn: StravaConnection,
): Promise<string> {
  if (conn.expires_at - 60 > Date.now() / 1000) return conn.access_token;
  const t = await tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: conn.refresh_token });
  await supabase
    .from('strava_connections')
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: t.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conn.user_id);
  conn.access_token = t.access_token;
  conn.refresh_token = t.refresh_token;
  conn.expires_at = t.expires_at;
  return t.access_token;
}

export async function deauthorize(accessToken: string): Promise<void> {
  await fetch(`${OAUTH}/deauthorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken }),
  }).catch(() => undefined);
}

/* ── Activities ─────────────────────────────────────────────────────────── */

export interface StravaActivity {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date: string;
  start_date_local?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  kilojoules?: number;
  calories?: number;
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) throw new Error('Strava rate limit reached. Try again in 15 minutes.');
  if (!res.ok) throw new Error(`Strava request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Activities that started after `afterEpoch` (seconds), newest pages capped at 200 items. */
export async function listActivitiesSince(token: string, afterEpoch: number): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await apiGet<StravaActivity[]>(token, `/athlete/activities?after=${afterEpoch}&per_page=50&page=${page}`);
    all.push(...batch);
    if (batch.length < 50) break;
  }
  return all;
}

export const getActivity = (token: string, id: number | string) => apiGet<StravaActivity>(token, `/activities/${id}`);

/** Strava sport types are CamelCase ("TrailRun", "WeightTraining"). */
function stravaType(a: StravaActivity): string {
  const raw = a.sport_type || a.type || 'Workout';
  const normalized = normalizeType(raw);
  return normalized === raw ? raw.replace(/([a-z])([A-Z])/g, '$1 $2') : normalized;
}

export function activityToWorkout(a: StravaActivity): IngestWorkout | null {
  const seconds = a.moving_time || a.elapsed_time || 0;
  if (seconds <= 0 || !a.start_date) return null;
  const start = new Date(a.start_date);
  if (Number.isNaN(start.getTime())) return null;
  // Strava reports calories on detailed activities; for rides kJ of work ≈ kcal burned.
  const calories = a.calories && a.calories > 0 ? a.calories : a.kilojoules && a.kilojoules > 0 ? a.kilojoules : null;
  return {
    externalId: `strava:${a.id}`,
    type: stravaType(a),
    source: 'Strava',
    startIso: start.toISOString(),
    localDate: (a.start_date_local || a.start_date).slice(0, 10),
    durationMin: Math.round((seconds / 60) * 10) / 10,
    distanceKm: a.distance && a.distance > 0 ? Math.round((a.distance / 1000) * 100) / 100 : null,
    caloriesReported: calories === null ? null : Math.round(calories),
    importSource: 'strava',
    extra: { strava_activity_id: a.id, strava_name: a.name ?? null },
  };
}

/* ── Webhook subscription (one per app) ─────────────────────────────────── */

/**
 * Makes sure Strava pushes new activities to `callbackUrl`. Strava validates
 * the URL by calling it (GET), so this only works on a public deployment.
 */
export async function ensureWebhookSubscription(cfg: StravaConfig, callbackUrl: string): Promise<'exists' | 'created' | 'skipped'> {
  if (/localhost|127\.0\.0\.1/.test(callbackUrl)) return 'skipped';
  const q = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret });
  const list = await fetch(`${API}/push_subscriptions?${q}`).then((r) => (r.ok ? r.json() : []));
  if (Array.isArray(list) && list.length > 0) return 'exists';
  const res = await fetch(`${API}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      callback_url: callbackUrl,
      verify_token: cfg.verifyToken,
    }),
  });
  if (!res.ok) throw new Error(`Strava webhook subscription failed (${res.status}): ${await res.text()}`);
  return 'created';
}
