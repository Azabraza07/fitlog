import { Exercise, ProgramDef, ProgramType } from './models';

/**
 * Каталог подобран под ограничения владельца:
 * без осевой нагрузки на позвоночник (таз/поясница),
 * нейтральный хват (правая кисть), щадящие траектории для левого плеча.
 */
export const EXERCISES: Record<string, Exercise> = {
  // ---- Ноги ----
  'leg-press': {
    id: 'leg-press', name: 'Жим ногами', group: 'Квадрицепс',
    yt: 'жим ногами в тренажёре техника',
    tips: [
      'Поясница и таз прижаты к спинке всё время — не отрывай таз внизу',
      'Стопы на ширине плеч, колени идут по линии носков',
      'Не выпрямляй колени до щелчка в верхней точке',
    ],
    alts: ['hack-squat', 'leg-extension'],
  },
  'hack-squat': {
    id: 'hack-squat', name: 'Гакк-присед в тренажёре', group: 'Квадрицепс',
    yt: 'гакк присед техника выполнения',
    tips: [
      'Спина полностью прижата к подушке тренажёра',
      'Глубина — до комфортной, без отрыва поясницы',
    ],
    alts: ['leg-press', 'leg-extension'],
  },
  'leg-extension': {
    id: 'leg-extension', name: 'Разгибания ног сидя', group: 'Квадрицепс',
    yt: 'разгибание ног в тренажёре техника',
    tips: ['В верхней точке — секундная пауза', 'Опускай подконтрольно, не бросай вес'],
    alts: ['leg-press', 'hack-squat'],
  },
  'leg-curl-lying': {
    id: 'leg-curl-lying', name: 'Сгибания ног лёжа', group: 'Бицепс бедра',
    yt: 'сгибание ног лёжа в тренажёре техника',
    tips: [
      'Таз прижат к скамье — не поднимай его при сгибании',
      'Это замена румынской тяги — безопасно для поясницы',
    ],
    alts: ['leg-curl-seated', 'leg-curl-standing'],
  },
  'leg-curl-seated': {
    id: 'leg-curl-seated', name: 'Сгибания ног сидя', group: 'Бицепс бедра',
    yt: 'сгибание ног сидя в тренажёре техника',
    tips: ['Спина прижата к спинке', 'Подконтрольное движение в обе стороны'],
    alts: ['leg-curl-lying', 'leg-curl-standing'],
  },
  'leg-curl-standing': {
    id: 'leg-curl-standing', name: 'Сгибание ноги стоя', group: 'Бицепс бедра',
    yt: 'сгибание ноги стоя в тренажёре',
    tips: ['Корпус зафиксирован, работает только нога'],
    alts: ['leg-curl-lying', 'leg-curl-seated'],
  },
  'hip-thrust': {
    id: 'hip-thrust', name: 'Hip thrust', group: 'Ягодичные',
    yt: 'hip thrust техника выполнения',
    tips: [
      'Подбородок к груди — не запрокидывай голову',
      'В верхней точке ровная линия колени-таз-плечи, без прогиба поясницы',
      'Сжимай ягодицы наверху одну секунду',
    ],
    alts: ['glute-bridge', 'cable-kickback'],
  },
  'glute-bridge': {
    id: 'glute-bridge', name: 'Ягодичный мост с гантелью', group: 'Ягодичные',
    yt: 'ягодичный мост с гантелью на полу',
    tips: ['Лёжа на полу, гантель на тазу', 'Работают ягодицы, не поясница'],
    alts: ['hip-thrust', 'cable-kickback'],
  },
  'cable-kickback': {
    id: 'cable-kickback', name: 'Отведение ноги в блоке', group: 'Ягодичные',
    yt: 'отведение ноги назад в кроссовере техника',
    tips: ['Держись за раму, спина ровная', 'Движение за счёт ягодицы'],
    alts: ['hip-thrust', 'glute-bridge'],
  },

  // ---- Грудь ----
  'db-press-neutral': {
    id: 'db-press-neutral', name: 'Жим гантелей лёжа, нейтральный хват', group: 'Грудь',
    yt: 'жим гантелей лёжа нейтральным хватом',
    tips: [
      'Ладони смотрят друг на друга — кисть и плечо в безопасном положении',
      'Лопатки сведены и прижаты к скамье',
      'Глубина — до комфортной, без боли в плече',
    ],
    alts: ['hammer-chest-press', 'cable-fly', 'pec-deck'],
  },
  'hammer-chest-press': {
    id: 'hammer-chest-press', name: 'Жим в Хаммере', group: 'Грудь',
    yt: 'жим в хаммере на грудь техника',
    tips: ['Выбирай нейтральные рукояти, если есть', 'Спина и голова прижаты к спинке'],
    alts: ['db-press-neutral', 'cable-fly', 'pec-deck'],
  },
  'cable-fly': {
    id: 'cable-fly', name: 'Сведения в кроссовере', group: 'Грудь',
    yt: 'сведение рук в кроссовере техника',
    tips: [
      'Кисть не нагружается — лучший вариант при боли в кисти',
      'Локти чуть согнуты, своди руки перед грудью с паузой',
    ],
    alts: ['pec-deck', 'db-press-neutral'],
  },
  'pec-deck': {
    id: 'pec-deck', name: 'Бабочка (пек-дек)', group: 'Грудь',
    yt: 'бабочка тренажёр на грудь техника',
    tips: ['Не разводи руки до боли в плече — работай в комфортной амплитуде'],
    alts: ['cable-fly', 'hammer-chest-press'],
  },

  // ---- Спина ----
  'lat-pulldown-neutral': {
    id: 'lat-pulldown-neutral', name: 'Тяга верхнего блока, нейтральный хват', group: 'Спина · ширина',
    yt: 'тяга верхнего блока нейтральным хватом',
    tips: [
      'Тяни к верху груди, локти вниз, а не назад',
      'Не отклоняйся сильно назад — спина почти вертикальна',
    ],
    alts: ['hammer-pulldown', 'cable-pullover'],
  },
  'hammer-pulldown': {
    id: 'hammer-pulldown', name: 'Вертикальная тяга в Хаммере', group: 'Спина · ширина',
    yt: 'вертикальная тяга в хаммере техника',
    tips: ['Тяни локтями, а не руками'],
    alts: ['lat-pulldown-neutral', 'cable-pullover'],
  },
  'cable-pullover': {
    id: 'cable-pullover', name: 'Пуловер в блоке', group: 'Спина · ширина',
    yt: 'пуловер в кроссовере прямыми руками',
    tips: ['Корпус наклонён, спина ровная', 'Тяни рукоять к бёдрам широчайшими'],
    alts: ['lat-pulldown-neutral', 'hammer-pulldown'],
  },
  'seated-cable-row': {
    id: 'seated-cable-row', name: 'Тяга блока сидя', group: 'Спина · толщина',
    yt: 'тяга горизонтального блока сидя техника',
    tips: [
      'Корпус вертикально и неподвижно — не раскачивайся поясницей',
      'Тяни к низу живота, своди лопатки',
    ],
    alts: ['chest-supported-row', 'db-row-bench'],
  },
  'chest-supported-row': {
    id: 'chest-supported-row', name: 'Тяга с упором грудью', group: 'Спина · толщина',
    yt: 'тяга в тренажёре с упором в грудь',
    tips: ['Грудь прижата к подушке — поясница выключена', 'Пауза при сведении лопаток'],
    alts: ['seated-cable-row', 'db-row-bench'],
  },
  'db-row-bench': {
    id: 'db-row-bench', name: 'Тяга гантели с опорой', group: 'Спина · толщина',
    yt: 'тяга гантели одной рукой в упоре на скамью',
    tips: ['Колено и рука на скамье — спина разгружена', 'Тяни локтем к тазу'],
    alts: ['seated-cable-row', 'chest-supported-row'],
  },

  // ---- Плечи ----
  'db-shoulder-press': {
    id: 'db-shoulder-press', name: 'Жим гантелей сидя со спинкой', group: 'Плечи',
    yt: 'жим гантелей сидя на плечи техника',
    tips: [
      'Спинка 80–90° — поясница прижата',
      'Можно нейтральным хватом, если плечу так комфортнее',
      'Не опускай ниже уровня, где появляется дискомфорт',
    ],
    alts: ['machine-shoulder-press', 'lateral-raise-db'],
  },
  'machine-shoulder-press': {
    id: 'machine-shoulder-press', name: 'Жим в тренажёре на плечи', group: 'Плечи',
    yt: 'жим в тренажёре на плечи сидя',
    tips: ['Нейтральные рукояти, если есть'],
    alts: ['db-shoulder-press', 'lateral-raise-db'],
  },
  'lateral-raise-db': {
    id: 'lateral-raise-db', name: 'Махи гантелями в стороны', group: 'Плечи',
    yt: 'махи гантелями в стороны техника',
    tips: [
      'До уровня плеч, не выше — щадим плечо',
      'Лучше легче вес и чище техника',
    ],
    alts: ['lateral-raise-cable', 'machine-shoulder-press'],
  },
  'lateral-raise-cable': {
    id: 'lateral-raise-cable', name: 'Махи в нижнем блоке', group: 'Плечи',
    yt: 'отведение руки в сторону в кроссовере',
    tips: ['Постоянное натяжение по всей амплитуде', 'До уровня плеча'],
    alts: ['lateral-raise-db'],
  },
  'face-pull': {
    id: 'face-pull', name: 'Face pull канатом', group: 'Задняя дельта',
    yt: 'face pull техника выполнения',
    tips: [
      'Лечебное упражнение для левого плеча — не пропускай',
      'Тяни канат к лицу, разводя концы к ушам',
      'Лёгкий вес, чувствуй заднюю дельту',
    ],
    alts: ['reverse-pec-deck', 'rear-delt-raise'],
  },
  'reverse-pec-deck': {
    id: 'reverse-pec-deck', name: 'Обратная бабочка', group: 'Задняя дельта',
    yt: 'обратная бабочка на заднюю дельту',
    tips: ['Грудь прижата к спинке', 'Разводи руки назад без рывка'],
    alts: ['face-pull', 'rear-delt-raise'],
  },
  'rear-delt-raise': {
    id: 'rear-delt-raise', name: 'Разведения с упором грудью', group: 'Задняя дельта',
    yt: 'разведение гантелей в наклоне лёжа на скамье',
    tips: ['Грудью на наклонную скамью — поясница выключена'],
    alts: ['face-pull', 'reverse-pec-deck'],
  },

  // ---- Руки ----
  'hammer-curl': {
    id: 'hammer-curl', name: 'Hammer curl (молотки)', group: 'Бицепс',
    yt: 'молотки на бицепс техника',
    tips: ['Нейтральный хват — самый щадящий для кисти', 'Локти прижаты, без раскачки'],
    alts: ['cable-curl-rope', 'preacher-machine'],
  },
  'cable-curl-rope': {
    id: 'cable-curl-rope', name: 'Сгибания с канатом', group: 'Бицепс',
    yt: 'сгибание рук с канатом на бицепс',
    tips: ['Канат позволяет кисти занять удобный угол'],
    alts: ['hammer-curl', 'preacher-machine'],
  },
  'preacher-machine': {
    id: 'preacher-machine', name: 'Скамья Скотта в тренажёре', group: 'Бицепс',
    yt: 'сгибание рук в тренажёре скамья скотта',
    tips: ['Локти полностью на подушке', 'Не разгибай руки рывком'],
    alts: ['hammer-curl', 'cable-curl-rope'],
  },
  'rope-pushdown': {
    id: 'rope-pushdown', name: 'Разгибания с канатом', group: 'Трицепс',
    yt: 'разгибание рук с канатом на трицепс',
    tips: ['Локти прижаты и неподвижны', 'Внизу разведи концы каната'],
    alts: ['triceps-machine', 'db-overhead-ext'],
  },
  'triceps-machine': {
    id: 'triceps-machine', name: 'Разгибания в тренажёре', group: 'Трицепс',
    yt: 'разгибание рук в тренажёре на трицепс',
    tips: ['Полное разгибание с паузой'],
    alts: ['rope-pushdown', 'db-overhead-ext'],
  },
  'db-overhead-ext': {
    id: 'db-overhead-ext', name: 'Французский жим гантелью сидя', group: 'Трицепс',
    yt: 'французский жим гантелью из-за головы сидя',
    tips: ['Скамья со спинкой', 'Ладони под блин гантели — нейтрально для кисти'],
    alts: ['rope-pushdown', 'triceps-machine'],
  },

  // ---- Кор ----
  'plank': {
    id: 'plank', name: 'Планка', group: 'Кор', isTime: true,
    yt: 'планка правильная техника',
    tips: ['Тело — прямая линия, таз не провисает', 'Ягодицы и пресс напряжены'],
    alts: ['dead-bug', 'side-plank'],
  },
  'dead-bug': {
    id: 'dead-bug', name: 'Dead bug', group: 'Кор',
    yt: 'dead bug упражнение техника',
    tips: [
      'Золотой стандарт при проблемной пояснице',
      'Поясница прижата к полу всё время — это главное',
      'Медленно: противоположные рука и нога',
    ],
    alts: ['plank', 'pallof-press'],
  },
  'pallof-press': {
    id: 'pallof-press', name: 'Pallof press', group: 'Кор',
    yt: 'pallof press техника выполнения',
    tips: [
      'Стоя боком к блоку, жми рукоять от груди вперёд',
      'Не давай корпусу повернуться — в этом суть',
    ],
    alts: ['dead-bug', 'plank'],
  },
  'side-plank': {
    id: 'side-plank', name: 'Боковая планка', group: 'Кор', isTime: true,
    yt: 'боковая планка техника',
    tips: ['Тело — прямая линия сбоку', 'По 30–45 секунд на сторону'],
    alts: ['plank', 'dead-bug'],
  },
};

