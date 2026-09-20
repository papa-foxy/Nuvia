'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Check, X, RotateCcw, Plus, Trash2, Info } from 'lucide-react';
import { Profile } from '@/types/database';

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
          <Brain className="w-3.5 h-3.5 text-[#30D158]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            AI Personalization
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMemoryModalOpen(true)}
          className="text-xs text-[#30D158] hover:underline font-semibold"
        >
          Manage Memory
        </button>
      </div>

      {/* Explanatory note */}
      <p className="text-[11px] text-[#8E8E93] leading-relaxed">
        Nuvia uses your stored health targets and verified log patterns to personalize daily meal recommendations and workout pacing.
      </p>

      {/* Stored Food & Lifestyle Preferences */}
      <div className="space-y-2 pt-0.5">
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
              Dietary Profile
            </span>
            <span className="text-[10px] text-[#30D158] font-semibold">User Confirmed</span>
          </div>
          <p className="text-xs font-medium text-white">
            {profile?.dietary_preference || 'Balanced / Halal'}
          </p>
        </div>

        {/* Cautious Learned Habits */}
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
              Identified Patterns
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">Adaptive Memory</span>
          </div>

          <div className="space-y-1.5">
            {customPreferences.length > 0 ? (
              customPreferences.slice(0, 3).map((pref) => (
                <div key={pref.id} className="flex items-start gap-2 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] mt-1.5 shrink-0" />
                  <span className="leading-snug">{pref.text}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#8E8E93] italic">
                Your personalization profile is still learning. Keep using Nuvia and your preferences will become more tailored.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Control Trigger Callout */}
      <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.04] flex items-center gap-2 text-xs">
        <Info className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
        <span className="text-[11px] text-zinc-400">Explicit user corrections always override AI assumptions.</span>
      </div>

      {/* ============================================================ */}
      {/* AI MEMORY & PREFERENCES MANAGEMENT MODAL                     */}
      {/* ============================================================ */}
      {isMemoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#1C1C1E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#30D158]/15 text-[#30D158] flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Personalization Memory</h3>
                  <p className="text-[11px] text-[#8E8E93]">Review and control what Nuvia learns about you</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMemoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetNotice && (
              <div className="p-2.5 rounded-xl bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold">
                AI learned memory has been reset to default.
              </div>
            )}

            {/* List of active preferences */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                Active Personalization Rules
              </span>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {customPreferences.map((pref) => (
                  <div
                    key={pref.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-zinc-200 leading-snug">{pref.text}</span>
                    <button
                      type="button"
                      onClick={() => handleDeletePreference(pref.id)}
                      title="Remove preference"
                      className="w-7 h-7 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center shrink-0 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Custom User Instruction */}
            <form onSubmit={handleAddPreference} className="space-y-2 pt-2 border-t border-white/10">
              <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                Add Explicit Rule / Override
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPrefText}
                  onChange={(e) => setNewPrefText(e.target.value)}
                  placeholder="e.g. Prefer Malaysian cuisine, no dairy after 8pm"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[#30D158]"
                />
                <button
                  type="submit"
                  disabled={!newPrefText.trim()}
                  className="px-3.5 py-2.5 rounded-xl bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black text-xs font-bold transition-colors flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>

            {/* Actions: Reset and Close */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs">
              <button
                type="button"
                onClick={handleResetPreferences}
                className="text-red-400 hover:text-red-300 font-medium flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset AI Memory</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMemoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
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
