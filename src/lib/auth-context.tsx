'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, Goal } from '@/types/database';
import { createClient, isSupabaseConfigured } from './supabase/client';
import { DataService } from './data-service';
import { NuviaCache } from './nuvia-cache';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  avatar_url?: string | null;
  full_name?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  goals: Goal | null;
  isLoading: boolean;
  isDemo: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<{ error?: string }>;
  sendOtp: (
    email: string,
    name?: string,
    password?: string,
    type?: 'signup' | 'reset_password'
  ) => Promise<{ success: boolean; error?: string; devOtp?: string; verificationType?: string; emailDelivered?: boolean }>;
  verifyOtp: (email: string, token: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfileAndGoals: () => Promise<void>;
  hasCompletedOnboarding: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ── Saved session snapshot (this device only) ───────────────────────────── */

const SNAPSHOT_KEY = 'nuvia_auth_snapshot';

interface AuthSnapshot {
  user: User;
  profile: Profile | null;
  goals: Goal | null;
}

function readAuthSnapshot(): AuthSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const snap = raw ? (JSON.parse(raw) as AuthSnapshot) : null;
    return snap?.user?.id ? snap : null;
  } catch {
    return null;
  }
}

function writeAuthSnapshot(snap: AuthSnapshot) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* storage full or unavailable */
  }
}

