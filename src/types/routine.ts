export interface RoutineExercise {
  id: string;
  /** Reference to the catalog exercise ID this was built from */
  catalog_id?: string;
  name: string;
  target_muscle: string; // e.g. 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs', 'Full Body'
  sets: number;
  reps: string; // e.g. '10-12', '15', '40-60 sec', '20 per side'
  min_reps?: number;
  max_reps?: number;
  target_weight_kg?: number;
  rest_seconds?: number;
  notes?: string; // e.g. 'Blue/Chest position', 'hold dumbbell', 'done first'
  thumbnail_url: string; // SVG data URI or image URL
  youtube_id: string; // YouTube Video ID for direct embedded player
  youtube_url: string; // Direct YouTube watch link
  image_url?: string; // Optional custom photo or uploaded image
  video_thumbnail_url?: string; // Optional direct video thumbnail
  thumbnail_type?: 'youtube' | 'custom' | 'svg' | 'placeholder';
  completed?: boolean;
}

export interface WorkoutRoutine {
  id: string;
  user_id: string;
  title: string; // e.g. 'Monday & Wednesday - Upper Body (Push-up Board + Dumbbells)'
  days: string[]; // e.g. ['Monday', 'Wednesday']
  focus?: string; // e.g. 'Upper Body', 'Abs', 'Push & Pull'
  description?: string;
  exercises: RoutineExercise[];
  created_at: string;
  updated_at?: string;
}

/** Individual completed set in an active workout session */
export interface LoggedSet {
  set_number: number;
  reps: number;
  weight_kg?: number;
  completed: boolean;
}

/** Actual set-by-set execution recorded during a workout */
export interface ExercisePerformance {
  exercise_id: string;
  name: string;
  target_muscle: string;
  sets: LoggedSet[];
  replaced_from?: string; // If this exercise replaced another in the active session
}

/** Lifetime statistics for a specific workout routine */
export interface RoutineWorkoutStats {
  completedCount: number;
  lastCompletedDate: string | null;
  totalDurationMinutes: number;
  totalCaloriesBurned: number;
}

