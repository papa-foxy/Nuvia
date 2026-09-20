'use client';

import React from 'react';
import { CheckCircle2, Award, Sparkles, Dumbbell, Calendar, Heart, ArrowRight } from 'lucide-react';
import { WeeklyTrainingReport } from '@/types/adaptive-training';
import { NuviaBottomSheet } from '../NuviaBottomSheet';

interface WeeklyReportModalProps {
  report?: WeeklyTrainingReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WeeklyReportModal({ report, isOpen, onClose }: WeeklyReportModalProps) {
  if (!isOpen || !report) return null;

  return (
    <NuviaBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#30D158]">
            Weekly Review
          </span>
          <h3 className="text-base font-bold text-white tracking-tight leading-snug mt-0.5">
            Training Summary
          </h3>
        </div>
      }
      subtitle="Consistency, volume, and schedule adaptations"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pb-2">
        {/* ── STATS GRID ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
              Consistency
            </span>
            <span className="text-lg font-black text-white mt-1 block">
              {report.consistencyRate.split(' ')[0]}
            </span>
            <span className="text-[10px] text-[#8E8E93] block mt-0.5">
              planned completed
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
              Active Time
            </span>
            <span className="text-lg font-black text-white mt-1 block">
              {report.totalMinutes}m
            </span>
            <span className="text-[10px] text-[#8E8E93] block mt-0.5">
              {report.totalCalories.toLocaleString()} kcal burned
            </span>
          </div>
        </div>

        {/* ── BREAKDOWN LIST ─────────────────────────────────────────────── */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
            <span className="text-[#8E8E93] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#30D158]" />
              Completed Sessions
            </span>
            <span className="font-bold text-white">{report.completedWorkouts}</span>
          </div>

          {report.partialWorkouts > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
              <span className="text-[#8E8E93] flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#FF9F0A]" />
                Partial Sessions
              </span>
              <span className="font-bold text-white">{report.partialWorkouts}</span>
            </div>
          )}

          {report.extraActivities > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
              <span className="text-[#8E8E93] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                Additional Activities
              </span>
              <span className="font-bold text-white">{report.extraActivities}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
            <span className="text-[#8E8E93] flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              Recovery Days
            </span>
            <span className="font-bold text-white">{report.recoveryDays}</span>
          </div>
        </div>

        {/* ── ADAPTATIONS LOG ────────────────────────────────────────────── */}
        {report.adaptationsSummary && report.adaptationsSummary.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 text-xs space-y-1.5">
            <span className="font-bold text-[#0A84FF] text-[11px] block">
              Adaptations ({report.adaptationsSummary.length}):
            </span>
            {report.adaptationsSummary.map((item, idx) => (
              <p key={idx} className="text-[#E5E5EA] text-[11px] leading-relaxed flex items-start gap-1.5">
                <span className="text-[#0A84FF]">•</span>
                <span>{item}</span>
              </p>
            ))}
          </div>
        )}

        {/* ── NEUTRAL COACH NOTE ────────────────────────────────────────── */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-[#8E8E93] leading-relaxed space-y-1">
          <span className="font-bold text-white text-xs block">Coach Note</span>
          <p>
            {report.completedWorkouts >= report.plannedWorkouts
              ? 'Outstanding consistency this week. Muscle stimulus targets were reached cleanly while respecting recovery.'
              : 'Good training balance this week. Any adapted or missed sessions were factored into your upcoming volume.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-white text-black font-extrabold text-xs hover:bg-[#F5F5F7] transition-all cursor-pointer shadow-lg"
        >
          Done
        </button>
      </div>
    </NuviaBottomSheet>
  );
}
