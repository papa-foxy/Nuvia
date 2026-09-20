import { NextRequest, NextResponse } from 'next/server';
import { calculateTargets, getUserCalculationContext } from '@/lib/calculator';
import { AdaptiveTrainingEngine } from '@/lib/adaptive-training-engine';

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

function formatFitnessContext(fc: any): string {
  if (!fc) return '';
  const p = fc.profile || {};
  const g = fc.goal || {};
  const c = fc.constraints || {};
  const pref = fc.preferences || {};
  const rec = fc.recovery || {};
  const sched = fc.weekly_schedule || [];
  const perf = fc.performance?.recent_exercises || [];

  const schedStr = sched.map((s: any) => `  * ${s.day}: ${s.type.toUpperCase()} ${s.routine_title ? `(${s.routine_title})` : ''} - ${s.description || ''}`).join('\n');
  const perfStr = perf.length > 0
    ? perf.map((e: any) => `  * ${e.exercise_name}: Last lifted ${e.top_set_performance || 'bodyweight'} (${e.last_reps} reps). ${e.suggested_next_target || ''}`).join('\n')
    : '  * No previous detailed performance logs recorded yet';

  return `
=== AUTHORITATIVE PERSONAL FITNESS CONTEXT ===
- Biometrics: ${p.sex || 'Not specified'}, ${p.age ? `${p.age} yrs` : ''}, ${p.height_cm ? `${p.height_cm} cm` : ''}, ${p.weight_kg ? `${p.weight_kg} kg` : ''}
- Training Experience & Consistency:
  * Experience Level: ${p.experience_level || p.fitness_level || 'beginner_inconsistent'} (${p.training_background || 'Returning trainee'})
  * Current Consistency: ${p.consistency_level || 'on_and_off'}
- Current Physique (Self-Assessed):
  * Description: ${g.physique_preference?.current_physique_label || 'Soft / little muscle definition'}
  * Priority Improvement Areas: ${(g.physique_preference?.priority_areas || ['Belly / waist', 'Overall muscle definition']).join(', ')}
  * (RULE: NEVER claim spot reduction is possible; remind user that systemic body recomposition drives local definition)
- Target Physique & Vision:
  * Desired Look: ${g.physique_preference?.desired_physique || 'Athletic'} - ${g.physique_preference?.desired_physique_custom || g.physique_preference?.desired_look || 'Athletic, lean, and balanced'}
  * Target Visual Reference: ${g.physique_preference?.user_estimated_target_bf_percent ? `~${g.physique_preference.user_estimated_target_bf_percent}% appearance (user-estimated aesthetic goal, NOT a medical calculation)` : 'Lean athletic'}
- Primary Goal & Objective: ${g.primary_goal || 'lose_weight'}
  * Objective: ${g.objective || 'Body recomposition (fat loss while preserving/building lean muscle)'}
- Training Environment & Available Equipment:
  * Environment: ${c.environment || 'home'}
  * Available Equipment: ${(c.available_equipment || ['dumbbells', 'push_up_board', 'bodyweight']).join(', ')}
  * Available Session Time: ~${c.workout_duration_minutes || 45} minutes
  * Preferred Time of Day: ${c.training_time_of_day || 'Evening'}
  * Adherence Obstacles: ${(c.adherence_obstacles || ['Lack of time']).join(', ')}
  * STRICT EQUIPMENT CONSTRAINT: ONLY prescribe exercises executable with their available equipment. NEVER prescribe barbell bench press, cable crossovers, leg press, or machine lat pulldowns unless explicitly in available equipment.
- Cardio Habits: ${c.cardio_habits?.type || 'Brisk walking'} (~${c.cardio_habits?.distance_km || 4.5} km on ${(c.cardio_habits?.typical_days || ['Saturday']).join(', ')})
  * RULE: Do NOT automatically add large amounts of cardio for fat loss; respect their existing walking baseline and prioritize progressive resistance training.
- Synthesized Individual Strategy:
${(fc.synthesized_strategy || []).map((s: string) => `  * ${s}`).join('\n') || '  * Prioritize consistency, progressive overload, and adherence.'}
- Weekly Training Structure:
${schedStr}
- Current Day Reality:
  * Scheduled Today: ${rec.scheduled_today?.has_routine ? `WORKOUT DAY (${rec.scheduled_today?.routine_title})` : 'REST / CARDIO DAY'}
  * Completed Today: ${rec.scheduled_today?.is_completed ? 'YES (Routine already logged today!)' : 'NO'}
- Adaptive Training Engine Status (AUTHORITATIVE):
  * Deterministic State Today: ${fc.adaptive?.today_state ? fc.adaptive.today_state.toUpperCase() : 'Not evaluated'}
  * Recommended Next Action: ${fc.adaptive?.next_action?.type ? fc.adaptive.next_action.type.toUpperCase() : 'None'} (${fc.adaptive?.next_action?.reason || ''})
  * Auto-Adjust Mode: ${fc.adaptive?.auto_adjust_mode || 'ask_first'}
  * Pending Reschedule Proposals: ${fc.adaptive?.pending_proposals?.length ? fc.adaptive.pending_proposals.map((p: any) => `${p.routine_title} from ${p.from_date} to ${p.suggested_date} (${p.reason})`).join('; ') : 'None'}
- Recovery Context:
  * Muscles trained in last 48h: ${(rec.trained_in_last_48h || []).join(', ') || 'None (fully recovered)'}
- Personal Preferences & Progression Rules:
  * Effort Target: ${pref.effort_target || 'Challenging but manageable (1-3 RIR)'}
  * Progression Rule: ${pref.progression_rule || 'Double progression (10-15 reps; raise weight when all sets reach 15)'}
  * Easy vs Hard Areas: ${(pref.easy_hard_areas || []).join('; ') || 'None specified'}
  * Muscle Bias: ${(pref.muscle_biases || []).join('; ') || 'None'}
  * Preferred Exercises: ${(pref.preferred_exercises || []).join(', ')}
  * Disliked / Avoided Exercises: ${(pref.disliked_exercises || []).join(', ')} (NEVER prescribe these without user asking!)
  * Custom Starting Estimates: ${JSON.stringify(pref.custom_starting_weights || {})}
- Recent Performance & Progressive Overload Memory:
${perfStr}

WORKOUT GENERATION & MODIFICATION RULES:
1. When asked for a workout or "what should I do today":
   - Always check what day of the week it is.
   - If today is a REST DAY: State clearly that today is their scheduled rest/recovery day. Suggest light mobility, stretching, or an easy walk; do NOT prescribe a full lifting session unless they explicitly ask to train anyway.
   - If today is a WORKOUT DAY: Use their assigned routine (${rec.scheduled_today?.routine_title || 'Assigned Routine'}). If already completed, congratulate them. If not, generate the session with EXACT exercises, sets, rep ranges (e.g. 10-15), and weights derived from their last session or starting estimates.
   - For every exercise, include a concrete progressive overload target (e.g. "Last time you hit 12 reps with 14kg; aim for 13-15 reps today before bumping to 16kg").
2. When asked to modify or replace an exercise (e.g. "I can't do Bulgarian split squats"):
   - Replace it with a movement targeting the same muscle group and movement pattern using their available equipment (${(c.available_equipment || ['dumbbells', 'push_up_board', 'bodyweight']).join(', ')}).
   - Preserve weekly volume and ensure muscles fatigued in the last 48h are not overloaded.
3. Keep responses structured, encouraging, concise (under 200 words), and tailored specifically to this user's constraints.
`;
}

