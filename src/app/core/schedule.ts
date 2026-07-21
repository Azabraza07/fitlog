import { ProgramType } from './models';

/** Тренировочные дни недели: вторник (2), четверг (4), суббота (6) */
const TRAINING_DAYS = [2, 4, 6] as const;

/**
 * Якорь отсчёта — понедельник 20.07.2026, начало «недели 1» (A-Б-A).
 * Тип тренировки считается от календаря, а не от истории: пропуск занятия
 * не сбивает шаблон, расписание всегда строго A-Б-A / Б-A-Б.
 */
const ANCHOR = new Date(2026, 6, 20);

const DAY_MS = 86_400_000;

/** Полночь по локальному времени — чтобы арифметика дней не зависела от часа */
function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isTrainingDay(d: Date): boolean {
  return (TRAINING_DAYS as readonly number[]).includes(d.getDay());
}

/**
 * Порядковый номер тренировочного дня относительно якоря.
 * Считается как «полные недели × 3 + тренировочные дни внутри недели».
 * Для нетренировочного дня возвращает номер СЛЕДУЮЩЕЙ тренировки.
 */
function sessionIndex(d: Date): number {
  const days = Math.round((midnight(d).getTime() - ANCHOR.getTime()) / DAY_MS);
  const weeks = Math.floor(days / 7);
  const dow = ((days % 7) + 7) % 7; // 0 = понедельник (якорь — понедельник)
  // Сколько тренировочных дней уже прошло/наступило внутри недели.
  // dow: 0 пн, 1 вт, 2 ср, 3 чт, 4 пт, 5 сб, 6 вс
  const withinWeek = dow <= 1 ? 0 : dow <= 3 ? 1 : dow <= 5 ? 2 : 3;
  return weeks * 3 + withinWeek;
}

/** Тип тренировки по расписанию: чётный номер → A, нечётный → B */
export function scheduledType(d: Date): ProgramType {
  const i = sessionIndex(d);
  return ((i % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

/** Ближайший тренировочный день (включая сегодня) и его тип */
export function nextSession(d: Date): { date: Date; type: ProgramType } {
  const cursor = midnight(d);
  for (let step = 0; step < 8; step++) {
    const probe = new Date(cursor.getTime() + step * DAY_MS);
    if (isTrainingDay(probe)) {
      return { date: probe, type: scheduledType(probe) };
    }
  }
  // недостижимо: тренировочный день найдётся в пределах недели
  return { date: cursor, type: scheduledType(cursor) };
}

/** «четверг, 23 июля» */
export function humanDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}
