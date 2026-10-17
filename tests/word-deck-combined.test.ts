import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildWordDeck, canDealNextWordDeckCard, isWordDeckDescriptionGame, isWordDeckFinished, normalizeWordDeckLiveState,
  normalizeWordDeckSettings, playableWordDeckCards, remainingWordDeckSeconds,
  restartWordDeckTimer, startWordDeckSentence, type WordDeckLiveState, wordDeckTimerSeconds,
} from "../src/lib/word-deck";

const cards = [
  { phraseId: "1", word: "do the dishes", description: "Clean plates after dinner" },
  { phraseId: "2", word: "take out the rubbish", description: "Move household waste outside" },
];
const settings = normalizeWordDeckSettings({ gameType: "DESCRIPTION_SENTENCE", timerMode: "CARD", cardSeconds: 20, guessSeconds: 8, sentenceSeconds: 35 });
const now = Date.parse("2026-10-12T12:00:00.000Z");
const state: WordDeckLiveState = {
  deck: buildWordDeck(cards, settings, () => 0.5), at: 0, faceUp: false, phase: "GUESS",
  sound: false, time: 0, expired: true, timerPaused: true, readDescriptions: false,
  verdict: "WRONG", feedback: "TIME_UP", updatedAt: new Date(now - 10_000).toISOString(),
};

test("combined mode inherits the existing card duration for both stages", () => {
  const defaults = normalizeWordDeckSettings({ gameType: "DESCRIPTION_SENTENCE", cardSeconds: 27 });
  assert.equal(defaults.gameType, "DESCRIPTION_SENTENCE");
  assert.equal(defaults.guessSeconds, 27);
  assert.equal(defaults.sentenceSeconds, 27);
  assert.equal(normalizeWordDeckSettings({}).guessSeconds, 120);
  assert.equal(normalizeWordDeckSettings({}).sentenceSeconds, 120);
});

test("each stage can be configured independently and is safely bounded", () => {
  assert.equal(wordDeckTimerSeconds(settings, "GUESS"), 8);
  assert.equal(wordDeckTimerSeconds(settings, "SENTENCE"), 35);
  const bounded = normalizeWordDeckSettings({ gameType: "DESCRIPTION_SENTENCE", guessSeconds: -1, sentenceSeconds: 900 });
  assert.equal(bounded.guessSeconds, 0);
  assert.equal(bounded.sentenceSeconds, 300);
  const fallback = normalizeWordDeckSettings({ cardSeconds: 23, guessSeconds: Number.NaN, sentenceSeconds: Number.POSITIVE_INFINITY });
  assert.equal(fallback.guessSeconds, 23);
  assert.equal(fallback.sentenceSeconds, 23);
});

test("description + sentence excludes cards without a usable description", () => {
  assert.equal(isWordDeckDescriptionGame(settings.gameType), true);
  assert.deepEqual(playableWordDeckCards([...cards, { phraseId: "3", word: "no description", description: " " }], settings), cards);
});

test("a reveal starts the sentence clock from its full duration, even after timeout or a wrong guess", () => {
  const next = startWordDeckSentence(state, settings, now);
  assert.equal(next.phase, "SENTENCE");
  assert.equal(next.faceUp, true);
  assert.equal(next.time, 35);
  assert.equal(next.expired, false);
  assert.equal(next.timerPaused, false);
  assert.equal(next.feedback, null);
  assert.equal(next.verdict, "WRONG");
  assert.equal(next.at, state.at);
  assert.equal(next.deck, state.deck);
  assert.equal(state.phase, "GUESS");
  assert.equal(remainingWordDeckSeconds(next, settings, now + 3_000), 32);
});

test("whole-game time is not replenished at a phase transition and untimed mode stays untimed", () => {
  for (const timerMode of ["GAME", "NONE"] as const) {
    const next = startWordDeckSentence({ ...state, time: 15, expired: false, timerPaused: false }, { ...settings, timerMode }, now);
    assert.equal(next.time, 15);
    assert.equal(next.expired, false);
    assert.equal(next.phase, "SENTENCE");
  }
});

test("restart uses the current stage's duration and keeps the phrase and phase", () => {
  for (const phase of ["GUESS", "SENTENCE"] as const) {
    const next = restartWordDeckTimer({ ...state, phase }, settings, now);
    assert.equal(next.time, phase === "GUESS" ? 8 : 35);
    assert.equal(next.phase, phase);
    assert.equal(next.at, state.at);
    assert.equal(next.deck, state.deck);
    assert.equal(next.timerPaused, false);
  }
});

