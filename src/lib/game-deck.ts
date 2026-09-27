/**
 * Колода для «Угадай по картинке».
 *
 * Порядок здесь — не мелочь: от него зависит, узнаёт ученик слово или
 * вспоминает, каким оно было по счёту в словнике. Поэтому перемешивание
 * живёт отдельным модулем и проверяется тестами, а не глазами на уроке.
 */

export type DeckCard = {
  phraseId: string;
  /** Из какого словника слово — по нему собирается порядок. */
  nodeId: string;
  word: string;
  translation: string | null;
  imageUrl: string;
};

export type DeckOptions = {
  /** Перемешивать слова внутри словника. По умолчанию да. */
  shuffleWords: boolean;
  /**
   * Перемешивать словники между собой.
   *
   * Выключено — сначала все слова первого словника, потом второго.
   * Включено — карточки из разных словников идут вперемешку.
   */
  shuffleDecks: boolean;
};

/** Порядок словников, как их выбрал учитель. */
export type DeckSource = { nodeId: string; cards: DeckCard[] };

/**
 * Тасование Фишера — Йетса с передаваемым генератором.
 *
 * Генератор снаружи, чтобы тест получал предсказуемый порядок: иначе
 * проверить перемешивание нечем.
 */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/**
 * Собирает колоду из выбранных словников.
 *
 * Словники идут в том порядке, в каком их выбрали; перемешивание между
 * ними — отдельная настройка, потому что «вперемешку внутри словника» и
 * «вперемешку между словниками» на уроке нужны по отдельности.
 */
export function buildDeck(
  sources: DeckSource[],
  options: DeckOptions,
  random: () => number = Math.random,
): DeckCard[] {
  const parts = sources.map((source) =>
    options.shuffleWords ? shuffle(source.cards, random) : source.cards.slice(),
  );

  const all = parts.flat();
  return options.shuffleDecks ? shuffle(all, random) : all;
}

/** Есть ли ещё карта после текущей. */
export function hasNext(deck: unknown[], at: number): boolean {
  return at + 1 < deck.length;
}

export type Verdict = "right" | "wrong" | "timeout";

export type GameScore = { right: number; wrong: number; total: number };

/**
 * Счёт по проставленным оценкам.
 *
 * Истёкший таймер — не ошибка ученика и не правильный ответ: карта
 * просто перевернулась сама. Считаем его отдельно, чтобы «5 из 10» не
 * превращалось в приговор за то, что учитель не успел нажать.
 */
export function scoreOf(verdicts: (Verdict | null)[]): GameScore {
  return {
    right: verdicts.filter((v) => v === "right").length,
    wrong: verdicts.filter((v) => v === "wrong").length,
    total: verdicts.length,
  };
}
