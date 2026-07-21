import { Component, computed, inject, signal } from '@angular/core';
import { TuiCalendar } from '@taiga-ui/core';
import { TuiDay } from '@taiga-ui/cdk';
import type { TuiMarkerHandler } from '@taiga-ui/core';
import { StoreService } from '../../core/store.service';
import { EXERCISES, PROGRAMS, monogram } from '../../core/exercises.data';
import { Exercise, Workout } from '../../core/models';

const ACID = '#cdf463';

@Component({
  selector: 'app-history-page',
  imports: [TuiCalendar],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss',
})
export class HistoryPage {
  protected readonly store = inject(StoreService);
  protected readonly PROGRAMS = PROGRAMS;
  protected readonly monogram = monogram;

  /** id развёрнутой тренировки в списке */
  protected readonly expandedId = signal<number | null>(null);

  protected readonly ordered = computed<Workout[]>(() => [...this.store.workouts()].reverse());

  protected plural(n: number, forms: [string, string, string]): string {
    const mod100 = n % 100;
    const mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return forms[2];
    if (mod10 === 1) return forms[0];
    if (mod10 >= 2 && mod10 <= 4) return forms[1];
    return forms[2];
  }

  protected readonly monthCount = computed(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return this.store.workouts().filter((w) => w.date.startsWith(prefix)).length;
  });

  private readonly trainedDays = computed(() => new Set(this.store.workouts().map((w) => w.date)));

  protected readonly markerHandler: TuiMarkerHandler = (day: TuiDay) =>
    this.trainedDays().has(day.toString('YMD', '-')) ? [ACID] : [];

  protected exercise(id: string): Exercise {
    return EXERCISES[id];
  }

  protected toggle(id: number): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
  }

  protected remove(id: number): void {
    if (confirm('Удалить эту тренировку из истории?')) {
      this.store.deleteWorkout(id);
    }
  }

  protected fmt(iso: string): string {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /**
   * У упражнений на время в `r` лежат секунды, а не повторы, — печатать их
   * как «0×900» бессмысленно. Кардио показываем в минутах, планку в секундах.
   */
  protected setsLine(exId: string, sets: { w: number | null; r: number | null }[]): string {
    if (exId === 'cardio-cooldown') {
      return sets.map((s) => `${Math.round((s.r ?? 0) / 60)} мин`).join('   ');
    }
    if (EXERCISES[exId]?.isTime) {
      return sets.map((s, i) => `${i + 1}) ${s.r ?? 0} с`).join('   ');
    }
    return sets.map((s, i) => `${i + 1}) ${s.w ?? 0}×${s.r ?? 0}`).join('   ');
  }

  protected tonnage(w: Workout): number {
    return Math.round(this.store.tonnage(w));
  }

  protected duration(w: Workout): string | null {
    if (!w.durationSec) return null;
    return `${Math.round(w.durationSec / 60)} мин`;
  }

  protected hasPain(w: Workout): boolean {
    return w.items.some((it) => it.pain);
  }
}
