'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { getLocalDateString } from '@/lib/data-service';

export interface DateFilterBarProps {
  selectedDate: string; // Format: 'YYYY-MM-DD'
  onDateChange: (newDate: string) => void;
  className?: string;
}

export function DateFilterBar({
  selectedDate,
  onDateChange,
  className = '',
}: DateFilterBarProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const todayStr = getLocalDateString();

  // Split selectedDate safely
  const [selYear, selMonth, selDay] = (selectedDate || todayStr)
    .split('-')
    .map(Number);

  // Month & year being viewed in the calendar modal (0-indexed month)
  const [viewYear, setViewYear] = useState(() => selYear || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selMonth ? selMonth - 1 : new Date().getMonth()));

  // Keep viewed month synced whenever the modal opens or selectedDate changes
  useEffect(() => {
    if (selYear && selMonth) {
      setViewYear(selYear);
      setViewMonth(selMonth - 1);
    }
  }, [selectedDate, isCalendarOpen]);

  // Navigate date by +/- N days
  const changeDateBy = (days: number) => {
    const current = new Date(selYear, selMonth - 1, selDay);
    current.setDate(current.getDate() + days);
    onDateChange(getLocalDateString(current));
  };

  // Date label formatted for display
  const selectedDateObj = new Date(selYear, selMonth - 1, selDay);
  const dateLabel = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Calendar month view computations
  const viewedDate = new Date(viewYear, viewMonth, 1);
  const monthName = viewedDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Monday as week start (1=Mon ... 0=Sun -> leading blanks: Mon=0, Sun=6)
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onDateChange(getLocalDateString(d));
    setIsCalendarOpen(false);
  };

  return (
    <>
      {/* Date Filter Bar Pill */}
      <div
        className={`flex items-center gap-1.5 bg-[#1C1C1E] px-2 py-1.5 rounded-full border border-white/[0.08] shadow-sm ${className}`}
      >
        {/* Previous Day */}
        <button
          onClick={() => changeDateBy(-1)}
          className="p-1.5 text-[#8E8E93] hover:text-white transition-colors rounded-full hover:bg-white/[0.06] active:scale-95"
          title="Previous Day"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Date / Calendar Trigger Button */}
        <button
          onClick={() => setIsCalendarOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white hover:bg-white/[0.08] transition-colors group cursor-pointer"
          title="Open calendar to pick a date"
          type="button"
        >
          <CalendarIcon className="w-3.5 h-3.5 text-[#30D158] group-hover:scale-110 transition-transform" />
          <span className="whitespace-nowrap">{dateLabel}</span>
        </button>

        {/* Next Day */}
        <button
          onClick={() => changeDateBy(1)}
          className="p-1.5 text-[#8E8E93] hover:text-white transition-colors rounded-full hover:bg-white/[0.06] active:scale-95"
          title="Next Day"
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Selector Modal */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-white/[0.12] rounded-3xl p-5 shadow-2xl space-y-4 animate-slideUp">
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#30D158]/15 flex items-center justify-center text-[#30D158]">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Select Date</h3>
                  <p className="text-[11px] text-[#8E8E93]">Choose a date to view entries</p>
                </div>
              </div>
              <button
                onClick={() => setIsCalendarOpen(false)}
                className="w-7 h-7 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Month / Year Navigator */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                type="button"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-white">{monthName}</span>
              <button
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                type="button"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar Weekday Headers */}
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
              <span>Su</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Blank offset days */}
              {Array.from({ length: leadingBlanks }).map((_, idx) => (
                <div key={`blank-${idx}`} className="h-8" />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dObj = new Date(viewYear, viewMonth, dayNum);
                const dStr = getLocalDateString(dObj);
                const isDaySelected = dStr === selectedDate;
                const isDayToday = dStr === todayStr;

                return (
                  <button
                    key={dStr}
                    onClick={() => handleSelectDay(dayNum)}
                    type="button"
                    className={`h-8 rounded-xl flex items-center justify-center text-xs font-semibold transition-all relative ${
                      isDaySelected
                        ? 'bg-[#30D158] text-black font-bold shadow-md shadow-[#30D158]/30 scale-105 z-10'
                        : isDayToday
                        ? 'border border-[#30D158] text-[#30D158] hover:bg-[#30D158]/10'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {isDayToday && !isDaySelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#30D158]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
