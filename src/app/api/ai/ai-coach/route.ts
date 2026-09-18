import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
];

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { todaySummary, goals, profile, recentMeals, recentExercises, chatMessage } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    const remainingCals = Math.max(0, (goals?.calorie_target || 2000) - (todaySummary?.calories_consumed || 0));
    const remainingProtein = Math.max(0, (goals?.protein_target || 140) - (todaySummary?.protein_consumed || 0));
    const remainingExercise = Math.max(0, (goals?.exercise_minutes_target || 30) - (todaySummary?.exercise_minutes || 0));

    const exerciseContext = (recentExercises || []).length > 0
      ? `- Completed exercises today: ${(recentExercises as string[]).join(', ')}`
      : '- No exercises logged yet today';

    if (apiKey) {
      const userContext = `
USER CONTEXT:
- Name: ${profile?.name || 'User'}
- Goal: ${profile?.goal || 'Healthy lifestyle'}
- Dietary Preference: ${profile?.dietary_preference || 'None'}
- Calorie Goal: ${goals?.calorie_target || 2000} kcal (Consumed: ${todaySummary?.calories_consumed || 0} kcal, Remaining: ${remainingCals} kcal)
- Protein Goal: ${goals?.protein_target || 140} g (Consumed: ${todaySummary?.protein_consumed || 0} g, Remaining: ${remainingProtein} g)
- Exercise: ${todaySummary?.exercise_minutes || 0} min / Target ${goals?.exercise_minutes_target || 30} min (Burned: ${todaySummary?.calories_burned || 0} kcal)
${exerciseContext}
- Recent meals: ${(recentMeals || []).map((m: any) => `${m.meal_type}: ${m.description}`).join('; ')}
`;

      if (chatMessage) {
        const systemPrompt = `You are Nuvia's intelligent AI Coach, specialized in fitness, practical macro tracking, and Malaysian/Southeast Asian lifestyles (e.g. eating out at mamak stalls, hawker centers, Ayam Gepuk, Nasi Kandar, ordering 'kurang manis' or 'kosong' drinks, finding high-protein options locally).
Respond warmly, concisely, and practically to the user's question using their actual logged context.
Do not write long essays; answer in 2-3 focused sentences with specific meal/action suggestions fitting their remaining macros.`;

        for (const model of GEMINI_MODELS) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
                  generationConfig: { temperature: 0.5 },
                }),
              }
            );

            if (res.ok) {
              const data = await res.json();
              const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (reply) {
                return NextResponse.json({ success: true, mode: 'chat', reply });
              }
            }
          } catch (modelErr) {
            console.warn(`AI Coach chat model ${model} error:`, modelErr);
          }
        }
      } else {
        const systemPrompt = `You are Nuvia's AI Fitness & Nutrition Coach.
Analyze the user's progress today against their goals, keeping in mind Malaysian lifestyle & food options.
Generate prioritized, highly actionable guidance in strictly valid JSON format:
{
  "headline": "Here's your daily summary and advice for better results:",
  "priorities": [
    {
      "category": "Nutrition" | "Protein" | "Exercise",
      "priority": 1 | 2 | 3,
      "message": "Specific actionable message"
    }
  ]
}`;

        for (const model of GEMINI_MODELS) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }, { text: userContext }] }],
                  generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.3,
                  },
                }),
              }
            );

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(cleanJsonString(text));
                return NextResponse.json({ success: true, mode: 'priorities', data: parsed });
              }
            }
          } catch (modelErr) {
            console.warn(`AI Coach priorities model ${model} error:`, modelErr);
          }
        }
      }
    }

    // Heuristic intelligent fallback based on user's exact current metrics
    if (chatMessage) {
      const q = chatMessage.toLowerCase();
      let reply = `You have ${remainingCals} kcal remaining today and are ${remainingProtein}g short of your protein goal.`;

      if (q.includes('dinner') || q.includes('eat') || q.includes('food')) {
        if (remainingProtein > 25) {
          reply = `Yes! You have around ${remainingCals} kcal remaining and still need ${remainingProtein}g of protein. A high-protein dinner like grilled chicken or salmon with vegetables and quinoa (around 500–600 kcal) would fit your target perfectly.`;
        } else {
          reply = `You have ${remainingCals} kcal left. Since your protein intake is in good shape, a balanced, lighter dinner like a stir-fry or salad with lean protein would keep you right on track!`;
        }
      } else if (q.includes('exercise') || q.includes('workout') || q.includes('run')) {
        if (remainingExercise > 0) {
          reply = `You have completed ${todaySummary?.exercise_minutes || 0} minutes of activity. A ${remainingExercise}-minute brisk walk or jog would complete your daily exercise target!`;
        } else {
          reply = `You've already met your ${goals?.exercise_minutes_target || 30}-minute exercise goal today! Prioritize light stretching and adequate hydration for recovery.`;
        }
      }

      return NextResponse.json({ success: true, mode: 'chat', reply });
    }

    // Priorities fallback
    const priorities = [
      {
        category: 'Nutrition',
        priority: 1,
        message:
          remainingCals > 0
            ? `You're ${remainingCals} kcal below your daily goal. Consider adding a healthy snack (e.g. nuts or Greek yogurt) if you feel hungry.`
            : `You've reached your daily calorie target. Stick to water or herbal tea for the rest of the evening.`,
      },
      {
        category: 'Protein',
        priority: 2,
        message:
          remainingProtein > 0
            ? `You're ${remainingProtein}g short of your protein goal (${goals?.protein_target || 150}g). Try to include more lean meat, eggs, tofu, or protein-rich foods in your next meal.`
            : `Great job! You've achieved your daily protein target to support muscle recovery and fullness.`,
      },
      {
        category: 'Exercise',
        priority: 3,
        message:
          remainingExercise > 0
            ? `Your activity is currently ${remainingExercise} minutes below your goal. Aim for at least ${remainingExercise} minutes of moderate activity or a brisk walk.`
            : `Goal achieved! You've logged ${todaySummary?.exercise_minutes || 0} minutes of exercise today.`,
      },
    ];

    return NextResponse.json({
      success: true,
      mode: 'priorities',
      data: {
        headline: "Here's your daily summary and advice for better results:",
        priorities,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't generate advice right now. Please try again." },
      { status: 500 }
    );
  }
}
