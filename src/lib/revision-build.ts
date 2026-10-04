/**
 * Сборка задания «повторение слов».
 *
 * Из выбранных слов и порядка режимов получается список шагов — то, что
 * ученик увидит один за другим. Собирается один раз при старте и дальше
 * не меняется: правка словника посреди задания не должна переставлять
 * карточки под учеником.
 *
 * Здесь же выбираются чужие варианты для «выбери перевод» и режутся
 * пары. Это то место, где ошибка не видна глазами: правильный ответ,
 * случайно попавший в чужие варианты дважды, выглядит как обычный
 * вопрос — и ломает задание.
 */
import { shuffle } from "./game-deck";
import {
  isTestMode,
  MIN_WORDS,
  wordsFor,
  type RevisionMode,
  type RevisionWord,
} from "./revision-modes";

/** Сколько пар показывают за один раз. */
export const PAIR_MIN = 2;
export const PAIR_MAX = 4;

/** Сколько вариантов даёт выбор перевода и выбор по описанию. */
export const CHOICE_OPTIONS = 3;
export const DEFINITION_OPTIONS = 4;

export type RevisionStep =
  | { mode: "flashcards"; words: RevisionWord[] }
  | {
      mode: "choose";
      word: RevisionWord;
      /** Варианты перевода; правильный среди них ровно один. */
      options: string[];
    }
  | { mode: "pairs" | "definitionPairs"; words: RevisionWord[] }
  | {
      mode: "unscramble";
      word: RevisionWord;
      /** Слова фразы, у каждого свои буквы вперемешку. */
      parts: ScrambledPart[];
    }
  | { mode: "picture"; word: RevisionWord }
  | {
      mode: "definition";
      word: RevisionWord;
      /** Английские слова на выбор; верное среди них одно. */
      options: string[];
    };

/** Одно слово фразы: как пишется и как рассыпано. */
export type ScrambledPart = { text: string; letters: string[] };

/**
 * Буквы слова вперемешку — так, чтобы не совпасть с исходным порядком.
 *
 * Случайная перестановка иногда возвращает слово как есть, и задание
 * «собери слово» превращается в «нажми по порядку». Поэтому совпадение
 * отбрасывается, а если переставлять нечего (одна буква, одинаковые
 * буквы) — слово и остаётся собой.
 */
export function scrambleLetters(
  word: string,
  random: () => number = Math.random,
): string[] {
  const letters = [...word];
  if (new Set(letters).size < 2) return letters;

  for (let i = 0; i < 12; i++) {
    const mixed = shuffle(letters, random);
    if (mixed.join("") !== word) return mixed;
  }

  // Двенадцать неудач подряд — просто меняем местами две разные буквы.
  const mixed = [...letters];
  const at = mixed.findIndex((c) => c !== mixed[0]);
  [mixed[0], mixed[at]] = [mixed[at], mixed[0]];
  return mixed;
}

/** Фраза как набор рассыпанных слов: по коробке на слово. */
export function scrambleParts(
  phrase: string,
  random: () => number = Math.random,
): ScrambledPart[] {
  return phrase
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, letters: scrambleLetters(text, random) }));
}

/**
 * Собранные пары уходят наверх.
 *
 * Иначе решённое остаётся вперемешку с нерешённым, и к концу ученик
 * ищет оставшуюся пару глазами по всему столбцу.
 */
export function pairOrder(ids: string[], matched: string[]): string[] {
  const done = matched.filter((id) => ids.includes(id));
  const left = new Set(done);
  return [...done, ...ids.filter((id) => !left.has(id))];
}

/**
 * Чужие варианты к правильному ответу.
 *
 * Берутся из тех же слов задания: посторонние слова выдают ответ сразу,
 * а однотипные заставляют думать. Повторы отсеиваются — два одинаковых
 * варианта в списке выглядят как подсказка.
 */
