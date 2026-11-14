import { NextRequest, NextResponse } from 'next/server';
import { analyzeMeal } from '@/lib/server/meal-analysis';
import { supabaseAdmin, userIdFromRequest } from '@/lib/server/supabase-admin';
import { loadPersonalContext, personalOptionsFromBody } from '@/lib/server/meal-personalization-request';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, textPrompt, mealType } = body ?? {};
    // Signed-in users get their own history (usual items, past corrections).
    const userId = await userIdFromRequest(req);
    const supabase = userId ? supabaseAdmin() : null;
    const personalContext =
      userId && supabase ? await loadPersonalContext(supabase, userId, personalOptionsFromBody(body)) : '';
    return NextResponse.json({
      success: true,
      data: await analyzeMeal({ imageBase64, mimeType, textPrompt, mealType, personalContext }),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "We couldn't analyze this right now. Please try again." },
      { status: 500 }
    );
  }
}
