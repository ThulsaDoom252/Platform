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
  | { mode: "unscramble"; word: RevisionWord }
  | { mode: "picture"; word: RevisionWord }
  | {
      mode: "definition";
      word: RevisionWord;
      /** Английские слова на выбор; верное среди них одно. */
      options: string[];
    };

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
};

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
  const usable = wordsFor(words, mode);
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
