'use client';

import React, { useState } from 'react';
import {
  X,
  Flame,
  Trophy,
  Zap,
  Shield,
  Target,
  Award,
  Star,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calendar as CalendarIcon,
  Sparkles,
  Plus,
} from 'lucide-react';
import { StreakData, MilestoneBadge } from '@/types/streak';
import { getLocalDateString } from '@/lib/data-service';

interface StreakCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakData: StreakData | null;
  onLogActivity?: () => void;
}

export function StreakCalendarModal({
  isOpen,
  onClose,
  streakData,
  onLogActivity,
}: StreakCalendarModalProps) {
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'badges'>('calendar');

  if (!isOpen) return null;

  const currentStreak = streakData?.currentStreak || 0;
  const longestStreak = streakData?.longestStreak || 0;
  const totalActiveDays = streakData?.totalActiveDays || 0;
  const monthlyConsistencyPct = streakData?.monthlyConsistencyPct || 0;
  const activeDatesSet = new Set(streakData?.activeDates || []);

  const now = new Date();
  const todayStr = getLocalDateString(now);

  // Compute viewed month
  const viewedDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1);
  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth(); // 0-indexed

  const monthName = viewedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Month days computation (Monday as start of week)
  const firstDayOfMonth = new Date(viewedYear, viewedMonth, 1).getDay(); // 0 = Sun
  const leadingBlanks = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate();

  const calendarDays: Array<{
    dayNumber: number;
    dateStr: string;
    isToday: boolean;
    isActive: boolean;
    isFuture: boolean;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(viewedYear, viewedMonth, d);
    const dateStr = getLocalDateString(dayDate);
    const isToday = dateStr === todayStr;
    const isFuture = dayDate.getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const isActive = activeDatesSet.has(dateStr);

    calendarDays.push({
      dayNumber: d,
      dateStr,
      isToday,
      isActive,
      isFuture,
    });
  }

  const renderBadgeIcon = (iconName: MilestoneBadge['icon'], unlocked: boolean) => {
    const className = `w-5 h-5 ${unlocked ? 'text-white' : 'text-zinc-500'}`;
    switch (iconName) {
      case 'flame':
        return <Flame className={className} />;
      case 'trophy':
        return <Trophy className={className} />;
      case 'shield':
        return <Shield className={className} />;
      case 'zap':
        return <Zap className={className} />;
      case 'target':
        return <Target className={className} />;
      case 'award':
        return <Award className={className} />;
      case 'star':
      default:
        return <Star className={className} />;
    }
  };

  const getStreakMotivation = (streak: number) => {
    if (streak === 0) return 'Log today’s meal or workout to start your streak!';
    if (streak === 1) return 'Great first step! Consistency turns into habit.';
    if (streak <= 3) return 'Solid momentum! You are building a consistent routine.';
    if (streak <= 6) return 'You are on fire! Discipline is taking over.';
    return 'Unstoppable consistency! True champion habit.';
  };

  const isTodayLogged = activeDatesSet.has(todayStr);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:p-4 pb-[calc(68px+env(safe-area-inset-bottom,0px))] animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Sheet */}
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-[28px] max-h-[calc(100dvh-68px-env(safe-area-inset-bottom,0px)-1rem)] flex flex-col overflow-hidden shadow-2xl z-10 animate-slideUp">
        {/* Grab Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF9500] to-[#FF3B30] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Flame className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Activity & Streaks</h2>
              <p className="text-[11px] text-[#8E8E93]">Daily consistency & achievements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Hero Banner Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF9500]/20 via-[#FF3B30]/10 to-transparent border border-[#FF9500]/20 p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/30 uppercase">
                  <Sparkles className="w-3 h-3" />
                  Streak Engine
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-extrabold tracking-tight text-white">
                    {currentStreak}
                  </span>
                  <span className="text-lg font-bold text-white/90">
                    {currentStreak === 1 ? 'Day Active' : 'Days Streak'}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 max-w-[280px] leading-relaxed">
                  {getStreakMotivation(currentStreak)}
                </p>
              </div>

              {/* Flame Badge Ring */}
              <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF9500] to-[#FF3B30] shadow-lg shadow-orange-500/30">
                <Flame className="w-8 h-8 text-white fill-white animate-pulse" />
              </div>
            </div>

            {/* Quick action if today is not logged */}
            {!isTodayLogged && onLogActivity && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-amber-300 font-medium">
                  Keep streak alive for today!
                </span>
                <button
                  onClick={() => {
                    onClose();
                    onLogActivity();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#FF9500] text-black font-semibold text-xs flex items-center gap-1 hover:bg-[#FF9500]/90 transition-transform active:scale-95 shadow-md shadow-orange-500/20"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Log Today
                </button>
              </div>
            )}
          </div>

          {/* 4-Stat Glance Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-medium text-zinc-400 block uppercase tracking-wider">Current</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{currentStreak}d</span>
            </div>
            <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-medium text-zinc-400 block uppercase tracking-wider">Longest</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{longestStreak}d</span>
            </div>
            <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-medium text-zinc-400 block uppercase tracking-wider">Total</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{totalActiveDays}d</span>
            </div>
            <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-medium text-zinc-400 block uppercase tracking-wider">Month</span>
              <span className="text-lg font-bold text-[#30D158] mt-0.5 block">{monthlyConsistencyPct}%</span>
            </div>
          </div>

          {/* Section Segment Controls (Calendar vs Badges) */}
          <div className="flex bg-[#1C1C1E] p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar Heatmap
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'badges'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Trophies & Badges
            </button>
          </div>

          {/* TAB 1: CALENDAR HEATMAP */}
          {activeTab === 'calendar' && (
            <div className="bg-[#1C1C1E] rounded-2xl border border-white/5 p-4 space-y-3">
              {/* Month Navigation */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{monthName}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedMonthOffset((prev) => prev - 1)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedMonthOffset(0)}
                    disabled={selectedMonthOffset === 0}
                    className={`px-2 h-7 rounded-lg text-[10px] font-semibold transition-colors ${
                      selectedMonthOffset === 0
                        ? 'text-zinc-500 bg-transparent'
                        : 'text-zinc-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setSelectedMonthOffset((prev) => prev + 1)}
                    disabled={selectedMonthOffset >= 0}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      selectedMonthOffset >= 0
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500 uppercase">
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
                <span>Su</span>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {/* Leading empty spaces */}
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-9" />
                ))}

                {/* Day cells */}
                {calendarDays.map((d) => {
                  const isSelected = selectedDateStr === d.dateStr;

                  return (
                    <button
                      key={d.dateStr}
                      onClick={() => setSelectedDateStr(d.dateStr)}
                      disabled={d.isFuture}
                      className={`relative h-9 rounded-xl flex flex-col items-center justify-center text-xs transition-all ${
                        d.isFuture
                          ? 'opacity-25 text-zinc-600 cursor-not-allowed'
                          : isSelected
                          ? 'ring-2 ring-white bg-white/15 text-white font-bold'
                          : d.isActive
                          ? 'bg-gradient-to-b from-[#FF9500]/25 to-[#FF3B30]/20 text-white font-semibold hover:bg-orange-500/30'
                          : d.isToday
                          ? 'border border-white/30 text-white font-semibold'
                          : 'text-zinc-400 hover:bg-white/5'
                      }`}
                    >
                      <span className="leading-none text-[11px]">{d.dayNumber}</span>
                      {d.isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF9500] mt-1 shadow-sm shadow-orange-500/50" />
                      )}
                      {d.isToday && !d.isActive && (
                        <div className="w-1 h-1 rounded-full bg-white/60 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend & Selected Day Info */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#FF9500]" />
                    Logged Active
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border border-white/40" />
                    Today
                  </span>
                </div>
                {selectedDateStr && (
                  <span className="text-white font-medium">
                    {activeDatesSet.has(selectedDateStr) ? '🔥 Activity logged' : 'No records'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MILESTONES & BADGES */}
          {activeTab === 'badges' && (
            <div className="space-y-2.5">
              {(streakData?.badges || []).map((b) => {
                const pct = Math.round((b.progress / b.maxProgress) * 100);

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 ${
                      b.unlocked
                        ? 'bg-gradient-to-r from-white/[0.07] to-white/[0.03] border-white/10'
                        : 'bg-[#1C1C1E] border-white/5 opacity-70'
                    }`}
                  >
                    {/* Badge Icon Circle */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        b.unlocked
                          ? 'bg-gradient-to-tr from-[#FF9500] to-[#FF3B30] shadow-md shadow-orange-500/20'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      {renderBadgeIcon(b.icon, b.unlocked)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-bold truncate ${b.unlocked ? 'text-white' : 'text-zinc-400'}`}>
                          {b.title}
                        </h4>
                        {b.unlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Unlocked
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-medium">
                            {b.progress} / {b.maxProgress}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-1">
                        {b.description}
                      </p>

                      {/* Progress Bar (if not unlocked) */}
                      {!b.unlocked && (
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#FF9500] to-[#FF3B30] h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
