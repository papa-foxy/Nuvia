'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  XCircle,
  Calendar,
  Sparkles,
  Info,
  Clock,
  Dumbbell,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { WeeklyDayPlan } from '@/types/adaptive-training';

interface WeeklyAdaptationStripProps {
  days?: WeeklyDayPlan[];
  weekPlan?: WeeklyDayPlan[];
  onSelectDay?: (day: WeeklyDayPlan) => void;
  onOpenWeeklyReport?: () => void;
}

export function WeeklyAdaptationStrip({
  days,
  weekPlan,
  onSelectDay,
  onOpenWeeklyReport,
}: WeeklyAdaptationStripProps) {
  const effectiveDays = weekPlan || days || [];
  const [activeDay, setActiveDay] = useState<WeeklyDayPlan | null>(null);

  const handleDayTap = (day: WeeklyDayPlan) => {
    setActiveDay((prev) => (prev?.date === day.date ? null : day));
    onSelectDay?.(day);
  };

  const getStatusIcon = (status: WeeklyDayPlan['statusBadge']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#30D158]" />;
      case 'partial':
        return <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F0A]" />;
      case 'missed':
        return <XCircle className="w-3.5 h-3.5 text-[#FF453A]" />;
      case 'adapted':
        return <ArrowRight className="w-3.5 h-3.5 text-[#0A84FF]" />;
      case 'planned':
        return <div className="w-2.5 h-2.5 rounded-full border border-white/60" />;
      case 'rest':
      default:
        return <div className="w-1.5 h-1.5 rounded-full bg-white/20" />;
    }
  };

  return (
    <div className="space-y-2">
      {/* ── 7-DAY PILL STRIP ────────────────────────────────────────────── */}
      <div className="ios-card p-3">
        <div className="flex items-center justify-between gap-1">
          {effectiveDays.map((day) => {
            const isSelected = activeDay?.date === day.date;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => handleDayTap(day)}
                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                  day.isToday
                    ? isSelected
                      ? 'bg-[#30D158]/25 border border-[#30D158]'
                      : 'bg-[#30D158]/15 border border-[#30D158]/40'
                    : isSelected
                    ? 'bg-white/15 border border-white/25'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    day.isToday ? 'text-[#30D158]' : 'text-[#8E8E93]'
                  }`}
                >
                  {day.dayShort}
                </span>

                <span className="text-xs font-extrabold text-white mt-0.5">
                  {parseInt(day.date.split('-')[2], 10)}
                </span>

                <div className="mt-2 h-4 flex items-center justify-center">
                  {getStatusIcon(day.statusBadge)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SELECTED DAY DETAIL INSET ────────────────────────────────────── */}
      {activeDay && (
        <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/[0.08] shadow-lg animate-fadeIn text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>{activeDay.dayName}</span>
              <span className="text-[#8E8E93] font-normal">({activeDay.date})</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                activeDay.statusBadge === 'completed'
                  ? 'bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30'
                  : activeDay.statusBadge === 'partial'
                  ? 'bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/30'
                  : activeDay.statusBadge === 'adapted'
                  ? 'bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/30'
                  : activeDay.statusBadge === 'missed'
                  ? 'bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/30'
                  : 'bg-white/10 text-white'
              }`}
            >
              {activeDay.statusBadge}
            </span>
          </div>

          <p className="text-[#8E8E93] leading-relaxed">
            {activeDay.displayText}
            {activeDay.adaptationReason && ` · ${activeDay.adaptationReason}`}
          </p>
        </div>
      )}
    </div>
  );
}
