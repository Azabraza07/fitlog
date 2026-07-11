import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'workout' },
  {
    path: 'workout',
    loadComponent: () => import('./features/workout/workout-page').then((m) => m.WorkoutPage),
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history-page').then((m) => m.HistoryPage),
  },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress-page').then((m) => m.ProgressPage),
  },
  {
    path: 'nutrition',
    loadComponent: () => import('./features/nutrition/nutrition-page').then((m) => m.NutritionPage),
  },
  { path: '**', redirectTo: 'workout' },
];
