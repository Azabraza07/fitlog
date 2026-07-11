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

export interface ProgramItem {
  readonly ex: string;
  readonly sets: number;
  readonly reps: string;
  /** Последний подход — дроп-сет: −30% веса и до упора */
  readonly dropSet?: boolean;
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

export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  tdee: number;
}
