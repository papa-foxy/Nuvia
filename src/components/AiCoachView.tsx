'use client';

import React, { useState, useEffect } from 'react';
import { Send, Utensils, Flame, Activity, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DataService } from '@/lib/data-service';
import { AiService, CoachAdviceResult } from '@/lib/ai-service';

export function AiCoachView() {
  const { user, profile, goals } = useAuth();
  const [advice, setAdvice] = useState<CoachAdviceResult | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(true);

  // Clean query interface
  const [query, setQuery] = useState('');
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

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
      const summary = await DataService.getDailySummary(user?.id);
      const meals = await DataService.getMeals(user?.id);

      try {
        const res = await AiService.getCoachAdvice({
          todaySummary: summary,
          goals,
          profile,
          recentMeals: meals,
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

    try {
      const summary = await DataService.getDailySummary(user?.id);
      const meals = await DataService.getMeals(user?.id);

      const res = await AiService.getCoachAdvice({
        todaySummary: summary,
        goals,
        profile,
        recentMeals: meals,
        chatMessage: q,
      });

      setAnswer(res.reply || "You're making steady progress today! Keep staying consistent with your protein and movement.");
    } catch {
      setAnswer("Nuvia is briefly catching up. Prioritize hitting your remaining protein target and stay hydrated!");
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
          Intelligence
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
          Nuvia
        </h1>
      </div>

      {/* Primary Insights List (Apple Health Inset Grouped Rows) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
          Daily Analysis
        </p>

        {loadingAdvice ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl bg-[#1C1C1E] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="ios-card divide-y divide-white/[0.06] overflow-hidden">
            {advice?.priorities?.map((item, idx) => (
              <div key={idx} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    {item.category}
                  </span>
                  <span className="text-[10px] text-[#8E8E93] font-medium">
                    Priority {item.priority}
                  </span>
                </div>
                <p className="text-xs text-[#D1D1D6] leading-relaxed">
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
        <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
          Ask Nuvia
        </p>

        <form onSubmit={(e) => handleAsk(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your calories, dinner ideas..."
            className="flex-1 bg-[#1C1C1E] border border-white/[0.08] text-xs text-white placeholder-[#8E8E93] px-3.5 py-3 rounded-2xl focus:border-[#30D158] focus:outline-none"
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
            'Can I still eat dinner?',
            'What high-protein snack should I eat?',
            'How much exercise is left?',
          ].map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(prompt);
                handleAsk(undefined, prompt);
              }}
              className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-white border border-white/[0.06] transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Nuvia Response */}
        {answering && (
          <div className="p-4 rounded-2xl bg-[#1C1C1E] text-xs text-[#8E8E93] animate-pulse">
            Analyzing your daily logs...
          </div>
        )}

        {answer && !answering && (
          <div className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] text-xs text-white leading-relaxed space-y-1">
            <p className="font-semibold text-[#30D158]">Nuvia</p>
            <p className="text-[#D1D1D6]">{answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
