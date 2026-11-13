/**
 * Reference nutrition for common Malaysian / Singaporean hawker and mamak food.
 * Used to anchor the AI's estimates (it otherwise guesses portions and oil,
 * and tended to overestimate) and by the offline text parser.
 *
 * Values are for ONE typical serving as sold, cooking oil / santan / gravy
 * included. Sources, best first:
 *  - lab:   Yeo PLQ et al. "Energy Content and Nutrient Profiles of Frequently
 *           Consumed Meals in Singapore." Foods 2021;10(7):1659 (analysed meals
 *           bought from food courts; per-serving values from Tables 4–6).
 *  - myfcd: Malaysian Food Composition Database (Ministry of Health Malaysia).
 *  - hpb:   Singapore Health Promotion Board, SG FoodID.
 *  - est:   typical-serving estimates from Malaysian nutrition guides (no lab
 *           value found); midpoint of the published range.
 */

export interface FoodReference {
  name: string;
  /** Lower-case words people type for it (matched as substrings). */
  aliases: string[];
  serving: string;
  grams?: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  kind: 'meal' | 'side' | 'drink' | 'snack';
  source: 'lab' | 'myfcd' | 'hpb' | 'est';
}

export const MALAYSIAN_FOODS: FoodReference[] = [
  // ── Rice ────────────────────────────────────────────────────────────────
  { name: 'Nasi lemak (with egg, sambal, ikan bilis, peanuts, fried chicken)', aliases: ['nasi lemak ayam', 'nasi lemak ayam goreng'], serving: '1 plate', grams: 395, kcal: 741, protein_g: 36, carbs_g: 70, fat_g: 35, kind: 'meal', source: 'lab' },
  { name: 'Nasi lemak biasa / bungkus (no chicken)', aliases: ['nasi lemak'], serving: '1 bungkus', kcal: 600, protein_g: 15, carbs_g: 70, fat_g: 28, kind: 'meal', source: 'est' },
  { name: 'Ayam penyet / ayam gepuk set (rice, smashed fried chicken, sambal, tauhu, tempe)', aliases: ['ayam penyet', 'ayam gepuk', 'penyet', 'gepuk'], serving: '1 set', grams: 425, kcal: 862, protein_g: 38, carbs_g: 92, fat_g: 38, kind: 'meal', source: 'lab' },
  { name: 'Ikan penyet set', aliases: ['ikan penyet'], serving: '1 set', grams: 274, kcal: 502, protein_g: 21, carbs_g: 61, fat_g: 19, kind: 'meal', source: 'lab' },
  { name: 'Nasi goreng kampung', aliases: ['nasi goreng kampung', 'nasi goreng', 'fried rice'], serving: '1 plate', grams: 405, kcal: 772, protein_g: 29, carbs_g: 100, fat_g: 29, kind: 'meal', source: 'lab' },
  { name: 'Chicken rice, steamed (nasi ayam)', aliases: ['chicken rice', 'nasi ayam', 'nasi ayam stim'], serving: '1 plate', grams: 412, kcal: 778, protein_g: 38, carbs_g: 88, fat_g: 30, kind: 'meal', source: 'lab' },
  { name: 'Chicken rice, roasted (nasi ayam panggang)', aliases: ['roast chicken rice', 'roasted chicken rice', 'nasi ayam panggang'], serving: '1 plate', grams: 285, kcal: 524, protein_g: 24, carbs_g: 67, fat_g: 18, kind: 'meal', source: 'lab' },
  { name: 'Nasi kandar (rice, 1 meat, 2 veg, kuah campur)', aliases: ['nasi kandar'], serving: '1 plate', kcal: 800, protein_g: 30, carbs_g: 80, fat_g: 30, kind: 'meal', source: 'est' },
  { name: 'Nasi campur / economy rice (2 dishes)', aliases: ['nasi campur', 'economy rice', 'mixed rice', 'nasi bujang'], serving: '1 plate', kcal: 700, protein_g: 25, carbs_g: 75, fat_g: 25, kind: 'meal', source: 'est' },
  { name: 'Nasi ambang (chicken)', aliases: ['nasi ambang'], serving: '1 plate', grams: 630, kcal: 1104, protein_g: 58, carbs_g: 115, fat_g: 46, kind: 'meal', source: 'lab' },
  { name: 'Nasi kerabu', aliases: ['nasi kerabu'], serving: '1 plate', kcal: 500, protein_g: 20, carbs_g: 60, fat_g: 18, kind: 'meal', source: 'est' },
  { name: 'Nasi briyani, chicken', aliases: ['briyani', 'biryani', 'nasi beriani', 'nasi briyani'], serving: '1 plate', grams: 759, kcal: 1065, protein_g: 51, carbs_g: 98, fat_g: 49, kind: 'meal', source: 'hpb' },
  { name: 'Mutton biryani', aliases: ['mutton biryani', 'briyani kambing'], serving: '1 plate', grams: 459, kcal: 799, protein_g: 40, carbs_g: 67, fat_g: 41, kind: 'meal', source: 'lab' },
  { name: 'Lor mai kai', aliases: ['lor mai kai', 'loh mai kai'], serving: '1 portion', grams: 354, kcal: 547, protein_g: 15, carbs_g: 108, fat_g: 6, kind: 'meal', source: 'lab' },
  { name: 'Plain white rice', aliases: ['nasi putih', 'white rice'], serving: '1 bowl (160 g)', grams: 160, kcal: 210, protein_g: 4, carbs_g: 46, fat_g: 0.5, kind: 'side', source: 'myfcd' },

  // ── Noodles ─────────────────────────────────────────────────────────────
  { name: 'Char kuey teow', aliases: ['char kuey teow', 'char kway teow', 'kuey teow goreng', 'ckt'], serving: '1 plate', grams: 362, kcal: 659, protein_g: 15, carbs_g: 99, fat_g: 23, kind: 'meal', source: 'lab' },
  { name: 'Mee goreng mamak', aliases: ['mee goreng mamak', 'mee goreng', 'mi goreng'], serving: '1 plate', grams: 325, kcal: 600, protein_g: 21, carbs_g: 62, fat_g: 29, kind: 'meal', source: 'myfcd' },
  { name: 'Maggi goreng', aliases: ['maggi goreng', 'megi goreng'], serving: '1 plate', kcal: 600, protein_g: 12, carbs_g: 65, fat_g: 28, kind: 'meal', source: 'est' },
  { name: 'Bihun goreng (Singapore / sin chew style)', aliases: ['bihun goreng', 'mee hoon goreng', 'fried bee hoon', 'sin chew bee hoon'], serving: '1 plate', grams: 386, kcal: 635, protein_g: 26, carbs_g: 88, fat_g: 20, kind: 'meal', source: 'lab' },
  { name: 'Curry laksa / laksa lemak', aliases: ['curry laksa', 'laksa lemak', 'curry mee', 'kari mee', 'laksa'], serving: '1 bowl', grams: 577, kcal: 881, protein_g: 46, carbs_g: 106, fat_g: 30, kind: 'meal', source: 'lab' },
  { name: 'Asam laksa', aliases: ['asam laksa', 'penang laksa'], serving: '1 bowl', kcal: 450, protein_g: 18, carbs_g: 70, fat_g: 8, kind: 'meal', source: 'est' },
  { name: 'Mee rebus', aliases: ['mee rebus'], serving: '1 bowl', grams: 582, kcal: 655, protein_g: 21, carbs_g: 111, fat_g: 14, kind: 'meal', source: 'lab' },
  { name: 'Mee soto', aliases: ['mee soto'], serving: '1 bowl', grams: 281, kcal: 406, protein_g: 26, carbs_g: 57, fat_g: 8, kind: 'meal', source: 'lab' },
  { name: 'Soto ayam (with nasi impit)', aliases: ['soto ayam', 'soto'], serving: '1 bowl', grams: 693, kcal: 797, protein_g: 43, carbs_g: 133, fat_g: 10, kind: 'meal', source: 'lab' },
  { name: 'Mee siam', aliases: ['mee siam'], serving: '1 plate', grams: 566, kcal: 798, protein_g: 28, carbs_g: 138, fat_g: 15, kind: 'meal', source: 'lab' },
  { name: 'Mee bandung', aliases: ['mee bandung'], serving: '1 bowl', grams: 466, kcal: 693, protein_g: 35, carbs_g: 84, fat_g: 24, kind: 'meal', source: 'lab' },
  { name: 'Mee bakso', aliases: ['bakso'], serving: '1 bowl', grams: 435, kcal: 635, protein_g: 25, carbs_g: 113, fat_g: 9, kind: 'meal', source: 'lab' },
  { name: 'Wantan mee (dry, char siew)', aliases: ['wantan mee', 'wan tan mee', 'wonton noodle', 'wanton mee'], serving: '1 plate', grams: 335, kcal: 402, protein_g: 27, carbs_g: 62, fat_g: 5, kind: 'meal', source: 'lab' },
  { name: 'Hokkien mee (fried)', aliases: ['hokkien mee'], serving: '1 plate', grams: 328, kcal: 446, protein_g: 18, carbs_g: 82, fat_g: 5, kind: 'meal', source: 'lab' },
  { name: 'Pan mee / ban mian (dry)', aliases: ['pan mee', 'ban mian'], serving: '1 bowl', grams: 311, kcal: 462, protein_g: 21, carbs_g: 66, fat_g: 13, kind: 'meal', source: 'lab' },
  { name: 'Chicken noodle (steamed chicken)', aliases: ['chicken noodle', 'mee ayam'], serving: '1 bowl', grams: 367, kcal: 527, protein_g: 40, carbs_g: 64, fat_g: 12, kind: 'meal', source: 'lab' },
  { name: 'Lontong', aliases: ['lontong', 'lotong'], serving: '1 bowl', grams: 269, kcal: 381, protein_g: 22, carbs_g: 33, fat_g: 18, kind: 'meal', source: 'lab' },

  // ── Mamak / Indian ──────────────────────────────────────────────────────
  { name: 'Roti canai kosong (plain)', aliases: ['roti canai', 'roti kosong', 'roti prata', 'prata'], serving: '1 piece (95 g), no curry', grams: 95, kcal: 300, protein_g: 7, carbs_g: 46, fat_g: 10, kind: 'meal', source: 'myfcd' },
  { name: 'Roti telur', aliases: ['roti telur', 'egg prata'], serving: '1 piece (119 g)', grams: 119, kcal: 317, protein_g: 13, carbs_g: 33, fat_g: 13, kind: 'meal', source: 'hpb' },
  { name: 'Roti planta', aliases: ['roti planta'], serving: '1 piece', kcal: 380, protein_g: 7, carbs_g: 46, fat_g: 20, kind: 'meal', source: 'est' },
  { name: 'Dhal / curry gravy for roti', aliases: ['dhal', 'kuah dal', 'kuah kari'], serving: '1/2 cup (80 g)', grams: 80, kcal: 60, protein_g: 2.5, carbs_g: 7, fat_g: 2, kind: 'side', source: 'est' },
  { name: 'Murtabak (chicken or mutton)', aliases: ['murtabak'], serving: '1 piece', grams: 340, kcal: 850, protein_g: 46, carbs_g: 59, fat_g: 48, kind: 'meal', source: 'hpb' },
  { name: 'Thosai / tosai (plain)', aliases: ['thosai', 'tosai', 'dosa'], serving: '1 piece (156 g)', grams: 156, kcal: 390, protein_g: 11, carbs_g: 59, fat_g: 12, kind: 'meal', source: 'hpb' },
  { name: 'Thosai telur', aliases: ['thosai telur', 'tosai telur', 'egg thosai'], serving: '1 piece', grams: 146, kcal: 340, protein_g: 13, carbs_g: 45, fat_g: 12, kind: 'meal', source: 'hpb' },
  { name: 'Masala thosai', aliases: ['masala thosai', 'masala dosa'], serving: '1 piece', grams: 271, kcal: 420, protein_g: 12, carbs_g: 54, fat_g: 16, kind: 'meal', source: 'hpb' },
  { name: 'Chapati', aliases: ['chapati', 'capati'], serving: '1 piece (133 g)', grams: 133, kcal: 430, protein_g: 11, carbs_g: 63, fat_g: 14, kind: 'meal', source: 'hpb' },
  { name: 'Naan set (with curry)', aliases: ['naan', 'nan'], serving: '1 set', grams: 597, kcal: 995, protein_g: 31, carbs_g: 164, fat_g: 23, kind: 'meal', source: 'lab' },
  { name: 'Tandoori chicken', aliases: ['tandoori'], serving: '100 g', grams: 100, kcal: 165, protein_g: 18, carbs_g: 3, fat_g: 9, kind: 'side', source: 'hpb' },
  { name: 'Putu mayam', aliases: ['putu mayam', 'putu mayang'], serving: '1 portion', grams: 193, kcal: 312, protein_g: 4, carbs_g: 63, fat_g: 5, kind: 'snack', source: 'lab' },

  // ── Sides / proteins ────────────────────────────────────────────────────
  { name: 'Ayam goreng (fried chicken, 1 thigh)', aliases: ['ayam goreng', 'fried chicken', 'ayam goreng berempah'], serving: '1 piece (90 g)', grams: 90, kcal: 255, protein_g: 22, carbs_g: 5, fat_g: 16, kind: 'side', source: 'myfcd' },
  { name: 'Chicken curry (kari ayam)', aliases: ['kari ayam', 'chicken curry'], serving: '1 portion (96 g)', grams: 96, kcal: 195, protein_g: 15, carbs_g: 4, fat_g: 13, kind: 'side', source: 'myfcd' },
  { name: 'Rendang (ayam / daging)', aliases: ['rendang'], serving: '1 portion', kcal: 315, protein_g: 22, carbs_g: 6, fat_g: 22, kind: 'side', source: 'est' },
  { name: 'Ikan goreng (1 medium piece)', aliases: ['ikan goreng', 'fried fish'], serving: '1 piece', kcal: 240, protein_g: 25, carbs_g: 4, fat_g: 14, kind: 'side', source: 'est' },
  { name: 'Telur dadar / omelette', aliases: ['telur dadar', 'omelette', 'telur goreng', 'fried egg'], serving: '1 egg', kcal: 200, protein_g: 12, carbs_g: 1, fat_g: 16, kind: 'side', source: 'est' },
  { name: 'Half-boiled eggs', aliases: ['half boiled', 'telur separuh masak', 'soft boiled egg'], serving: '2 eggs', kcal: 140, protein_g: 12, carbs_g: 1, fat_g: 10, kind: 'side', source: 'est' },
  { name: 'Satay ayam', aliases: ['satay ayam', 'satay', 'sate'], serving: '10 sticks with peanut sauce', kcal: 450, protein_g: 35, carbs_g: 20, fat_g: 25, kind: 'meal', source: 'est' },
  { name: 'Fried carrot cake (chai tow kway)', aliases: ['carrot cake', 'chai tow kway'], serving: '1 plate', grams: 271, kcal: 475, protein_g: 25, carbs_g: 24, fat_g: 31, kind: 'meal', source: 'lab' },
  { name: 'Tahu goreng set (with peanut sauce)', aliases: ['tahu goreng', 'tauhu goreng'], serving: '1 set', grams: 402, kcal: 664, protein_g: 41, carbs_g: 35, fat_g: 40, kind: 'meal', source: 'lab' },
  { name: 'Roti bakar kaya butter', aliases: ['roti bakar', 'kaya toast', 'kaya butter'], serving: '2 slices', kcal: 325, protein_g: 6, carbs_g: 38, fat_g: 16, kind: 'meal', source: 'est' },

  // ── Kuih / snacks ───────────────────────────────────────────────────────
  { name: 'Curry puff (karipap)', aliases: ['curry puff', 'karipap', 'epok-epok'], serving: '1 piece', kcal: 225, protein_g: 4, carbs_g: 22, fat_g: 13, kind: 'snack', source: 'est' },
  { name: 'Pisang goreng', aliases: ['pisang goreng', 'goreng pisang', 'banana fritter'], serving: '1 piece', kcal: 135, protein_g: 1, carbs_g: 22, fat_g: 5, kind: 'snack', source: 'est' },
  { name: 'Keropok lekor', aliases: ['keropok lekor'], serving: '5 pieces', kcal: 225, protein_g: 8, carbs_g: 30, fat_g: 8, kind: 'snack', source: 'est' },
  { name: 'Kuih lapis', aliases: ['kuih lapis'], serving: '1 piece', kcal: 135, protein_g: 1, carbs_g: 25, fat_g: 4, kind: 'snack', source: 'est' },
  { name: 'Kuih seri muka', aliases: ['seri muka'], serving: '1 piece', kcal: 200, protein_g: 3, carbs_g: 32, fat_g: 7, kind: 'snack', source: 'est' },
  { name: 'Onde-onde', aliases: ['onde-onde', 'onde onde', 'buah melaka'], serving: '3 pieces', kcal: 165, protein_g: 2, carbs_g: 30, fat_g: 4, kind: 'snack', source: 'est' },
  { name: 'Apam balik (thick)', aliases: ['apam balik', 'martabak manis'], serving: '1 piece', kcal: 350, protein_g: 7, carbs_g: 50, fat_g: 14, kind: 'snack', source: 'est' },
  { name: 'Cendol', aliases: ['cendol', 'chendol'], serving: '1 bowl', kcal: 350, protein_g: 3, carbs_g: 55, fat_g: 14, kind: 'snack', source: 'est' },
  { name: 'Rojak buah', aliases: ['rojak'], serving: '1 serving', kcal: 300, protein_g: 6, carbs_g: 45, fat_g: 10, kind: 'snack', source: 'est' },
  { name: 'Popiah basah', aliases: ['popiah'], serving: '1 roll', kcal: 175, protein_g: 5, carbs_g: 25, fat_g: 6, kind: 'snack', source: 'est' },

  // ── Drinks (sweetened as usually served unless "kosong") ───────────────
  { name: 'Teh tarik', aliases: ['teh tarik'], serving: '1 glass (250 ml)', kcal: 150, protein_g: 4, carbs_g: 23, fat_g: 4, kind: 'drink', source: 'hpb' },
  { name: 'Teh / teh C (with milk)', aliases: ['teh c', 'teh susu', 'teh ais', 'teh peng'], serving: '1 glass', kcal: 140, protein_g: 3, carbs_g: 24, fat_g: 3, kind: 'drink', source: 'est' },
  { name: 'Teh O (sweetened)', aliases: ['teh o ais', 'teh o', 'teh-o'], serving: '1 glass', kcal: 70, protein_g: 0, carbs_g: 18, fat_g: 0, kind: 'drink', source: 'est' },
  { name: 'Kopi (with condensed milk)', aliases: ['kopi ais', 'kopi peng', 'kopi'], serving: '1 cup', kcal: 110, protein_g: 2, carbs_g: 20, fat_g: 3, kind: 'drink', source: 'est' },
  { name: 'Kopi O (sweetened)', aliases: ['kopi o', 'kopi-o'], serving: '1 cup', kcal: 50, protein_g: 0, carbs_g: 12, fat_g: 0, kind: 'drink', source: 'est' },
  { name: 'Teh O / kopi O kosong (no sugar)', aliases: ['kosong'], serving: '1 cup', kcal: 5, protein_g: 0, carbs_g: 1, fat_g: 0, kind: 'drink', source: 'est' },
  { name: 'Milo ais', aliases: ['milo ais', 'milo'], serving: '1 glass', kcal: 200, protein_g: 5, carbs_g: 35, fat_g: 5, kind: 'drink', source: 'est' },
  { name: 'Milo dinosaur', aliases: ['milo dinosaur', 'milo dino'], serving: '1 large glass (550 ml)', kcal: 500, protein_g: 12, carbs_g: 80, fat_g: 14, kind: 'drink', source: 'est' },
  { name: 'Sirap bandung', aliases: ['bandung', 'sirap bandung'], serving: '1 glass', kcal: 175, protein_g: 3, carbs_g: 38, fat_g: 2, kind: 'drink', source: 'est' },
  { name: 'Sirap ais / sirap limau', aliases: ['sirap ais', 'air sirap'], serving: '1 glass', kcal: 120, protein_g: 0, carbs_g: 30, fat_g: 0, kind: 'drink', source: 'est' },
  { name: 'Air tebu (sugar cane)', aliases: ['air tebu', 'sugar cane'], serving: '1 glass', kcal: 200, protein_g: 0, carbs_g: 50, fat_g: 0, kind: 'drink', source: 'est' },
  { name: '100Plus', aliases: ['100plus', '100 plus'], serving: '1 can (325 ml)', kcal: 110, protein_g: 0, carbs_g: 27, fat_g: 0, kind: 'drink', source: 'est' },
];

