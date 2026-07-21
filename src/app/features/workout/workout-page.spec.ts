import { TestBed } from '@angular/core/testing';
import { WorkoutPage } from './workout-page';
import { StoreService } from '../../core/store.service';
import { TimerService } from '../../core/timer.service';

/**
 * Проверяем порядок выполнения суперсета — главную новую механику:
 * подход упр.1 → сразу подход упр.2 → отдых → следующий круг.
 */
describe('WorkoutPage — суперсеты', () => {
  let page: WorkoutPage;
  let store: StoreService;
  let timer: TimerService;
  let started: { seconds: number; label?: string }[];

  /** Доступ к protected-членам компонента из теста */
  const p = () => page as unknown as Record<string, any>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [WorkoutPage] });
    store = TestBed.inject(StoreService);
    timer = TestBed.inject(TimerService);

    started = [];
    spyOn(timer, 'start').and.callFake((seconds: number, label?: string) => {
      started.push({ seconds, label });
    });
    spyOn(timer, 'unlockAudio');

    page = TestBed.createComponent(WorkoutPage).componentInstance;
  });

  it('блок 1 — соло, отдых 120 с после каждого подхода', () => {
    p()['start']('A');
    expect(p()['block']().kind).toBe('solo');
    expect(p()['ex']().id).toBe('leg-press');

    p()['completeSet']();
    expect(started).toEqual([{ seconds: 120, label: undefined }]);
  });

  it('внутри суперсета таймер НЕ запускается между упражнениями пары', () => {
    p()['start']('A');
    p()['completeSet']();
    p()['completeSet']();
    started = [];

    // Блок 2: жим гантелей + тяга верхнего блока, отдых 90 с
    expect(p()['block']().kind).toBe('superset');
    expect(p()['ex']().id).toBe('db-press-neutral');
    expect(p()['curRound']()).toBe(0);

    // Первое упражнение пары — отдыха нет, указатель едет на второе
    p()['completeSet']();
    expect(started).withContext('после первого упражнения пары').toEqual([]);
    expect(p()['ex']().id).toBe('lat-pulldown-neutral');
    expect(p()['curRound']()).withContext('круг тот же').toBe(0);

    // Второе упражнение пары — круг закрыт, стартует отдых блока
    p()['completeSet']();
    expect(started).toEqual([{ seconds: 90, label: undefined }]);
    expect(p()['curRound']()).withContext('следующий круг').toBe(1);
    expect(p()['ex']().id).withContext('снова первое упражнение').toBe('db-press-neutral');
  });

  it('прогресс блока считается по кругам, а не по подходам', () => {
    p()['start']('A');
    p()['completeSet']();
    p()['completeSet']();

    expect(p()['roundIndexes']().length).toBe(3);
    expect(p()['roundDone'](0)).toBeFalse();

    p()['completeSet']();
    expect(p()['roundDone'](0)).withContext('полкруга — ещё не круг').toBeFalse();
    p()['completeSet']();
    expect(p()['roundDone'](0)).toBeTrue();
  });

  it('после трёх кругов суперсет закрыт и указатель уходит на следующий блок', () => {
    p()['start']('A');
    p()['completeSet']();
    p()['completeSet']();

    for (let r = 0; r < 3; r++) {
      p()['completeSet']();
      p()['completeSet']();
    }

    expect(p()['curBlock']()).toBe(2);
    expect(p()['ex']().id).toBe('lateral-raise-db');
    expect(started.at(-1)).withContext('отдых следующего блока не подставился').toEqual({
      seconds: 90,
      label: undefined,
    });
  });

  it('тап по закрытому кругу снимает отметку с ОБОИХ упражнений пары', () => {
    p()['start']('A');
    p()['completeSet']();
    p()['completeSet']();
    p()['completeSet']();
    p()['completeSet']();
    expect(p()['roundDone'](0)).toBeTrue();

    p()['tapSet'](0);
    expect(p()['roundDone'](0)).toBeFalse();
    const b = p()['block']();
    const items = store.active()!.items;
    expect(b.idx.every((i: number) => !items[i].sets[0].done)).toBeTrue();
  });

  it('кардио-заминка — последний блок, 15 минут по умолчанию, без отдыха', () => {
    p()['start']('A');
    const blocks = p()['blocks']();
    const last = blocks[blocks.length - 1];
    expect(last.kind).toBe('cardio');

    p()['curBlock'].set(blocks.length - 1);
    expect(p()['isCardio']()).toBeTrue();
    expect(p()['displayMin']()).toBe(15);

    started = [];
    p()['startCardio']();
    expect(started).toEqual([{ seconds: 900, label: 'Кардио' }]);

    started = [];
    p()['completeSet']();
    expect(started).withContext('после кардио отдых не нужен').toEqual([]);
  });

  it('в программе нет жима лёжа, становой и приседа со штангой', () => {
    const banned = /штанг|становая|присед со штангой|жим лёжа со штангой/i;
    for (const type of ['A', 'B'] as const) {
      p()['start'](type);
      for (const item of store.active()!.items) {
        const ex = p()['exercise'](item.ex);
        expect(banned.test(ex.name)).withContext(`${type}: ${ex.name}`).toBeFalse();
        for (const alt of ex.alts) {
          expect(banned.test(p()['exercise'](alt).name))
            .withContext(`замена для ${ex.name}`)
            .toBeFalse();
        }
      }
      store.cancelWorkout();
    }
  });
});

/** Старые записи истории должны открываться как соло-упражнения */
describe('WorkoutPage — совместимость со старой историей', () => {
  const p = (page: WorkoutPage) => page as unknown as Record<string, any>;

  it('тренировка без block/kind разворачивается в соло-блоки с глобальным отдыхом', () => {
    localStorage.setItem(
      'fitlog-ng-v1',
      JSON.stringify({
        workouts: [],
        weights: [],
        rest: 90,
        meals: {},
        active: {
          id: 1,
          date: '2026-07-01',
          type: 'A',
          items: [
            {
              ex: 'leg-press',
              plan: { ex: 'leg-press', sets: 3, reps: '8–10' },
              sets: [{ w: 100, r: 10, done: false }],
            },
            {
              ex: 'hip-thrust',
              plan: { ex: 'hip-thrust', sets: 2, reps: '12' },
              sets: [{ w: 60, r: 12, done: false }],
            },
          ],
        },
      }),
    );

    TestBed.configureTestingModule({ imports: [WorkoutPage] });
    const page = TestBed.createComponent(WorkoutPage).componentInstance;
    const blocks = p(page)['blocks']();

    expect(blocks.length).withContext('каждое упражнение — свой блок').toBe(2);
    expect(blocks.every((b: any) => b.kind === 'solo')).toBeTrue();
    expect(blocks.every((b: any) => b.restSec === 90)).toBeTrue();
    // hip-thrust убран из программы, но остался в каталоге — иначе история упадёт
    expect(p(page)['exercise']('hip-thrust').name).toBe('Hip thrust');
  });
});
