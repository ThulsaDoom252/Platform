import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TENSE_CORRECTION_BANK } from "../src/lib/tense-correction-bank";
import { buildTenseCorrectionCards, tenseCorrectionWordDeckSettings } from "../src/lib/tense-correction";
import { normalizeTenseCorrectionSettings, TENSE_IDS, TENSE_NAMES, tenseCorrectionExplanation, type TenseId } from "../src/lib/tense-correction-settings";
import { buildWordDeck, canDealNextWordDeckCard, DEFAULT_WORD_DECK_SETTINGS, isWordDeckDescriptionGame, isWordDeckFinished, minimumWordDeckWords, normalizeWordDeckLiveState, normalizeWordDeckSettings, playableWordDeckCards, restartWordDeckTimer } from "../src/lib/word-deck";
import { groupTeacherHomeworkContent } from "../src/lib/teacher-homework-groups";
import { dictionaries } from "../src/lib/i18n";

function random(seed = 42) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

test("correction defaults: four sentences, zero completed forms and two-minute optional timers", () => {
  const settings = normalizeTenseCorrectionSettings();
  assert.deepEqual(settings.tenses, ["present-simple"]);
  assert.ok(TENSE_IDS.every((id) => settings.counts[id] === 4));
  assert.equal(settings.correctCount, 0);
  assert.equal(settings.timerMode, "NONE");
  assert.equal(settings.gameSeconds, 120);
  assert.equal(settings.cardSeconds, 120);
  assert.equal(buildTenseCorrectionCards({}).length, 4);
});

test("settings retain multiple tenses, deduplicate them, limit counts and clamp the exact correct count", () => {
  const defaults = normalizeTenseCorrectionSettings();
  const settings = normalizeTenseCorrectionSettings({ tenses: ["past-simple", "present-simple", "past-simple", "unknown" as TenseId], counts: { ...defaults.counts, "present-simple": 0, "past-simple": 100 }, correctCount: 500, timerMode: "CARD", cardSeconds: 0 });
  assert.deepEqual(settings.tenses, ["present-simple", "past-simple"]);
  assert.equal(settings.counts["present-simple"], 1);
  assert.equal(settings.counts["past-simple"], 10);
  assert.equal(settings.correctCount, 11);
  assert.equal(settings.cardSeconds, 0);
  assert.deepEqual(normalizeTenseCorrectionSettings({ tenses: [] }).tenses, []);
  assert.equal(buildTenseCorrectionCards({ tenses: [] }).length, 0);
  assert.equal(normalizeTenseCorrectionSettings({ correctCount: NaN, cardSeconds: NaN }).cardSeconds, 120);
});

test("all twelve tenses have ten distinct authored prompts with contextual clues and changed verb forms", () => {
  assert.equal(TENSE_IDS.length, 12);
  for (const tense of TENSE_IDS) {
    const bank = TENSE_CORRECTION_BANK[tense];
    assert.equal(bank.length, 10, tense);
    assert.equal(new Set(bank.map((row) => row[0])).size, 10, tense);
    for (const [sentence, infinitive, answer, clue] of bank) {
      assert.equal((sentence.match(/___/g) ?? []).length, 1);
      assert.ok(infinitive && answer && clue);
      assert.notEqual(infinitive, answer, "An infinitive card would already be correct");
      assert.ok(!sentence.replace("___", answer).includes("___"));
    }
  }
});

for (const tense of TENSE_IDS) {
  test(`${TENSE_NAMES[tense]}: generate 1–10 cards without duplicates or other tenses`, () => {
    const defaults = normalizeTenseCorrectionSettings();
    for (let count = 1; count <= 10; count++) {
      const cards = buildTenseCorrectionCards({ tenses: [tense], counts: { ...defaults.counts, [tense]: count } }, random(count));
      assert.equal(cards.length, count);
      assert.equal(new Set(cards.map((card) => card.phraseId)).size, count);
      assert.ok(cards.every((card) => card.correction?.tenseId === tense && card.description?.includes(`(${card.correction.infinitive})`)));
    }
  });
}

test("mixed deck has exact per-tense counts and exactly N initially correct sentences", () => {
  const defaults = normalizeTenseCorrectionSettings();
  const input = { tenses: ["present-simple", "past-simple", "future-perfect"] as TenseId[], counts: { ...defaults.counts, "present-simple": 1, "past-simple": 5, "future-perfect": 10 } };
  for (let correctCount = 0; correctCount <= 16; correctCount++) {
    const cards = buildTenseCorrectionCards({ ...input, correctCount }, random(correctCount));
    assert.equal(cards.length, 16);
    assert.equal(cards.filter((card) => card.correction!.originallyCorrect).length, correctCount);
    for (const tense of input.tenses) assert.equal(cards.filter((card) => card.correction!.tenseId === tense).length, input.counts[tense]);
    for (const card of cards) {
      const info = card.correction!;
      assert.ok(card.description!.includes(`(${info.originallyCorrect ? info.answer : info.infinitive})`));
      assert.ok(card.word.includes(info.answer));
      for (const locale of ["en", "ru", "uk"] as const) assert.ok(tenseCorrectionExplanation(info, locale).includes(info.cue));
    }
  }
});

