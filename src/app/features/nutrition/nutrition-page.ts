import { Component, computed, inject, signal } from '@angular/core';
import { StoreService, todayISO } from '../../core/store.service';
import { NUTRITION_TIERS, PROFILE, calcNutrition } from '../../core/nutrition';

interface MealDraft {
  name: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
}

const EMPTY_DRAFT: MealDraft = { name: '', kcal: '', protein: '', fat: '', carbs: '' };

@Component({
  selector: 'app-nutrition-page',
  templateUrl: './nutrition-page.html',
  styleUrl: './nutrition-page.scss',
})
export class NutritionPage {
  protected readonly store = inject(StoreService);
  protected readonly PROFILE = PROFILE;
  protected readonly tiers = NUTRITION_TIERS;
  protected readonly calc = calcNutrition;
  protected readonly today = todayISO();

  protected readonly macros = computed(() => calcNutrition(this.store.currentWeight()));

  protected readonly currentTier = computed(() => {
    const w = this.store.currentWeight();
    return this.tiers.find((t) => w > t.to) ?? this.tiers[this.tiers.length - 1];
  });

  // ---------- Дневник за сегодня ----------

  protected readonly draft = signal<MealDraft>({ ...EMPTY_DRAFT });
  protected readonly formOpen = signal(false);

  protected readonly todayMeals = computed(() => this.store.meals()[this.today] ?? []);

  protected readonly eaten = computed(() =>
    this.todayMeals().reduce(
      (sum, m) => ({
        kcal: sum.kcal + m.kcal,
        protein: sum.protein + m.protein,
        fat: sum.fat + m.fat,
        carbs: sum.carbs + m.carbs,
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    ),
  );

  protected readonly diaryRows = computed(() => {
    const target = this.macros();
    const eaten = this.eaten();
    return [
      { label: 'ккал', eaten: eaten.kcal, target: target.kcal },
      { label: 'белки', eaten: eaten.protein, target: target.protein },
      { label: 'жиры', eaten: eaten.fat, target: target.fat },
      { label: 'углеводы', eaten: eaten.carbs, target: target.carbs },
    ].map((row) => ({
      ...row,
      ratio: Math.min(1, row.target ? row.eaten / row.target : 0),
      over: row.eaten > row.target,
    }));
  });

  protected isCurrent(tier: { from: number; to: number }): boolean {
    return tier === this.currentTier();
  }

  protected patchDraft(field: keyof MealDraft, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected addMeal(): void {
    const d = this.draft();
    const num = (s: string): number => Math.max(0, parseFloat(s.replace(',', '.')) || 0);
    const meal = {
      name: d.name.trim() || 'Приём пищи',
      kcal: num(d.kcal),
      protein: num(d.protein),
      fat: num(d.fat),
      carbs: num(d.carbs),
    };
    if (!meal.kcal && !meal.protein && !meal.fat && !meal.carbs) return;
    this.store.addMeal(this.today, meal);
    this.draft.set({ ...EMPTY_DRAFT });
    this.formOpen.set(false);
  }

  protected deleteMeal(id: number): void {
    this.store.deleteMeal(this.today, id);
  }

  protected readonly rules = [
    'Белок — святое: сохраняет мышцы на дефиците. Курица, рыба, яйца, творог, протеин.',
    'Взвешивайся 2–3 раза в неделю утром натощак; смотри на среднее за неделю, а не на день.',
    'Вес стоит 2+ недели — минус 100–150 ккал от текущей нормы.',
    '8–10 тысяч шагов в день ускоряют жиросжигание без ущерба восстановлению.',
    'Вода — 2,5–3 литра в день.',
    'Сон 7–9 часов: недосып = голод и слабые тренировки.',
  ] as const;
}
