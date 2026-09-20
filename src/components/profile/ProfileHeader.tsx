'use client';

import React, { useState } from 'react';
import { ShieldCheck, Pencil } from 'lucide-react';
import { Profile } from '@/types/database';

interface ProfileHeaderProps {
  user: {
    id?: string;
    email?: string;
    avatar_url?: string | null;
    full_name?: string | null;
  } | null;
  profile: Profile | null;
  onEditProfile: () => void;
}

export function ProfileHeader({ user, profile, onEditProfile }: ProfileHeaderProps) {
  const [imgError, setImgError] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.avatar_url;
  const displayName = profile?.name || user?.full_name || user?.email?.split('@')[0] || 'Member';
  const email = user?.email || 'Nuvia Member';
  const isGoogle = Boolean(avatarUrl && !imgError);

  return (
    <div className="flex flex-col items-center text-center pt-2 pb-1">
      {/* Apple-style Centered Avatar with subtle ring */}
      <div className="relative mb-3.5 group">
        <div className="relative w-20 h-20 rounded-full p-0.5 bg-gradient-to-b from-white/20 to-white/5 shadow-xl shadow-black/40">
          {avatarUrl && !imgError ? (
            <img
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full rounded-full object-cover bg-[#1C1C1E]"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#2C2C2E] to-[#3A3A3C] flex items-center justify-center text-white font-semibold text-2xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Name and Verification Badge */}
      <div className="flex items-center justify-center gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {displayName}
        </h1>
        {isGoogle && (
          <span
            title="Google Verified Account"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.08] text-zinc-300 border border-white/10"
          >
            <ShieldCheck className="w-3 h-3 text-[#30D158]" />
            <span>Verified</span>
          </span>
        )}
      </div>

      {/* Email */}
      <p className="text-xs text-[#8E8E93] mt-1 font-normal tracking-wide">
        {email}
      </p>

      {/* Subtle Edit Action Pill */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onEditProfile}
          className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] active:scale-95 text-xs font-semibold text-white/90 border border-white/[0.06] transition-all flex items-center gap-1.5"
        >
          <Pencil className="w-3 h-3 text-[#30D158]" />
          <span>Edit Profile</span>
        </button>
      </div>
    </div>
  );
}
