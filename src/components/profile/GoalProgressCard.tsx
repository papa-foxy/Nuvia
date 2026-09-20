'use client';

import React from 'react';
import { Target, TrendingDown, TrendingUp, Minus, ArrowRight } from 'lucide-react';
import { Profile, Goal } from '@/types/database';

interface GoalProgressCardProps {
  profile: Profile | null;
  goals: Goal | null;
}

export function GoalProgressCard({ profile, goals }: GoalProgressCardProps) {
  const currentWeight = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const targetWeight = goals?.target_weight_kg
    ? Number(goals.target_weight_kg)
    : profile?.target_weight_kg
    ? Number(profile.target_weight_kg)
    : null;

  const rawGoal = profile?.goal || 'maintain_weight';
  const goalFormatted =
    rawGoal === 'lose_weight'
      ? 'Lose weight'
      : rawGoal === 'gain_weight'
      ? 'Gain weight'
      : rawGoal === 'build_muscle'
      ? 'Build muscle'
      : 'Maintain weight';

  // Calculate remaining difference
  const hasWeights = currentWeight !== null && targetWeight !== null;
  const diff = hasWeights ? Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10 : null;
  const isAtGoal = diff !== null && diff === 0;

  // Determine direction
  const isLosing = targetWeight !== null && currentWeight !== null && targetWeight < currentWeight;
  const isGaining = targetWeight !== null && currentWeight !== null && targetWeight > currentWeight;

  return (
    <div className="ios-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-[#30D158]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Goal Progress
          </span>
        </div>
      </div>

      {/* Main Stats: Current -> Target */}
      <div className="grid grid-cols-2 gap-3 pt-0.5">
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
          <span className="text-[11px] font-medium text-[#8E8E93] block">Current</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold tracking-tight text-white">
              {currentWeight !== null ? currentWeight : '—'}
            </span>
            <span className="text-xs font-semibold text-[#8E8E93]">kg</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8E8E93] block">Target</span>
            <span className="text-[10px] font-semibold text-[#30D158] px-1.5 py-0.2 rounded-full bg-[#30D158]/10">
              {goalFormatted}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold tracking-tight text-white">
              {targetWeight !== null ? targetWeight : '—'}
            </span>
            <span className="text-xs font-semibold text-[#8E8E93]">kg</span>
          </div>
        </div>
      </div>

      {/* Delta Callout */}
      {hasWeights ? (
        <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLosing ? (
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-[#30D158] flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            ) : isGaining ? (
              <div className="w-6 h-6 rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-zinc-500/15 text-zinc-400 flex items-center justify-center">
                <Minus className="w-3.5 h-3.5" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-white">
                {isAtGoal
                  ? 'Target reached! Maintaining weight.'
                  : `${diff} kg to goal`}
              </p>
              <p className="text-[11px] text-[#8E8E93]">
                {isLosing ? 'Gradual calorie deficit plan' : isGaining ? 'Surplus & muscle growth plan' : 'Maintenance balance'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-black/20 border border-white/[0.04] text-center">
          <p className="text-xs text-[#8E8E93]">
            Track progress towards your target weight in Your Daily Plan below.
          </p>
        </div>
      )}
    </div>
  );
}
