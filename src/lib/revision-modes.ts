/**
 * Режимы повторения слов и то, что каждому из них нужно.
 *
 * Режимы разные не только на вид: одному хватает слова, другому нужна
 * картинка, третьему английское описание. Слово без картинки в игре по
 * картинкам показать нечем — и это надо знать до старта, а не на уроке.
 *
 * Поэтому требования живут здесь, рядом со списком, а не растворены по
 * разметке.
 */

export type RevisionMode =
  | "flashcards"
  | "choose"
  | "pairs"
  | "unscramble"
  | "picture"
  | "definition"
  | "definitionPairs";

/** Все режимы в том порядке, в каком их показывают учителю. */
export const REVISION_MODES: RevisionMode[] = [
  "flashcards",
  "choose",
  "pairs",
  "unscramble",
  "picture",
  "definition",
  "definitionPairs",
];

/**
 * Проверочные режимы.
 *
 * Flashcards ничего не спрашивает — это просмотр. Поэтому задание из
 * одних карточек не задание, и хотя бы один режим отсюда обязателен.
 */
export const TEST_MODES: RevisionMode[] = REVISION_MODES.filter(
  (mode) => mode !== "flashcards",
);

export function isTestMode(mode: RevisionMode): boolean {
  return mode !== "flashcards";
}

/** Слово в том виде, в каком его получает задание. */
export type RevisionWord = {
  phraseId: string;
  word: string;
  translation: string | null;
  description: string | null;
  imageUrl: string | null;
};

/**
 * Годится ли слово этому режиму.
 *
 * Перевод нужен везде, где спрашивают переводом; картинка — где
 * показывают картинку; описание — где дают описание. Flashcards
 * обходится одним словом: перевод там необязателен.
 */
export function wordFits(word: RevisionWord, mode: RevisionMode): boolean {
  const has = (value: string | null | undefined) => !!value?.trim();

  switch (mode) {
    case "flashcards":
    case "unscramble":
      return has(word.word);
    case "choose":
    case "pairs":
      return has(word.word) && has(word.translation);
    case "picture":
      return has(word.word) && has(word.imageUrl);
    case "definition":
    case "definitionPairs":
      return has(word.word) && has(word.description);
  }
}

/** Слова, которыми режим может играть. */
export function wordsFor(words: RevisionWord[], mode: RevisionMode): RevisionWord[] {
  return words.filter((word) => wordFits(word, mode));
}

/**
 * Сколько слов режиму нужно, чтобы он вообще имел смысл.
 *
 * Выбор из трёх без двух чужих вариантов невозможен, пары — это пары,
 * а на одно слово меньше чем из четырёх выбирать нечего.
 */
export const MIN_WORDS: Record<RevisionMode, number> = {
  flashcards: 1,
  choose: 3,
  pairs: 2,
  unscramble: 1,
  picture: 1,
  definition: 4,
  definitionPairs: 2,
};

export type ModeReadiness = {
  mode: RevisionMode;
  /** Сколько выбранных слов режим может взять. */
  usable: number;
  /** Сколько выпадет: нет картинки, нет описания, нет перевода. */
  skipped: number;
  /** Хватает ли слов, чтобы режим заработал. */
  ready: boolean;
};

/**
 * Что получится у каждого режима на этом наборе слов.
 *
 * Считается до старта и показывается учителю: «по картинке — 4 из 20»
 * честнее, чем молча выбросить шестнадцать слов посреди задания.
 */
export function readiness(words: RevisionWord[]): ModeReadiness[] {
  return REVISION_MODES.map((mode) => {
    const usable = wordsFor(words, mode).length;
    return {
      mode,
      usable,
      skipped: words.length - usable,
      ready: usable >= MIN_WORDS[mode],
    };
  });
}

/** Можно ли пускать задание: нужен хотя бы один работающий проверочный режим. */
export function canStart(words: RevisionWord[], modes: RevisionMode[]): boolean {
  const state = new Map(readiness(words).map((r) => [r.mode, r]));
  return modes.some((mode) => isTestMode(mode) && state.get(mode)?.ready);
}