function clearAuthSnapshot() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDemo = false;

  const refreshProfileAndGoals = async () => {
    if (!user) {
      setProfile(null);
      setGoals(null);
      return;
    }
    const p = await DataService.getProfile(user.id);
    const g = await DataService.getGoals(user.id);
    setProfile(p);
    setGoals(g);
  };

  // Remember who was signed in, so a relaunch (iOS often discards a PWA in the
  // background) can show the app right away instead of the splash screen.
  useEffect(() => {
    if (isLoading) return;
    if (user) writeAuthSnapshot({ user, profile, goals });
    else clearAuthSnapshot();
  }, [isLoading, user, profile, goals]);

  useEffect(() => {
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    let currentUserId: string | null = null;
    let cancelled = false;

    const toUser = (u: SupabaseAuthUser): User => ({
      id: u.id,
      email: u.email || '',
      avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
      full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
    });

    // Keep the same object when nothing changed, so screens that depend on
    // `user` don't refetch everything after a silent token refresh.
    const applyUser = (next: User) =>
      setUser((prev) =>
        prev &&
        prev.id === next.id &&
        prev.email === next.email &&
        prev.avatar_url === next.avatar_url &&
        prev.full_name === next.full_name
          ? prev
          : next,
      );

    const loadProfileAndGoals = async (userId: string) => {
      const [p, g] = await Promise.all([DataService.getProfile(userId), DataService.getGoals(userId)]);
      if (cancelled || currentUserId !== userId) return;
      setProfile(p);
      setGoals(g);
    };

    const signedOut = () => {
      currentUserId = null;
      setUser(null);
      setProfile(null);
      setGoals(null);
    };

    async function initAuth() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nuvia_is_demo');
      }

      // 1. Instant start from the last session on this device.
      const snapshot = readAuthSnapshot();
      if (snapshot && isSupabaseConfigured()) {
        currentUserId = snapshot.user.id;
        setUser(snapshot.user);
        setProfile(snapshot.profile);
        setGoals(snapshot.goals);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      // 2. Confirm the session (and refresh profile/goals) in the background.
      try {
        if (isSupabaseConfigured()) {
          const supabase = createClient();

          // Race getSession against a timeout so the app never hangs. A
          // timeout with a saved session keeps the user signed in.
          const TIMEOUT = Symbol('timeout');
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 5000)),
          ]);
          if (cancelled) return;

          if (sessionResult === TIMEOUT) {
            if (!snapshot) signedOut();
          } else if (sessionResult.data.session?.user) {
            const sessionUser = sessionResult.data.session.user;
            currentUserId = sessionUser.id;
            applyUser(toUser(sessionUser));
            if (snapshot && snapshot.user.id === sessionUser.id) {
              void loadProfileAndGoals(sessionUser.id); // refresh without blocking
            } else {
              await loadProfileAndGoals(sessionUser.id);
            }
          } else {
            signedOut();
          }

          // Auth changes. Token refreshes (common when the app returns from
          // the background) keep the same user, so nothing is refetched.
          const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              const sameUser = session.user.id === currentUserId;
              currentUserId = session.user.id;
              applyUser(toUser(session.user));
              if (!sameUser) void loadProfileAndGoals(session.user.id);
            } else {
              signedOut();
            }
          });

          authListener = listener;
        } else {
          signedOut();
        }
      } catch (err) {
        // If anything throws (network error, etc.), still clear the loader
        console.warn('[Auth] initAuth error:', err);
        if (!snapshot) signedOut();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase authentication service is not configured.' };
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      return { error: error.message };
    }
    return {};
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase authentication service is not configured.' };
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      return { error: error.message };
    }
    if (data.user) {
      const avatar =
        data.user.user_metadata?.avatar_url ||
        data.user.user_metadata?.picture ||
        data.user.identities?.[0]?.identity_data?.avatar_url ||
        data.user.identities?.[0]?.identity_data?.picture ||
        null;
      const fullName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        null;
      setUser({
        id: data.user.id,
        email: data.user.email || email,
        avatar_url: avatar,
        full_name: fullName,
      });
      const p = await DataService.getProfile(data.user.id);
      const g = await DataService.getGoals(data.user.id);
      setProfile(p);
      setGoals(g);
    }
    return {};
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase authentication service is not configured.' };
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { name: name || '' },
      },
    });
    if (error) {
      return { error: error.message };
    }
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email || email });
      // Create blank profile
      const newProf: Profile = {
        id: data.user.id,
        name: name || '',
        date_of_birth: null,
        sex: null,
        height_cm: null,
        weight_kg: null,
        activity_level: null,
        goal: null,
        target_weight_kg: null,
        dietary_preference: null,
        allergies: [],
      };
      await DataService.saveProfile(newProf);
      setProfile(newProf);
      setGoals(null);
    }
    return {};
  };

  const sendOtp = async (
    email: string,
    name?: string,
    password?: string,
    type: 'signup' | 'reset_password' = 'signup'
  ) => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, type }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to send verification code.' };
      }
      return {
        success: true,
        devOtp: data.devOtp,
        verificationType: data.verificationType,
        emailDelivered: data.emailDelivered,
      };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to reset password.' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const verifyOtp = async (
    email: string,
    token: string,
    name?: string,
  ) => {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase authentication service is not configured.' };
      }

      // 1. Verify 6-digit code via our dedicated route
      const apiRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: token, name }),
      });

      const resData = await apiRes.json();

      if (!apiRes.ok || resData.error) {
        return { success: false, error: resData.error || 'Invalid or expired 6-digit OTP code.' };
      }

      const supabase = createClient();

      if (resData.session) {
        await supabase.auth.setSession({
          access_token: resData.session.access_token,
          refresh_token: resData.session.refresh_token,
        });
      }

      const verifiedUser = resData.user || (await supabase.auth.getUser()).data.user;

      if (!verifiedUser) {
        return { success: false, error: 'Failed to retrieve authenticated user session.' };
      }

      const avatar =
        verifiedUser.user_metadata?.avatar_url ||
        verifiedUser.user_metadata?.picture ||
        verifiedUser.identities?.[0]?.identity_data?.avatar_url ||
        verifiedUser.identities?.[0]?.identity_data?.picture ||
        null;
      const fullName =
        verifiedUser.user_metadata?.full_name ||
        verifiedUser.user_metadata?.name ||
        name ||
        null;

      setUser({
        id: verifiedUser.id,
        email: verifiedUser.email || email,
        avatar_url: avatar,
        full_name: fullName,
      });

      let existingProfile = await DataService.getProfile(verifiedUser.id);
      if (!existingProfile) {
        const newProf: Profile = {
          id: verifiedUser.id,
          name: fullName || '',
          avatar_url: avatar,
          date_of_birth: null,
          sex: null,
          height_cm: null,
          weight_kg: null,
          activity_level: null,
          goal: null,
          target_weight_kg: null,
          dietary_preference: null,
          allergies: [],
        };
        await DataService.saveProfile(newProf);
        existingProfile = newProf;
      }
      setProfile(existingProfile);

      const existingGoals = await DataService.getGoals(verifiedUser.id);
      setGoals(existingGoals);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'OTP verification failed.' };
    }
  };


  const signOut = async () => {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nuvia_is_demo');
      // Clean up localStorage routines belonging to logged-in users so next user doesn't see them
      try {
        const stored = localStorage.getItem('nuvia_storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.workoutRoutines) {
            parsed.workoutRoutines = parsed.workoutRoutines.filter(
              (r: any) => r.user_id === 'demo-user-001' || !r.user_id
            );
            localStorage.setItem('nuvia_storage', JSON.stringify(parsed));
          }
        }
      } catch {}
    }
    // Clear all cached data so a new login doesn't see stale user data
    NuviaCache.clear();
    clearAuthSnapshot();
    setUser(null);
    setProfile(null);
    setGoals(null);
  };

  const hasCompletedOnboarding = Boolean(
    profile?.height_cm && profile?.weight_kg && profile?.goal && goals?.calorie_target
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        goals,
        isLoading,
        isDemo,
        signInWithEmail,
        signInWithGoogle,
        signUpWithEmail,
        sendOtp,
        verifyOtp,
        resetPassword,
        signOut,
        refreshProfileAndGoals,
        hasCompletedOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
