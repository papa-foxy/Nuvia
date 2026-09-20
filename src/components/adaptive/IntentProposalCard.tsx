'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, X, RotateCcw, AlertCircle } from 'lucide-react';
import { RescheduleProposal, AdaptiveScheduleChange } from '@/types/adaptive-training';
import { DataService } from '@/lib/data-service';

interface IntentProposalCardProps {
  proposal: RescheduleProposal;
  userId?: string;
  onApplied?: (msg: string) => void;
  onDismiss?: () => void;
  onAccept?: (selectedOption: any) => Promise<void> | void;
  onReject?: () => void;
}

export function IntentProposalCard({
  proposal,
  userId,
  onApplied,
  onDismiss,
  onAccept,
  onReject,
}: IntentProposalCardProps) {
  const [loading, setLoading] = useState(false);
  const [appliedAdaptationId, setAppliedAdaptationId] = useState<string | null>(null);

  const handleSelectOption = async (targetDate?: string, actionType: 'move_workout' | 'cancel_workout' = 'move_workout') => {
    setLoading(true);
    try {
      if (onAccept) {
        await onAccept({
          to_date: targetDate || proposal.suggested_date,
          action: actionType === 'move_workout' ? 'move_workout' : 'cancel_workout',
        });
        return;
      }
      const target = targetDate || proposal.suggested_date;
      const adaptation: AdaptiveScheduleChange = {
        id: `intent-adapt-${Date.now()}`,
        user_id: userId || 'demo-user-001',
        date: target,
        action: actionType,
        routine_id: proposal.routine_id,
        routine_title: proposal.routine_title,
        original_date: proposal.from_date,
        target_date: target,
        reason: `${proposal.routine_title}: ${proposal.reason}`,
        status: 'accepted',
        user_confirmed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await DataService.saveScheduleAdaptation(adaptation, userId);
      setAppliedAdaptationId(adaptation.id);
      onApplied?.(`Plan adapted: ${proposal.routine_title} set for ${target}`);
    } catch (err) {
      console.error('Failed to save adaptation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!appliedAdaptationId) return;
    setLoading(true);
    try {
      await DataService.undoScheduleAdaptation(appliedAdaptationId, userId);
      setAppliedAdaptationId(null);
      onApplied?.('Schedule change undone.');
    } catch (err) {
      console.error('Failed to undo:', err);
    } finally {
      setLoading(false);
    }
  };

  if (appliedAdaptationId) {
    return (
      <div className="p-3.5 rounded-2xl bg-[#0A84FF]/15 border border-[#0A84FF]/30 text-xs text-white flex items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-[#0A84FF]" />
          <span>Plan updated based on your intent.</span>
        </div>
        <button
          type="button"
          onClick={handleUndo}
          disabled={loading}
          className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-[#0A84FF] font-bold text-xs flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Undo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#121A15] border border-emerald-500/30 text-xs space-y-3 shadow-lg animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <Sparkles className="w-3 h-3" />
          Proposed Plan Adaptation
        </span>
        {(onDismiss || onReject) && (
          <button
            type="button"
            onClick={onReject || onDismiss}
            className="text-[#8E8E93] hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div>
        <p className="font-bold text-white text-sm">
          {proposal.reason}
        </p>
        <p className="text-[#8E8E93] mt-1 leading-relaxed">
          {proposal.recovery_analysis}
        </p>
        {proposal.conflict_warning && (
          <p className="text-[#FF9F0A] mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{proposal.conflict_warning}</span>
          </p>
        )}
      </div>

      <div className="space-y-1.5 pt-1">
        {proposal.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={loading}
            onClick={() => {
              if (opt.action === 'move' && opt.target_date) {
                handleSelectOption(opt.target_date, 'move_workout');
              } else if (opt.action === 'skip') {
                handleSelectOption(proposal.from_date, 'cancel_workout');
              } else {
                onDismiss?.();
              }
            }}
            className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
              opt.action === 'move'
                ? 'bg-white text-black hover:bg-[#F5F5F7]'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
            }`}
          >
            <span>{opt.label}</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
