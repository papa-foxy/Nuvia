'use client';

import { useEffect, useState } from 'react';
import { DataService } from '@/lib/data-service';
import { NuviaCache, exerciseLogsKey } from '@/lib/nuvia-cache';
import type { ExerciseLog } from '@/types/database';
import type { StreakData } from '@/types/streak';

export function useTrainingOverview(userId: string | undefined, refreshKey?: number) {
  const [logs, setLogs] = useState<ExerciseLog[] | null>(
    () => NuviaCache.get<ExerciseLog[]>(exerciseLogsKey(userId))?.data ?? null,
  );
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([DataService.getExerciseLogs(userId), DataService.getStreakData(userId)])
      .then(([l, s]) => {
        if (cancelled) return;
        NuviaCache.set(exerciseLogsKey(userId), l);
        setLogs(l);
        setStreak(s);
      })
      .catch((e) => {
        console.error('Training overview load failed', e);
        if (!cancelled) setLogs((prev) => prev ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  return { logs, streak };
}
