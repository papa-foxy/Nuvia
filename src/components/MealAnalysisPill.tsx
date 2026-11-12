'use client';

import React, { useEffect } from 'react';
import { AlertCircle, ChevronRight, RefreshCw, Sparkles, X } from 'lucide-react';
import { MealAnalysisRunner, useMealAnalysis } from '@/lib/meal-analysis-runner';

/**
 * Floating status for a meal photo analyzed in the background (the Log Meal
 * sheet was closed, or Nuvia was reopened). Also resumes a pending analysis on
 * launch and whenever the app comes back to the foreground.
 */
export function MealAnalysisPill({ hidden, onReview }: { hidden: boolean; onReview: () => void }) {
  const analysis = useMealAnalysis();

  useEffect(() => {
    MealAnalysisRunner.resume();
    const onVisible = () => {
      if (document.visibilityState === 'visible') MealAnalysisRunner.resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);

  if (hidden || analysis.status === 'idle') return null;

  const thumb = analysis.image ? (
    <img src={analysis.image} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-xl bg-accent/15 text-green-ink flex items-center justify-center shrink-0">
      <Sparkles className="w-4 h-4" />
    </div>
  );

  return (
    <div
      className="fixed md:absolute left-0 right-0 z-30 flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-sm flex items-center gap-3 p-2 pr-2.5 rounded-2xl bg-card border border-fg/[0.08] shadow-xl shadow-black/20 animate-slideUp"
      >
        {thumb}
        {analysis.status === 'analyzing' && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg">Analyzing your meal…</p>
              <p className="text-xs text-muted truncate">You can leave the app. We&apos;ll keep going.</p>
            </div>
            <RefreshCw className="w-4 h-4 text-green-ink animate-spin shrink-0" aria-hidden="true" />
          </>
        )}
        {analysis.status === 'done' && analysis.result && (
          <>
            <button type="button" onClick={onReview} className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-fg truncate">{analysis.result.meal_name || 'Your meal is ready'}</p>
              <p className="text-xs text-muted">
                {Math.round(analysis.result.total?.calories || 0)} kcal · Tap to review and save
              </p>
            </button>
            <button
              type="button"
              onClick={onReview}
              className="h-8 pl-3 pr-2 rounded-full bg-accent text-on-accent text-xs font-bold flex items-center gap-0.5 shrink-0"
            >
              Review
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {analysis.status === 'failed' && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-ink shrink-0" />
                Couldn&apos;t analyze your meal
              </p>
              <p className="text-xs text-muted truncate">{analysis.error}</p>
            </div>
            <button
              type="button"
              onClick={() => MealAnalysisRunner.retry()}
              className="h-8 px-3 rounded-full bg-elevated text-fg text-xs font-semibold shrink-0"
            >
              Try again
            </button>
          </>
        )}
        {analysis.status !== 'analyzing' && (
          <button
            type="button"
            onClick={() => MealAnalysisRunner.clear()}
            aria-label="Dismiss"
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-fg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
