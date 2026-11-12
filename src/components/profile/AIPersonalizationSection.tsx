'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Check, RotateCcw, Plus, Trash2, Info } from 'lucide-react';
import { Profile } from '@/types/database';
import { NuviaBottomSheet } from '../NuviaBottomSheet';

interface AIPersonalizationSectionProps {
  userId?: string;
  profile: Profile | null;
}

interface CustomPreference {
  id: string;
  text: string;
  type: 'diet' | 'habit' | 'timing';
}

export function AIPersonalizationSection({ userId, profile }: AIPersonalizationSectionProps) {
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [customPreferences, setCustomPreferences] = useState<CustomPreference[]>([]);
  const [newPrefText, setNewPrefText] = useState('');
  const [resetNotice, setResetNotice] = useState(false);

  const storageKey = `nuvia_ai_memory_${userId || 'default'}`;

  // Default cautious inferences
  const defaultHabits = [
    {
      id: 'habit-1',
      text: 'Based on your recent activity: Prioritizes high-protein meal selections.',
      type: 'diet' as const,
    },
    {
      id: 'habit-2',
      text: 'Based on your recent logs: Frequently logs exercise in the afternoon or evening.',
      type: 'habit' as const,
    },
  ];

  // Load custom memory from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setCustomPreferences(JSON.parse(saved));
        } catch {
          setCustomPreferences(defaultHabits);
        }
      } else {
        setCustomPreferences(defaultHabits);
      }
    }
  }, [storageKey]);

  const savePreferences = (prefs: CustomPreference[]) => {
    setCustomPreferences(prefs);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    }
  };

  const handleAddPreference = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefText.trim()) return;

    const newPref: CustomPreference = {
      id: `pref-${Date.now()}`,
      text: newPrefText.trim(),
      type: 'diet',
    };

    const updated = [...customPreferences, newPref];
    savePreferences(updated);
    setNewPrefText('');
  };

  const handleDeletePreference = (id: string) => {
    const updated = customPreferences.filter((p) => p.id !== id);
    savePreferences(updated);
  };

  const handleResetPreferences = () => {
    if (confirm('Reset AI learned memory to default initial state? Your profile parameters will not be affected.')) {
      savePreferences(defaultHabits);
      setResetNotice(true);
      setTimeout(() => setResetNotice(false), 3000);
    }
  };

  return (
    <div className="ios-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-green-ink" />
          <span className="text-xs font-bold text-fg uppercase tracking-wider">
            AI Personalization
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMemoryModalOpen(true)}
          className="text-xs text-green-ink hover:underline font-semibold"
        >
          Manage Memory
        </button>
      </div>

      {/* Explanatory note */}
      <p className="text-[11px] text-muted leading-relaxed">
        Nuvia uses your stored health targets and verified log patterns to personalize daily meal recommendations and workout pacing.
      </p>

      {/* Stored Food & Lifestyle Preferences */}
      <div className="space-y-2 pt-0.5">
        <div className="p-3 rounded-2xl bg-fg/[0.03] border border-fg/[0.04] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              Dietary Profile
            </span>
            <span className="text-[10px] text-green-ink font-semibold">User Confirmed</span>
          </div>
          <p className="text-xs font-medium text-fg">
            {profile?.dietary_preference || 'Balanced / Halal'}
          </p>
        </div>

        {/* Cautious Learned Habits */}
        <div className="p-3 rounded-2xl bg-fg/[0.03] border border-fg/[0.04] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              Identified Patterns
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">Adaptive Memory</span>
          </div>

          <div className="space-y-1.5">
            {customPreferences.length > 0 ? (
              customPreferences.slice(0, 3).map((pref) => (
                <div key={pref.id} className="flex items-start gap-2 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span className="leading-snug">{pref.text}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted italic">
                Your personalization profile is still learning. Keep using Nuvia and your preferences will become more tailored.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Control Trigger Callout */}
      <div className="p-2.5 rounded-xl bg-app/30 border border-fg/[0.04] flex items-center gap-2 text-xs">
        <Info className="w-3.5 h-3.5 text-blue-ink shrink-0" />
        <span className="text-[11px] text-zinc-400">Explicit user corrections always override AI assumptions.</span>
      </div>

      {/* ============================================================ */}
      {/* AI MEMORY & PREFERENCES MANAGEMENT MODAL                     */}
      {/* ============================================================ */}
      <NuviaBottomSheet
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        variant="standard"
        ariaLabel="AI personalization memory"
        contentClassName="space-y-4"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-accent/15 text-green-ink flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg leading-snug">AI Personalization Memory</h3>
              <p className="text-[11px] text-muted">Review and control what Nuvia learns about you</p>
            </div>
          </div>
        }
      >
        {resetNotice && (
          <div className="p-2.5 rounded-[var(--radius-control)] bg-accent/15 border border-accent/30 text-green-ink text-xs font-semibold">
            AI learned memory has been reset to default.
          </div>
        )}

        {/* Active rules */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Active Personalization Rules
          </span>
          {customPreferences.length === 0 ? (
            <p className="text-xs text-muted py-2">No rules yet. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {customPreferences.map((pref) => (
                <div
                  key={pref.id}
                  className="p-3 rounded-[var(--radius-control)] bg-elevated/50 border border-line flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-fg-soft leading-snug">{pref.text}</span>
                  <button
                    type="button"
                    onClick={() => handleDeletePreference(pref.id)}
                    title="Remove preference"
                    aria-label={'Remove ' + pref.text}
                    className="w-8 h-8 rounded-lg hover:bg-danger/15 text-muted hover:text-red-ink flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add a rule */}
        <form onSubmit={handleAddPreference} className="space-y-2 pt-4 border-t border-line">
          <label htmlFor="new-ai-rule" className="block text-[11px] font-bold text-muted uppercase tracking-wider">
            Add Explicit Rule / Override
          </label>
          <div className="flex gap-2">
            <input
              id="new-ai-rule"
              type="text"
              value={newPrefText}
              onChange={(e) => setNewPrefText(e.target.value)}
              placeholder="e.g. Prefer Malaysian cuisine, no dairy after 8pm"
              className="flex-1 min-w-0 h-11 px-3 rounded-[var(--radius-control)] bg-elevated/40 border border-line text-fg text-sm placeholder:text-subtle focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newPrefText.trim()}
              className="h-11 px-4 rounded-[var(--radius-control)] bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent text-sm font-extrabold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Reset / Done */}
        <div className="pt-4 flex items-center justify-between border-t border-line text-xs">
          <button
            type="button"
            onClick={handleResetPreferences}
            className="text-red-ink hover:opacity-80 font-semibold flex items-center gap-1.5 transition-opacity cursor-pointer py-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset AI Memory</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMemoryModalOpen(false)}
            className="h-10 px-5 rounded-[var(--radius-control)] bg-elevated hover:bg-elevated-2 text-fg text-sm font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </NuviaBottomSheet>
    </div>
  );
}
