'use client';

/**
 * Runs meal-photo analysis so it survives closing the sheet or the whole app.
 *
 * Signed in: the server runs the analysis as a background job
 * (/api/ai/meal-jobs) and keeps going after the app is closed; we only poll
 * for the result. The pending job (and the photo, for the result screen) is
 * kept in localStorage, so reopening Nuvia picks it up again.
 *
 * Demo / no server jobs: the analysis runs from the browser, and if the app is
 * closed mid-way it simply restarts on the next launch.
 */
import { useSyncExternalStore } from 'react';
import { AiService, type MealAnalysisResult } from './ai-service';
import { createClient, isSupabaseConfigured } from './supabase/client';

export type MealAnalysisStatus = 'idle' | 'analyzing' | 'done' | 'failed';

export interface MealAnalysisState {
  status: MealAnalysisStatus;
  /** Server job id; null when the analysis runs from the browser. */
  jobId: string | null;
  mealType: string;
  textPrompt?: string;
  image: string | null;
  startedAt: number;
  result?: MealAnalysisResult;
  error?: string;
}

const STORAGE_KEY = 'nuvia_meal_analysis';
const POLL_MS = 2500;
/** Give up polling a job after this long (the server itself stops at ~60 s). */
const GIVE_UP_MS = 3 * 60_000;
const FAILED_MSG = "We couldn't analyze this right now. Please try again.";

const IDLE: MealAnalysisState = { status: 'idle', jobId: null, mealType: 'lunch', image: null, startedAt: 0 };

let state: MealAnalysisState = IDLE;
let loaded = false;
let running = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
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

function set(next: MealAnalysisState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

async function accessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

function schedulePoll(delay = POLL_MS) {
  stopPolling();
  pollTimer = setTimeout(() => void poll(), delay);
}

async function poll() {
  const { jobId, startedAt } = state;
  if (state.status !== 'analyzing' || !jobId) return;
  const token = await accessToken();
  try {
    const res = await fetch(`/api/ai/meal-jobs?id=${encodeURIComponent(jobId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (state.jobId !== jobId) return; // a newer analysis replaced this one
    if (res.status === 404) {
      set({ ...state, status: 'failed', error: FAILED_MSG });
      return;
    }
    if (res.ok) {
      const job = (await res.json()) as { status: string; result?: MealAnalysisResult; error?: string };
      if (job.status === 'done' && job.result) {
        set({ ...state, status: 'done', result: job.result });
        void fetch(`/api/ai/meal-jobs?id=${encodeURIComponent(jobId)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => undefined);
        return;
      }
      if (job.status === 'failed') {
        set({ ...state, status: 'failed', error: job.error || FAILED_MSG });
        return;
      }
    }
  } catch {
    /* offline or app suspended: try again */
  }
  if (Date.now() - startedAt > GIVE_UP_MS) {
    set({ ...state, status: 'failed', error: FAILED_MSG });
    return;
  }
  schedulePoll();
}

/** Browser-side analysis (demo mode, or when background jobs are unavailable). */
async function runLocally() {
  if (running) return;
  running = true;
  const startedAt = state.startedAt;
  try {
    const result = await AiService.analyzeMeal({
      imageBase64: state.image || undefined,
      mimeType: 'image/jpeg',
      textPrompt: state.textPrompt,
      mealType: state.mealType,
    });
    if (state.startedAt === startedAt && state.status === 'analyzing') set({ ...state, status: 'done', result });
  } catch (err) {
    if (state.startedAt === startedAt && state.status === 'analyzing') {
      set({ ...state, status: 'failed', error: err instanceof Error ? err.message : FAILED_MSG });
    }
  } finally {
    running = false;
  }
}

async function begin() {
  const token = await accessToken();
  const startedAt = state.startedAt;
  if (token) {
    try {
      const res = await fetch('/api/ai/meal-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          imageBase64: state.image || undefined,
          mimeType: 'image/jpeg',
          textPrompt: state.textPrompt,
          mealType: state.mealType,
        }),
      });
      if (state.startedAt !== startedAt) return;
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        set({ ...state, jobId: id });
        schedulePoll();
        return;
      }
    } catch {
      /* fall through to browser-side analysis */
    }
    if (state.startedAt !== startedAt) return;
  }
  await runLocally();
}

export const MealAnalysisRunner = {
  start(params: { image: string | null; textPrompt?: string; mealType: string }) {
    load();
    stopPolling();
    set({
      status: 'analyzing',
      jobId: null,
      mealType: params.mealType,
      textPrompt: params.textPrompt,
      image: params.image,
      startedAt: Date.now(),
    });
    void begin();
  },

  /** Picks up an analysis left running when the app was closed or backgrounded. */
  resume() {
    load();
    if (state.status !== 'analyzing') {
      listeners.forEach((l) => l());
      return;
    }
    if (state.jobId) void poll();
    else void runLocally();
  },

  retry() {
    if (state.status === 'idle') return;
    this.start({ image: state.image, textPrompt: state.textPrompt, mealType: state.mealType });
  },

  clear() {
    stopPolling();
    set(IDLE);
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
