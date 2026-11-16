'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui';
import type { ExerciseLog, Meal, MealItem } from '@/types/database';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABEL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

const n = (v: number | null | undefined) => Number(v) || 0;
const kcal = (v: number) => `${Math.round(v).toLocaleString()} kcal`;
const g = (v: number) => `${Math.round(v)}g`;

function timeLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** A meal's items, or the meal itself as one item when it has no breakdown. */
function itemsOf(m: Meal): Pick<MealItem, 'name' | 'estimated_quantity' | 'estimated_unit' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[] {
  if (m.items && m.items.length > 0) return m.items;
  return [
    {
      name: m.description || 'Meal',
      estimated_quantity: null,
      estimated_unit: null,
      calories: m.calories,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
    },
  ];
}

function portion(i: { estimated_quantity: number | null; estimated_unit: string | null }) {
  if (!i.estimated_quantity) return '';
  const q = Number(i.estimated_quantity);
  return `${q % 1 === 0 ? q : q.toFixed(1)}${i.estimated_unit ? ` ${i.estimated_unit}` : ''}`;
}

/** What was eaten (grouped by meal, with every food item) and logged activity for one day. */
export function DayItemsSummary({ meals, exercises }: { meals: Meal[]; exercises: ExerciseLog[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const dayKcal = meals.reduce((a, m) => a + n(m.calories), 0);

  const groups = useMemo(
    () =>
      MEAL_ORDER.map((type) => {
        const list = meals
          .filter((m) => (m.meal_type || 'snack') === type)
          .sort((a, b) => a.meal_time.localeCompare(b.meal_time));
        return {
          type,
          meals: list,
          kcal: list.reduce((a, m) => a + n(m.calories), 0),
          protein: list.reduce((a, m) => a + n(m.protein_g), 0),
        };
      }).filter((grp) => grp.meals.length > 0),
    [meals],
  );

  // Biggest calorie sources across the day (same food in several meals is added up).
  const top = useMemo(() => {
    const map = new Map<string, { name: string; kcal: number; protein: number }>();
    for (const m of meals) {
      for (const i of itemsOf(m)) {
        const key = (i.name || '').trim().toLowerCase();
        if (!key) continue;
        const cur = map.get(key) || { name: i.name, kcal: 0, protein: 0 };
        cur.kcal += n(i.calories);
        cur.protein += n(i.protein_g);
        map.set(key, cur);
      }
    }
    return [...map.values()].filter((x) => x.kcal > 0).sort((a, b) => b.kcal - a.kcal).slice(0, 5);
  }, [meals]);

  const itemCount = meals.reduce((a, m) => a + itemsOf(m).length, 0);
  const burned = exercises.reduce((a, e) => a + n(e.calories_burned), 0);

  if (meals.length === 0 && exercises.length === 0) {
    return (
      <Card className="p-5 text-center">
        <p className="text-sm font-semibold text-fg">Nothing logged for this day</p>
        <p className="text-xs text-muted mt-1">Meals and workouts you log will be summarised here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {meals.length > 0 && (
        <section aria-labelledby="ate-heading" className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="ate-heading" className="text-sm font-bold text-fg">
              What you ate
            </h2>
            <span className="text-xs text-muted tabular-nums">
              {meals.length} meal{meals.length === 1 ? '' : 's'} · {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-2">
            {groups.map((grp) => (
              <Card key={grp.type} className="overflow-hidden">
                <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-fg">{MEAL_LABEL[grp.type]}</p>
                    <p className="text-[11px] text-muted tabular-nums">
                      {dayKcal > 0 ? `${Math.round((grp.kcal / dayKcal) * 100)}% of today` : ''} · {g(grp.protein)} protein
                    </p>
                  </div>
                  <p className="text-sm font-bold text-fg tabular-nums shrink-0">{kcal(grp.kcal)}</p>
                </div>

                <ul className="divide-y divide-line/60 border-t border-line/60">
                  {grp.meals.map((m) => {
                    const items = itemsOf(m);
                    const multi = items.length > 1;
                    const isOpen = open[m.id] ?? true;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => multi && setOpen((o) => ({ ...o, [m.id]: !isOpen }))}
                          aria-expanded={multi ? isOpen : undefined}
                          className={`w-full px-4 py-2.5 flex items-center gap-3 text-left ${multi ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          {m.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                          ) : null}
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold text-fg truncate">{m.description || 'Meal'}</span>
                            <span className="block text-[11px] text-subtle tabular-nums">
                              {timeLabel(m.meal_time)} · P {g(n(m.protein_g))} · C {g(n(m.carbs_g))} · F {g(n(m.fat_g))}
                            </span>
                          </span>
                          <span className="text-[13px] font-semibold text-fg tabular-nums shrink-0">{kcal(n(m.calories))}</span>
                          {multi && (
                            <ChevronDown
                              className={`w-4 h-4 text-subtle shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                        {multi && isOpen && (
                          <ul className="pb-2.5 pl-4 pr-4 space-y-1">
                            {items.map((i, idx) => (
                              <li key={idx} className="flex items-baseline gap-2 text-[12px]">
                                <span className="w-1 h-1 rounded-full bg-fg/30 shrink-0 translate-y-[-2px]" aria-hidden="true" />
                                <span className="flex-1 min-w-0 truncate text-fg-soft">
                                  {i.name}
                                  {portion(i) && <span className="text-subtle"> · {portion(i)}</span>}
                                </span>
                                <span className="tabular-nums text-muted shrink-0">{Math.round(n(i.calories))} kcal</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}

      {top.length > 1 && (
        <section aria-labelledby="top-heading" className="space-y-2">
          <h2 id="top-heading" className="text-sm font-bold text-fg px-1">
            Biggest calorie sources
          </h2>
          <Card className="p-4 space-y-3">
            {top.map((t) => {
              const share = dayKcal > 0 ? t.kcal / dayKcal : 0;
              return (
                <div key={t.name}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate font-semibold text-fg">{t.name}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {kcal(t.kcal)} · {Math.round(share * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, share * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {exercises.length > 0 && (
        <section aria-labelledby="activity-heading" className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="activity-heading" className="text-sm font-bold text-fg">
              Activity
            </h2>
            <span className="text-xs text-muted tabular-nums">~{kcal(burned)} burned</span>
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line/60">
              {exercises.map((e) => (
                <li key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-elevated flex items-center justify-center shrink-0" aria-hidden="true">
                    <Dumbbell className="w-4 h-4 text-muted" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-fg truncate">{e.exercise_type}</span>
                    <span className="block text-[11px] text-subtle tabular-nums">
                      {e.created_at ? `${timeLabel(e.created_at)} · ` : ''}
                      {n(e.duration_minutes)} min
                      {e.distance_km ? ` · ${e.distance_km} km` : ''}
                    </span>
                  </span>
                  <span className="text-[13px] font-semibold text-orange-ink tabular-nums shrink-0">~{kcal(n(e.calories_burned))}</span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-[11px] text-subtle px-1">Burned calories aren&apos;t added to your food budget.</p>
        </section>
      )}
    </div>
  );
}
