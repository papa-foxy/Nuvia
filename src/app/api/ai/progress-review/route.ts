import { NextRequest, NextResponse } from 'next/server';
import { geminiGenerate } from '@/lib/server/gemini';

export const maxDuration = 30;

/**
 * Plain-language coaching note for a progress check-in.
 * The numbers and the recommendations are decided by src/lib/progress-tracker
 * (fixed, safe rules); this only explains them. Body: the report fields below.
 */
interface ReviewBody {
  goal?: string;
  status?: string;
  headline?: string;
  summary?: string;
  trendWeightKg?: number | null;
  targetWeightKg?: number | null;
  actualKgPerWeek?: number | null;
  expectedKgPerWeek?: number;
  loggingRate?: number;
  estimatedTdee?: number | null;
  weeksToGoal?: number | null;
  energy?: number | null;
  note?: string | null;
  recommendations?: { title: string; body: string }[];
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);

export async function POST(req: NextRequest) {
  const body = ((await req.json().catch(() => null)) || {}) as ReviewBody;
  const facts = {
    goal: clip(body.goal, 40),
    status: clip(body.status, 40),
    headline: clip(body.headline, 120),
    summary: clip(body.summary, 400),
    trend_weight_kg: body.trendWeightKg ?? null,
    target_weight_kg: body.targetWeightKg ?? null,
    actual_kg_per_week: body.actualKgPerWeek ?? null,
    planned_kg_per_week: body.expectedKgPerWeek ?? null,
    share_of_days_food_logged: body.loggingRate ?? null,
    estimated_real_maintenance_kcal: body.estimatedTdee ?? null,
    weeks_to_goal: body.weeksToGoal ?? null,
    how_user_feels_1_to_5: body.energy ?? null,
    user_note: clip(body.note, 300) ?? null,
    nuvia_recommendations: (body.recommendations || []).slice(0, 4).map((r) => ({ title: clip(r.title, 120), detail: clip(r.body, 400) })),
  };

  const prompt = `You are Nuvia's friendly fitness coach. A user just did a progress check-in.
Write a short, warm, practical note in plain English (no jargon, no medical claims), for someone in Malaysia.
STRICT RULES:
- Use ONLY the facts below. Never invent or change numbers, and never recommend a different calorie target than Nuvia's recommendations.
- If the status is not_enough_data, encourage consistent weigh-ins and logging; do not judge progress.
- If the user says they feel tired (1-2) or wrote a note, acknowledge it kindly.
- Remind them it's their choice where relevant; never shame.
Return strict JSON: {"message": "2-3 sentences", "tips": ["max 2 short, specific tips (e.g. Malaysian food swaps, sleep, protein)"]}.

FACTS: ${JSON.stringify(facts)}`;

  const text = await geminiGenerate({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    timeoutMs: 12_000,
    task: 'progress-review',
  });
  if (text) {
    try {
      const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')) as { message?: string; tips?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        const tips = Array.isArray(parsed.tips) ? parsed.tips.filter((t): t is string => typeof t === 'string').slice(0, 2) : [];
        return NextResponse.json({ source: 'ai', message: parsed.message.trim(), tips });
      }
    } catch {
      /* fall through */
    }
  }
  // AI unavailable: the engine's own summary.
  return NextResponse.json({ source: 'rules', message: facts.summary || 'Keep logging and weighing in; Nuvia will show your trend.', tips: [] });
}
