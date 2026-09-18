'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ProfileViewProps {
  onReplayOnboarding: () => void;
}

export function ProfileView({ onReplayOnboarding }: ProfileViewProps) {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="flex-1 flex flex-col pb-20 px-5 pt-4 max-w-md mx-auto space-y-6">
      {/* Title */}
      <div className="pt-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
          Account
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">
          Profile
        </h1>
      </div>

      {/* User Header Cell */}
      <div className="ios-card p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center text-white font-bold text-lg">
          {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">
            {profile?.name || user?.email?.split('@')[0] || 'Member'}
          </h2>
          <p className="text-xs text-[#8E8E93]">{user?.email || ''}</p>
        </div>
      </div>

      {/* Health Details Group */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
            Health Details
          </span>
          <button
            onClick={onReplayOnboarding}
            className="text-xs text-[#30D158] hover:underline font-medium"
          >
            Recalculate Plan
          </button>
        </div>

        <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Biological Sex</span>
            <span className="font-semibold text-white capitalize">{profile?.sex || 'Male'}</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Height</span>
            <span className="font-semibold text-white">{profile?.height_cm || 176} cm</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Weight</span>
            <span className="font-semibold text-white">{profile?.weight_kg || 73} kg</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Target Weight</span>
            <span className="font-semibold text-white">{profile?.target_weight_kg || 68} kg</span>
          </div>
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#8E8E93]">Dietary Preference</span>
            <span className="font-semibold text-white">{profile?.dietary_preference || 'None'}</span>
          </div>
        </div>
      </div>

      {/* Account Controls */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
          Account Session
        </span>

        <div className="ios-card divide-y divide-white/[0.06] overflow-hidden text-xs">
          <button
            onClick={signOut}
            className="w-full p-3.5 flex justify-between items-center text-left text-[#FF453A] font-medium hover:bg-white/[0.02]"
          >
            <span>Sign Out</span>
            <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#636366] pt-4">
        Nuvia PWA · Gemini 3.8 Flash
      </p>
    </div>
  );
}
