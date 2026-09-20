'use client';

import React, { useState } from 'react';
import {
  Clock,
  Flame,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Calendar,
  Sparkles,
  Activity,
} from 'lucide-react';
import { ExerciseLog } from '@/types/database';
import { NuviaBottomSheet } from './NuviaBottomSheet';
import { getActivityDisplayData } from '@/lib/activity-utils';

interface ActivityDetailsModalProps {
  log: ExerciseLog | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void> | void;
}

export function ActivityDetailsModal({
  log,
  isOpen,
  onClose,
  onDelete,
}: ActivityDetailsModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !log) return null;

  const data = getActivityDisplayData(log);
  const actualPerformance = log.ai_analysis?.actual_performance as Array<{
    exercise_id: string;
    name: string;
    target_muscle?: string;
    sets?: Array<{ set_number: number; reps: number | string; weight_kg?: number; completed: boolean }>;
  }> | undefined;

  const handleDelete = async () => {
    if (!onDelete) return;
    if (confirm(`Delete activity entry "${data.cleanTitle}"?`)) {
      setDeleting(true);
      await onDelete(log.id);
      setDeleting(false);
      onClose();
    }
  };

  const headerAction = onDelete ? (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8E8E93] hover:text-[#FF453A] transition-colors cursor-pointer"
      title="Delete activity record"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  ) : undefined;

  return (
    <NuviaBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      headerAction={headerAction}
      title={
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
              data.isPartial
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30'
            }`}
          >
            {data.statusLabel}
          </span>
          <span className="text-[11px] font-medium text-[#8E8E93] flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>{data.sourceLabel}</span>
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Title and Date Info */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white tracking-tight">
            {data.cleanTitle}
          </h2>
          {data.equipmentSubtitle && (
            <p className="text-xs font-semibold text-[#30D158] flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5" />
              <span>{data.equipmentSubtitle}</span>
            </p>
          )}
          <p className="text-xs text-[#8E8E93] flex items-center gap-1.5 pt-0.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{data.fullDate}</span>
            <span>·</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{data.timeStr}</span>
          </p>
        </div>

        {/* Primary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF453A]/15 text-[#FF453A] flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-wider block">
                Calories Burned
              </span>
              <span className="text-base font-black text-white">
                ~{data.caloriesBurned} <span className="text-xs font-normal text-[#8E8E93]">kcal</span>
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-wider block">
                Duration
              </span>
              <span className="text-base font-black text-white">
                {data.durationMinutes} <span className="text-xs font-normal text-[#8E8E93]">min</span>
              </span>
            </div>
          </div>

          {data.movementsSummary && (
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-wider block">
                  Movements
                </span>
                <span className="text-base font-black text-white">
                  {data.movementsSummary}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Partial Workout Alert (if applicable) */}
        {data.isPartial && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This was logged as a partial session ({data.movementsSummary || 'some exercises skipped'}). The recorded calorie burn reflects what was actually executed.
            </p>
          </div>
        )}

        {/* Set-by-Set Movement Execution Breakdown */}
        {actualPerformance && actualPerformance.length > 0 ? (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block px-1">
              Logged Movements ({actualPerformance.length})
            </span>
            <div className="space-y-2">
              {actualPerformance.map((item, idx) => {
                const completedSets = (item.sets || []).filter((s) => s.completed);
                const isItemCompleted = completedSets.length > 0;

                return (
                  <div
                    key={item.exercise_id || idx}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isItemCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-[#30D158] shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-white leading-snug">{item.name}</p>
                          {item.target_muscle && (
                            <p className="text-[10px] text-[#8E8E93]">{item.target_muscle}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-300">
                        {completedSets.length} / {(item.sets || []).length} sets
                      </span>
                    </div>

                    {/* Set Pills */}
                    {item.sets && item.sets.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 pl-6">
                        {item.sets.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono ${
                              s.completed
                                ? 'bg-[#30D158]/10 text-[#30D158] border-[#30D158]/30'
                                : 'bg-white/5 text-[#8E8E93] border-white/10'
                            }`}
                          >
                            Set {s.set_number || sIdx + 1}: {s.reps} reps
                            {s.weight_kg ? ` · ${s.weight_kg}kg` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : log.description ? (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block px-1">
              Session Notes
            </span>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300 leading-relaxed">
              {log.description}
            </div>
          </div>
        ) : null}

        {/* AI Tip / Feedback if present */}
        {log.ai_analysis?.ai_tip && (
          <div className="p-3 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 flex items-start gap-2.5 text-xs text-[#0A84FF]">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{log.ai_analysis.ai_tip}</p>
          </div>
        )}
      </div>
    </NuviaBottomSheet>
  );
}
