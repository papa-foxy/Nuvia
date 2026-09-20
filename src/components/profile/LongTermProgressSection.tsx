'use client';

import React from 'react';
import { TrendingUp, Activity, Utensils, Calendar, ChevronRight } from 'lucide-react';
import { Profile, Goal } from '@/types/database';

interface LongTermProgressSectionProps {
  profile: Profile | null;
  goals: Goal | null;
  activeDaysCount: number;
  totalLoggedDays: number;
  averageAdherencePercent: number | null;
  onNavigateActivity: () => void;
}

export function LongTermProgressSection({
  profile,
  goals,
  activeDaysCount,
  totalLoggedDays,
  averageAdherencePercent,
  onNavigateActivity,
}: LongTermProgressSectionProps) {
  const currentWeight = profile?.weight_kg;
  const targetWeight = goals?.target_weight_kg || profile?.target_weight_kg;
  const hasHistory = totalLoggedDays > 0 || activeDaysCount > 0;

  return (
    <div className="ios-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-[#30D158]" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          Long-Term Progress
        </span>
      </div>

      {hasHistory ? (
        <div className="space-y-2.5">
          {/* Trends Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Nutrition Adherence */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                <Utensils className="w-3.5 h-3.5 text-[#FF9500]" />
                <span className="text-[11px] font-medium text-[#8E8E93]">Nutrition</span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {averageAdherencePercent !== null ? `${averageAdherencePercent}%` : 'Building'}
              </p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">
                {averageAdherencePercent !== null ? 'Calorie adherence' : 'Keep logging meals'}
              </p>
            </div>

            {/* Workout Consistency */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                <Activity className="w-3.5 h-3.5 text-[#30D158]" />
                <span className="text-[11px] font-medium text-[#8E8E93]">Active Days</span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {activeDaysCount} {activeDaysCount === 1 ? 'day' : 'days'}
              </p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">Logged this month</p>
            </div>
          </div>

          {/* Activity summary banner linking to Activity History */}
          <button
            type="button"
            onClick={onNavigateActivity}
            className="w-full p-3 rounded-xl bg-black/30 hover:bg-black/40 border border-white/[0.04] flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-[#30D158] transition-colors">
                  Monthly Activity History
                </p>
                <p className="text-[11px] text-[#8E8E93]">
                  {activeDaysCount} logged workout & meal days on calendar
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#30D158] flex items-center gap-0.5 shrink-0">
              <span>View</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      ) : (
        /* Transparent Empty State */
        <div className="p-4 rounded-2xl bg-black/20 border border-white/[0.04] text-center space-y-1.5">
          <p className="text-xs font-semibold text-white">No trend history yet</p>
          <p className="text-[11px] text-[#8E8E93] leading-relaxed max-w-xs mx-auto">
            Keep logging your daily meals and exercises. As your history builds, Nuvia will reveal your long-term consistency and adherence trends here.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onNavigateActivity}
              className="text-xs text-[#30D158] font-semibold hover:underline"
            >
              Check Activity Calendar →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
