'use client';

import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Flame,
  Clock,
  Dumbbell,
  Heart,
  RotateCcw,
  AlertCircle,
  Check,
  X,
  Footprints,
} from 'lucide-react';
import { NextTrainingAction, RescheduleProposal, AdaptiveScheduleChange } from '@/types/adaptive-training';
import { DataService, getLocalDateString } from '@/lib/data-service';

interface NuviaNextActionCardProps {
  action: NextTrainingAction;
  userId?: string;
  onStartWorkout?: (routineId: string) => void;
  onResumeWorkout?: (routineId: string) => void;
  onActionClick?: (action: NextTrainingAction) => void;
  onAcceptProposal?: (proposal: RescheduleProposal, selectedOption: any) => Promise<void> | void;
  onUndoProposal?: (changeId: string) => Promise<void> | void;
  onAdaptationApplied?: (message: string) => void;
  onRefresh?: () => void;
}

export function NuviaNextActionCard({
  action,
  userId,
  onStartWorkout,
  onResumeWorkout,
  onActionClick,
  onAcceptProposal,
  onUndoProposal,
  onAdaptationApplied,
  onRefresh,
}: NuviaNextActionCardProps) {
  const [loading, setLoading] = useState(false);
  const [undoAdaptationId, setUndoAdaptationId] = useState<string | null>(null);

  const handleApplyReschedule = async (
    proposal: RescheduleProposal,
    targetDate: string,
    actionType: 'move_workout' | 'cancel_workout'
  ) => {
    setLoading(true);
    try {
      if (onAcceptProposal) {
        await onAcceptProposal(proposal, {
          to_date: targetDate,
          action: actionType === 'move_workout' ? 'move' : 'skip',
        });
        setUndoAdaptationId(proposal.id);
      } else {
        const adaptation: AdaptiveScheduleChange = {
          id: `adapt-${Date.now()}`,
          user_id: userId || 'demo-user-001',
          date: targetDate,
          action: actionType,
          routine_id: proposal.routine_id,
          routine_title: proposal.routine_title,
          original_date: proposal.from_date,
          target_date: targetDate,
          reason: `${proposal.routine_title} moved from ${proposal.from_date} to ${targetDate}`,
          status: 'accepted',
          user_confirmed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await DataService.saveScheduleAdaptation(adaptation, userId);
        setUndoAdaptationId(adaptation.id);
        onAdaptationApplied?.(`Plan adapted: ${proposal.routine_title} moved to ${targetDate}`);
        onRefresh?.();
      }
    } catch (err) {
      console.error('Failed to apply reschedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!undoAdaptationId) return;
    setLoading(true);
    try {
      if (onUndoProposal) {
        await onUndoProposal(undoAdaptationId);
      } else {
        await DataService.undoScheduleAdaptation(undoAdaptationId, userId);
      }
      setUndoAdaptationId(null);
      onAdaptationApplied?.('Schedule adaptation reversed.');
      onRefresh?.();
    } catch (err) {
      console.error('Failed to undo adaptation:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* ── UNDO BANNER ─────────────────────────────────────────────────── */}
      {undoAdaptationId && (
        <div className="p-3 rounded-2xl bg-info/15 border border-info/30 flex items-center justify-between gap-2 text-xs text-fg animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-ink" />
            <span>Plan updated successfully.</span>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            disabled={loading}
            className="px-3 py-1 rounded-xl bg-fg/10 hover:bg-fg/20 text-blue-ink font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* ── CARD CONTENT BY TYPE ────────────────────────────────────────── */}

      {/* 1. START WORKOUT */}
      {action.type === 'start_workout' && (
        <div className="rounded-3xl p-5 bg-gradient-to-br from-card via-card dark:via-[#161E18] to-card dark:to-[#121814] border border-accent/30 shadow-xl shadow-black/10 dark:shadow-black/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-accent/20 text-green-ink border border-accent/30">
              <Sparkles className="w-3 h-3" />
              Next Recommended Step
            </span>
            <span className="text-xs font-semibold text-muted flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{action.durationMinutes} min
            </span>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-fg tracking-tight">
              {action.routineTitle}
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {action.reason} Focus: <strong className="text-fg">{action.focus}</strong> ({action.exerciseCount} exercises).
            </p>
          </div>

          <button
            type="button"
            onClick={() => (onActionClick ? onActionClick(action) : onStartWorkout?.(action.routineId))}
            className="w-full py-3.5 px-4 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-extrabold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-accent/25 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Start Today’s Workout</span>
          </button>
        </div>
      )}

      {/* 2. CONTINUE WORKOUT (In-Progress or Partial) */}
      {action.type === 'continue_workout' && (
        <div className="rounded-3xl p-5 bg-gradient-to-br from-card via-card dark:via-[#1D1A15] to-card dark:to-[#14120E] border border-warn/40 shadow-xl shadow-black/10 dark:shadow-black/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-warn/20 text-orange-ink border border-warn/30">
              <Clock className="w-3 h-3" />
              Resume Session ({action.percentage}%)
            </span>
            <span className="text-xs text-muted font-semibold">
              {action.remainingExercises} exercises left
            </span>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-fg tracking-tight">
              Continue {action.routineTitle}
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {action.reason}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-fg/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-warn to-accent transition-all duration-500 rounded-full"
              style={{ width: `${Math.max(8, action.percentage)}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => (onActionClick ? onActionClick(action) : onResumeWorkout?.(action.routineId))}
            className="w-full py-3.5 px-4 rounded-2xl bg-warn hover:bg-warn text-black font-extrabold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-warn/25 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Resume Workout</span>
          </button>
        </div>
      )}

      {/* 3. RECOVERY DAY */}
      {action.type === 'recovery' && (
        <div className="rounded-3xl p-5 bg-card border border-fg/[0.08] shadow-xl shadow-black/10 dark:shadow-black/40 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-400/15 text-sky-400 border border-sky-400/30">
              <Heart className="w-3 h-3" />
              Recovery Window
            </span>
            <span className="text-xs text-muted">Active Rest</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-fg tracking-tight">
              Physical Recovery &amp; Rebuilding
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {action.reason}
            </p>
          </div>

          {action.suggestedActivities && action.suggestedActivities.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-2">
              {action.suggestedActivities.map((act, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-xl bg-fg/[0.05] border border-fg/[0.06] text-xs text-fg-soft font-medium"
                >
                  {act}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. OPTIONAL ACTIVITY / CARDIO */}
      {action.type === 'optional_activity' && (
        <div className="rounded-3xl p-5 bg-gradient-to-br from-card to-card dark:to-[#171C20] border border-sky-400/30 shadow-xl shadow-black/10 dark:shadow-black/40 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-400/15 text-sky-400 border border-sky-400/30">
              <Footprints className="w-3 h-3" />
              Optional Movement
            </span>
            <span className="text-xs text-muted">
              ~{action.suggestedDurationMinutes} min
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-fg tracking-tight">
              {action.activityType}
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {action.reason}
            </p>
          </div>
        </div>
      )}

      {/* 5. RESCHEDULE PROPOSAL (MISSED WORKOUT REVIEW) */}
      {action.type === 'reschedule' && (
        <div className="rounded-3xl p-5 bg-gradient-to-br from-card via-card dark:via-[#20181A] to-card dark:to-[#171214] border border-danger/40 shadow-xl shadow-black/10 dark:shadow-black/40 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-danger/20 text-red-ink border border-danger/30">
              <AlertCircle className="w-3 h-3" />
              Schedule Adaptation
            </span>
            <span className="text-xs text-muted">Action Needed</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-fg tracking-tight">
              {action.proposal.routine_title} was missed
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {action.proposal.reason} {action.proposal.recovery_analysis}
            </p>
            {action.proposal.conflict_warning && (
              <p className="text-xs text-orange-ink mt-1.5 font-medium">
                ⚠️ {action.proposal.conflict_warning}
              </p>
            )}
          </div>

          {/* Action options */}
          <div className="space-y-2 pt-1">
            {action.proposal.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => {
                  if (opt.action === 'move' && opt.target_date) {
                    handleApplyReschedule(action.proposal, opt.target_date, 'move_workout');
                  } else if (opt.action === 'skip') {
                    handleApplyReschedule(action.proposal, action.proposal.from_date, 'cancel_workout');
                  }
                }}
                className={`w-full py-3 px-4 rounded-2xl text-xs font-bold transition-all text-left flex items-center justify-between ${
                  opt.action === 'move'
                    ? 'bg-fg text-app hover:bg-fg/85'
                    : 'bg-fg/10 hover:bg-fg/15 text-fg border border-fg/10'
                }`}
              >
                <span>{opt.label}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
