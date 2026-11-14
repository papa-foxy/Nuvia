// Run: node --experimental-strip-types scripts/test-meal-personalization.ts
import assert from 'node:assert/strict';
import {
  summarizeMealHistory,
  personalContextForPrompt,
  formatHourRange,
  type PersonalMealRow,
} from '../src/lib/server/meal-personalization.ts';

const NOW = new Date('2026-11-13T00:12:00Z'); // Fri 8:12am MYT
const DAY = 86_400_000;

/** ISO time for `daysAgo` local (UTC+8) days before NOW at local hh:mm. */
function at(daysAgo: number, hh: number, mm = 0): string {
  const localMidnight = Date.UTC(2026, 10, 13) - daysAgo * DAY; // 13 Nov local date
  return new Date(localMidnight + (hh * 60 + mm) * 60_000 - 8 * 3_600_000).toISOString();
}

function meal(p: Partial<PersonalMealRow> & { meal_time: string }): PersonalMealRow {
  return {
    description: null,
    meal_type: null,
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    ...p,
  };
}

function buildHistory(): PersonalMealRow[] {
  const rows: PersonalMealRow[] = [];
  // Latte almost daily (days 0..19 except 3 and 7), single-item meals, ~8:10-8:50am.
  for (let d = 0; d < 20; d++) {
    if (d === 3 || d === 7) continue;
    rows.push(
      meal({
        description: d % 2 ? 'latte ' : 'Latte (no stevia)',
        meal_type: 'breakfast',
        meal_time: at(d, 8, 10 + (d % 5) * 10),
        calories: 110,
        protein_g: 6,
        carbs_g: 9,
        fat_g: 5,
        source: 'photo',
        items: [{ name: 'Latte', calories: 110 }],
        ai_meal_name: d < 3 ? 'Kopi Ais' : d === 4 ? 'latte (No Stevia)' : null,
      }),
    );
  }
  // Days 3 and 7: latte as part of a combo.
  for (const d of [3, 7]) {
    rows.push(
      meal({
        description: 'Roti bakar + Latte',
        meal_type: 'breakfast',
        meal_time: at(d, 8, 30),
        calories: 330,
        protein_g: 10,
        carbs_g: 40,
        fat_g: 14,
        items: [
          { name: 'Roti bakar', calories: 220 },
          { name: 'latte', calories: 110 },
        ],
      }),
    );
  }
  // Nasi lemak ayam x6 at lunch.
  for (const d of [1, 5, 12, 20, 30, 40]) {
    rows.push(
      meal({
        description: 'Nasi lemak  ayam',
        meal_type: 'lunch',
        meal_time: at(d, 12, 45),
        calories: 740,
        protein_g: 30,
        carbs_g: 80,
        fat_g: 32,
        source: 'photo',
        ai_meal_name: d === 1 ? 'Nasi Lemak Biasa' : 'Nasi lemak ayam',
      }),
    );
  }
  // Kopi once (not usual), and a different-name drink twice.
  rows.push(meal({ description: 'Kopi', meal_type: 'snack', meal_time: at(2, 16) }));
  rows.push(meal({ description: 'Teh tarik', meal_type: 'snack', meal_time: at(2, 16, 30), calories: 150 }));
  rows.push(meal({ description: 'TEH TARIK.', meal_type: 'snack', meal_time: at(9, 16, 10), calories: 170 }));
  return rows;
}

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const rows = buildHistory();
const s = summarizeMealHistory(rows, { now: NOW });
const latte = s.usual.find((u) => u.name.toLowerCase().startsWith('latte'))!;

test('totalMeals counts every row', () => {
  assert.equal(s.totalMeals, rows.length);
});

test('latte counted from single + multi-item meals without double counting', () => {
  assert.ok(latte);
  assert.equal(latte.count, 20); // 18 single-item + 2 combos, no double count
  assert.equal(s.usual[0], latte);
  assert.equal(latte.name, 'Latte (no stevia)'); // most recent original spelling
  assert.equal(latte.calories, 110);
  assert.equal(latte.protein_g, 6);
  assert.equal(latte.mealType, 'breakfast');
});

test('casing/whitespace/punctuation variants merged', () => {
  const nl = s.usual.find((u) => u.name.startsWith('Nasi lemak'))!;
  assert.equal(nl.count, 6);
  assert.equal(nl.calories, 740);
  const teh = s.usual.find((u) => u.name.toLowerCase().startsWith('teh'))!;
  assert.equal(teh.count, 2);
  assert.equal(teh.calories, 160);
});

test('"Latte" vs "Kopi" not merged; singletons excluded', () => {
  assert.ok(!s.usual.some((u) => u.name === 'Kopi'));
  const r = summarizeMealHistory(
    [
      meal({ description: 'Latte', meal_time: at(0, 8) }),
      meal({ description: 'Kopi', meal_time: at(1, 8) }),
      meal({ description: 'Kopi', meal_time: at(2, 8) }),
    ],
    { now: NOW },
  );
  assert.equal(r.usual.length, 1);
  assert.equal(r.usual[0].name, 'Kopi');
  assert.equal(r.usual[0].count, 2);
});

test('combo description counted as its own item; Roti bakar from items', () => {
  const roti = s.usual.find((u) => u.name === 'Roti bakar')!;
  assert.equal(roti.count, 2);
  assert.equal(roti.calories, 220);
  assert.equal(roti.protein_g, null); // items carry no macros
});

