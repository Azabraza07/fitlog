import { Injectable, computed, effect, signal } from '@angular/core';
import { Meal, ProgramItem, ProgramType, SetEntry, WeightEntry, Workout, WorkoutItem } from './models';
import { EXERCISES, PROGRAMS } from './exercises.data';
import { PROFILE } from './nutrition';

interface PersistedState {
  workouts: Workout[];
  weights: WeightEntry[];
  rest: number;
  active: Workout | null;
  meals: Record<string, Meal[]>;
}

export interface WeightSuggestion {
  w: number;
  /** true — вес повышен по правилу двойной прогрессии */
  increased: boolean;
}

/** Верхняя граница вилки повторений: '10–12' → 12 */
function topReps(reps: string): number | null {
  const nums = reps.match(/\d+/g);
  return nums?.length ? Number(nums[nums.length - 1]) : null;
}

/** Нижняя граница вилки повторений: '10–12' → 10 */
function bottomReps(reps: string): number | null {
  const nums = reps.match(/\d+/g);
  return nums?.length ? Number(nums[0]) : null;
}

/** Шаг прогрессии: ноги в тренажёрах растут быстрее */
function increment(exId: string): number {
  return ['leg-press', 'hack-squat'].includes(exId) ? 5 : 2.5;
}

const STORAGE_KEY = 'fitlog-ng-v1';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly workouts = signal<Workout[]>([]);
  readonly weights = signal<WeightEntry[]>([]);
  readonly restSeconds = signal(90);
  readonly active = signal<Workout | null>(null);
  readonly meals = signal<Record<string, Meal[]>>({});

  readonly currentWeight = computed(() => {
    const list = this.weights();
    return list.length ? list[list.length - 1].kg : PROFILE.startWeight;
  });

  readonly suggestedType = computed<ProgramType>(() => {
    const last = this.workouts().at(-1);
    return last?.type === 'A' ? 'B' : 'A';
  });

  readonly weekStreak = computed(() => {
    const weekOf = (iso: string): string => {
      const d = new Date(iso);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    };
    const weeks = new Set(this.workouts().map((w) => weekOf(w.date)));
    let streak = 0;
    let cursor = weekOf(todayISO());
    while (weeks.has(cursor)) {
      streak++;
      const d = new Date(cursor);
      d.setDate(d.getDate() - 7);
      cursor = d.toISOString().slice(0, 10);
    }
    return streak;
  });

  constructor() {
    this.restore();
    effect(() => {
      const state: PersistedState = {
        workouts: this.workouts(),
        weights: this.weights(),
        rest: this.restSeconds(),
        active: this.active(),
        meals: this.meals(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    });
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as Partial<PersistedState>;
      this.workouts.set(state.workouts ?? []);
      this.weights.set(state.weights ?? []);
      this.restSeconds.set(state.rest ?? 90);
      this.active.set(state.active ?? null);
      this.meals.set(state.meals ?? {});
    } catch {
      // повреждённое хранилище — начинаем с чистого состояния
    }
  }

  // ---------- Активная тренировка ----------

  startWorkout(type: ProgramType): void {
    const items: WorkoutItem[] = PROGRAMS[type].items.map((plan) => {
      const suggestion = this.suggestedWeight(plan.ex, plan);
      const last = this.lastSets(plan.ex);
      const bottom = bottomReps(plan.reps);
      return {
        ex: plan.ex,
        plan,
        // Предзаполняем вес и повторы, чтобы обычный подход закрывался
        // одним касанием: вес — по прогрессии, повторы — низ вилки
        // (при повышении веса) или как в прошлый раз.
        sets: Array.from({ length: plan.sets }, (_, i): SetEntry => {
          const prevReps = suggestion?.increased ? null : (last?.[i]?.r ?? null);
          return { w: suggestion?.w ?? null, r: prevReps ?? bottom, done: false };
        }),
      };
    });
    this.active.set({ id: Date.now(), date: todayISO(), type, items, startedAt: Date.now() });
  }

  /**
   * Двойная прогрессия: все подходы прошлой тренировки выполнены
   * в верху вилки повторений → +2,5/5 кг; иначе — повторить вес.
   */
  suggestedWeight(exId: string, plan: ProgramItem): WeightSuggestion | null {
    if (EXERCISES[exId]?.isTime) return null;
    const last = this.lastSets(exId);
    if (!last?.length) return null;
    const maxW = Math.max(...last.map((s) => s.w ?? 0));
    if (!maxW) return null;
    const top = topReps(plan.reps);
    const hitTop =
      top !== null &&
      last.length >= plan.sets &&
      last.every((s) => (s.r ?? 0) >= top && (s.w ?? 0) >= maxW);
    return hitTop ? { w: maxW + increment(exId), increased: true } : { w: maxW, increased: false };
  }

  /** Лучший вес в истории — для детектора рекордов */
  bestWeight(exId: string): number {
    let best = 0;
    for (const w of this.workouts()) {
      const item = w.items.find((it) => it.ex === exId);
      if (item) {
        best = Math.max(best, ...item.sets.map((s) => s.w ?? 0));
      }
    }
    return best;
  }

  private patchActive(mutate: (draft: Workout) => void): void {
    const current = this.active();
    if (!current) return;
    const draft: Workout = structuredClone(current);
    mutate(draft);
    this.active.set(draft);
  }

  updateSet(exIndex: number, setIndex: number, patch: Partial<SetEntry>): void {
    this.patchActive((d) => Object.assign(d.items[exIndex].sets[setIndex], patch));
  }

  /** @returns true, если подход стал выполненным (нужно запустить таймер) */
  toggleSet(exIndex: number, setIndex: number): boolean {
    let becameDone = false;
    const best = this.bestWeight(this.active()?.items[exIndex]?.ex ?? '');
    this.patchActive((d) => {
      const set = d.items[exIndex].sets[setIndex];
      set.done = !set.done;
      becameDone = set.done;
      set.pr = set.done && best > 0 && (set.w ?? 0) > best;
    });
    return becameDone;
  }

  togglePain(exIndex: number): void {
    this.patchActive((d) => {
      d.items[exIndex].pain = !d.items[exIndex].pain;
    });
  }

  /** Тоннаж: суммарный поднятый вес выполненных подходов */
  tonnage(w: Workout): number {
    return w.items.reduce(
      (sum, it) =>
        EXERCISES[it.ex]?.isTime
          ? sum
          : sum +
            it.sets.reduce((s, set) => s + (set.done ? (set.w ?? 0) * (set.r ?? 0) : 0), 0),
      0,
    );
  }

  addSet(exIndex: number): void {
    this.patchActive((d) => {
      const sets = d.items[exIndex].sets;
      const prev = sets.at(-1);
      sets.push({ w: prev?.w ?? null, r: prev?.r ?? null, done: false });
    });
  }

  swapExercise(exIndex: number, newExId: string): void {
    this.patchActive((d) => {
      d.items[exIndex].ex = newExId;
      d.items[exIndex].sets.forEach((s) => (s.done = false));
    });
  }

  finishWorkout(): void {
    const a = this.active();
    if (!a) return;
    const items = a.items
      .map((it) => ({ ...it, sets: it.sets.filter((s) => s.done && (s.w !== null || s.r !== null)) }))
      .filter((it) => it.sets.length);
    if (items.length) {
      const durationSec = a.startedAt ? Math.round((Date.now() - a.startedAt) / 1000) : undefined;
      this.workouts.update((list) => [...list, { ...a, items, durationSec }]);
    }
    this.active.set(null);
  }

  cancelWorkout(): void {
    this.active.set(null);
  }

  // ---------- История ----------

  deleteWorkout(id: number): void {
    this.workouts.update((list) => list.filter((w) => w.id !== id));
  }

  /** Подходы прошлой тренировки с этим упражнением — подсказка «в прошлый раз» */
  lastSets(exId: string): SetEntry[] | null {
    const list = this.workouts();
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i].items.find((it) => it.ex === exId);
      if (item?.sets.length) return item.sets;
    }
    return null;
  }

  // ---------- Вес и настройки ----------

  addWeight(kg: number): void {
    const today = todayISO();
    this.weights.update((list) => [...list.filter((x) => x.date !== today), { date: today, kg }]);
  }

  setRest(seconds: number): void {
    this.restSeconds.set(seconds);
  }

  // ---------- Дневник питания ----------

  mealsFor(date: string): Meal[] {
    return this.meals()[date] ?? [];
  }

  addMeal(date: string, meal: Omit<Meal, 'id'>): void {
    this.meals.update((all) => ({
      ...all,
      [date]: [...(all[date] ?? []), { ...meal, id: Date.now() }],
    }));
  }

  deleteMeal(date: string, id: number): void {
    this.meals.update((all) => ({
      ...all,
      [date]: (all[date] ?? []).filter((m) => m.id !== id),
    }));
  }

  // ---------- Экспорт / импорт ----------

  exportJSON(): string {
    return localStorage.getItem(STORAGE_KEY) ?? '{}';
  }

  /** @returns false, если файл не похож на бэкап FitLog */
  importJSON(raw: string): boolean {
    try {
      const state = JSON.parse(raw) as Partial<PersistedState>;
      if (!Array.isArray(state.workouts) || !Array.isArray(state.weights)) return false;
      this.workouts.set(state.workouts);
      this.weights.set(state.weights);
      this.restSeconds.set(state.rest ?? 90);
      this.active.set(state.active ?? null);
      this.meals.set(state.meals ?? {});
      return true;
    } catch {
      return false;
    }
  }
}

export { EXERCISES, PROGRAMS };
