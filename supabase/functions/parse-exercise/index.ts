// Supabase Edge Function: parse-exercise
// Model: gemini-3.8-flash
// Calculates calorie burn using MET and user body weight

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { textPrompt, userWeightKg, manualData } = await req.json();
    const weight = Number(userWeightKg) || 70;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Server AI configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const promptText = textPrompt
      ? `Natural language description: "${textPrompt}"`
      : `Manual input: Type=${manualData?.exercise_type}, Duration=${manualData?.duration_minutes}m, Intensity=${manualData?.intensity}, Distance=${manualData?.distance_km}km`;

    const systemPrompt = `You are an exercise analysis assistant for the fitness app Nuvia.
The user weighs approximately ${weight} kg.
Analyze the exercise prompt and estimate calories burned using MET (Metabolic Equivalent of Task) formulas:
Calories burned = MET * weight_kg * (duration_minutes / 60).
Examples of MET:
- Walking: 3.5
- Jogging/Running: 7.0 - 10.0
- Cycling: 6.0 - 8.5
- Weight Training: 3.5 - 5.5
- HIIT: 8.0 - 11.0
- Badminton / Tennis: 5.5 - 7.0
- Swimming: 6.0 - 8.0

Return strictly valid JSON matching this schema:
{
  "exercise_type": "Running (Cardio)" or "Chest Workout (Strength)" etc,
  "duration_minutes": 30,
  "intensity": "low" | "moderate" | "high",
  "distance_km": 5.0 or null,
  "calories_burned": 320,
  "confidence": "high" | "medium" | "low",
  "ai_tip": "One concise, encouraging, personalized tip for recovery or technique"
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini exercise error:', errText);
      return new Response(
        JSON.stringify({ error: "We couldn't analyze this exercise right now. Please try again." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(candidateText);

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "We couldn't analyze this exercise right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
