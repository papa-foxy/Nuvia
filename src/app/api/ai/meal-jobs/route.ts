import { after, NextRequest, NextResponse } from 'next/server';
import { analyzeMeal } from '@/lib/server/meal-analysis';
import { supabaseAdmin, userIdFromRequest } from '@/lib/server/supabase-admin';
import { loadPersonalContext, personalOptionsFromBody } from '@/lib/server/meal-personalization-request';

/** Gemini can take a while on big photos; after() runs within this limit. */
export const maxDuration = 60;

/** A job still "pending" after this long died with its function; report it as failed. */
const STALE_MS = 2 * 60_000;
const FAILED_MSG = "We couldn't analyze this right now. Please try again.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST — start analyzing a meal in the background. Returns { id } right away;
 *        the analysis keeps running on the server even if the app is closed.
 *        503 { fallback: true } means background jobs aren't available (no
 *        service role or table missing): the client analyzes directly instead.
 *        The client sends its own job id, so a re-sent upload (the app was
 *        closed mid-upload) never starts a second analysis.
 */
export async function POST(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const supabase = supabaseAdmin();
  if (!supabase) return NextResponse.json({ fallback: true }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body || (!body.imageBase64 && !body.textPrompt)) {
    return NextResponse.json({ error: 'Add a photo or a description' }, { status: 400 });
  }
  const params = {
    imageBase64: typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined,
    mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
    textPrompt: typeof body.textPrompt === 'string' ? body.textPrompt.slice(0, 2000) : undefined,
    mealType: typeof body.mealType === 'string' ? body.mealType : undefined,
  };

  const clientId = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : undefined;
  if (clientId) {
    const { data: existing, error: lookupError } = await supabase
      .from('meal_analysis_jobs')
      .select('id, user_id')
      .eq('id', clientId)
      .maybeSingle();
    if (lookupError) {
      console.warn('[meal-jobs] jobs table unavailable:', lookupError.message);
      return NextResponse.json({ fallback: true, reason: 'jobs-unavailable' }, { status: 503 });
    }
    if (existing) {
      // Already running or finished (re-sent upload): don't analyze twice.
      return existing.user_id === userId
        ? NextResponse.json({ id: existing.id })
        : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const { data: job, error } = await supabase
    .from('meal_analysis_jobs')
    .insert(clientId ? { id: clientId, user_id: userId } : { user_id: userId })
    .select('id')
    .single();
  if (error || !job) {
    console.warn('[meal-jobs] could not create job:', error?.message);
    return NextResponse.json({ fallback: true, reason: 'jobs-unavailable' }, { status: 503 });
  }

  after(async () => {
    let update: Record<string, unknown> = { status: 'failed', error: FAILED_MSG };
    try {
      // The user's usual items and past corrections (e.g. their daily latte).
      const personalContext = await loadPersonalContext(supabase, userId, personalOptionsFromBody(body));
      update = { status: 'done', result: await analyzeMeal({ ...params, personalContext }) };
    } catch (err) {
      console.warn('[meal-jobs] analysis failed:', err);
      update = { status: 'failed', error: err instanceof Error && err.message ? err.message : FAILED_MSG };
    } finally {
      await supabase
        .from('meal_analysis_jobs')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    // Housekeeping: drop this user's jobs older than a day.
    await supabase
      .from('meal_analysis_jobs')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', new Date(Date.now() - 86_400_000).toISOString());
  });

  return NextResponse.json({ id: job.id });
}

/** GET ?id= — the job's status and, when done, its result. */
export async function GET(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const supabase = supabaseAdmin();
  const id = request.nextUrl.searchParams.get('id');
  if (!supabase || !id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await supabase
    .from('meal_analysis_jobs')
    .select('id, status, result, error, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (data.status === 'pending' && Date.now() - new Date(data.created_at).getTime() > STALE_MS) {
    return NextResponse.json({ id: data.id, status: 'failed', error: FAILED_MSG });
  }
  return NextResponse.json({ id: data.id, status: data.status, result: data.result, error: data.error });
}

/** DELETE ?id= — the client has shown the result; forget the job. */
export async function DELETE(request: NextRequest) {
  const userId = await userIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const supabase = supabaseAdmin();
  const id = request.nextUrl.searchParams.get('id');
  if (supabase && id) {
    await supabase.from('meal_analysis_jobs').delete().eq('id', id).eq('user_id', userId);
  }
  return NextResponse.json({ ok: true });
}
