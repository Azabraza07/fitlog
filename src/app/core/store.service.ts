import { Injectable, computed, effect, signal } from '@angular/core';
import {
  Meal,
  Measurement,
  ProgramItem,
  ProgramType,
  SetEntry,
  WeightEntry,
  Workout,
  WorkoutItem,
} from './models';
import { EXERCISES, PROGRAMS } from './exercises.data';
import { PROFILE } from './nutrition';
import { scheduledType } from './schedule';

interface PersistedState {
  workouts: Workout[];
  weights: WeightEntry[];
  rest: number;
  active: Workout | null;
  meals: Record<string, Meal[]>;
  measurements: Measurement[];
  /** ISO-дата → шаги за день */
  steps: Record<string, number>;
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ISO-строка → Date в ЛОКАЛЬНОЙ полуночи.
 * `new Date('2026-07-21')` парсится как UTC: в отрицательных часовых поясах
 * это даёт предыдущий день и ломает определение дня недели.
 */
export function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO-дата понедельника той недели, в которую попадает дата */
export function weekOf(iso: string): string {
  const d = localDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
}

/** Разница в днях между двумя ISO-датами */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((localDate(toISO).getTime() - localDate(fromISO).getTime()) / 86_400_000);
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly workouts = signal<Workout[]>([]);
  readonly weights = signal<WeightEntry[]>([]);
  readonly restSeconds = signal(90);
  readonly active = signal<Workout | null>(null);
  readonly meals = signal<Record<string, Meal[]>>({});
  readonly measurements = signal<Measurement[]>([]);
  readonly steps = signal<Record<string, number>>({});

  readonly currentWeight = computed(() => {
    const list = this.weights();
    return list.length ? list[list.length - 1].kg : PROFILE.startWeight;
  });

  /**
   * Сегодняшняя дата как сигнал: PWA может провисеть открытым сутки,
   * поэтому дату обновляем при возврате на вкладку — иначе расписание
   * и дневник питания застревают на вчерашнем дне.
   */
  readonly today = signal(todayISO());

  /**
   * Тип тренировки по расписанию Вт/Чт/Сб (A-Б-A / Б-A-Б).
   * Считается от календаря, а не от истории: пропуск занятия не сбивает шаблон.
   * В нетренировочный день — тип ближайшей предстоящей тренировки.
   */
  readonly suggestedType = computed<ProgramType>(() => scheduledType(localDate(this.today())));

  readonly weekStreak = computed(() => {
    const weeks = new Set(this.workouts().map((w) => weekOf(w.date)));
    let streak = 0;
    let cursor = weekOf(todayISO());
    while (weeks.has(cursor)) {
      streak++;
      const d = localDate(cursor);
      d.setDate(d.getDate() - 7);
      cursor = weekOf(isoOf(d));
    }
    return streak;
  });

  /**
   * Средний вес по неделям (понедельник — ключ недели).
   * Дневные колебания веса до ±1,5 кг маскируют реальный тренд,
   * поэтому темп считаем по недельным средним, а не по соседним замерам.
   */
  readonly weeklyWeights = computed<{ week: string; kg: number }[]>(() => {
    const buckets = new Map<string, number[]>();
    for (const entry of this.weights()) {
      const key = weekOf(entry.date);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(entry.kg);
      else buckets.set(key, [entry.kg]);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, kgs]) => ({
        week,
        kg: Math.round((kgs.reduce((s, k) => s + k, 0) / kgs.length) * 10) / 10,
      }));
  });

  /** Изменение веса за каждую неделю относительно предыдущей, кг */
  readonly weeklyDeltas = computed<number[]>(() => {
    const weeks = this.weeklyWeights();
    return weeks.slice(1).map((w, i) => Math.round((w.kg - weeks[i].kg) * 10) / 10);
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
        measurements: this.measurements(),
        steps: this.steps(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.today.set(todayISO());
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
      this.measurements.set(state.measurements ?? []);
      this.steps.set(state.steps ?? {});
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
          // Кардио-заминка: r — это секунды, а не повторы. bottomReps('15–20 мин')
          // дал бы 15 в неверных единицах, поэтому берём прошлую длительность
          // или 15 минут по умолчанию.
          if (plan.kind === 'cardio') {
            return { w: null, r: last?.[i]?.r ?? 900, done: false };
          }
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

  /**
   * Замена упражнения. Отметки `done` НЕ сбрасываются: сделанные подходы —
   * это выполненная работа, просто на другом тренажёре. Сброс ломал бы
   * суперсет, откатывая пару на первый круг, пока напарник уже отработан.
   * Блочные метаданные лежат в `plan`, который тут не трогаем, — суперсет
   * переживает замену.
   */
  swapExercise(exIndex: number, newExId: string): void {
    this.patchActive((d) => {
      d.items[exIndex].ex = newExId;
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
    const today = this.today();
    this.weights.update((list) => [...list.filter((x) => x.date !== today), { date: today, kg }]);
  }

  setRest(seconds: number): void {
    this.restSeconds.set(seconds);
  }

  // ---------- Замеры тела ----------

  /** Upsert по дате — как addWeight: повторный замер за день перезаписывает */
  addMeasurement(m: Omit<Measurement, 'date'>): void {
    const today = this.today();
    this.measurements.update((list) =>
      [...list.filter((x) => x.date !== today), { ...m, date: today }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
  }

  /** Дней с последнего замера; null — замеров ещё не было */
  daysSinceMeasurement(): number | null {
    const last = this.measurements().at(-1);
    return last ? daysBetween(last.date, this.today()) : null;
  }

  // ---------- Шаги ----------

  stepsFor(date: string): number {
    return this.steps()[date] ?? 0;
  }

  setSteps(date: string, steps: number): void {
    this.steps.update((all) => ({ ...all, [date]: Math.max(0, Math.round(steps)) }));
  }

  /** Среднее за последние 7 дней, включая сегодня. Дни без записи считаются нулём. */
  readonly stepsAvg7 = computed(() => {
    const all = this.steps();
    const today = localDate(this.today());
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() - i * 86_400_000);
      sum += all[isoOf(d)] ?? 0;
    }
    return Math.round(sum / 7);
  });

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
      this.measurements.set(state.measurements ?? []);
      this.steps.set(state.steps ?? {});
      return true;
    } catch {
      return false;
    }
  }
}

export { EXERCISES, PROGRAMS };