/**
 * Философия «минимально достаточной дозы» (12.07.2026, по запросу владельца:
 * после зала должна оставаться энергия жить/работать/учиться):
 * ~17 подходов и 45–55 минут на тренировку, тяжело ВНУТРИ подхода
 * (заканчивать с запасом 1–2 повторения), но без отказа, дроп-сетов
 * и мусорного объёма. На дефиците калорий лишний объём = усталость,
 * а не мышцы. Стало тяжело жить — убрать по подходу с изоляции.
 */
export const PROGRAMS: Record<ProgramType, ProgramDef> = {
  A: {
    name: 'Тренировка A',
    items: [
      { ex: 'leg-press', sets: 3, reps: '8–10' },
      { ex: 'db-press-neutral', sets: 3, reps: '8–10' },
      { ex: 'lat-pulldown-neutral', sets: 3, reps: '10–12' },
      { ex: 'leg-curl-lying', sets: 2, reps: '12' },
      { ex: 'lateral-raise-db', sets: 2, reps: '12–15' },
      { ex: 'hammer-curl', sets: 2, reps: '12' },
      { ex: 'plank', sets: 2, reps: '45–60 с' },
    ],
  },
  B: {
    name: 'Тренировка B',
    items: [
      { ex: 'hack-squat', sets: 3, reps: '8–10' },
      { ex: 'seated-cable-row', sets: 3, reps: '10–12' },
      { ex: 'db-shoulder-press', sets: 3, reps: '8–10' },
      { ex: 'hip-thrust', sets: 2, reps: '12' },
      { ex: 'face-pull', sets: 2, reps: '15' },
      { ex: 'rope-pushdown', sets: 2, reps: '12' },
      { ex: 'dead-bug', sets: 2, reps: '10' },
    ],
  },
};

export const WARMUP: readonly string[] = [
  '5 минут кардио — дорожка или велосипед',
  'Bird dog — 2×8 на сторону',
  'Вращения плеч с резинкой — 2×15',
];

/** Монограмма для плитки упражнения: первые буквы двух первых слов */
export function monogram(name: string): string {
  const words = name.replace(/[()]/g, '').split(/[\s-]+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function ytLink(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
