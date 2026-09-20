import { createClient, isSupabaseConfigured } from './supabase/client';

export interface MealAnalysisResult {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_name: string;
  foods: {
    name: string;
    estimated_quantity: number;
    unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  total: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  confidence: 'high' | 'medium' | 'low';
  assumptions: string[];
  notes?: string;
}

export interface ExerciseAnalysisResult {
  exercise_type: string;
  duration_minutes: number;
  intensity: 'low' | 'moderate' | 'high';
  distance_km: number | null;
  calories_burned: number;
  confidence: 'high' | 'medium' | 'low';
  ai_tip: string;
}

export interface CoachAdviceResult {
  headline: string;
  priorities: {
    category: 'Nutrition' | 'Protein' | 'Exercise';
    priority: number;
    message: string;
  }[];
}

export const AiService = {
  async analyzeMeal(params: {
    imageBase64?: string;
    mimeType?: string;
    textPrompt?: string;
    mealType?: string;
  }): Promise<MealAnalysisResult> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data, error } = await supabase.functions.invoke('analyze-meal', {
            body: params,
          });
          if (!error && data?.success && data?.data) {
            return data.data;
          }
        }
      }

      // Local API route fallback
      const res = await fetch('/api/ai/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to analyze meal');
      }
      return json.data;
    } catch {
      throw new Error("We couldn't analyze this right now. Please try again.");
    }
  },

  async parseExercise(params: {
    textPrompt?: string;
    userWeightKg?: number;
    manualData?: {
      exercise_type: string;
      duration_minutes: number;
      intensity: 'low' | 'moderate' | 'high';
      distance_km?: number | null;
    };
  }): Promise<ExerciseAnalysisResult> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data, error } = await supabase.functions.invoke('parse-exercise', {
            body: params,
          });
          if (!error && data?.success && data?.data) {
            return data.data;
          }
        }
      }

      const res = await fetch('/api/ai/parse-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error('Exercise parse failed');
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to parse exercise');
      }
      return json.data;
    } catch {
      throw new Error("We couldn't analyze this exercise right now. Please try again.");
    }
  },

  async getCoachAdvice(params: {
    todaySummary: any;
    goals: any;
    profile: any;
    recentMeals: any[];
    recentExercises?: string[];
    chatMessage?: string;
    fitnessContext?: any;
  }): Promise<{ reply?: string; advice?: CoachAdviceResult }> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data, error } = await supabase.functions.invoke('ai-coach', {
            body: params,
          });
          if (!error && data?.success) {
            if (data.mode === 'chat') return { reply: data.reply };
            return { advice: data.data };
          }
        }
      }

      const res = await fetch('/api/ai/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error('Coach advice failed');
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to get advice');
      }

      if (json.mode === 'chat') {
        return { reply: json.reply };
      }
      return { advice: json.data };
    } catch {
      throw new Error("We couldn't reach your AI Coach right now. Please try again.");
    }
  },
};