export async function POST(req: NextRequest) {
  try {
    const { todaySummary, goals, profile, recentMeals, recentExercises, chatMessage, fitnessContext } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // Authoritative calculation context
    const calcCtx = getUserCalculationContext(profile, goals);
    const authCalc = calculateTargets(calcCtx);
    const maintenanceCalories = authCalc.tdee;
    const authoritativeCalorieTarget = goals?.calorie_target || authCalc.calorie_target;
    const goalAdjustment = authoritativeCalorieTarget - maintenanceCalories;

    // Structured Net Calorie Accounting:
    const foodCalories = todaySummary?.calories_consumed || 0;
    const exerciseCalories = todaySummary?.calories_burned || 0;
    const netCalories = foodCalories - exerciseCalories;
    const remainingCalories = authoritativeCalorieTarget - netCalories;
    const isOverTarget = netCalories > authoritativeCalorieTarget;
    const overCalories = isOverTarget ? netCalories - authoritativeCalorieTarget : 0;

    const structuredCalorieState = {
      dailyTarget: authoritativeCalorieTarget,
      foodCalories,
      exerciseCalories,
      netCalories,
      remainingCalories,
      goalType: profile?.goal || 'lose_weight',
    };

    const remainingProtein = Math.max(0, (goals?.protein_target || authCalc.protein_target) - (todaySummary?.protein_consumed || 0));
    const remainingExercise = Math.max(0, (goals?.exercise_minutes_target || authCalc.exercise_minutes_target) - (todaySummary?.exercise_minutes || 0));

    const exerciseContext = (recentExercises || []).length > 0
      ? `- Completed exercises today: ${(recentExercises as string[]).join(', ')}`
      : '- No exercises logged yet today';

    const fitnessContextBlock = formatFitnessContext(fitnessContext);

    if (apiKey) {
      const userContext = `
USER CONTEXT:
- Name: ${profile?.name || profile?.full_name || 'User'}
- Goal: ${profile?.goal || 'lose_weight'}
- Estimated Maintenance (TDEE): ${maintenanceCalories} kcal/day
- Daily Calorie Target: ${authoritativeCalorieTarget} kcal/day (Goal Adjustment: ${goalAdjustment >= 0 ? `+${goalAdjustment}` : goalAdjustment} kcal/day vs maintenance)
- Structured Net Calorie State: ${JSON.stringify(structuredCalorieState, null, 2)}
- Calorie Accounting Today:
  * Food consumed (eaten): ${foodCalories} kcal
  * Activity burned: ${exerciseCalories} kcal
  * Net calories: ${netCalories} kcal (${foodCalories} eaten - ${exerciseCalories} burned)
  * Budget status: ${isOverTarget ? `${overCalories} kcal above target` : `${remainingCalories} kcal remaining in net budget`}
- Protein Goal: ${goals?.protein_target || authCalc.protein_target} g (Consumed: ${todaySummary?.protein_consumed || 0} g, Remaining: ${remainingProtein} g)
- Exercise: ${todaySummary?.exercise_minutes || 0} min / Target ${goals?.exercise_minutes_target || authCalc.exercise_minutes_target} min (Burned: ${exerciseCalories} kcal)
- Dietary Preference: ${profile?.dietary_preference || 'None'}
${exerciseContext}
- Recent meals: ${(recentMeals || []).map((m: any) => `${m.meal_type}: ${m.description}`).join('; ')}
${fitnessContextBlock}
`;

      if (chatMessage) {
        const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayRoutine = fitnessContext?.active_routines?.find((r: any) =>
          r.days?.some((d: string) => d.toLowerCase() === todayDayName.toLowerCase())
        );

        const intentAnalysis = AdaptiveTrainingEngine.evaluateUserIntent({
          message: chatMessage,
          todayRoutine,
          recentMuscles: fitnessContext?.recovery?.trained_in_last_48h || [],
          routines: fitnessContext?.active_routines || [],
          logs: recentExercises || [],
        });

        let intentContext = '';
        if (intentAnalysis.classification !== 'GENERAL_QUESTION') {
          intentContext = `
USER INTENT DETECTED (AUTHORITATIVE):
- Intent: ${intentAnalysis.intentSummary}
- Classification: ${intentAnalysis.classification}
- Recommendation: ${intentAnalysis.proposal ? intentAnalysis.proposal.reason : 'Review schedule'}
- Recovery Analysis: ${intentAnalysis.proposal ? intentAnalysis.proposal.recovery_analysis : 'Sufficient recovery'}
STRICT RULE: Explain this recommendation directly and concisely in 2-3 sentences based strictly on the facts provided. Do NOT claim the user trained or is sore unless stated in context. Reassure the user they have full control.
`;
        }

        const systemPrompt = `You are Nuvia's intelligent AI Coach, specialized in progressive resistance training, practical macro tracking, and Malaysian/Southeast Asian lifestyles (e.g. eating out at mamak stalls, hawker centers, Ayam Gepuk, Nasi Kandar, ordering 'kurang manis' or 'kosong' drinks, finding high-protein options locally).
IMPORTANT NUTRITION RULE: Nuvia uses a net calorie budgeting model (dailyTarget: ${authoritativeCalorieTarget} kcal, food: ${foodCalories} kcal, activity: -${exerciseCalories} kcal, net: ${netCalories} kcal, remaining: ${remainingCalories} kcal). Do NOT say the user only consumed ${netCalories} kcal.
IMPORTANT WORKOUT RULE: Never generate a generic workout. Always check the user's Weekly Training Structure, Available Equipment, Recovery Status, and Previous Performance. Follow the WORKOUT GENERATION & MODIFICATION RULES strictly.
Respond warmly, directly, concisely, and practically in 2-4 focused sentences or bullet points.`;

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
                        { text: userContext + intentContext },
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
                return NextResponse.json({
                  success: true,
                  mode: 'chat',
                  reply,
                  intentAnalysis: intentAnalysis.classification !== 'GENERAL_QUESTION' ? intentAnalysis : undefined,
                });
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
      let reply =
        remainingCalories > 0
          ? `You have ${remainingCalories} kcal remaining in your net calorie budget today (${foodCalories} kcal eaten, ${exerciseCalories} kcal activity) and are ${remainingProtein}g short of your protein goal.`
          : `You have reached your daily calorie target (${netCalories} kcal net of ${authoritativeCalorieTarget} kcal target) and are ${remainingProtein}g short of your protein goal.`;

      if (q.includes('dinner') || q.includes('eat') || q.includes('food')) {
        if (remainingProtein > 25) {
          reply = `Yes! You have around ${remainingCalories} kcal remaining in your net budget and still need ${remainingProtein}g of protein. A high-protein dinner like grilled chicken or salmon with vegetables and quinoa (around 500–600 kcal) would fit your target perfectly.`;
        } else {
          reply = `You have ${remainingCalories} kcal left in your net budget. Since your protein intake is in good shape, a balanced, lighter dinner like a stir-fry or salad with lean protein would keep you right on track!`;
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
          remainingCalories > 0
            ? `You have ${remainingCalories} kcal remaining in your net daily budget today. Consider a balanced meal or snack if you feel hungry.`
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
