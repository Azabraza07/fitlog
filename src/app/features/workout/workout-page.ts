import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { StoreService, WeightSuggestion, localDate } from '../../core/store.service';
import { TimerService } from '../../core/timer.service';
import { WakeLockService } from '../../core/wake-lock.service';
import { EXERCISES, PROGRAMS, STEPS_GOAL, WARMUP, monogram, ytLink } from '../../core/exercises.data';
import { toBlocks } from '../../core/blocks';
import { humanDate, isTrainingDay, nextSession } from '../../core/schedule';
import { Block, Exercise, ProgramType, SetEntry, WorkoutItem } from '../../core/models';
import { Sheet } from '../../shared/sheet/sheet';

type SheetState =
  | { kind: 'info'; exId: string }
  | { kind: 'swap'; exId: string }
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
  protected readonly STEPS_GOAL = STEPS_GOAL;
  protected readonly monogram = monogram;
  protected readonly ytLink = ytLink;

  protected readonly sheet = signal<SheetState>(null);

  /** Индекс текущего блока (соло-упражнение, суперсет или кардио) */
  protected readonly curBlock = signal(0);
  /** Явно выбранный круг (null — первый незакрытый) */
  private readonly pickedRound = signal<number | null>(null);

  /** «Сейчас» для секундомера тренировки */
  private readonly now = signal(Date.now());
  private readonly clock = setInterval(() => this.now.set(Date.now()), 1000);

  constructor() {
    // При возврате на страницу с восстановленной тренировкой —
    // встать на первый блок с незакрытыми подходами.
    const a = this.store.active();
    if (a) {
      const bs = toBlocks(
        a.items.map((it) => it.plan),
        a.items.map((it) => it.sets.length),
        this.store.restSeconds(),
      );
      const idx = bs.findIndex((b) => b.idx.some((i) => a.items[i].sets.some((s) => !s.done)));
      this.curBlock.set(Math.max(0, idx));
    }
    // Смена блока сбрасывает выбранный вручную круг
    effect(() => {
      this.curBlock();
      this.pickedRound.set(null);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.clock);
  }

  // ---------- Расписание (стартовый экран) ----------

  protected readonly suggested = this.store.suggestedType;
  protected readonly other = computed<ProgramType>(() => (this.suggested() === 'A' ? 'B' : 'A'));

  protected readonly isTrainingToday = computed(() =>
    isTrainingDay(localDate(this.store.today())),
  );

  /**
   * Ближайшая тренировка — показывается в день отдыха.
   * Сегодня заведомо не тренировочный день, поэтому nextSession от сегодня
   * возвращает именно следующее занятие.
   */
  protected readonly upcoming = computed(() => {
    const next = nextSession(localDate(this.store.today()));
    return { type: next.type, when: humanDate(next.date) };
  });

  protected readonly todaySteps = computed(() => this.store.stepsFor(this.store.today()));

  /** План выбранной программы, сгруппированный в блоки — для превью на старте */
  protected planBlocks(type: ProgramType): Block[] {
    const items = PROGRAMS[type].items;
    return toBlocks(items, items.map((p) => p.sets), this.store.restSeconds());
  }

  protected planItem(type: ProgramType, i: number) {
    return PROGRAMS[type].items[i];
  }

  // ---------- Блоки активной тренировки ----------

  protected readonly blocks = computed<Block[]>(() => {
    const a = this.store.active();
    if (!a) return [];
    return toBlocks(
      a.items.map((it) => it.plan),
      a.items.map((it) => it.sets.length),
      this.store.restSeconds(),
    );
  });

  protected readonly block = computed<Block | null>(() => this.blocks()[this.curBlock()] ?? null);

  protected readonly isSuperset = computed(() => this.block()?.kind === 'superset');
  protected readonly isCardio = computed(() => this.block()?.kind === 'cardio');

  /** Первый круг, где хоть у одного упражнения блока подход не отмечен */
  private readonly firstOpenRound = computed(() => {
    const b = this.block();
    const a = this.store.active();
    if (!b || !a) return 0;
    for (let r = 0; r < b.rounds; r++) {
      if (b.idx.some((i) => a.items[i].sets[r] && !a.items[i].sets[r].done)) return r;
    }
    return Math.max(0, b.rounds - 1);
  });

  protected readonly curRound = computed(() => {
    const b = this.block();
    if (!b) return 0;
    const picked = this.pickedRound();
    return picked !== null && picked < b.rounds ? picked : this.firstOpenRound();
  });

  /**
   * Позиция внутри блока: первое упражнение с неотмеченным подходом на текущем
   * круге. Именно это даёт порядок «упр. 1 → упр. 2 → отдых» и корректно
   * пропускает упражнение, у которого подходов меньше, чем кругов.
   */
  protected readonly curPos = computed(() => {
    const b = this.block();
    const a = this.store.active();
    if (!b || !a) return 0;
    const r = this.curRound();
    const pos = b.idx.findIndex((i) => {
      const s = a.items[i].sets[r];
      return !!s && !s.done;
    });
    return pos === -1 ? 0 : pos;
  });

  /** Плоский индекс упражнения — «клей» со всеми методами стора */
  protected readonly curEx = computed(() => this.block()?.idx[this.curPos()] ?? 0);
  /** Номер подхода внутри упражнения совпадает с номером круга блока */
  protected readonly curSet = this.curRound;

  // ---------- Прогресс и статистика ----------

  protected readonly doneSets = computed(() => {
    const a = this.store.active();
    return a ? a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0) : 0;
  });

  protected readonly totalSets = computed(() => {
    const a = this.store.active();
    return a ? a.items.reduce((n, it) => n + it.sets.length, 0) : 0;
  });

  protected readonly allDone = computed(
    () => this.totalSets() > 0 && this.doneSets() === this.totalSets(),
  );

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

  protected readonly set = computed<SetEntry | null>(
    () => this.item()?.sets[this.curSet()] ?? null,
  );

  /** Круг закрыт: каждое упражнение блока либо отметило подход, либо его не имеет */
  protected roundDone(r: number): boolean {
    const b = this.block();
    const a = this.store.active();
    if (!b || !a) return false;
    return b.idx.every((i) => {
      const s = a.items[i].sets[r];
      return !s || s.done;
    });
  }

  protected readonly blockDone = computed(() => {
    const b = this.block();
    const a = this.store.active();
    return !!b && !!a && b.idx.every((i) => a.items[i].sets.every((s) => s.done));
  });

  protected readonly roundIndexes = computed(() =>
    Array.from({ length: this.block()?.rounds ?? 0 }, (_, i) => i),
  );

  /** Значения для степперов — с дефолтами, чтобы всегда было число */
  protected readonly displayW = computed(() => this.set()?.w ?? 0);
  protected readonly displayR = computed(() => this.set()?.r ?? 0);
  /** Кардио вводится в минутах, хранится в секундах */
  protected readonly displayMin = computed(() => Math.round(this.displayR() / 60));

  protected suggestionFor(it: WorkoutItem): WeightSuggestion | null {
    return this.store.suggestedWeight(it.ex, it.plan);
  }

  protected prevHint(exId: string): string | null {
    const sets = this.store.lastSets(exId);
    if (!sets) return null;
    if (exId === 'cardio-cooldown') {
      return sets.map((s) => `${Math.round((s.r ?? 0) / 60)} мин`).join(' · ');
    }
    if (EXERCISES[exId]?.isTime) return sets.map((s) => `${s.r ?? 0} с`).join(' · ');
    return sets.map((s) => `${s.w ?? 0}×${s.r ?? 0}`).join(' · ');
  }

  protected exercise(id: string): Exercise {
    return EXERCISES[id];
  }

  protected itemAt(i: number): WorkoutItem | null {
    return this.store.active()?.items[i] ?? null;
  }

  /** Сколько кругов блока полностью закрыто — для списка блоков в шторке */
  protected blockDoneRounds(b: Block): number {
    const a = this.store.active();
    if (!a) return 0;
    let n = 0;
    for (let r = 0; r < b.rounds; r++) {
      if (b.idx.every((i) => !a.items[i].sets[r] || a.items[i].sets[r].done)) n++;
    }
    return n;
  }

  protected blockTitle(b: Block): string {
    return b.idx.map((i) => EXERCISES[this.itemAt(i)?.ex ?? '']?.name ?? '').join(' + ');
  }

  protected blockHasPain(b: Block): boolean {
    return b.idx.some((i) => this.itemAt(i)?.pain);
  }

  // ---------- Действия ----------

  protected start(type: ProgramType): void {
    this.timer.unlockAudio();
    this.store.startWorkout(type);
    this.curBlock.set(0);
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

  /** Шаг степпера повторов: кардио — минуты, планка — 5 секунд, иначе 1 повтор */
  protected repStep(sign: number): number {
    if (this.isCardio()) return sign * 60;
    return sign * (this.ex()?.isTime ? 5 : 1);
  }

  /** Запустить обратный отсчёт кардио-заминки */
  protected startCardio(): void {
    this.timer.unlockAudio();
    this.timer.start(this.displayR(), 'Кардио');
  }

  /**
   * Главная кнопка: отметить текущий подход.
   * Внутри суперсета таймер НЕ запускается — сразу идёт второе упражнение пары.
   * Отдых стартует только когда закрыт весь круг, длительность — из блока.
   */
  protected completeSet(): void {
    this.timer.unlockAudio();
    const b = this.block();
    if (!b) return;
    const round = this.curRound();
    const done = this.store.toggleSet(this.curEx(), round);
    this.pickedRound.set(null);
    if (!done) return;
    if (!this.roundDone(round)) return;
    if (this.blockDone()) this.advance();
    if (!this.allDone() && b.restSec > 0) {
      this.timer.start(b.restSec);
    }
  }

  /**
   * Тап по чипу круга: закрытый круг — снять отметку целиком
   * (половина суперсета «сделана» не бывает), будущий — выбрать.
   */
  protected tapSet(r: number): void {
    const b = this.block();
    const a = this.store.active();
    if (!b || !a) return;
    if (b.idx.some((i) => a.items[i].sets[r]?.done)) {
      b.idx.forEach((i) => {
        if (this.store.active()?.items[i].sets[r]?.done) this.store.toggleSet(i, r);
      });
    }
    this.pickedRound.set(r);
  }

  /** К следующему блоку с невыполненными подходами */
  protected advance(): void {
    const bs = this.blocks();
    const a = this.store.active();
    if (!a || !bs.length) return;
    for (let step = 1; step <= bs.length; step++) {
      const idx = (this.curBlock() + step) % bs.length;
      if (bs[idx].idx.some((i) => a.items[i].sets.some((s) => !s.done))) {
        this.curBlock.set(idx);
        return;
      }
    }
  }

  protected goTo(index: number): void {
    this.curBlock.set(index);
    this.sheet.set(null);
  }

  protected prev(): void {
    const n = this.blocks().length;
    if (n) this.curBlock.update((i) => (i - 1 + n) % n);
  }

  protected next(): void {
    const n = this.blocks().length;
    if (n) this.curBlock.update((i) => (i + 1) % n);
  }

  /** «+» добавляет круг: по одному подходу каждому упражнению блока */
  protected addRound(): void {
    const b = this.block();
    if (!b) return;
    b.idx.forEach((i) => this.store.addSet(i));
    this.pickedRound.set(null);
  }

  /**
   * Замена упражнения. Заменяем именно то, чью шторку открыли: в суперсете
   * можно открыть технику второго упражнения пары, не будучи на нём сейчас.
   */
  protected swap(newExId: string, replacedExId: string): void {
    const a = this.store.active();
    const b = this.block();
    if (!a || !b) return;
    const flat = b.idx.find((i) => a.items[i].ex === replacedExId) ?? this.curEx();
    this.store.swapExercise(flat, newExId);
    this.pickedRound.set(null);
    this.sheet.set(null);
  }

  protected finish(): void {
    if (this.doneSets() === 0 && !confirm('Ни один подход не отмечен. Всё равно завершить?')) {
      return;
    }
    this.timer.stop();
    this.wakeLock.release();
    this.store.finishWorkout();
    this.curBlock.set(0);
  }

  protected cancel(): void {
    if (confirm('Точно отменить тренировку? Данные не сохранятся.')) {
      this.timer.stop();
      this.wakeLock.release();
      this.store.cancelWorkout();
      this.curBlock.set(0);
    }
  }
}
