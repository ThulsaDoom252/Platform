import assert from "node:assert/strict";
import test from "node:test";
import { buildWordDeck, normalizeWordDeckLiveState, remainingWordDeckSeconds, restartWordDeckTimer, wordDeckTimerPaused, type WordDeckLiveState } from "../src/lib/word-deck";

const state: WordDeckLiveState = { deck: [], at: 0, faceUp: false, sound: false, time: 10, expired: false, readDescriptions: false, verdict: null, feedback: null, updatedAt: "2026-10-07T10:00:00Z" };
const now = Date.parse("2026-10-07T10:00:03.900Z");
test("shared timers advance from the saved anchor without new writes", () => {
  assert.equal(remainingWordDeckSeconds(state, { timerMode: "CARD" }, now), 7);
  assert.equal(remainingWordDeckSeconds(state, { timerMode: "GAME" }, now + 20_000), 0);
});
test("disabled, unstarted and answered card timers do not advance", () => {
  assert.equal(remainingWordDeckSeconds(state, { timerMode: "NONE" }, now), 10);
  assert.equal(remainingWordDeckSeconds({ ...state, at: -1 }, { timerMode: "CARD" }, now), 10);
  assert.equal(remainingWordDeckSeconds({ ...state, verdict: "RIGHT" }, { timerMode: "CARD" }, now), 10);
});
test("the clock tolerates malformed timestamps and future anchors", () => {
  assert.equal(remainingWordDeckSeconds({ ...state, updatedAt: "bad" }, { timerMode: "CARD" }, now), 10);
  assert.equal(remainingWordDeckSeconds(state, { timerMode: "CARD" }, now - 10_000), 10);
});
test("pausing freezes both card and game clocks regardless of elapsed wall time", () => {
  for (const timerMode of ["CARD", "GAME"] as const)
    assert.equal(remainingWordDeckSeconds({ ...state, timerPaused: true }, { timerMode }, now + 3600_000), 10);
});
test("resuming uses a fresh anchor and can explicitly restart an answered card's timer", () => {
  const resumed = { ...state, verdict: "RIGHT" as const, timerPaused: false, updatedAt: new Date(now).toISOString() };
  assert.equal(remainingWordDeckSeconds(resumed, { timerMode: "CARD" }, now + 2000), 8);
});
test("restart restores the configured duration without changing the card, side or judgement", () => {
  const expired = { ...state, at: 3, faceUp: true, verdict: "RIGHT" as const, expired: true, time: 0, timerPaused: true, feedback: "TIME_UP" as const };
  for (const timerMode of ["CARD", "GAME"] as const) {
    const result = restartWordDeckTimer(expired, { timerMode, cardSeconds: 12, gameSeconds: 90 }, now);
    assert.equal(result.time, timerMode === "CARD" ? 12 : 90);
    assert.equal(result.expired, false);
    assert.equal(result.timerPaused, false);
    assert.equal(result.feedback, null);
    assert.equal(result.at, 3);
    assert.equal(result.faceUp, true);
    assert.equal(result.verdict, "RIGHT");
    assert.equal(result.deck, expired.deck);
    assert.equal(result.updatedAt, new Date(now).toISOString());
  }
  assert.equal(expired.time, 0);
});
test("legacy saved answers stay paused, while malformed pause flags are not trusted", () => {
  const cards = [{ phraseId: "word", word: "full phrase" }];
  const deck = buildWordDeck(cards, { repeats: 1 });
  const legacy = normalizeWordDeckLiveState(cards, { repeats: 1, timerMode: "CARD" }, { ...state, deck, verdict: "RIGHT" });
  assert.equal(legacy?.timerPaused, true);
  assert.equal(wordDeckTimerPaused({ verdict: "RIGHT" }, { timerMode: "CARD" }), true);
  const current = normalizeWordDeckLiveState(cards, { repeats: 1, timerMode: "CARD" }, { ...legacy!, timerPaused: false });
  assert.equal(current?.timerPaused, false);
  const invalid = normalizeWordDeckLiveState(cards, { repeats: 1, timerMode: "CARD" }, { ...state, deck, timerPaused: "true" as unknown as boolean });
  assert.equal(invalid?.timerPaused, false);
});
