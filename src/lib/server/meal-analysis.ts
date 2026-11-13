/**
 * Server-only meal analysis (Gemini, with an offline heuristic fallback).
 * Used by /api/ai/analyze-meal and the background jobs in /api/ai/meal-jobs.
 */

import type { MealAnalysisResult } from '@/lib/ai-service';
import { foodReferenceForPrompt, referenceMealFromText } from '@/lib/malaysian-food-reference';
import { geminiGenerate } from '@/lib/server/gemini';

export interface MealAnalysisParams {
  imageBase64?: string;
  mimeType?: string;
  textPrompt?: string;
  mealType?: string;
}

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

export async function analyzeMeal({ imageBase64, mimeType, textPrompt, mealType }: MealAnalysisParams): Promise<MealAnalysisResult> {
  {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      const systemPrompt = `You are Nuvia's nutrition estimator, an expert in Malaysian food: mamak, kopitiam, hawker, Malay, Chinese, Indian, Peranakan and East Malaysian dishes, local chains (e.g. Ayam Gepuk Top Global, Nasi Kandar Pelita, Marrybrown, OldTown, ZUS, Tealive) and international food.

STEP 1: IDENTIFY THE DISH. Use the user's words first; otherwise look closely at the photo. Name it the way Malaysians do (e.g. "Nasi Lemak Ayam Goreng", "Roti Canai Kosong + Dhal", "Teh Tarik"). Cues for look-alikes:
- Nasi lemak: rice in a mound or banana-leaf bungkus, red sambal, ikan bilis + peanuts, cucumber, egg.
- Nasi kandar / nasi campur: rice covered in mixed curry gravies with several separate dishes; count the dishes.
- Ayam penyet / gepuk: flattened fried chicken, sambal on the side, tauhu + tempe, cabbage/cucumber.
- Char kuey teow: flat wide rice noodles, dark and glossy, bean sprouts, cockles/prawns, egg.
- Mee goreng mamak: yellow noodles, red-orange, tofu cubes, potato, egg, lime. Maggi goreng: thin wavy instant noodles.
- Curry laksa: orange coconut-curry soup with noodles, tofu puffs. Asam laksa: thick, dark, sour fish broth, no coconut.
- Roti canai: flaky round flatbread. Roti telur: thicker with egg inside. Thosai: thin, crispy, pale rice crepe.
- Teh tarik: frothy light brown. Teh O: dark, clear. Kopi: dark brown with milk. Milo: chocolate brown. Bandung: pink.

STEP 2: ESTIMATE FROM THE REFERENCE TABLE. Each line is ONE typical serving as sold in Malaysia/Singapore, and ALREADY includes the cooking oil, santan and gravy (values from lab analysis, the Malaysian Food Composition Database (MyFCD) and Singapore HPB; "est." lines are typical estimates):
${foodReferenceForPrompt()}

Rules:
- Start from the matching reference line and scale it to the portion you see (plate and bowl size, amount of rice, number of pieces). Typical servings: 1 bowl rice ~160 g ~210 kcal; a "bungkus" is smaller than a plate.
- Do NOT add extra oil, santan or sugar on top of a reference value. Adjust upward only for things you can see or the user says: extra rice ("nasi tambah"), "banjir" (gravy flooded), extra sambal, extra pieces, add-ons (telur, ayam, sotong). Adjust downward for half portions, "kurang manis" (about -30% sugar), "kosong" (no sugar), "kurang minyak", skin removed.
- For a dish not in the table, build it from its parts using the closest lines.
- Itemise each visible component in "foods" (e.g. rice, chicken, sambal, egg, drink). The items must add up to "total".
- If the photo is unclear, still give the best estimate, set "confidence": "low", and say what you assumed.

STEP 3: Return strictly structured JSON matching this schema:
{
  "meal_type": "${mealType || 'lunch'}",
  "meal_name": "Authentic dish name (e.g. Ayam Gepuk Top Global with Rice & Sambal)",
  "foods": [
    {
      "name": "Food item name (e.g. Smashed Fried Chicken)",
      "estimated_quantity": 160,
      "unit": "g",
      "calories": 340,
      "protein_g": 30,
      "carbs_g": 2,
      "fat_g": 24,
      "confidence": "high"
    }
  ],
  "total": {
    "calories": 920,
    "protein_g": 49,
    "carbs_g": 73,
    "fat_g": 50.5
  },
  "confidence": "high",
  "assumptions": ["List of realistic culinary assumptions (e.g. includes oil in sambal gepuk, standard portion of white rice)"],
  "notes": "One short, friendly, practical tip for this meal (e.g. ask for 'kuah sikit', 'kurang manis' or skip the skin)"
}`;

      const contents: any[] = [];
      const parts: any[] = [{ text: systemPrompt }];

      if (textPrompt) {
        parts.push({ text: `User meal description: "${textPrompt}"` });
      }

      let detectedMime = mimeType || 'image/jpeg';
      let cleanBase64 = imageBase64;
      if (imageBase64 && imageBase64.startsWith('data:')) {
        const match = imageBase64.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          detectedMime = match[1];
          cleanBase64 = match[2];
        }
      }

      if (cleanBase64) {
        parts.push({
          inlineData: {
            mimeType: detectedMime,
            data: cleanBase64,
          },
        });
      }

      contents.push({ parts });

      // Try each model in sequence for resilience
      const text = await geminiGenerate({
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        // Photos take a little longer. All attempts together stay under the
        // 60 s function limit (7 + 14 + 14 + 7 s).
        timeoutMs: 14_000,
        task: 'meal-analysis',
      });
      if (text) {
        try {
          return JSON.parse(cleanJsonString(text));
        } catch {
          console.warn('[meal-analysis] Gemini returned invalid JSON');
        }
      }
      // A photo can't be estimated without the AI: say so instead of
      // inventing a generic meal.
      if (cleanBase64) {
        throw new Error('Nuvia AI is busy right now (the daily AI limit may be used up). Please try again in a while.');
      }
    }

    // Heuristic intelligent fallback specialized in Malaysian & popular foods when offline
    // Known Malaysian dishes: use the reference values (MyFCD / HPB / lab).
    const reference = textPrompt ? referenceMealFromText(textPrompt) : null;
    if (reference) {
      return {
        meal_type: (mealType || 'lunch') as MealAnalysisResult['meal_type'],
        meal_name: reference.meal_name,
        foods: reference.foods,
        total: reference.total,
        confidence: 'medium',
        assumptions: reference.assumptions,
        notes: 'Estimated from standard Malaysian servings. Tap an item to adjust your portion.',
      };
    }

    const prompt = (textPrompt || '').toLowerCase();
    let mealName = 'Healthy Meal';
    let foods: any[] = [];
    let assumptions = ['Portions estimated based on standard Malaysian street/restaurant serving sizes.'];
    let notes = 'Estimated nutrition. You can tap or edit any item to fine-tune your actual portion.';

    if (prompt.includes('gepuk') || prompt.includes('penyet') || prompt.includes('gembus')) {
      mealName = prompt.includes('global') ? 'Ayam Gepuk Top Global (Set)' : 'Ayam Gepuk / Penyet Set';
      foods = [
        {
          name: 'Smashed Fried Chicken (Ayam Goreng)',
          estimated_quantity: 160,
          unit: 'g',
          calories: 340,
          protein_g: 30,
          carbs_g: 2,
          fat_g: 24,
          confidence: 'high',
        },
        {
          name: 'Steamed White Rice (Nasi Putih)',
          estimated_quantity: 200,
          unit: 'g',
          calories: 260,
          protein_g: 5,
          carbs_g: 58,
          fat_g: 0.5,
          confidence: 'high',
        },
        {
          name: 'Spicy Garlic-Peanut Sambal Gepuk with Oil',
          estimated_quantity: 45,
          unit: 'g',
          calories: 195,
          protein_g: 4,
          carbs_g: 5,
          fat_g: 19,
          confidence: 'high',
        },
        {
          name: 'Fried Tahu & Tempeh (1 pc each)',
          estimated_quantity: 60,
          unit: 'g',
          calories: 115,
          protein_g: 9,
          carbs_g: 6,
          fat_g: 7,
          confidence: 'medium',
        },
        {
          name: 'Fresh Cucumber & Cabbage',
          estimated_quantity: 40,
          unit: 'g',
          calories: 10,
          protein_g: 1,
          carbs_g: 2,
          fat_g: 0,
          confidence: 'high',
        },
      ];
      notes = "Ayam Gepuk is rich in protein but high in calories due to the peanut-and-hot-oil sambal. Requesting 'kurang minyak' in the sambal can save 100-150 kcal!";
    } else if (prompt.includes('lemak')) {
      mealName = 'Nasi Lemak with Ayam Goreng Berempah';
      foods = [
        {
          name: 'Coconut Rice (Nasi Lemak Santan)',
          estimated_quantity: 200,
          unit: 'g',
          calories: 380,
          protein_g: 6,
          carbs_g: 60,
          fat_g: 14,
          confidence: 'high',
        },
        {
          name: 'Spiced Fried Chicken (Ayam Goreng Berempah)',
          estimated_quantity: 150,
          unit: 'g',
          calories: 330,
          protein_g: 28,
          carbs_g: 6,
          fat_g: 22,
          confidence: 'high',
        },
        {
          name: 'Sambal Tumis',
          estimated_quantity: 40,
          unit: 'g',
          calories: 90,
          protein_g: 1,
          carbs_g: 8,
          fat_g: 6,
          confidence: 'high',
        },
        {
          name: 'Fried Anchovies (Ikan Bilis) & Peanuts',
          estimated_quantity: 25,
          unit: 'g',
          calories: 120,
          protein_g: 7,
          carbs_g: 4,
          fat_g: 9,
          confidence: 'high',
        },
        {
          name: 'Hard Boiled Egg (Half) & Cucumber',
          estimated_quantity: 40,
          unit: 'g',
          calories: 45,
          protein_g: 3,
          carbs_g: 1,
          fat_g: 3,
          confidence: 'high',
        },
      ];
      notes = 'Nasi Lemak is Malaysia’s national dish! High in flavor and energy; great fuel for demanding training days.';
    } else if (prompt.includes('kandar')) {
      mealName = 'Nasi Kandar (Kuah Campur & Ayam Goreng)';
      foods = [
        {
          name: 'Steamed White Rice (Nasi Putih)',
          estimated_quantity: 220,
          unit: 'g',
          calories: 285,
          protein_g: 5,
          carbs_g: 64,
          fat_g: 0.5,
          confidence: 'high',
        },
        {
          name: 'Ayam Goreng Mamak (Berempah)',
          estimated_quantity: 160,
          unit: 'g',
          calories: 340,
          protein_g: 30,
          carbs_g: 6,
          fat_g: 22,
          confidence: 'high',
        },
        {
          name: 'Kuah Campur / Banjir (Curry & Dalcha mix)',
          estimated_quantity: 80,
          unit: 'ml',
          calories: 130,
          protein_g: 3,
          carbs_g: 8,
          fat_g: 10,
          confidence: 'medium',
        },
        {
          name: 'Cooked Bendi / Lady’s Finger & Cabbage',
          estimated_quantity: 70,
          unit: 'g',
          calories: 45,
          protein_g: 2,
          carbs_g: 7,
          fat_g: 1,
          confidence: 'high',
        },
      ];
      notes = "Asking for 'kuah asing' (gravy on the side) or 'kuah sikit' helps control sodium and fat while retaining full flavor.";
    } else if (prompt.includes('roti') || prompt.includes('dhal') || prompt.includes('canai')) {
      mealName = 'Roti Canai with Dhal & Sambal';
      foods = [
        {
          name: 'Roti Canai',
          estimated_quantity: 2,
          unit: 'pcs',
          calories: 480,
          protein_g: 10,
          carbs_g: 60,
          fat_g: 22,
          confidence: 'high',
        },
        {
          name: 'Yellow Dhal Curry',
          estimated_quantity: 120,
          unit: 'ml',
          calories: 140,
          protein_g: 7,
          carbs_g: 19,
          fat_g: 4,
          confidence: 'high',
        },
      ];
      notes = 'Consider pairing Roti Canai with Teh C Kosong or Kopi O Kosong to avoid excess liquid sugar.';
    } else if (prompt.includes('ayam') || prompt.includes('chicken rice')) {
      mealName = 'Hainanese Chicken Rice (Nasi Ayam)';
      foods = [
        {
          name: 'Fragrant Chicken Broth Rice',
          estimated_quantity: 200,
          unit: 'g',
          calories: 310,
          protein_g: 6,
          carbs_g: 54,
          fat_g: 8,
          confidence: 'high',
        },
        {
          name: 'Roasted / Steamed Chicken',
          estimated_quantity: 150,
          unit: 'g',
          calories: 270,
          protein_g: 28,
          carbs_g: 1,
          fat_g: 17,
          confidence: 'high',
        },
        {
          name: 'Chili Dip, Ginger Sauce & Cucumber',
          estimated_quantity: 40,
          unit: 'g',
          calories: 35,
          protein_g: 1,
          carbs_g: 4,
          fat_g: 1.5,
          confidence: 'high',
        },
      ];
      notes = 'A balanced, protein-dense local favorite. Steamed chicken breast is the leanest option.';
    } else if (prompt.includes('kway teow') || prompt.includes('kuey teow') || prompt.includes('mee goreng') || prompt.includes('maggi')) {
      mealName = prompt.includes('kway') || prompt.includes('kuey') ? 'Char Kway Teow' : 'Mee Goreng Mamak';
      foods = [
        {
          name: 'Fried Noodles / Flat Rice Noodles',
          estimated_quantity: 250,
          unit: 'g',
          calories: 520,
          protein_g: 14,
          carbs_g: 68,
          fat_g: 24,
          confidence: 'high',
        },
        {
          name: 'Prawns / Chicken / Tofu & Egg',
          estimated_quantity: 80,
          unit: 'g',
          calories: 140,
          protein_g: 16,
          carbs_g: 3,
          fat_g: 7,
          confidence: 'medium',
        },
      ];
      notes = 'High in carbs and delicious wok-hei flavor! Great for post-workout glycogen replenishment.';
    } else if (prompt.includes('egg') || prompt.includes('toast') || prompt.includes('breakfast')) {
      mealName = 'Eggs & Wholemeal Toast';
      foods = [
        {
          name: 'Poached/Fried Eggs',
          estimated_quantity: 2,
          unit: 'eggs',
          calories: 140,
          protein_g: 12,
          carbs_g: 1,
          fat_g: 10,
          confidence: 'high',
        },
        {
          name: 'Wholemeal Toast',
          estimated_quantity: 2,
          unit: 'slices',
          calories: 160,
          protein_g: 6,
          carbs_g: 28,
          fat_g: 2,
          confidence: 'high',
        },
      ];
    } else {
      foods = [
        {
          name: 'Grilled / Cooked Protein',
          estimated_quantity: 160,
          unit: 'g',
          calories: 260,
          protein_g: 34,
          carbs_g: 0,
          fat_g: 5,
          confidence: 'medium',
        },
        {
          name: 'Steamed Rice / Complex Carbs',
          estimated_quantity: 180,
          unit: 'g',
          calories: 230,
          protein_g: 4,
          carbs_g: 50,
          fat_g: 1,
          confidence: 'medium',
        },
        {
          name: 'Vegetables & Side',
          estimated_quantity: 120,
          unit: 'g',
          calories: 130,
          protein_g: 7,
          carbs_g: 8,
          fat_g: 8,
          confidence: 'medium',
        },
      ];
    }

    const totalCals = foods.reduce((sum, f) => sum + f.calories, 0);
    const totalProtein = Math.round(foods.reduce((sum, f) => sum + f.protein_g, 0));
    const totalCarbs = Math.round(foods.reduce((sum, f) => sum + f.carbs_g, 0));
    const totalFat = Math.round(foods.reduce((sum, f) => sum + f.fat_g, 0));

    return {
      meal_type: (mealType || 'lunch') as MealAnalysisResult['meal_type'],
      meal_name: mealName,
      foods,
      total: {
        calories: totalCals,
        protein_g: totalProtein,
        carbs_g: totalCarbs,
        fat_g: totalFat,
      },
      confidence: 'high',
      assumptions,
      notes,
    };
  }
}

