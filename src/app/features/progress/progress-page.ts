import { Component, computed, inject, signal } from '@angular/core';
import { TuiAxes, TuiLineChart } from '@taiga-ui/addon-charts';
import type { TuiPoint } from '@taiga-ui/core';
import { StoreService } from '../../core/store.service';
import { EXERCISES, PROGRAMS, WARMUP } from '../../core/exercises.data';
import { PROFILE } from '../../core/nutrition';
import { Exercise, ProgramType } from '../../core/models';

interface ChartData {
  points: TuiPoint[];
  labelsX: string[];
  labelsY: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

function toChart(values: { v: number; label: string }[]): ChartData | null {
  if (values.length < 2) return null;
  const ys = values.map((p) => p.v);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.15;
  min -= pad;
  max += pad;
  return {
    points: values.map((p, i) => [i, p.v] as TuiPoint),
    labelsX: [values[0].label, values[values.length - 1].label],
    labelsY: [String(Math.round(min * 10) / 10), String(Math.round(max * 10) / 10)],
    x: 0,
    y: min,
    width: values.length - 1,
    height: max - min,
  };
}

@Component({
  selector: 'app-progress-page',
  imports: [TuiAxes, TuiLineChart],
  templateUrl: './progress-page.html',
  styleUrl: './progress-page.scss',
})
export class ProgressPage {
  protected readonly store = inject(StoreService);
  protected readonly PROFILE = PROFILE;
  protected readonly PROGRAMS = PROGRAMS;
  protected readonly WARMUP = WARMUP;
  protected readonly restOptions = [60, 90, 120] as const;
  protected readonly programTypes: readonly ProgramType[] = ['A', 'B'];

  protected readonly weightInput = signal('');
  protected readonly selectedEx = signal<string | null>(null);
  protected readonly programOpen = signal(false);

  protected readonly lost = computed(() =>
    Math.round((PROFILE.startWeight - this.store.currentWeight()) * 10) / 10,
  );

  protected readonly toGoal = computed(() =>
    Math.max(0, Math.round((this.store.currentWeight() - PROFILE.goalWeight) * 10) / 10),
  );

  /** Упражнения, встречавшиеся в истории — для селектора графика */
  protected readonly exOptions = computed(() => {
    const ids = new Set<string>();
    this.store.workouts().forEach((w) => w.items.forEach((it) => ids.add(it.ex)));
    return [...ids];
  });

  protected readonly currentEx = computed(() => this.selectedEx() ?? this.exOptions()[0] ?? null);

  protected readonly weightChart = computed(() =>
    toChart(
      this.store.weights().map((x) => ({
        v: x.kg,
        label: new Date(x.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      })),
    ),
  );

  protected readonly exChart = computed(() => {
    const exId = this.currentEx();
    if (!exId) return null;
    const values = this.store
      .workouts()
      .map((w) => {
        const item = w.items.find((it) => it.ex === exId);
        if (!item) return null;
        const best = Math.max(...item.sets.map((s) => s.w ?? 0));
        return {
          v: best,
          label: new Date(w.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        };
      })
      .filter((x): x is { v: number; label: string } => x !== null);
    return toChart(values);
  });

  protected exercise(id: string): Exercise {
    return EXERCISES[id];
  }

  protected addWeight(): void {
    const kg = parseFloat(this.weightInput().replace(',', '.'));
    if (!kg || kg < 40 || kg > 250) return;
    this.store.addWeight(kg);
    this.weightInput.set('');
  }

  protected onWeightInput(event: Event): void {
    this.weightInput.set((event.target as HTMLInputElement).value);
  }

  protected onExChange(event: Event): void {
    this.selectedEx.set((event.target as HTMLSelectElement).value);
  }

  protected lastWeightLine(): string | null {
    const last = this.store.weights().at(-1);
    if (!last) return null;
    const date = new Date(last.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return `${date} — ${last.kg} кг`;
  }

  // ---------- Бэкап ----------

  protected exportData(): void {
    const blob = new Blob([this.store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  protected async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!confirm('Импорт заменит все текущие данные приложения. Продолжить?')) return;
    const ok = this.store.importJSON(await file.text());
    alert(ok ? 'Данные восстановлены из бэкапа.' : 'Файл не похож на бэкап FitLog.');
  }
}
