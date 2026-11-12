'use client';

import React from 'react';
import { Flame, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/**
 * Top-of-screen header: eyebrow, large title, optional streak pill and the
 * avatar button that opens Profile (Profile is not a bottom-nav tab).
 */
export function ScreenHeader({
  eyebrow,
  title,
  streak,
  onOpenProfile,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  streak?: number | null;
  onOpenProfile?: () => void;
  trailing?: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const avatarUrl = profile?.avatar_url || user?.avatar_url;
  const initial = (profile?.name || user?.full_name || '').trim().charAt(0).toUpperCase();

  return (
    <header className="px-5 pt-2 pb-1 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold text-muted">{eyebrow}</p>}
        <h1 className="mt-0.5 text-[28px] leading-tight font-extrabold tracking-tight text-fg truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0 pb-1">
        {trailing}
        {typeof streak === 'number' && streak > 0 && (
          <span
            className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-card border border-line text-xs font-extrabold text-fg tabular-nums"
            title={`${streak}-day streak`}
          >
            <Flame className="w-3.5 h-3.5 text-warn" />
            {streak}
          </span>
        )}
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Open profile"
            className="w-10 h-10 rounded-full bg-card border border-line flex items-center justify-center overflow-hidden text-sm font-extrabold text-fg hover:border-fg/30 transition-colors cursor-pointer"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : initial ? (
              initial
            ) : (
              <User className="w-4 h-4 text-muted" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
