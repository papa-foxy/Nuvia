export interface RoutineExercise {
  id: string;
  name: string;
  target_muscle: string; // e.g. 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs', 'Full Body'
  sets: number;
  reps: string; // e.g. '10-12', '15', '40-60 sec', '20 per side'
  rest_seconds?: number;
  notes?: string; // e.g. 'Blue/Chest position', 'hold dumbbell', 'done first'
  thumbnail_url: string; // SVG data URI or image URL
  youtube_id: string; // YouTube Video ID for direct embedded player
  youtube_url: string; // Direct YouTube watch link
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
