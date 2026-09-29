/**
 * Итог повторения слов.
 *
 * Учителю нужен не счёт, а разбор: где сыпется, сколько на это ушло,
 * что далось легче всего. Поэтому считается по секциям, а не одним
 * числом.
 *
 * Время берётся только с отвеченного: на карточках ученик ничего не
 * решает, а истёкший срок показывает длину таймера, а не скорость.
 */
import { isTestMode, type RevisionMode } from "./revision-modes";

/** Почему ответ засчитан неверным. */
export type WrongReason = "wrong" | "timeout";

export type RevisionAnswer = {
  mode: RevisionMode;
  phraseId: string;
  word: string;
  correct: boolean;
  /** Проставляется только у неверных. */
  reason?: WrongReason;
  /** Сколько миллисекунд ушло на ответ. */
  ms: number;
  /**
   * С какой попытки ответили, если режим их даёт.
   *
   * На точность не влияет — она считается по первой попытке. Нужно
   * учителю: угаданное со второго раза и угаданное сразу — разные вещи.
   */
  tries?: number;
};

export type SectionResult = {
  mode: RevisionMode;
  total: number;
  right: number;
  wrong: number;
  timeouts: number;
  /** Доля верных, 0–100. */
  accuracy: number;
  /** Сколько ушло на всю секцию. */
  ms: number;
};

export type RevisionResult = {
  sections: SectionResult[];
  total: number;
  right: number;
  wrong: number;
  timeouts: number;
  accuracy: number;
  /** Всё время задания, включая карточки. */
  totalMs: number;
  fastestMs: number | null;
  fastestWord: string | null;
  slowestMs: number | null;
  slowestWord: string | null;
  /** Лучшая и худшая секции. Пусто, когда сравнивать не с чем. */
  best: RevisionMode | null;
  worst: RevisionMode | null;
};

/**
 * Разбор попытки.
 *
 * Секции идут в том порядке, в каком их проходили: учителю важно, что
 * было раньше, а что под конец, когда ученик устал.
 */
export function scoreRevision(answers: RevisionAnswer[]): RevisionResult {
  const order: RevisionMode[] = [];
  const grouped = new Map<RevisionMode, RevisionAnswer[]>();

  for (const answer of answers) {
    if (!grouped.has(answer.mode)) {
      grouped.set(answer.mode, []);
      order.push(answer.mode);
    }
    grouped.get(answer.mode)!.push(answer);
  }

  const sections: SectionResult[] = order.map((mode) => {
    const list = grouped.get(mode)!;
    const right = list.filter((a) => a.correct).length;
    const timeouts = list.filter((a) => a.reason === "timeout").length;

    return {
      mode,
      total: list.length,
      right,
      wrong: list.length - right,
      timeouts,
      accuracy: list.length > 0 ? Math.round((right / list.length) * 100) : 0,
      ms: list.reduce((sum, a) => sum + Math.max(0, a.ms), 0),
    };
  });

  // Итог считаем по проверочным: карточки ничего не спрашивают, и
  // включать их в точность значило бы всегда завышать её.
  const tested = answers.filter((a) => isTestMode(a.mode));
  const right = tested.filter((a) => a.correct).length;

  /*
   * Самый быстрый и самый медленный — среди верных ответов. У неверного
   * время говорит не о знании, а о том, сколько ученик колебался, и
   * истёкший таймер всегда оказывался бы «самым медленным».
   */
  const timed = tested.filter((a) => a.correct && a.ms > 0);
  const fastest = timed.reduce<RevisionAnswer | null>(
    (best, a) => (!best || a.ms < best.ms ? a : best),
    null,
  );
  const slowest = timed.reduce<RevisionAnswer | null>(
    (worst, a) => (!worst || a.ms > worst.ms ? a : worst),
    null,
  );

  // Сравниваем только проверочные секции, где был хоть один ответ.
  const comparable = sections.filter((s) => isTestMode(s.mode) && s.total > 0);
  const byAccuracy = [...comparable].sort(
    (a, b) => b.accuracy - a.accuracy || a.ms - b.ms,
  );

  return {
    sections,
    total: tested.length,
    right,
    wrong: tested.length - right,
    timeouts: tested.filter((a) => a.reason === "timeout").length,
    accuracy: tested.length > 0 ? Math.round((right / tested.length) * 100) : 0,
    totalMs: answers.reduce((sum, a) => sum + Math.max(0, a.ms), 0),
    fastestMs: fastest?.ms ?? null,
    fastestWord: fastest?.word ?? null,
    slowestMs: slowest?.ms ?? null,
    slowestWord: slowest?.word ?? null,
    // Одна секция сама себе и лучшая и худшая — сравнения тут нет.
    best: comparable.length > 1 ? byAccuracy[0].mode : null,
    worst: comparable.length > 1 ? byAccuracy[byAccuracy.length - 1].mode : null,
  };
}
