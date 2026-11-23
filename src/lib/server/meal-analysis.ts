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
  /** What this user usually logs and past corrections (from meal-personalization). */
  personalContext?: string;
}

const PERSONAL_RULES = `
PERSONALISATION:
- The block below is THIS user's own history. If the photo or description plausibly shows one of their usual items (same kind of food or drink, similar look, typical time of day), identify it AS that item: use their exact name (keep qualifiers like "no stevia", "less ice", "oat milk"). Reuse their usual portion and macros only when the current edible portion matches. Current photo evidence and user notes about amounts eaten, bones, and leftovers take precedence. Add the assumption "Matched your usual <name>" when reusing the usual portion and macros.
- Past corrections show what the AI got wrong before. Never repeat a corrected guess for the same kind of photo: e.g. if "Kopi Ais" was corrected to "Latte (no stevia)", an iced milky coffee is their latte, not kopi ais.
- Only identify something else when it is clearly a different food or drink.`;

type MealFood = MealAnalysisResult['foods'][number];
type GeminiMeal = Omit<MealAnalysisResult, 'foods'> & {
  foods: (MealFood & {
    bone_in?: {
      served_g: number;
      edible_g: number;
      per_100g: MealAnalysisResult['total'];
    };
  })[];
};

function applyEdiblePortions(meal: GeminiMeal): MealAnalysisResult {
  let adjusted = false;
  const foods = meal.foods.flatMap(({ bone_in, ...food }) => {
    if (!bone_in) return [food];
    const { served_g, edible_g, per_100g } = bone_in;
    if (!Number.isFinite(served_g) || served_g <= 0 || !Number.isFinite(edible_g) || edible_g < 0 || edible_g > served_g) {
      return [food];
    }
    if (!per_100g) return [food];
    const { calories, protein_g, carbs_g, fat_g } = per_100g;
    if (![calories, protein_g, carbs_g, fat_g].every((value) => Number.isFinite(value) && value >= 0)) return [food];

    adjusted = true;
    if (edible_g === 0) return [];
    const portion = edible_g / 100;
    return [{
      ...food,
      estimated_quantity: edible_g,
      unit: 'g',
      calories: Math.round(calories * portion),
      protein_g: Math.round(protein_g * portion),
      carbs_g: Math.round(carbs_g * portion),
      fat_g: Math.round(fat_g * portion),
    }];
  });

  if (!adjusted) return { ...meal, foods };
  const sum = (key: keyof MealAnalysisResult['total']) =>
    Math.round(foods.reduce((total, food) => total + (Number(food[key]) || 0), 0) * 10) / 10;
  return {
    ...meal,
    foods,
    total: { calories: sum('calories'), protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') },
    assumptions: ['Bone-in portions are shown as estimated edible weight.', ...(meal.assumptions || [])],
  };
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

export async function analyzeMeal({ imageBase64, mimeType, textPrompt, mealType, personalContext }: MealAnalysisParams): Promise<MealAnalysisResult> {
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
- BONE-IN PORTIONS: For chicken wings, drumsticks, chopped curry chicken, ribs, and whole or bone-in fish, estimate grams of edible cooked meat separately from the weight of the pieces with their bones. Exclude bones from both calories and protein. If the pieces are mostly bone or the user says "mostly bone" / "banyak tulang", use less than half the weight of the pieces as edible, or less still when there is only a little meat. For example, if 180 g of chopped chicken is mostly bone and has about 70 g of meat, use 70 g to estimate its nutrition. Do not treat each piece as a full serving. Use any stated edible weight. If the meat is hard to see, give a conservative estimate and state the assumption.
- SINGLE-ITEM dishes (a bowl of laksa, a plate of char kuey teow, a roti, a drink): start from the matching reference line and scale it to the portion you see (bowl/plate size, how full, number of pieces).
- PLATES BUILT FROM PARTS (nasi kandar, nasi campur / economy rice, banana-leaf rice, any rice with separate dishes): do NOT copy a whole-plate line. Estimate EACH part from the photo and add them up, so a big plate comes out above the "typical" line and a small one below it:
  * Rice: judge the grams from the mound (a small bowl ~160 g, a normal plate ~200–250 g, a big heaped plate ~300 g+) at ~1.3 kcal per g.
  * Each protein: use edible weight. For curry chicken served with rice, estimate the meat and the curry gravy separately, even when both are in the same bowl. Use cooked meat nutrition without gravy for the chicken, and include skin or coating if eaten.
  * Gravy (kuah campur, curry, dalcha) is its own item on these plates. Estimate how much was eaten using the photo and any user notes. A drizzle is ~60–80 kcal; covering most of the rice ~150 kcal; "banjir" (rice swimming, gravy pooling across the plate) ~200–250 kcal.
  * Vegetables, egg, papadom, sambal: each its own item.
- Do NOT add extra oil, santan or sugar on top of a reference value. Adjust only for what you can see or the user says: extra rice ("nasi tambah"), "banjir", extra sambal, extra pieces, add-ons (telur, ayam, sotong); downward for half portions, "kurang manis" (about -30% sugar), "kosong" (no sugar), "kurang minyak", skin removed.
- For a dish not in the table, build it from its parts using the closest lines.
- Itemise each visible component in "foods" with its estimated grams. The items must add up to "total".
- For bone-in items, report the edible weight in "estimated_quantity" (unit "g") and provide calories and macros for that amount. Include the "bone_in" fields shown below. "served_g" includes the bones, "edible_g" excludes them, and both weights exclude separately itemised gravy. "per_100g" describes 100 g of the cooked edible item. Omit "bone_in" for boneless foods, rice, and gravy.
- If the photo is unclear, still give the best estimate, set "confidence": "low", and say what you assumed.

STEP 3: Return strictly structured JSON matching this schema:
{
  "meal_type": "${mealType || 'lunch'}",
  "meal_name": "Ayam Goreng",
  "foods": [
    {
      "name": "Ayam Goreng (edible portion)",
      "estimated_quantity": 70,
      "unit": "g",
      "calories": 196,
      "protein_g": 18,
      "carbs_g": 6,
      "fat_g": 11,
      "confidence": "medium",
      "bone_in": {
        "served_g": 120,
        "edible_g": 70,
        "per_100g": { "calories": 280, "protein_g": 25, "carbs_g": 8, "fat_g": 16 }
      }
    }
  ],
  "total": {
    "calories": 196,
    "protein_g": 18,
    "carbs_g": 6,
    "fat_g": 11
  },
  "confidence": "high",
  "assumptions": ["List of realistic culinary assumptions (e.g. includes oil in sambal gepuk, standard portion of white rice)"],
  "notes": "One short, friendly, practical tip for this meal (e.g. ask for 'kuah sikit', 'kurang manis' or skip the skin)"
}`;

      const contents: any[] = [];
      const parts: any[] = [{ text: systemPrompt }];
      if (personalContext) {
        parts.push({ text: `${PERSONAL_RULES}

${personalContext}` });
      }

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
          return applyEdiblePortions(JSON.parse(cleanJsonString(text)));
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

