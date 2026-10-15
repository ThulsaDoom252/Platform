import type { WordDeckSettings } from "./word-deck";

/** New class activities only; saved presets and the standalone studios keep their settings. */
export const CLASS_ACTIVITY_CARD_SECONDS = 15;
export const CLASS_ACTIVITY_WORD_DECK_DEFAULTS: Partial<WordDeckSettings> = {
  timerMode: "CARD",
  cardSeconds: CLASS_ACTIVITY_CARD_SECONDS,
  guessSeconds: CLASS_ACTIVITY_CARD_SECONDS,
  sentenceSeconds: CLASS_ACTIVITY_CARD_SECONDS,
  alternate: true,
  studentPercent: 70,
};
