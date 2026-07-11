import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { StoreService, WeightSuggestion } from '../../core/store.service';
import { TimerService } from '../../core/timer.service';
import { WakeLockService } from '../../core/wake-lock.service';
import { EXERCISES, PROGRAMS, WARMUP, monogram, ytLink } from '../../core/exercises.data';
import { Exercise, ProgramItem, ProgramType, SetEntry, WorkoutItem } from '../../core/models';
import { Sheet } from '../../shared/sheet/sheet';

type SheetState =
  | { kind: 'info' }
  | { kind: 'swap' }
  | { kind: 'list' }
  | null;

@Component({
  selector: 'app-workout-page',
  imports: [Sheet],
  templateUrl: './workout-page.html',
  styleUrl: './workout-page.scss',
})
export class WorkoutPage implements OnDestroy {
  protected readonly store = inject(StoreService);
  protected readonly timer = inject(TimerService);
  private readonly wakeLock = inject(WakeLockService);

  protected readonly EXERCISES = EXERCISES;
  protected readonly PROGRAMS = PROGRAMS;
  protected readonly WARMUP = WARMUP;
  protected readonly monogram = monogram;
  protected readonly ytLink = ytLink;

  protected readonly sheet = signal<SheetState>(null);

  /** Индекс текущего упражнения в пошаговом режиме */
  protected readonly curEx = signal(0);
  /** Явно выбранный подход (null — первый невыполненный) */
  private readonly pickedSet = signal<number | null>(null);

  /** «Сейчас» для секундомера тренировки */
  private readonly now = signal(Date.now());
  private readonly clock = setInterval(() => this.now.set(Date.now()), 1000);

  constructor() {
    // При возврате на страницу с восстановленной тренировкой —
    // встать на первое незавершённое упражнение.
    const a = this.store.active();
    if (a) {
      const idx = a.items.findIndex((it) => it.sets.some((s) => !s.done));
      this.curEx.set(Math.max(0, idx));
    }
    // Смена упражнения сбрасывает выбранный вручную подход
    effect(() => {
      this.curEx();
      this.pickedSet.set(null);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.clock);
  }

  // ---------- Прогресс и статистика ----------

  protected readonly suggested = this.store.suggestedType;
  protected readonly other = computed<ProgramType>(() => (this.suggested() === 'A' ? 'B' : 'A'));

  protected readonly doneSets = computed(() => {
    const a = this.store.active();
    return a ? a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0) : 0;
  });

  protected readonly totalSets = computed(() => {
    const a = this.store.active();
    return a ? a.items.reduce((n, it) => n + it.sets.length, 0) : 0;
  });

  protected readonly allDone = computed(() => this.totalSets() > 0 && this.doneSets() === this.totalSets());

