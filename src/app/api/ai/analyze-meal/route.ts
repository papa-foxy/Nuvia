import { NextRequest, NextResponse } from 'next/server';
import { analyzeMeal } from '@/lib/server/meal-analysis';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const params = await req.json();
    return NextResponse.json({ success: true, data: await analyzeMeal(params) });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "We couldn't analyze this right now. Please try again." },
      { status: 500 }
    );
  }
}
