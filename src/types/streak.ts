export interface StreakDay {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // 'M', 'T', 'W', etc.
  dayNumber: number; // 1-31
  isToday: boolean;
  isLogged: boolean;
  isFuture: boolean;
  hasMeal: boolean;
  hasWorkout: boolean;
  calories: number;
  burned: number;
}

export interface MilestoneBadge {
  id: string;
  title: string;
  description: string;
  icon: 'flame' | 'trophy' | 'zap' | 'shield' | 'target' | 'award' | 'star';
  category: 'streak' | 'nutrition' | 'fitness';
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  weeklyDays: StreakDay[];
  activeDates: string[]; // YYYY-MM-DD
  badges: MilestoneBadge[];
  monthlyConsistencyPct: number;
}
