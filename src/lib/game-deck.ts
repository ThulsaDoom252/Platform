/**
 * Колода для «Угадай по картинке».
 *
 * Порядок здесь — не мелочь: от него зависит, узнаёт ученик слово или
 * вспоминает, каким оно было по счёту в словнике. Поэтому перемешивание
 * живёт отдельным модулем и проверяется тестами, а не глазами на уроке.
 */

/** Что на лицевой стороне карты. */
export type CardFace = "PICTURE" | "TRANSLATION";

export type DeckCard = {
  phraseId: string;
  /** Из какого словника слово — по нему собирается порядок. */
  nodeId: string;
  word: string;
  translation: string | null;
  imageUrl: string;
  face: CardFace;
};

export type DeckOptions = {
  /** Перемешивать слова внутри словника. По умолчанию да. */
  shuffleWords: boolean;
  /**
   * Спрашивать каждое слово дважды — и картинкой, и переводом.
   *
   * Карты обеих сторон расходятся по колоде, а не идут парой.
   */
  mixFaces?: boolean;
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
 * Одно слово — две карты: картинка и перевод.
 *
 * Идут они не парой, а вразброс: если картинка и перевод одного слова
 * стоят подряд, вторая карта перестаёт быть проверкой — ответ только
 * что назвали вслух. Поэтому раскладываем обе стороны по всей колоде и
 * мешаем целиком.
 */
export function doubleFaces(cards: DeckCard[]): DeckCard[] {
  return cards.flatMap((card) => [
    { ...card, face: "PICTURE" as CardFace },
    { ...card, face: "TRANSLATION" as CardFace },
  ]);
}

/**
 * Развести одинаковые слова, оказавшиеся рядом.
 *
 * Случайный порядок сам по себе этого не даёт: из двадцати карт пара
 * регулярно встаёт подряд. А подряд — значит вторая карта ничего не
 * проверяет: ответ только что назвали вслух.
 *
 * Простого «бери первую неподходящую» мало: так обе карты одного слова
 * откладываются до конца и там всё равно встают рядом. Поэтому на
 * каждом шаге берём слово, которого осталось больше всего, — только это
 * гарантирует расстановку без соседей, когда она вообще возможна.
 *
 * Внутри равных берём то, что раньше легло при тасовании: порядок
 * остаётся случайным, поправляются только мешающие места.
 */
export function spreadDuplicates<T extends { phraseId: string }>(cards: T[]): T[] {
  const rest = cards.slice();
  const out: T[] = [];

  const left = new Map<string, number>();
  for (const card of rest) {
    left.set(card.phraseId, (left.get(card.phraseId) ?? 0) + 1);
  }

  while (rest.length > 0) {
    const last = out.at(-1);

    let at = -1;
    let best = -1;

    rest.forEach((card, i) => {
      if (last && card.phraseId === last.phraseId) return;
      const count = left.get(card.phraseId) ?? 0;
      if (count > best) {
        best = count;
        at = i;
      }
    });

    // Все оставшиеся — одно и то же слово: развести уже нечем.
    if (at < 0) at = 0;

    const [taken] = rest.splice(at, 1);
    left.set(taken.phraseId, (left.get(taken.phraseId) ?? 1) - 1);
    out.push(taken);
  }

  return out;
}

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
  const parts = sources.map((source) => {
    // Удваиваем до перемешивания: иначе обе стороны слова остались бы
    // рядом, и вторая карта ничего не проверяла бы.
    const cards = options.mixFaces ? doubleFaces(source.cards) : source.cards;
    return options.shuffleWords ? shuffle(cards, random) : cards.slice();
  });

  const all = parts.flat();
  const mixed = options.shuffleDecks ? shuffle(all, random) : all;

  // В смешанном режиме одно слово встречается дважды — следим, чтобы
  // обе его карты не встали подряд.
  return options.mixFaces ? spreadDuplicates(mixed) : mixed;
}

/** Есть ли ещё карта после текущей. */
export function hasNext(deck: unknown[], at: number): boolean {
  return at + 1 < deck.length;
}

export type Verdict = "right" | "wrong" | "timeout";

export type GameScore = { right: number; wrong: number; total: number };

/** Итог партии: то, что показывается в конце. */
export type GameStats = GameScore & {
  /** Сколько карт успели пройти — по ним и считается остальное. */
  answered: number;
  timeouts: number;
  /** Доля верных среди отвеченных, 0–100. Без ответов — ноль. */
  accuracy: number;
  /** Самый быстрый и самый долгий ответ в миллисекундах. */
  fastestMs: number | null;
  slowestMs: number | null;
  averageMs: number | null;
  /** На каких словах это вышло — сухое число ни о чём не говорит. */
  fastestWord: string | null;
  slowestWord: string | null;
};

/**
 * Итог партии по оценкам и затраченному времени.
 *
 * Время считается только по названным ответам: карта, которая
 * перевернулась сама, показывает не скорость ученика, а то, что учитель
 * не успел нажать. Брать её в «самый долгий ответ» — значит каждый раз
 * получать там один и тот же таймаут.
 */
export function statsOf(
  verdicts: (Verdict | null)[],
  timings: (number | null)[],
  words: string[] = [],
): GameStats {
  const score = scoreOf(verdicts);
  const answered = score.right + score.wrong;

  const spent: { ms: number; word: string | null }[] = [];
  verdicts.forEach((verdict, i) => {
    const ms = timings[i];
    if (verdict !== "right" && verdict !== "wrong") return;
    if (typeof ms !== "number" || ms <= 0) return;
    spent.push({ ms, word: words[i] ?? null });
  });

  const fastest = spent.reduce<(typeof spent)[number] | null>(
    (best, row) => (!best || row.ms < best.ms ? row : best),
    null,
  );
  const slowest = spent.reduce<(typeof spent)[number] | null>(
    (worst, row) => (!worst || row.ms > worst.ms ? row : worst),
    null,
  );

  return {
    ...score,
    answered,
    timeouts: verdicts.filter((v) => v === "timeout").length,
    accuracy: answered > 0 ? Math.round((score.right / answered) * 100) : 0,
    fastestMs: fastest?.ms ?? null,
    slowestMs: slowest?.ms ?? null,
    averageMs:
      spent.length > 0
        ? Math.round(spent.reduce((sum, row) => sum + row.ms, 0) / spent.length)
        : null,
    fastestWord: fastest?.word ?? null,
    slowestWord: slowest?.word ?? null,
  };
}

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