test("all-tenses maximum has 120 unique sentences and genuinely mixed order", () => {
  const counts = Object.fromEntries(TENSE_IDS.map((id) => [id, 10])) as Record<TenseId, number>;
  const cards = buildTenseCorrectionCards({ tenses: [...TENSE_IDS], counts, correctCount: 63 }, random());
  assert.equal(cards.length, 120);
  assert.equal(new Set(cards.map((card) => card.phraseId)).size, 120);
  assert.equal(cards.filter((card) => card.correction!.originallyCorrect).length, 63);
  assert.ok(cards.slice(0, 10).some((card) => card.correction!.tenseId !== cards[0].correction!.tenseId));
  assert.deepEqual(cards, buildTenseCorrectionCards({ tenses: [...TENSE_IDS], counts, correctCount: 63 }, random()));
});

test("native snapshots keep new settings, minimum one sentence and immutable canonical explanations", () => {
  const settings = tenseCorrectionWordDeckSettings({ tenses: ["past-simple"], counts: { ...normalizeTenseCorrectionSettings().counts, "past-simple": 1 }, correctCount: 1, timerMode: "CARD", cardSeconds: 25 }, DEFAULT_WORD_DECK_SETTINGS);
  assert.equal(settings.gameType, "TENSE_CORRECTION");
  assert.equal(minimumWordDeckWords(settings), 1);
  assert.ok(isWordDeckDescriptionGame(settings.gameType));
  assert.deepEqual(normalizeWordDeckSettings(settings).correction, settings.correction);
  assert.equal(normalizeWordDeckSettings({ ...settings, repeats: 20, alternate: true }).repeats, 1);
  const source = buildTenseCorrectionCards(settings.correction!, random());
  assert.equal(playableWordDeckCards(source, settings).length, 1);
  const deck = buildWordDeck(source, settings, random());
  const fake = { ...deck[0], word: "FORGED", correction: { ...deck[0].correction!, tenseId: "future-simple" as const, answer: "FORGED", originallyCorrect: false } };
  const state = normalizeWordDeckLiveState(source, settings, { deck: [fake], at: 0, faceUp: false, time: 99 });
  assert.ok(state);
  assert.equal(state.deck[0].word, source[0].word);
  assert.deepEqual(state.deck[0].correction, source[0].correction);
  assert.equal(state.time, 25);
  assert.equal(isWordDeckFinished(state, settings), false);
  assert.equal(isWordDeckFinished({ ...state, faceUp: true }, settings), true);
  assert.equal(restartWordDeckTimer(state, settings).time, 25);
});

test("timeout does not hide or block sentences and observer cannot advance", () => {
  assert.ok(canDealNextWordDeckCard({ cardCount: 4, at: 0, expired: true, observer: false, gameType: "TENSE_CORRECTION" }));
  assert.equal(canDealNextWordDeckCard({ cardCount: 4, at: 0, expired: true, observer: true, gameType: "TENSE_CORRECTION" }), false);
  const settings = tenseCorrectionWordDeckSettings({ timerMode: "GAME", gameSeconds: 88, cardSeconds: 2 }, DEFAULT_WORD_DECK_SETTINGS);
  assert.equal(restartWordDeckTimer({ feedback: "TIME_UP" as const }, settings).time, 88);
});

test("class and homework integration uses the new game and preserves the existing editor", () => {
  const picker = readFileSync("src/components/class/class-activity-picker.tsx", "utf8");
  const page = readFileSync("src/app/teacher/activities/page.tsx", "utf8");
  const editor = readFileSync("src/components/game/word-deck-studio.tsx", "utf8");
  const backend = readFileSync("src/lib/actions/word-deck.ts", "utf8");
  const board = readFileSync("src/components/game/word-deck-board.tsx", "utf8");
  for (const source of [picker, page, editor]) assert.ok(source.includes("TenseCorrection") && source.includes("TENSE_CORRECTION"));
  assert.ok(backend.includes("cards: buildTenseCorrectionCards(settings.correction)"), "The server must generate its own answers");
  assert.match(board, /correctionGame && faceUp && current\?\.correction/);
  assert.ok(board.includes("!correctionGame && !combinedGame && feedback"), "No answer-blocking verdict overlay");
  assert.ok(board.includes("correctionGame && settings.timerMode === \"CARD\") setTimerPaused(true)"));
  assert.ok(board.includes("!observer && descriptionGame && started && !faceUp && (correctionGame"));
  const groups = groupTeacherHomeworkContent([{ id: "correction", kind: "ACTIVITY" as const, activityType: "TENSE_CORRECTION", assignedAt: "2026-10-12T12:00:00Z" }]);
  assert.equal(groups[0].activityGroups[0].type, "TENSE_CORRECTION");
  for (const locale of ["en", "ru", "uk"] as const) assert.deepEqual(Object.keys(dictionaries[locale].tenseCorrection), Object.keys(dictionaries.en.tenseCorrection));
});