  protected readonly elapsed = computed(() => {
    const a = this.store.active();
    if (!a?.startedAt) return '';
    const sec = Math.max(0, Math.floor((this.now() - a.startedAt) / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  });

  protected readonly tonnage = computed(() => {
    const a = this.store.active();
    return a ? Math.round(this.store.tonnage(a)) : 0;
  });

  // ---------- Текущее упражнение / подход ----------

  protected readonly item = computed<WorkoutItem | null>(() => {
    const a = this.store.active();
    return a ? (a.items[this.curEx()] ?? null) : null;
  });

  protected readonly ex = computed<Exercise | null>(() => {
    const it = this.item();
    return it ? EXERCISES[it.ex] : null;
  });

  protected readonly curSet = computed(() => {
    const it = this.item();
    if (!it) return 0;
    const picked = this.pickedSet();
    if (picked !== null && picked < it.sets.length) return picked;
    const firstUndone = it.sets.findIndex((s) => !s.done);
    return firstUndone === -1 ? it.sets.length - 1 : firstUndone;
  });

  protected readonly set = computed<SetEntry | null>(() => this.item()?.sets[this.curSet()] ?? null);

  protected readonly exDone = computed(() => {
    const it = this.item();
    return !!it && it.sets.every((s) => s.done);
  });

  /** Значения для степперов — с дефолтами, чтобы всегда было число */
  protected readonly displayW = computed(() => this.set()?.w ?? 0);
  protected readonly displayR = computed(() => this.set()?.r ?? 0);

  protected suggestionFor(it: WorkoutItem): WeightSuggestion | null {
    return this.store.suggestedWeight(it.ex, it.plan);
  }

  protected prevHint(exId: string): string | null {
    const sets = this.store.lastSets(exId);
    return sets ? sets.map((s) => `${s.w ?? 0}×${s.r ?? 0}`).join(' · ') : null;
  }

  protected exercise(id: string): Exercise {
    return EXERCISES[id];
  }

  protected itemDoneCount(it: WorkoutItem): number {
    return it.sets.filter((s) => s.done).length;
  }

  // ---------- Действия ----------

  protected start(type: ProgramType): void {
    this.timer.unlockAudio();
    this.store.startWorkout(type);
    this.curEx.set(0);
    void this.wakeLock.acquire();
  }

  protected bumpW(delta: number): void {
    const set = this.set();
    if (!set) return;
    const next = Math.max(0, Math.round(((set.w ?? 0) + delta) * 2) / 2);
    this.store.updateSet(this.curEx(), this.curSet(), { w: next });
  }

  protected bumpR(delta: number): void {
    const set = this.set();
    if (!set) return;
    const next = Math.max(0, (set.r ?? 0) + delta);
    this.store.updateSet(this.curEx(), this.curSet(), { r: next });
  }

  /** Главная кнопка: отметить текущий подход и запустить отдых */
  protected completeSet(): void {
    this.timer.unlockAudio();
    const done = this.store.toggleSet(this.curEx(), this.curSet());
    this.pickedSet.set(null);
    if (!done) return;
    if (this.exDone()) {
      this.advance();
    }
    if (!this.allDone()) {
      this.timer.start(this.store.restSeconds());
    }
  }

  /** Тап по чипу подхода: выполненный — снять отметку, будущий — выбрать */
  protected tapSet(index: number): void {
    const it = this.item();
    if (!it) return;
    if (it.sets[index].done) {
      this.store.toggleSet(this.curEx(), index);
    }
    this.pickedSet.set(index);
  }

  /** К следующему упражнению с невыполненными подходами */
  protected advance(): void {
    const a = this.store.active();
    if (!a) return;
    for (let step = 1; step <= a.items.length; step++) {
      const idx = (this.curEx() + step) % a.items.length;
      if (a.items[idx].sets.some((s) => !s.done)) {
        this.curEx.set(idx);
        return;
      }
    }
  }

  protected goTo(index: number): void {
    this.curEx.set(index);
    this.sheet.set(null);
  }

  protected prev(): void {
    const a = this.store.active();
    if (a) this.curEx.update((i) => (i - 1 + a.items.length) % a.items.length);
  }

  protected next(): void {
    const a = this.store.active();
    if (a) this.curEx.update((i) => (i + 1) % a.items.length);
  }

  protected addSet(): void {
    this.store.addSet(this.curEx());
    this.pickedSet.set(null);
  }

  protected swap(newExId: string): void {
    this.store.swapExercise(this.curEx(), newExId);
    this.pickedSet.set(null);
    this.sheet.set(null);
  }

  protected finish(): void {
    if (this.doneSets() === 0 && !confirm('Ни один подход не отмечен. Всё равно завершить?')) {
      return;
    }
    this.timer.stop();
    this.wakeLock.release();
    this.store.finishWorkout();
    this.curEx.set(0);
  }

  protected cancel(): void {
    if (confirm('Точно отменить тренировку? Данные не сохранятся.')) {
      this.timer.stop();
      this.wakeLock.release();
      this.store.cancelWorkout();
      this.curEx.set(0);
    }
  }
}