test('corrections detected, merged with counts, ignored when names match', () => {
  // d=0,d=2 saved "Latte (no stevia)"; d=1 saved "latte" (distinct pair); d=1 nasi lemak
  assert.equal(s.corrections.length, 3);
  const kopi = s.corrections.find((c) => c.aiSaid === 'Kopi Ais' && c.userSaved === 'Latte (no stevia)')!;
  assert.equal(kopi.count, 2);
  assert.ok(s.corrections.some((c) => c.aiSaid === 'Kopi Ais' && c.userSaved === 'latte' && c.count === 1));
  const all = summarizeMealHistory(rows, { now: NOW }).corrections;
  assert.ok(all.every((c) => c.aiSaid !== 'latte (No Stevia)')); // normalizes equal -> no correction
  assert.ok(all.every((c) => !(c.aiSaid === 'Nasi lemak ayam')));
});

test('corrections merge exact pairs', () => {
  const r = summarizeMealHistory(
    [
      meal({ description: 'Latte (no stevia)', ai_meal_name: 'Kopi Ais', meal_time: at(0, 8) }),
      meal({ description: 'latte (No Stevia)', ai_meal_name: 'kopi ais', meal_time: at(1, 8) }),
      meal({ description: 'Latte (no stevia)', ai_meal_name: 'Kopi Ais', meal_time: at(2, 8) }),
      meal({ description: 'Mee goreng', ai_meal_name: 'mee goreng!', meal_time: at(3, 13) }),
      meal({ description: 'Nasi Kandar', ai_meal_name: 'Nasi Campur', meal_time: at(4, 13) }),
    ],
    { now: NOW },
  );
  assert.equal(r.corrections.length, 2);
  assert.deepEqual(
    { ...r.corrections[0], lastSeen: undefined },
    { aiSaid: 'Kopi Ais', userSaved: 'Latte (no stevia)', count: 3, lastSeen: undefined },
  );
  assert.equal(r.corrections[1].userSaved, 'Nasi Kandar');
});

test('daysOfLast14', () => {
  // Latte on local days 0..13 = 14 days (combos on 3 and 7 included).
  assert.equal(latte.daysOfLast14, 14);
  const nl = s.usual.find((u) => u.name.startsWith('Nasi lemak'))!;
  assert.equal(nl.daysOfLast14, 3); // days 1, 5, 12
});

test('hour range uses +480 offset', () => {
  assert.deepEqual(latte.hours, { start: 8, end: 9 });
  assert.equal(formatHourRange(latte.hours!), '~8–9am');
  const nl = s.usual.find((u) => u.name.startsWith('Nasi lemak'))!;
  assert.equal(formatHourRange(nl.hours!), '~12–1pm');
  assert.equal(formatHourRange({ start: 11, end: 13 }), '~11am–1pm');
  // UTC offset 0 shifts the same latte to midnight
  const utc = summarizeMealHistory(rows, { now: NOW, timeZoneOffsetMinutes: 0 });
  assert.deepEqual(utc.usual[0].hours, { start: 0, end: 1 });
});

test('prompt text contains expected lines', () => {
  const text = personalContextForPrompt(s, { localTimeLabel: 'Fri 8:12am local' });
  console.log('\n' + text + '\n(' + text.length + ' chars)\n');
  assert.ok(text.startsWith('ABOUT THIS USER'));
  assert.ok(
    text.includes(
      '- "Latte (no stevia)" — 20x, 14 of last 14 days, usually breakfast ~8–9am, ~110 kcal (P6 C9 F5)',
    ),
  );
  assert.ok(text.includes('- "Nasi lemak  ayam"'.replace('  ', ' ')));
  assert.ok(text.includes('Past corrections (AI guess → what the user saved):'));
  assert.ok(text.includes('- "Kopi Ais" → "Latte (no stevia)" (2x)'));
  assert.ok(text.includes('- "Nasi Lemak Biasa" → "Nasi lemak ayam"'));
  assert.ok(text.trimEnd().endsWith('Now: Fri 8:12am local.'));
  assert.ok(text.length < 900, `typical length ${text.length}`);
});

test('length cap respected for heavy users', () => {
  const big: PersonalMealRow[] = [];
  for (let i = 0; i < 30; i++) {
    for (let k = 0; k < 3; k++) {
      big.push(
        meal({
          description: `Very long descriptive meal name number ${i} with extra words`,
          meal_type: 'lunch',
          meal_time: at(i + k, 12),
          calories: 500,
          protein_g: 20,
          carbs_g: 60,
          fat_g: 15,
          ai_meal_name: `Some completely different AI guess for dish ${i} variant`,
        }),
      );
    }
  }
  const sum = summarizeMealHistory(big, { now: NOW });
  assert.equal(sum.usual.length, 12);
  assert.equal(sum.corrections.length, 8);
  const text = personalContextForPrompt(sum, { localTimeLabel: 'Fri 8:12am local' });
  assert.ok(text.length <= 1500, `length ${text.length}`);
  assert.ok(text.includes('Usual items:') && text.includes('Past corrections'));
  assert.ok(text.endsWith('Now: Fri 8:12am local.'));
});

test('empty input -> empty string', () => {
  const e = summarizeMealHistory([], { now: NOW });
  assert.equal(e.totalMeals, 0);
  assert.equal(personalContextForPrompt(e, { localTimeLabel: 'Fri 8:12am' }), '');
  const singles = summarizeMealHistory([meal({ description: 'Kopi', meal_time: at(0, 8) })], { now: NOW });
  assert.equal(personalContextForPrompt(singles), '');
});

console.log(`\n${passed} tests passed`);
