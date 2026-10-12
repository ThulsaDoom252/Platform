import { DEFAULT_TIMER_SECONDS } from "./timer-settings";

export const TENSE_IDS = ["present-simple", "present-continuous", "present-perfect", "present-perfect-continuous", "past-simple", "past-continuous", "past-perfect", "past-perfect-continuous", "future-simple", "future-continuous", "future-perfect", "future-perfect-continuous"] as const;
export type TenseId = typeof TENSE_IDS[number];
export type CorrectionLocale = "en" | "ru" | "uk";

export const TENSE_NAMES: Record<TenseId, string> = {
  "present-simple": "Present Simple", "present-continuous": "Present Continuous",
  "present-perfect": "Present Perfect", "present-perfect-continuous": "Present Perfect Continuous",
  "past-simple": "Past Simple", "past-continuous": "Past Continuous",
  "past-perfect": "Past Perfect", "past-perfect-continuous": "Past Perfect Continuous",
  "future-simple": "Future Simple", "future-continuous": "Future Continuous",
  "future-perfect": "Future Perfect", "future-perfect-continuous": "Future Perfect Continuous",
};

const REASONS: Record<TenseId, [string, string, string]> = {
  "present-simple": ["A habit or general fact: use the present simple. With he/she/it, add -s/-es; negatives use does not + infinitive.", "Привычка или общий факт: Present Simple. С he/she/it добавляем -s/-es; отрицание: does not + инфинитив.", "Звичка або загальний факт: Present Simple. З he/she/it додаємо -s/-es; заперечення: does not + інфінітив."],
  "present-continuous": ["An action happening now or temporarily: am/is/are + verb-ing.", "Действие происходит сейчас или временно: am/is/are + глагол-ing.", "Дія відбувається зараз або тимчасово: am/is/are + дієслово-ing."],
  "present-perfect": ["A completed action with a present result, experience or an unfinished time period: have/has + past participle.", "Завершённое действие с результатом сейчас, опыт или незавершённый период: have/has + третья форма глагола.", "Завершена дія з результатом зараз, досвід або незавершений період: have/has + третя форма дієслова."],
  "present-perfect-continuous": ["Focus on an ongoing/recent process and its duration up to now: have/has been + verb-ing.", "Акцент на процессе и его длительности до настоящего момента: have/has been + глагол-ing.", "Акцент на процесі та його тривалості до теперішнього моменту: have/has been + дієслово-ing."],
  "past-simple": ["A finished action at a finished past time: past simple (verb-ed or the second form).", "Завершённое действие в закончившийся момент прошлого: Past Simple (глагол-ed или вторая форма).", "Завершена дія в минулому: Past Simple (дієслово-ed або друга форма)."],
  "past-continuous": ["An action in progress at a past moment, often interrupted by another event: was/were + verb-ing.", "Процесс в определённый момент прошлого, часто прерванный другим событием: was/were + глагол-ing.", "Процес у певний момент минулого, часто перерваний іншою подією: was/were + дієслово-ing."],
  "past-perfect": ["This action was already complete before another past event: had + past participle.", "Это действие уже завершилось до другого события в прошлом: had + третья форма глагола.", "Ця дія вже завершилася до іншої події в минулому: had + третя форма дієслова."],
  "past-perfect-continuous": ["Focus on how long a process had been continuing before a past event: had been + verb-ing.", "Акцент на длительности процесса до события в прошлом: had been + глагол-ing.", "Акцент на тривалості процесу до події в минулому: had been + дієслово-ing."],
  "future-simple": ["A prediction, promise or decision made now: will + infinitive.", "Предсказание, обещание или решение, принятое сейчас: will + инфинитив.", "Передбачення, обіцянка або рішення, ухвалене зараз: will + інфінітив."],
  "future-continuous": ["An action that will be in progress at a specific future time: will be + verb-ing.", "Процесс в определённый момент будущего: will be + глагол-ing.", "Процес у певний момент майбутнього: will be + дієслово-ing."],
  "future-perfect": ["An action that will be complete by a future deadline: will have + past participle.", "Действие завершится к указанному сроку в будущем: will have + третья форма глагола.", "Дія завершиться до вказаного терміну в майбутньому: will have + третя форма дієслова."],
  "future-perfect-continuous": ["Focus on the duration of a process up to a future point: will have been + verb-ing.", "Акцент на длительности процесса до момента в будущем: will have been + глагол-ing.", "Акцент на тривалості процесу до моменту в майбутньому: will have been + дієслово-ing."],
};

export type TenseCorrectionSettings = {
  tenses: TenseId[];
  counts: Record<TenseId, number>;
  correctCount: number;
  timerMode: "NONE" | "GAME" | "CARD";
  gameSeconds: number;
  cardSeconds: number;
};
export type TenseCorrectionCardInfo = {
  tenseId: TenseId;
  originallyCorrect: boolean;
  infinitive: string;
  answer: string;
  cue: string;
};

const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  value === undefined || value === null || !Number.isFinite(Number(value)) ? fallback : Math.min(max, Math.max(min, Math.round(Number(value))));

export function normalizeTenseCorrectionSettings(value?: Partial<TenseCorrectionSettings> | null): TenseCorrectionSettings {
  const tenses = Array.isArray(value?.tenses)
    ? TENSE_IDS.filter((id) => value.tenses!.includes(id)) : ["present-simple" as const];
  const counts = Object.fromEntries(TENSE_IDS.map((id) => [id, bounded(value?.counts?.[id], 1, 10, 4)])) as Record<TenseId, number>;
  const total = tenses.reduce((sum, id) => sum + counts[id], 0);
  return {
    tenses, counts, correctCount: bounded(value?.correctCount, 0, total, 0),
    timerMode: value?.timerMode === "GAME" || value?.timerMode === "CARD" ? value.timerMode : "NONE",
    gameSeconds: bounded(value?.gameSeconds, 0, 3600, DEFAULT_TIMER_SECONDS),
    cardSeconds: bounded(value?.cardSeconds, 0, 300, DEFAULT_TIMER_SECONDS),
  };
}

export function tenseCorrectionExplanation(info: TenseCorrectionCardInfo, locale: CorrectionLocale): string {
  return `${REASONS[info.tenseId][locale === "ru" ? 1 : locale === "uk" ? 2 : 0]} ${locale === "ru" ? "Контекст" : locale === "uk" ? "Контекст" : "Context"}: “${info.cue}”.`;
}
