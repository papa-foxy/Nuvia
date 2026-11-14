'use client';

/**
 * Runs meal-photo analysis so it survives closing the sheet or the whole app.
 *
 * Background mode (signed in, meal_analysis_jobs table set up): the job id is
 * created here and saved before anything is sent, then the server analyzes
 * the photo in the background (/api/ai/meal-jobs) and keeps going after the
 * app is closed. Reopening Nuvia polls that same id; if the upload never
 * reached the server, it is sent again with the same id (never analyzed twice).
 *
 * Fallback mode (demo, or background jobs unavailable): the analysis runs from
 * the browser, so Nuvia must stay open; the UI says so. If iOS cuts the
 * request off, it is retried when the app comes back instead of failing.
 */
import { useSyncExternalStore } from 'react';
import type { MealAnalysisResult } from './ai-service';
import { createClient, isSupabaseConfigured } from './supabase/client';

export type MealAnalysisStatus = 'idle' | 'analyzing' | 'done' | 'failed';

export interface MealAnalysisState {
  status: MealAnalysisStatus;
  /** Job id (created on this device). */
  jobId: string | null;
  /** 'server' = keeps running when the app closes; 'browser' = Nuvia must stay open. */
  mode: 'server' | 'browser' | null;
  /** True once the server has accepted the job. */
  submitted: boolean;
  mealType: string;
  textPrompt?: string;
  image: string | null;
  startedAt: number;
  result?: MealAnalysisResult;
  error?: string;
}

const STORAGE_KEY = 'nuvia_meal_analysis';
const POLL_MS = 2500;
/** Give up only after this long without any answer from the server while the app is open. */
const GIVE_UP_MS = 10 * 60_000;
const FAILED_MSG = "We couldn't analyze this right now. Please try again.";

const IDLE: MealAnalysisState = {
  status: 'idle',
  jobId: null,
  mode: null,
  submitted: false,
  mealType: 'lunch',
  image: null,
  startedAt: 0,
};

let state: MealAnalysisState = IDLE;
let loaded = false;
let busySince = 0; // when a submit / browser request started (0 = none)
let browserAttempts = 0;
/** iOS can leave a request hanging forever after suspending the app. */
const BUSY_STALE_MS = 45_000;
const isBusy = () => busySince > 0 && Date.now() - busySince < BUSY_STALE_MS;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let lastAnswerAt = 0;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...IDLE, ...(JSON.parse(raw) as MealAnalysisState) };
  } catch {
    /* ignore */
  }
}

function persist() {
  try {
    if (state.status === 'idle') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full: keep the job without the photo.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, image: null }));
    }
  } catch {
    /* storage unavailable */
  }
}

function set(patch: Partial<MealAnalysisState>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

const fail = (error = FAILED_MSG) => set({ status: 'failed', error });

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function accessToken(forceRefresh = false): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const auth = createClient().auth;
    if (forceRefresh) {
      const { data } = await auth.refreshSession();
      return data.session?.access_token ?? null;
    }
    const { data } = await auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

function schedulePoll(delay = POLL_MS) {
  stopPolling();
  pollTimer = setTimeout(() => void poll(), delay);
}

/** "Fri 8:12am": lets the AI match items to the user's usual time of day. */
function localTimeLabel(d = new Date()): string {
  return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(/[  ]/g, ' ').toLowerCase();
}

const body = () =>
  JSON.stringify({
    id: state.jobId,
    imageBase64: state.image || undefined,
    mimeType: 'image/jpeg',
    textPrompt: state.textPrompt,
    mealType: state.mealType,
    localTime: localTimeLabel(new Date(state.startedAt || Date.now())),
    tzOffset: -new Date().getTimezoneOffset(),
  });

/** Sends the job to the server (again, if a previous upload was cut off). */
async function submit() {
  if (isBusy() || state.status !== 'analyzing') return;
  const { jobId } = state;
  busySince = Date.now();
  try {
    let token = await accessToken();
    if (!token) {
      await runInBrowser();
      return;
    }
    let res = await fetch('/api/ai/meal-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body(),
    });
    if (res.status === 401 && (token = await accessToken(true))) {
      res = await fetch('/api/ai/meal-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body(),
      });
    }
    if (state.jobId !== jobId) return; // replaced by a newer analysis
    if (res.ok) {
      lastAnswerAt = Date.now();
      set({ mode: 'server', submitted: true });
      schedulePoll();
      return;
    }
    if (res.status === 503 || res.status === 401) {
      // Background jobs aren't available (e.g. table not set up): analyze here.
      busySince = 0;
      await runInBrowser();
      return;
    }
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    fail(err?.error);
  } catch {
    // Upload cut off (app closed or offline). It's sent again on resume.
    if (state.jobId === jobId && isVisible()) schedulePoll(4000);
  } finally {
    busySince = 0;
  }
}

