'use client';

import React, { useState } from 'react';
import {
  User,
  Target,
  Sliders,
  Shield,
  LogOut,
  ChevronRight,
  Info,
  X,
  Lock,
  SunMoon,
} from 'lucide-react';
import { useTheme, ThemePreference } from '@/lib/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

interface ProfileSettingsSectionProps {
  onSignOut: () => void;
}

export function ProfileSettingsSection({
  onSignOut,
}: ProfileSettingsSectionProps) {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const { preference, setTheme } = useTheme();

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted uppercase tracking-wider px-1">
        Preferences & Account
      </span>

      <div className="ios-card divide-y divide-fg/[0.05] overflow-hidden text-xs">

        {/* Appearance */}
        <div className="p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
              <SunMoon className="w-3.5 h-3.5" />
            </div>
            <span className="text-fg font-medium">Appearance</span>
          </div>
          <div
            role="radiogroup"
            aria-label="Appearance"
            className="flex items-center p-0.5 rounded-lg bg-fg/[0.06]"
          >
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={preference === opt.value}
                onClick={() => setTheme(opt.value)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  preference === opt.value
                    ? 'bg-card text-fg shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Units */}
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-ink flex items-center justify-center shrink-0">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <span className="text-fg font-medium">Measurement Units</span>
          </div>
          <span className="text-zinc-400 font-semibold">Metric (kg, cm, kcal)</span>
        </div>

        {/* Privacy & Stored Data */}
        <button
          type="button"
          onClick={() => setIsPrivacyModalOpen(true)}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-fg/[0.02] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-fg font-medium">Privacy & Data Security</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted" />
        </button>

        {/* Sign Out (Red Destructive Row) */}
        <button
          type="button"
          onClick={onSignOut}
          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-red-500/[0.05] transition-colors group text-red-ink"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-red-500/15 text-red-ink flex items-center justify-center shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold">Sign Out of Nuvia</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-ink/60" />
        </button>
      </div>

      {/* PRIVACY & DATA MODAL */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-card border-t sm:border border-fg/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-fg/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">Privacy & Data Storage</h3>
                  <p className="text-[11px] text-muted">How your health records are handled</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-fg/5 hover:bg-fg/10 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                <strong className="text-fg">Offline-First Architecture:</strong> Nuvia caches your daily nutrition, weight, and workout logs directly on your device. This guarantees instant tab navigation and seamless offline functionality.
              </p>
              <p>
                <strong className="text-fg">Encrypted Cloud Sync:</strong> When signed in, records sync securely to your private Supabase database protected with strict Row Level Security (RLS). Only your authenticated session can access your logs.
              </p>
              <p>
                <strong className="text-fg">AI Safety:</strong> Nuvia does not sell or share your biometric data. AI models only process anonymous context when you explicitly request a meal breakdown or workout recommendation.
              </p>
            </div>

            <div className="pt-2 border-t border-fg/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-fg/10 hover:bg-fg/15 text-fg text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
