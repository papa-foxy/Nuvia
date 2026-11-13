import type {
  NaturalLanguageLoggingContext,
  NaturalLanguageParseResult,
} from '@/types/natural-language';

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
  }): Promise<{
    reply?: string;
    advice?: CoachAdviceResult;
    intentAnalysis?: any;
    proposal?: any;
  }> {
    try {

      // The coach only reads each meal's type and description; sending whole
      // meal objects uploaded every past meal on each request.
      const recentMeals = (params.recentMeals || [])
        .slice(0, 30)
        .map((m: { meal_type?: string; description?: string | null }) => ({
          meal_type: m.meal_type,
          description: m.description,
        }));
      const res = await fetch('/api/ai/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, recentMeals }),
      });

      if (!res.ok) {
        throw new Error('Coach advice failed');
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to get advice');
      }

      if (json.mode === 'chat') {
        return {
          reply: json.reply,
          intentAnalysis: json.intentAnalysis,
          proposal: json.intentAnalysis?.proposal,
        };
      }
      return { advice: json.data };
    } catch {
      throw new Error("We couldn't reach your AI Coach right now. Please try again.");
    }
  },

  async parseNaturalInput(params: {
    text: string;
    context?: NaturalLanguageLoggingContext;
  }): Promise<NaturalLanguageParseResult> {
    try {
      const res = await fetch('/api/ai/parse-natural-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error('Parsing service returned error status');
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to interpret natural language input');
      }

      return json.data;
    } catch (err: any) {
      console.warn('parseNaturalInput error, falling back to local engine:', err);
      const { parseNaturalLanguageLocally } = await import('./natural-language-parser');
      return parseNaturalLanguageLocally(params.text, params.context);
    }
  },
};

