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
  /** Сохранённая emoji-иконка словарной записи. */
  icon?: string | null;
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
 * Обычный выбор из перевода без двух чужих вариантов невозможен.
 * Режимы по картинке и описанию доступны уже с одной подходящей записью:
 * учитель сам решает, насколько большим будет такой набор.
 */
export const MIN_WORDS: Record<RevisionMode, number> = {
  flashcards: 1,
  choose: 3,
  pairs: 2,
  unscramble: 1,
  picture: 1,
  definition: 1,
  definitionPairs: 1,
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

/** Заработает ли режим на этих словах. */
export function modeReady(words: RevisionWord[], mode: RevisionMode): boolean {
  return wordsFor(words, mode).length >= MIN_WORDS[mode];
}

/**
 * Можно ли пускать задание, когда у каждого режима свой набор слов.
 *
 * Нужен хотя бы один работающий проверочный режим: задание из одних
 * карточек ничего не спрашивает.
 */
export function canStartWith(
  wordsOf: (mode: RevisionMode) => RevisionWord[],
  modes: RevisionMode[],
): boolean {
  return modes.some((mode) => isTestMode(mode) && modeReady(wordsOf(mode), mode));
}

/** То же на одном общем наборе слов. */
export function canStart(words: RevisionWord[], modes: RevisionMode[]): boolean {
  return canStartWith(() => words, modes);
}

/**
 * Что показывать рядом с заданием.
 *
 * Карточка — это английское слово, а «собери слово» — буквы. Перевод,
 * картинка и описание рядом превращают и то и другое в чтение вслух,
 * поэтому по умолчанию их нет, а включает их учитель под конкретный
 * класс: начинающему картинка помогает, продвинутому мешает.
 */
export type RevisionShow = {
  /** Students can keep a separate difficult-word list for every attempt. */
  strugglingWith: boolean;
  cardIcon: boolean;
  cardImage: boolean;
  cardTranslation: boolean;
  cardDescription: boolean;
  scrambleImage: boolean;
  scrambleTranslation: boolean;
};

export const DEFAULT_SHOW: RevisionShow = {
  strugglingWith: true,
  cardIcon: false,
  cardImage: false,
  cardTranslation: false,
  cardDescription: false,
  scrambleImage: false,
  scrambleTranslation: false,
};

/** Ключи настроек по режимам — чтобы форма не выдумывала их заново. */
export const SHOW_KEYS: Partial<Record<RevisionMode, (keyof RevisionShow)[]>> = {
  flashcards: ["cardIcon", "cardImage", "cardTranslation", "cardDescription"],
  unscramble: ["scrambleImage", "scrambleTranslation"],
};

/** Old assignments gain the difficult-word list without rewriting their settings. */
export function readShow(stored: Record<string, boolean> | null | undefined): RevisionShow {
  return { ...DEFAULT_SHOW, ...(stored ?? {}), strugglingWith: stored?.strugglingWith !== false };
}

/** Случайная доля слов; каждое нажатие даёт новую выборку. */
export function randomRevisionPercentage<T>(
  items: T[],
  percent: 25 | 50 | 75,
  random: () => number = Math.random,
): T[] {
  if (items.length === 0) return [];
  const mixed = [...items];
  for (let i = mixed.length - 1; i > 0; i--) {
    const at = Math.floor(random() * (i + 1));
    [mixed[i], mixed[at]] = [mixed[at], mixed[i]];
  }
  return mixed.slice(0, Math.max(1, Math.round(items.length * (percent / 100))));
}