async function poll() {
  const { jobId } = state;
  if (state.status !== 'analyzing' || !jobId || state.mode === 'browser') return;
  if (!state.submitted) {
    void submit();
    return;
  }
  let token = await accessToken();
  try {
    const url = `/api/ai/meal-jobs?id=${encodeURIComponent(jobId)}`;
    let res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
    if (res.status === 401 && (token = await accessToken(true))) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    }
    if (state.jobId !== jobId) return;
    if (res.ok) {
      lastAnswerAt = Date.now();
      const job = (await res.json()) as { status: string; result?: MealAnalysisResult; error?: string };
      if (job.status === 'done' && job.result) {
        set({ status: 'done', result: job.result });
        void fetch(`/api/ai/meal-jobs?id=${encodeURIComponent(jobId)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => undefined);
        return;
      }
      if (job.status === 'failed') {
        fail(job.error);
        return;
      }
    } else if (res.status === 404) {
      // The server has no such job (upload lost): send it again with the same id.
      if (state.image || state.textPrompt) {
        set({ submitted: false });
        void submit();
      } else {
        fail();
      }
      return;
    }
  } catch {
    /* offline or app suspended: try again */
  }
  if (isVisible() && lastAnswerAt && Date.now() - lastAnswerAt > GIVE_UP_MS) {
    fail();
    return;
  }
  if (isVisible()) schedulePoll();
}

/** Browser-side analysis: only while Nuvia stays open. */
async function runInBrowser() {
  if (isBusy() && state.mode === 'browser') return;
  const { jobId } = state;
  busySince = Date.now();
  browserAttempts++;
  set({ mode: 'browser' });
  try {
    // Signed in: the server adds this user's usual items and corrections.
    const token = await accessToken();
    const res = await fetch('/api/ai/analyze-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body(),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: MealAnalysisResult; error?: string } | null;
    if (state.jobId !== jobId || state.status !== 'analyzing') return;
    if (res.ok && json?.success && json.data) set({ status: 'done', result: json.data });
    else fail(json?.error);
  } catch {
    // iOS cut the request off when the app was closed: try once more (now if
    // the app is open, otherwise when it comes back) before showing an error.
    if (state.jobId === jobId) {
      if (browserAttempts >= 3) fail();
      else if (isVisible()) setTimeout(() => void runInBrowser(), 1500);
    }
  } finally {
    busySince = 0;
  }
}

export const MealAnalysisRunner = {
  start(params: { image: string | null; textPrompt?: string; mealType: string }) {
    load();
    stopPolling();
    busySince = 0;
    browserAttempts = 0;
    lastAnswerAt = Date.now();
    // Saved (with its id) before anything is sent, so a closed app can resume it.
    state = {
      ...IDLE,
      status: 'analyzing',
      jobId: newId(),
      mealType: params.mealType,
      textPrompt: params.textPrompt,
      image: params.image,
      startedAt: Date.now(),
    };
    persist();
    listeners.forEach((l) => l());
    void submit();
  },

  /** Picks up an analysis left running when the app was closed or backgrounded. */
  resume() {
    load();
    listeners.forEach((l) => l());
    if (state.status !== 'analyzing' || isBusy()) return;
    lastAnswerAt = lastAnswerAt || Date.now();
    if (state.mode === 'browser') void runInBrowser();
    else void poll();
  },

  retry() {
    if (state.status === 'idle') return;
    this.start({ image: state.image, textPrompt: state.textPrompt, mealType: state.mealType });
  },

  clear() {
    stopPolling();
    busySince = 0;
    state = IDLE;
    persist();
    listeners.forEach((l) => l());
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMealAnalysis(): MealAnalysisState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => IDLE,
  );
}