test("saved and shared sentence snapshots retain their stage and full timer range", () => {
  const next = startWordDeckSentence(state, settings, now);
  const saved = normalizeWordDeckLiveState(cards, settings, next)!;
  assert.equal(saved.phase, "SENTENCE");
  assert.equal(saved.time, 35);
  assert.equal(saved.faceUp, true);
  assert.equal(saved.timerPaused, false);
  assert.equal(remainingWordDeckSeconds(saved, settings, now + 2_000), 33);
  const legacy = normalizeWordDeckLiveState(cards, settings, { ...next, phase: undefined, timerPaused: undefined })!;
  assert.equal(legacy.phase, "SENTENCE");
  assert.equal(legacy.timerPaused, false);
});

test("malformed phase data cannot reveal answers or prematurely complete a deck", () => {
  const forged = normalizeWordDeckLiveState(cards, settings, { ...state, phase: "COMPLETE" })!;
  assert.equal(forged.phase, "GUESS");
  assert.equal(isWordDeckFinished(forged, settings), false);
  const early = normalizeWordDeckLiveState(cards, settings, { ...state, faceUp: true, phase: "COMPLETE" })!;
  assert.equal(early.phase, "SENTENCE");
  const invalid = normalizeWordDeckLiveState(cards, settings, { ...state, faceUp: true, phase: "anything" as "GUESS", time: 99 })!;
  assert.equal(invalid.phase, "SENTENCE");
  assert.equal(invalid.time, 35);
});

test("the last phrase is not complete until its sentence is explicitly finished", () => {
  const last = { ...state, at: 1 };
  assert.equal(isWordDeckFinished(last, settings), false);
  assert.equal(isWordDeckFinished({ ...last, faceUp: true, phase: "SENTENCE" }, settings), false);
  const timedOutSentence = { ...last, faceUp: true, phase: "SENTENCE" as const, expired: true };
  assert.equal(isWordDeckFinished(timedOutSentence, settings), false);
  const complete = normalizeWordDeckLiveState(cards, settings, { ...last, faceUp: true, phase: "COMPLETE", timerPaused: false })!;
  assert.equal(isWordDeckFinished(complete, settings), true);
  assert.equal(complete.timerPaused, true);
  assert.equal(isWordDeckFinished({ deck: [], at: -1, faceUp: false }, settings), false);
});

test("combined mode cannot skip the guess phase, including after timeout", () => {
  const card = { cardCount: 4, at: 1, expired: true, observer: false, gameType: "DESCRIPTION_SENTENCE" as const };
  assert.equal(canDealNextWordDeckCard({ ...card, at: -1 }), true);
  assert.equal(canDealNextWordDeckCard({ ...card, phase: "GUESS" }), false);
  assert.equal(canDealNextWordDeckCard({ ...card, phase: "SENTENCE" }), true);
  assert.equal(canDealNextWordDeckCard({ ...card, phase: "SENTENCE", observer: true }), false);
  assert.equal(canDealNextWordDeckCard({ ...card, phase: "SENTENCE", at: 3 }), false);
});

test("existing words, description, picture and spelling completion rules remain unchanged", () => {
  for (const gameType of ["WORDS", "SPELLING"] as const)
    assert.equal(isWordDeckFinished({ ...state, at: 1 }, { gameType }), true);
  for (const gameType of ["GUESS_DESCRIPTION", "GUESS_PICTURE"] as const) {
    assert.equal(isWordDeckFinished({ ...state, at: 1 }, { gameType }), false);
    assert.equal(isWordDeckFinished({ ...state, at: 1, faceUp: true }, { gameType }), true);
  }
});

test("UI and homework use the shared completion logic, and live updates include phase changes", () => {
  const board = readFileSync("src/components/game/word-deck-board.tsx", "utf8");
  const action = readFileSync("src/lib/actions/word-deck.ts", "utf8");
  const form = readFileSync("src/components/game/word-deck-studio.tsx", "utf8");
  assert.ok(board.includes("isWordDeckFinished({ deck, at, faceUp, phase }, settings)"));
  assert.ok(action.includes("const finished = isWordDeckFinished(state, settings)"));
  assert.ok(board.includes('setPhase(state.phase ?? "GUESS")'));
  assert.ok(board.includes("observer, phase, ratings, showScores, readDescriptions"));
  assert.ok(board.includes("startWordDeckSentence({ time, expired, timerPaused, feedback }, settings)"));
  assert.ok(board.includes("!combinedGame && feedback"));
  assert.ok(form.includes('["guessSeconds", t.wordDeck.guessSeconds]'));
  assert.ok(form.includes('["sentenceSeconds", t.wordDeck.sentenceSeconds]'));
});