export function makeOptions(
  correct: string,
  pool: string[],
  size: number,
  random: () => number = Math.random,
): string[] {
  const others = [...new Set(pool.map((p) => p.trim()).filter(Boolean))].filter(
    (value) => value.toLowerCase() !== correct.trim().toLowerCase(),
  );

  const picked = shuffle(others, random).slice(0, Math.max(0, size - 1));
  return shuffle([correct, ...picked], random);
}

/** Режет список на группы от двух до четырёх — так показывают пары. */
export function splitPairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  let rest = items.slice();

  while (rest.length > 0) {
    if (rest.length <= PAIR_MAX) {
      // Хвост из одного соединять не с чем — подклеиваем к прошлой группе.
      if (rest.length < PAIR_MIN && out.length > 0) {
        out[out.length - 1] = [...out[out.length - 1], ...rest];
      } else if (rest.length >= PAIR_MIN) {
        out.push(rest);
      }
      break;
    }

    out.push(rest.slice(0, PAIR_MAX));
    rest = rest.slice(PAIR_MAX);
  }

  return out;
}

export type BuildOptions = {
  /** Перемешивать слова внутри режима. */
  shuffleWords?: boolean;
  /**
   * Чем закрывать каждый режим.
   *
   * Учитель набирает секции по отдельности: карточки на всём словнике,
   * «собери слово» — на пяти трудных. Режим, которого здесь нет, берёт
   * всё, что ему подходит.
   */
  byMode?: Partial<Record<RevisionMode, string[]>>;
};

/** Слова одного режима с учётом того, что отобрал учитель. */
export function wordsOfMode(
  mode: RevisionMode,
  words: RevisionWord[],
  byMode: BuildOptions["byMode"],
): RevisionWord[] {
  const picked = byMode?.[mode];
  if (!picked) return words;

  // Порядок словника важнее порядка галочек: так задание читается ровно.
  const keep = new Set(picked);
  return words.filter((w) => keep.has(w.phraseId));
}

/**
 * Шаги одного режима.
 *
 * Режим, которому не хватило слов, не даёт ни одного шага — и в задании
 * его просто не будет. Проверять это надо до старта, иначе ученик
 * получит пустую секцию.
 */
export function buildMode(
  mode: RevisionMode,
  words: RevisionWord[],
  options: BuildOptions = {},
  random: () => number = Math.random,
): RevisionStep[] {
  const usable = wordsFor(wordsOfMode(mode, words, options.byMode), mode);
  if (usable.length < MIN_WORDS[mode]) return [];

  const list = options.shuffleWords === false ? usable : shuffle(usable, random);

  switch (mode) {
    case "flashcards":
      // Карточки идут одной пачкой: ученик листает их вперёд и назад.
      return [{ mode, words: list }];

    case "choose":
      return list.map((word) => ({
        mode,
        word,
        options: makeOptions(
          word.translation!.trim(),
          list.map((w) => w.translation ?? ""),
          CHOICE_OPTIONS,
          random,
        ),
      }));

    case "definition":
      return list.map((word) => ({
        mode,
        word,
        options: makeOptions(
          word.word.trim(),
          list.map((w) => w.word),
          DEFINITION_OPTIONS,
          random,
        ),
      }));

    case "pairs":
    case "definitionPairs":
      return splitPairs(list).map((group) => ({ mode, words: group }));

    case "unscramble":
      return list.map((word) => ({
        mode,
        word,
        parts: scrambleParts(word.word, random),
      }));

    case "picture":
      return list.map((word) => ({ mode, word }));
  }
}

export type RevisionSection = { mode: RevisionMode; steps: RevisionStep[] };

/**
 * Всё задание: секции в том порядке, какой задал учитель.
 *
 * Пустые секции выбрасываются — режим, которому не хватило слов,
 * показывать нечем.
 */
export function buildRevision(
  words: RevisionWord[],
  modes: RevisionMode[],
  options: BuildOptions = {},
  random: () => number = Math.random,
): RevisionSection[] {
  return modes
    .map((mode) => ({ mode, steps: buildMode(mode, words, options, random) }))
    .filter((section) => section.steps.length > 0);
}

