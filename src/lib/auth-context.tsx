'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, Goal } from '@/types/database';
import { createClient, isSupabaseConfigured } from './supabase/client';
import { DataService } from './data-service';
import { NuviaCache } from './nuvia-cache';

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

  useEffect(() => {
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    async function initAuth() {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nuvia_is_demo');
      }

      try {
        if (isSupabaseConfigured()) {
          const supabase = createClient();

          // Race Supabase getSession against a 5s timeout so the app never hangs
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise<{ data: { session: null } }>((resolve) =>
              setTimeout(() => resolve({ data: { session: null } }), 5000)
            ),
          ]);

          const session = sessionResult.data.session;

          if (session?.user) {
            const avatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
            const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || null;
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              avatar_url: avatar,
              full_name: fullName,
            });
            const [p, g] = await Promise.all([
              DataService.getProfile(session.user.id),
              DataService.getGoals(session.user.id),
            ]);
            setProfile(p);
            setGoals(g);
          } else {
            setUser(null);
            setProfile(null);
            setGoals(null);
          }

          // Listen to real-time auth changes
          const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
              const avatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
              const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || null;
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                avatar_url: avatar,
                full_name: fullName,
              });
              const [p, g] = await Promise.all([
                DataService.getProfile(session.user.id),
                DataService.getGoals(session.user.id),
              ]);
              setProfile(p);
              setGoals(g);
            } else {
              setUser(null);
              setProfile(null);
              setGoals(null);
            }
          });

          authListener = listener;
        } else {
          setUser(null);
          setProfile(null);
          setGoals(null);
        }
      } catch (err) {
        // If anything throws (network error, etc.), still clear the loader
        console.warn('[Auth] initAuth error:', err);
        setUser(null);
        setProfile(null);
        setGoals(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

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
      setUser({ id: data.user.id, email: data.user.email || email });
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

      setUser({ id: verifiedUser.id, email: verifiedUser.email || email });

      let existingProfile = await DataService.getProfile(verifiedUser.id);
      if (!existingProfile) {
        const newProf: Profile = {
          id: verifiedUser.id,
          name: name || (verifiedUser.user_metadata?.name as string) || '',
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
    }
    // Clear all cached data so a new login doesn't see stale user data
    NuviaCache.clear();
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
