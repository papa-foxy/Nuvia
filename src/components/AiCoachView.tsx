'use client';

import React, { useState, useEffect } from 'react';
import { Send, Utensils, Flame, Activity, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { AiService, CoachAdviceResult } from '@/lib/ai-service';
import { FitnessContextService } from '@/lib/fitness-context-service';
import { IntentProposalCard } from '@/components/adaptive/IntentProposalCard';
import { RescheduleProposal, AdaptiveScheduleChange } from '@/types/adaptive-training';

export function AiCoachView() {
  const { user, profile, goals } = useAuth();
  const [advice, setAdvice] = useState<CoachAdviceResult | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(true);

  // Clean query interface
  const [query, setQuery] = useState('');
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<RescheduleProposal | null>(null);
  const [lastAdaptedChange, setLastAdaptedChange] = useState<AdaptiveScheduleChange | null>(null);

  useEffect(() => {
    async function loadInsights() {
      // Load any existing stored recommendations first for instant display
      try {
        const storedRecs = await DataService.getRecommendations(user?.id);
        if (storedRecs && storedRecs.length > 0 && storedRecs[0].recommendation) {
          try {
            const parsed = JSON.parse(storedRecs[0].recommendation);
            if (parsed.headline && Array.isArray(parsed.priorities)) {
              setAdvice(parsed);
            }
          } catch {
            // Recommendation was raw text
          }
        }
      } catch {
        // Continue
      }

      setLoadingAdvice(true);
      try {
        const [summary, meals, fitnessCtx] = await Promise.all([
          DataService.getDailySummary(user?.id),
          DataService.getMeals(user?.id),
          FitnessContextService.getFitnessContext(user?.id),
        ]);

        const res = await AiService.getCoachAdvice({
          todaySummary: summary,
          goals,
          profile,
          recentMeals: meals,
          fitnessContext: fitnessCtx,
        });
        if (res.advice) {
          setAdvice(res.advice);
          if (user?.id) {
            await DataService.addRecommendation({
              user_id: user.id,
              date: new Date().toISOString().split('T')[0],
              recommendation: JSON.stringify(res.advice),
              priority: 1,
            });
          }
        }
      } catch {
        // Fallback handled gracefully
      } finally {
        setLoadingAdvice(false);
      }
    }

    loadInsights();
  }, [user, profile, goals]);

  const handleAsk = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const q = customQuery || query.trim();
    if (!q || answering) return;

    setAnswering(true);
    setAnswer(null);
    setActiveProposal(null);

    try {
      const [summary, meals, fitnessCtx] = await Promise.all([
        DataService.getDailySummary(user?.id),
        DataService.getMeals(user?.id),
        FitnessContextService.getFitnessContext(user?.id),
      ]);

      const res = await AiService.getCoachAdvice({
        todaySummary: summary,
        goals,
        profile,
        recentMeals: meals,
        chatMessage: q,
        fitnessContext: fitnessCtx,
      });

      setAnswer(res.reply || "You're making steady progress today! Keep staying consistent with your protein and movement.");
      if (res.proposal) {
        setActiveProposal(res.proposal);
      }
    } catch {
      setAnswer("Nuvia is briefly catching up. Prioritize hitting your remaining protein target and stay hydrated!");
    } finally {
      setAnswering(false);
    }
  };

  const handleAcceptProposal = async (selectedOption: any) => {
    if (!user?.id || !activeProposal) return;
    try {
      const targetDate = selectedOption.to_date || activeProposal.suggested_date || new Date().toISOString().split('T')[0];
      const change = await DataService.saveScheduleAdaptation({
        user_id: user.id,
        routine_id: activeProposal.routine_id,
        routine_title: activeProposal.routine_title,
        date: targetDate,
        original_date: activeProposal.from_date,
        target_date: targetDate,
        action: selectedOption.action === 'move' ? 'move_workout' : selectedOption.action === 'add_activity' ? 'add_activity' : 'cancel_workout',
        reason: activeProposal.reason,
        status: 'accepted',
        user_confirmed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setLastAdaptedChange(change);
      setActiveProposal(null);
      FitnessContextService.invalidateFitnessContext(user.id);
    } catch (e) {
      console.error('Failed to accept proposal', e);
    }
  };

  const handleUndo = async () => {
    if (!lastAdaptedChange) return;
    try {
      await DataService.undoScheduleAdaptation(lastAdaptedChange.id);
      setLastAdaptedChange(null);
      FitnessContextService.invalidateFitnessContext(user?.id);
    } catch (e) {
      console.error('Failed to undo proposal', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 w-full max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          Intelligence
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-fg mt-0.5">
          Nuvia
        </h1>
      </div>

      {/* Primary Insights List (Apple Health Inset Grouped Rows) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          Daily Analysis
        </p>

        {loadingAdvice ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="ios-card divide-y divide-fg/[0.06] overflow-hidden">
            {advice?.priorities?.map((item, idx) => (
              <div key={idx} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg">
                    {item.category}
                  </span>
                  <span className="text-[10px] text-muted font-medium">
                    Priority {item.priority}
                  </span>
                </div>
                <p className="text-xs text-fg-soft leading-relaxed">
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ios-divider" />

      {/* Ask Nuvia Section (Clean Query & Answer Box) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          Ask Nuvia
        </p>

        <form onSubmit={(e) => handleAsk(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your calories, dinner ideas..."
            className="flex-1 bg-card border border-fg/[0.08] text-xs text-fg placeholder-muted px-3.5 py-3 rounded-2xl focus:border-[#30D158] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || answering}
            className="p-3 rounded-2xl bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-30 text-black font-bold transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            'I want to run today',
            'What workout should I do today?',
            'I missed yesterday’s workout',
            'I only have 30 minutes today',
            'How should I progress my squats?',
          ].map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(prompt);
                handleAsk(undefined, prompt);
              }}
              className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-card hover:bg-elevated text-muted hover:text-fg border border-fg/[0.06] transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Nuvia Response */}
        {answering && (
          <div className="p-4 rounded-2xl bg-card text-xs text-muted animate-pulse">
            Analyzing your training plan & recovery...
          </div>
        )}

        {answer && !answering && (
          <div className="p-4 rounded-2xl bg-card border border-fg/[0.08] text-xs text-fg leading-relaxed space-y-3">
            <div className="space-y-1">
              <p className="font-semibold text-green-ink">Nuvia</p>
              <p className="text-fg-soft">{answer}</p>
            </div>

            {activeProposal && (
              <div className="pt-2 border-t border-fg/[0.06]">
                <IntentProposalCard
                  proposal={activeProposal}
                  onAccept={handleAcceptProposal}
                  onReject={() => setActiveProposal(null)}
                />
              </div>
            )}

            {lastAdaptedChange && !activeProposal && (
              <div className="pt-2 border-t border-fg/[0.06] flex items-center justify-between text-xs text-muted">
                <span>Plan adjusted ({lastAdaptedChange.routine_title || 'Workout'} {lastAdaptedChange.action}).</span>
                <button
                  onClick={handleUndo}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
