import assert from "node:assert/strict";
import test from "node:test";
import { remainingWordDeckSeconds, type WordDeckLiveState } from "../src/lib/word-deck";

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
