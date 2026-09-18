import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { textPrompt, userWeightKg, manualData } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    const weight = Number(userWeightKg) || 70;

    if (apiKey) {
      const promptText = textPrompt
        ? `Natural language description: "${textPrompt}"`
        : `Manual input: Type=${manualData?.exercise_type}, Duration=${manualData?.duration_minutes}m, Intensity=${manualData?.intensity}, Distance=${manualData?.distance_km}km`;

      const systemPrompt = `You are an exercise analysis assistant for the fitness app Nuvia.
The user weighs approximately ${weight} kg.
Analyze the workout and estimate calories burned using MET (Metabolic Equivalent of Task) formulas:
Calories burned = MET * weight_kg * (duration_minutes / 60).
Return strictly valid JSON matching this schema:
{
  "exercise_type": "Running (Cardio)" or "Chest Workout (Strength)" etc,
  "duration_minutes": 30,
  "intensity": "low" | "moderate" | "high",
  "distance_km": 5.0 or null,
  "calories_burned": 320,
  "confidence": "high" | "medium" | "low",
  "ai_tip": "One concise encouraging tip"
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
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

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, data: parsed });
      }
    }

    // Heuristic fallback
    const prompt = (textPrompt || '').toLowerCase();
    let exerciseType = manualData?.exercise_type || 'Workout Session';
    let duration = Number(manualData?.duration_minutes) || 30;
    let intensity: 'low' | 'moderate' | 'high' = manualData?.intensity || 'moderate';
    let distance: number | null = manualData?.distance_km ? Number(manualData.distance_km) : null;
    let met = 5.0;

    // Pattern matching
    if (prompt.includes('run') || prompt.includes('jog')) {
      exerciseType = 'Running (Cardio)';
      met = 8.5;
      intensity = 'moderate';
      const distMatch = prompt.match(/(\d+(\.\d+)?)\s*(km|k|miles)/i);
      if (distMatch) distance = parseFloat(distMatch[1]);
    } else if (prompt.includes('walk')) {
      exerciseType = 'Brisk Walking';
      met = 3.8;
      intensity = 'low';
    } else if (prompt.includes('gym') || prompt.includes('chest') || prompt.includes('weights') || prompt.includes('press')) {
      exerciseType = 'Strength Training (Gym)';
      met = 4.5;
      intensity = 'moderate';
    } else if (prompt.includes('badminton') || prompt.includes('tennis')) {
      exerciseType = 'Badminton';
      met = 6.0;
      intensity = 'moderate';
    } else if (prompt.includes('cycle') || prompt.includes('bike')) {
      exerciseType = 'Cycling';
      met = 7.0;
      intensity = 'moderate';
    } else if (prompt.includes('hiit')) {
      exerciseType = 'HIIT Circuit';
      met = 9.0;
      intensity = 'high';
    }

    const durMatch = prompt.match(/(\d+)\s*(min|minute|hr|hour)/i);
    if (durMatch) {
      const val = parseInt(durMatch[1], 10);
      if (durMatch[2].toLowerCase().startsWith('hr')) {
        duration = val * 60;
      } else {
        duration = val;
      }
    }

    const caloriesBurned = Math.round(met * weight * (duration / 60));

    return NextResponse.json({
      success: true,
      data: {
        exercise_type: exerciseType,
        duration_minutes: duration,
        intensity,
        distance_km: distance,
        calories_burned: caloriesBurned,
        confidence: 'high',
        ai_tip:
          exerciseType.includes('Run')
            ? 'Great job! To improve endurance, try increasing your running time by 5 minutes next week.'
            : 'Excellent session! Make sure to hydrate and prioritize protein to support muscle recovery.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't analyze this exercise right now. Please try again." },
      { status: 500 }
    );
  }
}
