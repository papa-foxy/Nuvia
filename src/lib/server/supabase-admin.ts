/**
 * Server-only Supabase helpers for API routes.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Service-role client (bypasses RLS). Never expose to the browser. */
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Returns the signed-in user's id from `Authorization: Bearer <Supabase access
 * token>` (the browser session), or null.
 */
export async function userIdFromRequest(request: Request): Promise<string | null> {
  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!jwt || !url || !anonKey) return null;
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}
