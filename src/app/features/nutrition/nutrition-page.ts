import { Component, computed, inject, signal } from '@angular/core';
import { StoreService } from '../../core/store.service';
import { NUTRITION_GOALS, PROFILE } from '../../core/nutrition';

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
  protected readonly GOALS = NUTRITION_GOALS;

  protected readonly today = this.store.today;

  // ---------- Дневник за сегодня ----------

  protected readonly draft = signal<MealDraft>({ ...EMPTY_DRAFT });
  protected readonly formOpen = signal(false);

  protected readonly todayMeals = computed(() => this.store.meals()[this.today()] ?? []);

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

  // ---------- Белок: главный приоритет ----------

  protected readonly protein = computed(() => {
    const eaten = this.eaten().protein;
    const { proteinMin, proteinMax } = NUTRITION_GOALS;
    return {
      eaten,
      ratio: Math.min(1, eaten / proteinMin),
      /** Норма закрыта — цель по белку это МИНИМУМ, перебор не страшен */
      hit: eaten >= proteinMin,
      left: Math.max(0, Math.round(proteinMin - eaten)),
      inRange: eaten >= proteinMin && eaten <= proteinMax,
    };
  });

  // ---------- Калории: коридор 2200–2400 ----------

  protected readonly kcal = computed(() => {
    const eaten = this.eaten().kcal;
    const { kcalMin, kcalMax } = NUTRITION_GOALS;
    return {
      eaten,
      ratio: Math.min(1, eaten / kcalMax),
      over: eaten > kcalMax,
      under: eaten < kcalMin,
      status: eaten > kcalMax ? 'перебор' : eaten < kcalMin ? 'ниже коридора' : 'в цели',
    };
  });

  /** Жиры и углеводы — справочно, жёстких целей по ним нет */
  protected readonly secondary = computed(() => {
    const e = this.eaten();
    return [
      { label: 'жиры, г', value: Math.round(e.fat) },
      { label: 'углеводы, г', value: Math.round(e.carbs) },
    ];
  });

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
    this.store.addMeal(this.today(), meal);
    this.draft.set({ ...EMPTY_DRAFT });
    this.formOpen.set(false);
  }

  protected deleteMeal(id: number): void {
    this.store.deleteMeal(this.today(), id);
  }

  protected readonly rules = [
    'Белок — приоритет №1: на дефиците он удерживает мышцы. 160 г — это минимум, а не «примерно».',
    'Набирай белок по 30–40 г за приём: курица, рыба, яйца, творог, протеин.',
    'Взвешивайся утром натощак; смотри на среднее за неделю, а не на отдельный день.',
    'Темп быстрее 0,8 кг в неделю — добавь 150–200 ккал: на такой скорости уходят мышцы.',
    '8–10 тысяч шагов в день ускоряют жиросжигание без ущерба восстановлению.',
    'Вода — 2,5–3 литра в день. Сон 7–9 часов: недосып = голод и слабые тренировки.',
  ] as const;
}
