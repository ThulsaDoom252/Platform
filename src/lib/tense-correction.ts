import type { WordDeckSettings, WordDeckSourceCard } from "./word-deck";
import { TENSE_CORRECTION_BANK } from "./tense-correction-bank";
import { normalizeTenseCorrectionSettings, TENSE_NAMES, type TenseCorrectionSettings } from "./tense-correction-settings";

function mix<T>(values: readonly T[], random: () => number) {
  const copy = [...values];
  for (let at = copy.length - 1; at > 0; at--) {
    const next = Math.min(at, Math.max(0, Math.floor(random() * (at + 1))));
    [copy[at], copy[next]] = [copy[next], copy[at]];
  }
  return copy;
}

/** All answers are built on the server, never accepted from submitted card data. */
export function buildTenseCorrectionCards(input: Partial<TenseCorrectionSettings>, random: () => number = Math.random): WordDeckSourceCard[] {
  const settings = normalizeTenseCorrectionSettings(input);
  const selected = settings.tenses.flatMap((tenseId) => mix(TENSE_CORRECTION_BANK[tenseId].map((row, index) => ({ row, index, tenseId })), random).slice(0, settings.counts[tenseId]));
  const correct = new Set(mix(selected, random).slice(0, settings.correctCount));
  return mix(selected.map(({ row: [sentence, infinitive, answer, cue], index, tenseId }, at) => {
    const originallyCorrect = correct.has(selected[at]);
    return {
      phraseId: `tense-correction:${tenseId}:${index}`,
      word: sentence.replace("___", answer),
      description: sentence.replace("___", `(${originallyCorrect ? answer : infinitive})`),
      icon: null,
      vocabName: TENSE_NAMES[tenseId],
      correction: { tenseId, originallyCorrect, infinitive, answer, cue },
    };
  }), random);
}

export function tenseCorrectionWordDeckSettings(input: Partial<TenseCorrectionSettings>, base: WordDeckSettings): WordDeckSettings {
  const correction = normalizeTenseCorrectionSettings(input);
  return { ...base, gameType: "TENSE_CORRECTION", timerMode: correction.timerMode, cardSeconds: correction.cardSeconds, gameSeconds: correction.gameSeconds, repeats: 1, alternate: false, descriptionIcons: false, answerIcons: false, correction };
}
