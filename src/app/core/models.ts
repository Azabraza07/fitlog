export type ProgramType = 'A' | 'B';

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly yt: string;
  readonly tips: readonly string[];
  readonly alts: readonly string[];
  /** Упражнение на время (планка) — вместо кг×повторы вводятся секунды */
  readonly isTime?: boolean;
}

export type BlockKind = 'solo' | 'superset' | 'cardio';

export interface ProgramItem {
  readonly ex: string;
  readonly sets: number;
  readonly reps: string;
  /**
   * Индекс блока. Соседние items с одинаковым `block` образуют один суперсет.
   * Отсутствует у записей до суперсетов — тогда каждый item сам себе блок.
   */
  readonly block?: number;
  /** Тип блока. Отсутствует → 'solo'. */
  readonly kind?: BlockKind;
  /** Отдых ПОСЛЕ круга блока, сек. Отсутствует → глобальный restSeconds. 0 → без таймера. */
  readonly restSec?: number;
}

/**
 * Производная структура: не персистится, считается из плоского items[]
 * функцией toBlocks(). Плоский формат Workout.items менять нельзя —
 * это формат истории в localStorage.
 */
export interface Block {
  kind: BlockKind;
  /** Индексы в плоском Workout.items */
  idx: number[];
  restSec: number;
  /** Кругов в блоке = max(sets.length) среди упражнений блока */
  rounds: number;
}

export interface ProgramDef {
  readonly name: string;
  readonly items: readonly ProgramItem[];
}

export interface SetEntry {
  w: number | null;
  r: number | null;
  done: boolean;
  /** Личный рекорд по весу — зафиксирован в момент отметки подхода */
  pr?: boolean;
}

export interface WorkoutItem {
  ex: string;
  plan: ProgramItem;
  sets: SetEntry[];
  /** Была боль (кисть/плечо/поясница) на этом упражнении */
  pain?: boolean;
}

export interface Workout {
  id: number;
  date: string; // ISO yyyy-mm-dd
  type: ProgramType;
  items: WorkoutItem[];
  startedAt?: number;
  durationSec?: number;
}

export interface Meal {
  id: number;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

/** Замеры тела, снимаются раз в 2 недели */
export interface Measurement {
  date: string;
  waist?: number;
  hips?: number;
  chest?: number;
  shoulders?: number;
}
