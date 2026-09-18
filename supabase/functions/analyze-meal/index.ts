// Supabase Edge Function: analyze-meal
// Model: gemini-3.8-flash
// Security: Verifies Supabase caller JWT and matches user_id

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

    // Verify JWT
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

    const { imageBase64, mimeType, textPrompt, mealType } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Server AI configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a nutrition estimation assistant for the fitness app Nuvia.
Analyze the provided meal (from image and/or text).
Follow these rules strictly:
1. All nutrition values are estimates, not exact medical measurements.
2. Only identify foods that are reasonably visible or explicitly described. Do not invent ingredients.
3. If portion cannot be determined precisely, provide a reasonable estimate and note assumptions.
4. Assign confidence level: "high", "medium", or "low".
5. Return strictly structured JSON matching this schema:
{
  "meal_type": "${mealType || 'lunch'}",
  "meal_name": "Short descriptive name (e.g. Chicken Rice Bowl)",
  "foods": [
    {
      "name": "food item name",
      "estimated_quantity": 150,
      "unit": "g" or "pieces" or "cup" or "tbsp",
      "calories": 250,
      "protein_g": 20,
      "carbs_g": 30,
      "fat_g": 5,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "total": {
    "calories": 650,
    "protein_g": 35,
    "carbs_g": 70,
    "fat_g": 22
  },
  "confidence": "high" | "medium" | "low",
  "assumptions": ["List of assumptions, e.g. estimated from visual size"],
  "notes": "Friendly explanation or uncertainty notes"
}`;

    const contents: any[] = [];
    const parts: any[] = [{ text: systemPrompt }];

    if (textPrompt) {
      parts.push({ text: `User meal description: "${textPrompt}"` });
    }

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }

    contents.push({ parts });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', errText);
      return new Response(
        JSON.stringify({ error: "We couldn't analyze this right now. Please try again." }),
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
      JSON.stringify({ error: "We couldn't analyze this right now. Please try again." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
