// Supabase Edge Function: ai-coach
// Model: gemini-3.8-flash
// Daily coaching & conversational assistant rooted in actual logged data

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

    const { todaySummary, goals, profile, recentMeals, chatMessage } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Server AI configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userContext = `
USER CONTEXT:
- Name: ${profile?.name || 'User'}
- Goal: ${profile?.goal || 'Healthy lifestyle'}
- Dietary Preference: ${profile?.dietary_preference || 'None'}
- Allergies: ${(profile?.allergies || []).join(', ') || 'None'}
- Calorie Goal: ${goals?.calorie_target || 2000} kcal (Consumed: ${todaySummary?.calories_consumed || 0} kcal, Remaining: ${Math.max(0, (goals?.calorie_target || 2000) - (todaySummary?.calories_consumed || 0))} kcal)
- Protein Goal: ${goals?.protein_target || 140} g (Consumed: ${todaySummary?.protein_consumed || 0} g, Remaining: ${Math.max(0, (goals?.protein_target || 140) - (todaySummary?.protein_consumed || 0))} g)
- Carbs Consumed: ${todaySummary?.carbohydrate_consumed || 0} g / Target ${goals?.carbohydrate_target || 220} g
- Fat Consumed: ${todaySummary?.fat_consumed || 0} g / Target ${goals?.fat_target || 65} g
- Exercise: ${todaySummary?.exercise_minutes || 0} min / Target ${goals?.exercise_minutes_target || 30} min (Burned: ${todaySummary?.calories_burned || 0} kcal)
- Recent meals today: ${(recentMeals || []).map((m: any) => `${m.meal_type}: ${m.description} (${m.calories} kcal, ${m.protein_g}g protein)`).join('; ') || 'None yet'}
`;

    if (chatMessage) {
      // Conversational response
      const systemPrompt = `You are Nuvia's intelligent AI Coach.
Respond warmly, concisely, and practically to the user's question.
Always use their actual logged data provided in the user context.
Do not produce essays; answer in 2-3 focused sentences.
Give specific food or action recommendations that fit their remaining calorie/protein targets.
Never provide dangerous restriction advice or pretend to give clinical diagnoses.`;

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
                  { text: userContext },
                  { text: `User message: "${chatMessage}"` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.5,
            },
          }),
        }
      );

      const geminiData = await geminiRes.json();
      const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "You're making steady progress today! Keep focusing on your nutrition and movement.";

      return new Response(
        JSON.stringify({ success: true, mode: 'chat', reply }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Prioritized daily coaching cards
      const systemPrompt = `You are Nuvia's AI Fitness & Nutrition Coach.
Analyze the user's progress today against their goals.
Generate prioritized, highly actionable guidance in strictly valid JSON format:
{
  "headline": "Here's your daily summary and advice for better results:",
  "priorities": [
    {
      "category": "Nutrition" | "Protein" | "Exercise",
      "priority": 1 | 2 | 3,
      "message": "Specific actionable message referencing remaining calories/gap and concrete food/action suggestions"
    }
  ]
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
                  { text: userContext },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        }
      );

      const geminiData = await geminiRes.json();
      const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(candidateText);

      return new Response(
        JSON.stringify({ success: true, mode: 'priorities', data: parsed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "We couldn't generate advice right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
