'use client';

import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronRight } from 'lucide-react';
import { NuviaBottomSheet } from '@/components/NuviaBottomSheet';
import type { RescheduleProposal } from '@/types/adaptive-training';

const READY_AT = 90;

function readinessTone(pct: number) {
  if (pct >= READY_AT) return { label: 'Recovered', className: 'bg-accent/15 text-green-ink' };
  if (pct >= 70) return { label: `${pct}% recovered`, className: 'bg-accent/10 text-green-ink' };
  if (pct >= 40) return { label: `${pct}% recovered`, className: 'bg-warn/15 text-orange-ink' };
  return { label: `${pct}% recovered`, className: 'bg-danger/15 text-red-ink' };
}

function weekdayOf(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}

interface MissedSessionNoticeProps {
  proposal: RescheduleProposal;
  /** Save the choice: move to a date, or skip the session. */
  onChoose: (proposal: RescheduleProposal, choice: { to_date: string; action: 'move' | 'skip' }) => Promise<void> | void;
}

/**
 * A quiet one-line note about a missed session. Tapping it opens a sheet to
 * pick any day in the next week; each day shows how recovered the routine's
 * muscles will be. Nuvia suggests a day, but the choice is the user's.
 */
export function MissedSessionNotice({ proposal, onChoose }: MissedSessionNoticeProps) {
  const [open, setOpen] = useState(false);
  const days = useMemo(() => proposal.day_options ?? [], [proposal.day_options]);
  const recommended = days.find((d) => d.recommended)?.date ?? proposal.suggested_date;
  const [picked, setPicked] = useState<string>(recommended);
  const [saving, setSaving] = useState(false);
  const pickedDay = days.find((d) => d.date === picked);

  const choose = async (choice: { to_date: string; action: 'move' | 'skip' }) => {
    setSaving(true);
    try {
      await onChoose(proposal, choice);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPicked(recommended);
          setOpen(true);
        }}
        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[var(--radius-card)] bg-card border border-line/60 text-left hover:border-fg/25 transition-colors"
      >
        <span className="w-9 h-9 rounded-full bg-warn/15 text-orange-ink flex items-center justify-center shrink-0" aria-hidden="true">
          <CalendarClock className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-fg truncate">
            Missed {weekdayOf(proposal.from_date)}: {proposal.routine_title}
          </span>
          <span className="block text-[11px] text-muted truncate">Pick a day to make it up, or skip it</span>
        </span>
        <span className="text-xs font-semibold text-green-ink shrink-0 flex items-center gap-0.5">
          Reschedule
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </button>

      <NuviaBottomSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Make up ${proposal.routine_title}`}
        subtitle={`Missed on ${weekdayOf(proposal.from_date)}`}
        variant="standard"
      >
        <div className="space-y-4">
          {days.length > 0 ? (
            <>
              <p className="text-sm text-muted leading-relaxed">
                Recovery is based on the sets you&apos;ve logged. Nuvia suggests a day, but go by how you feel.
              </p>
              <div className="space-y-1.5" role="radiogroup" aria-label="Choose a day">
                {days.map((d) => {
                  const tone = readinessTone(d.readiness);
                  const isPicked = picked === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      onClick={() => setPicked(d.date)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-left transition-colors ${
                        isPicked ? 'border-accent bg-accent/10' : 'border-line/60 bg-card hover:border-fg/25'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isPicked ? 'border-accent bg-accent text-on-accent' : 'border-fg/25'
                        }`}
                        aria-hidden="true"
                      >
                        {isPicked && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-fg">{d.label}</span>
                          {d.recommended && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-on-accent">Suggested</span>
                          )}
                        </span>
                        <span className="block text-[11px] text-subtle truncate">
                          {d.planned ? `Also planned: ${d.planned}` : d.isRestDay ? 'Free day' : 'Training day'}
                        </span>
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${tone.className}`}>{tone.label}</span>
                    </button>
                  );
                })}
              </div>

              {pickedDay && pickedDay.readiness < READY_AT && (
                <p className="text-xs text-muted bg-surface border border-line/60 rounded-xl px-3 py-2" role="status">
                  These muscles are still recovering on {pickedDay.label.toLowerCase() === 'today' ? 'today' : pickedDay.label}. If you feel good, go
                  ahead, and keep the weights a little lighter.
                </p>
              )}

              <button
                type="button"
                disabled={saving || !pickedDay}
                onClick={() => choose({ to_date: picked, action: 'move' })}
                className="w-full h-12 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm transition-colors disabled:opacity-50"
              >
                {pickedDay ? `Move to ${pickedDay.label}` : 'Move'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => choose({ to_date: proposal.suggested_date, action: 'move' })}
              className="w-full h-12 rounded-2xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm transition-colors disabled:opacity-50"
            >
              Move to {proposal.options.find((o) => o.action === 'move')?.label.replace(/^Move to /, '') || 'suggested day'}
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => choose({ to_date: proposal.from_date, action: 'skip' })}
            className="w-full h-11 rounded-2xl bg-card border border-line/60 text-fg font-semibold text-sm transition-colors disabled:opacity-50"
          >
            Skip it and keep my plan
          </button>
        </div>
      </NuviaBottomSheet>
    </>
  );
}
