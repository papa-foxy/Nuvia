'use client';

import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'nuvia_theme';
const EVENT = 'nuvia-theme-change';

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function apply(pref: ThemePreference) {
  document.documentElement.setAttribute('data-theme', resolve(pref));
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* storage unavailable: still apply for this session */
  }
  apply(pref);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: pref }));
}

/** Current preference + setter; follows OS changes while set to 'system'. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    const sync = () => {
      const p = readPreference();
      setPreference(p);
      setResolved(resolve(p));
      apply(p);
    };
    sync();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { preference, resolved, setTheme: setThemePreference };
}
