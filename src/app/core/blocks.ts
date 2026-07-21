import { Block, ProgramItem } from './models';

/**
 * Схлопывает плоский список планов в блоки.
 *
 * Соседние элементы с одинаковым определённым `block` и kind === 'superset'
 * образуют один суперсет. Записи без `block` (история до суперсетов) —
 * solo-блоки, то есть ровно прежнее поведение «одно упражнение на экран».
 *
 * Слияние только по СОСЕДНИМ индексам: совпадение номеров блоков у далёких
 * упражнений (например, после замены) не может склеить их в одну пару.
 *
 * @param plans      планы упражнений в порядке следования
 * @param setCounts  фактическое число подходов каждого упражнения (может
 *                   отличаться от plan.sets после «+ подход»)
 * @param fallbackRest отдых для записей без restSec — глобальная настройка
 */
export function toBlocks(
  plans: readonly ProgramItem[],
  setCounts: readonly number[],
  fallbackRest: number,
): Block[] {
  const out: Block[] = [];
  let prevKey: number | undefined;

  plans.forEach((plan, i) => {
    const key = plan.block;
    const last = out.at(-1);
    const merge =
      last !== undefined &&
      last.kind === 'superset' &&
      key !== undefined &&
      key === prevKey &&
      last.idx.at(-1) === i - 1;

    if (merge) {
      last.idx.push(i);
      last.rounds = Math.max(last.rounds, setCounts[i] ?? plan.sets);
    } else {
      out.push({
        kind: plan.kind ?? 'solo',
        idx: [i],
        restSec: plan.restSec ?? fallbackRest,
        rounds: setCounts[i] ?? plan.sets,
      });
    }
    prevKey = key;
  });

  return out;
}