/** Compact table for AI prompts (one line per item). */
export function foodReferenceForPrompt(items: FoodReference[] = MALAYSIAN_FOODS): string {
  return items
    .map(
      (f) =>
        `- ${f.name} | ${f.serving}${f.grams ? `, ~${f.grams} g` : ''} | ${f.kcal} kcal | P${f.protein_g} C${f.carbs_g} F${f.fat_g}${f.source === 'est' ? ' (est.)' : ''}`,
    )
    .join('\n');
}

/**
 * Finds reference items named in free text, longest alias first, so
 * "nasi lemak ayam goreng" matches the chicken version, not plain nasi lemak.
 * Returns each match with a quantity read from a preceding number ("2 roti canai").
 */
export function matchMalaysianFoods(text: string): { food: FoodReference; quantity: number }[] {
  let rest = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  const candidates = MALAYSIAN_FOODS.flatMap((food) => food.aliases.map((alias) => ({ food, alias })))
    .filter(({ alias }) => alias !== 'kosong')
    .sort((a, b) => b.alias.length - a.alias.length);
  const found: { food: FoodReference; quantity: number }[] = [];
  for (const { food, alias } of candidates) {
    const re = new RegExp(`(?:\\b(\\d+|one|two|three|satu|dua|tiga)\\s+)?\\b${alias.replace(/[-]/g, '[- ]?')}\\b`);
    const m = rest.match(re);
    if (!m) continue;
    const words: Record<string, number> = { one: 1, two: 2, three: 3, satu: 1, dua: 2, tiga: 3 };
    const quantity = m[1] ? Number(m[1]) || words[m[1]] || 1 : 1;
    if (!found.some((f) => f.food === food)) found.push({ food, quantity: Math.min(quantity, 10) });
    rest = rest.replace(m[0], ' ');
  }
  return found;
}

