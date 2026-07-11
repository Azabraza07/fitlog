import { Macros } from './models';

export const PROFILE = {
  height: 176,
  age: 23,
  activity: 1.45,
  deficit: 550,
  startWeight: 102,
  goalWeight: 80,
} as const;

/** Миффлин-Сан Жеор (мужчина) + активность − дефицит */
export function calcNutrition(weight: number): Macros {
  const bmr = 10 * weight + 6.25 * PROFILE.height - 5 * PROFILE.age + 5;
  const tdee = bmr * PROFILE.activity;
  const kcal = Math.round((tdee - PROFILE.deficit) / 50) * 50;
  const protein = Math.round((weight * 1.7) / 5) * 5;
  const fat = Math.round((weight * 0.72) / 2) * 2;
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { kcal, protein, fat, carbs, tdee: Math.round(tdee) };
}

export const NUTRITION_TIERS: readonly { from: number; to: number }[] = [
  { from: 102, to: 95 },
  { from: 95, to: 90 },
  { from: 90, to: 85 },
  { from: 85, to: 80 },
];
