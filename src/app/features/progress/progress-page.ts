import { Component, computed, inject, signal } from '@angular/core';
import { TuiAxes, TuiLineChart } from '@taiga-ui/addon-charts';
import type { TuiPoint } from '@taiga-ui/core';
import { StoreService, localDate } from '../../core/store.service';
import { EXERCISES, PROGRAMS, STEPS_GOAL, WARMUP } from '../../core/exercises.data';
import { KCAL_STEP, PROFILE, WEIGHT_PACE } from '../../core/nutrition';
import { toBlocks } from '../../core/blocks';
import { Block, Exercise, ProgramType } from '../../core/models';

interface MeasureRow {
  label: string;
  value: number;
  deltaText: string | null;
  shrank: boolean;
}

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

  /** График по НЕДЕЛЬНЫМ средним: дневные колебания ±1,5 кг маскируют тренд */
  protected readonly weightChart = computed(() =>
    toChart(
      this.store.weeklyWeights().map((x) => ({
        v: x.kg,
        label: localDate(x.week).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      })),
    ),
  );

  /** Есть ли запись веса за сегодня — иначе показываем напоминание */
  protected readonly weighedToday = computed(() =>
    this.store.weights().some((w) => w.date === this.store.today()),
  );

  /**
   * Подсказка по коррекции калорий. Срабатывает только когда темп вышел
   * за коридор −0,8…−0,5 кг/нед ДВЕ недели подряд — одна неделя может быть
   * задержкой воды, а не реальным изменением.
   */
  protected readonly paceHint = computed<{ text: string; kind: 'fast' | 'slow' | 'ok' } | null>(
    () => {
      const deltas = this.store.weeklyDeltas();
      if (deltas.length < 2) return null;
      const [prev, last] = deltas.slice(-2);
      const tooFast = prev < WEIGHT_PACE.fastest && last < WEIGHT_PACE.fastest;
      const tooSlow = prev > WEIGHT_PACE.slowest && last > WEIGHT_PACE.slowest;
      if (tooFast) {
        return {
          kind: 'fast',
          text: `Темп быстрее ${-WEIGHT_PACE.fastest} кг/нед две недели подряд — добавь ${KCAL_STEP.min}–${KCAL_STEP.max} ккал, иначе уйдут мышцы.`,
        };
      }
      if (tooSlow) {
        return {
          kind: 'slow',
          text: `Темп медленнее ${-WEIGHT_PACE.slowest} кг/нед две недели подряд — убери ${KCAL_STEP.min}–${KCAL_STEP.max} ккал.`,
        };
      }
      return { kind: 'ok', text: 'Темп в цели: −0,5…−0,8 кг в неделю. Ничего не меняем.' };
    },
  );

  protected readonly lastDelta = computed(() => this.store.weeklyDeltas().at(-1) ?? null);

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

  // ---------- Замеры тела ----------

  protected readonly measureFields = [
    { key: 'waist', label: 'талия' },
    { key: 'hips', label: 'бёдра' },
    { key: 'chest', label: 'грудь' },
    { key: 'shoulders', label: 'плечи' },
  ] as const;

  /** Незаполненные поля отсутствуют в объекте — отсюда `string | undefined` */
  protected readonly measureDraft = signal<Record<string, string | undefined>>({});
  protected readonly measureOpen = signal(false);

  /** Замеры снимаются раз в 2 недели — чаще они тонут в погрешности сантиметра */
  protected readonly measureDue = computed(() => {
    const days = this.store.daysSinceMeasurement();
    return days === null || days >= 14;
  });

  /** Последние замеры с дельтой к предыдущим */
  protected readonly measureRows = computed<MeasureRow[]>(() => {
    const list = this.store.measurements();
    const last = list.at(-1);
    if (!last) return [];
    const prev = list.at(-2);
    const rows: MeasureRow[] = [];
    for (const f of this.measureFields) {
      const value = last[f.key];
      if (value === undefined) continue;
      const before = prev?.[f.key];
      const delta = before === undefined ? null : Math.round((value - before) * 10) / 10;
      rows.push({
        label: f.label,
        value,
        // Знак важнее числа: «−1.5» читается как прогресс, «1.5» — нет
        deltaText: delta === null ? null : `${delta > 0 ? '+' : ''}${delta}`,
        shrank: delta !== null && delta < 0,
      });
    }
    return rows;
  });

  protected readonly lastMeasureDate = computed(() => {
    const last = this.store.measurements().at(-1);
    return last
      ? localDate(last.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : null;
  });

  protected patchMeasure(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.measureDraft.update((d) => ({ ...d, [key]: value }));
  }

  protected saveMeasurement(): void {
    const d = this.measureDraft();
    const num = (s: string | undefined): number | undefined => {
      const n = parseFloat((s ?? '').replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const m = {
      waist: num(d['waist']),
      hips: num(d['hips']),
      chest: num(d['chest']),
      shoulders: num(d['shoulders']),
    };
    if (!m.waist && !m.hips && !m.chest && !m.shoulders) return;
    this.store.addMeasurement(m);
    this.measureDraft.set({});
    this.measureOpen.set(false);
  }

  // ---------- Шаги ----------

  protected readonly STEPS_GOAL = STEPS_GOAL;
  protected readonly stepsInput = signal('');

  protected readonly todaySteps = computed(() => this.store.stepsFor(this.store.today()));

  protected readonly stepsRatio = computed(() =>
    Math.min(1, this.todaySteps() / STEPS_GOAL.min),
  );

  protected onStepsInput(event: Event): void {
    this.stepsInput.set((event.target as HTMLInputElement).value);
  }

  protected saveSteps(): void {
    const n = parseInt(this.stepsInput().replace(/\s/g, ''), 10);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) return;
    this.store.setSteps(this.store.today(), n);
    this.stepsInput.set('');
  }

  // ---------- Программа ----------

  /** Программа, сгруппированная в блоки — чтобы показать суперсеты парами */
  protected planBlocks(type: ProgramType): Block[] {
    const items = PROGRAMS[type].items;
    return toBlocks(items, items.map((p) => p.sets), this.store.restSeconds());
  }

  protected planItem(type: ProgramType, i: number) {
    return PROGRAMS[type].items[i];
  }

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