export interface ReferenceMeal {
  meal_name: string;
  foods: {
    name: string;
    estimated_quantity: number;
    unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  assumptions: string[];
}

/**
 * Builds a meal estimate from the reference table for text like
 * "2 roti canai and teh tarik kurang manis". Returns null when no known food
 * is named. Used when the AI is unavailable.
 */
export function referenceMealFromText(text: string): ReferenceMeal | null {
  const lower = text.toLowerCase();
  const matches = matchMalaysianFoods(text);
  if (matches.length === 0) return null;
  const noSugar = /\bkosong\b|no sugar|tanpa gula/.test(lower);
  const lessSweet = /kurang manis|less sugar|less sweet/.test(lower);
  const assumptions = ['Typical Malaysian hawker serving (MyFCD / HPB / lab-analysed values).'];

  const foods = matches.map(({ food, quantity }) => {
    let { kcal, carbs_g } = food;
    let name = food.name;
    if (food.kind === 'drink' && noSugar && /^(teh|kopi)/i.test(food.name)) {
      kcal = food.name.startsWith('Teh tarik') || /milk|susu|condensed/i.test(food.name) ? Math.round(kcal * 0.45) : 5;
      carbs_g = Math.round(carbs_g * 0.2);
      name = `${food.name.split(' (')[0]} kosong`;
      assumptions.push(`${name}: no sugar.`);
    } else if (food.kind === 'drink' && lessSweet) {
      kcal = Math.round(kcal * 0.75);
      carbs_g = Math.round(carbs_g * 0.7);
      name = `${food.name.split(' (')[0]} (kurang manis)`;
      assumptions.push(`${name}: about 30% less sugar.`);
    }
    const r = (n: number) => Math.round(n * quantity * 10) / 10;
    return {
      name,
      estimated_quantity: quantity,
      unit: food.serving.replace(/^1\s+/, ''),
      calories: Math.round(kcal * quantity),
      protein_g: r(food.protein_g),
      carbs_g: r(carbs_g),
      fat_g: r(food.fat_g),
      confidence: (food.source === 'est' ? 'medium' : 'high') as 'high' | 'medium',
    };
  });

  const sum = (k: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g') =>
    Math.round(foods.reduce((acc, f) => acc + f[k], 0) * 10) / 10;
  return {
    meal_name: foods.map((f) => (f.estimated_quantity > 1 ? `${f.estimated_quantity}× ` : '') + f.name.split(' (')[0]).join(' + '),
    foods,
    total: { calories: Math.round(sum('calories')), protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') },
    assumptions,
  };
}