/**
 * Сколько ответов даёт один шаг.
 *
 * Карточки и пары закрывают сразу несколько слов, остальные режимы — по
 * одному. Без этого не понять, где ученик остановился: ответов больше,
 * чем шагов.
 */
export function stepSize(step: RevisionStep): number {
  return stepWords(step).length;
}

/** Слова одного шага — по одному на ответ. */
export function stepWords(step: RevisionStep): RevisionWord[] {
  switch (step.mode) {
    case "flashcards":
    case "pairs":
    case "definitionPairs":
      return step.words;
    default:
      return [step.word];
  }
}

/** Все слова задания в порядке прохождения — по одному на ответ. */
export function planWords(plan: RevisionSection[]): {
  mode: RevisionMode;
  word: RevisionWord;
}[] {
  const out: { mode: RevisionMode; word: RevisionWord }[] = [];

  for (const section of plan) {
    for (const step of section.steps) {
      for (const word of stepWords(step)) out.push({ mode: section.mode, word });
    }
  }

  return out;
}

export type SectionProgress = {
  mode: RevisionMode;
  /** На каком шаге секция стоит сейчас. */
  step: number;
  /** Сколько слов уже отвечено и сколько их всего. */
  answered: number;
  total: number;
  done: boolean;
};

/**
 * Продвижение по каждой секции в отдельности.
 *
 * Ученик ходит между секциями свободно, поэтому «сколько всего
 * ответов» больше ничего не говорит: считать надо по режимам. Режим в
 * плане встречается один раз, так что ответы по нему и есть прогресс
 * его секции.
 */
export function planProgress(
  plan: RevisionSection[],
  answers: { mode: RevisionMode }[],
): SectionProgress[] {
  const byMode = new Map<RevisionMode, number>();
  for (const a of answers) byMode.set(a.mode, (byMode.get(a.mode) ?? 0) + 1);

  return plan.map((section) => {
    const total = section.steps.reduce((sum, step) => sum + stepSize(step), 0);
    const answered = Math.min(byMode.get(section.mode) ?? 0, total);

    let used = 0;
    let step = section.steps.length;
    for (let q = 0; q < section.steps.length; q++) {
      const size = stepSize(section.steps[q]);
      if (used + size > answered) {
        step = q;
        break;
      }
      used += size;
    }

    return {
      mode: section.mode,
      step: Math.min(step, Math.max(0, section.steps.length - 1)),
      answered,
      total,
      done: answered >= total,
    };
  });
}

/** Первая непройденная секция; −1 — пройдено всё. */
export function nextSection(progress: SectionProgress[], from = 0): number {
  for (let i = 0; i < progress.length; i++) {
    const at = (from + i) % progress.length;
    if (!progress[at].done) return at;
  }
  return -1;
}

/**
 * Сдана ли проверочная часть игры.
 * Flashcards остаются доступной разминкой, но не мешают закончить игру.
 */
export function testSectionsComplete(
  progress: Pick<SectionProgress, "mode" | "done">[],
): boolean {
  const tests = progress.filter((section) => isTestMode(section.mode));
  return tests.length > 0 && tests.every((section) => section.done);
}

/**
 * Хвост задания как просроченный.
 *
 * Когда кончилось время на всю работу, непройденное не исчезает: учитель
 * должен видеть, что слова остались без ответа, а не только высокий
 * процент по тем, что успели.
 */
export function timeoutRest(
  plan: RevisionSection[],
  answered: number,
): { mode: RevisionMode; phraseId: string; word: string; correct: false; reason: "timeout"; ms: number }[] {
  return planWords(plan)
    .slice(answered)
    .map(({ mode, word }) => ({
      mode,
      phraseId: word.phraseId,
      word: word.word,
      correct: false as const,
      reason: "timeout" as const,
      ms: 0,
    }));
}
