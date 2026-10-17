import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWordDeck, normalizeWordDeckLiveState, normalizeWordDeckRatings, normalizeWordDeckSettings, shuffleWordDeckTail, wordDeckScores, type WordDeckLiveState } from "../src/lib/word-deck";
import { WORD_DECK_SKINS } from "../src/lib/word-deck-skins";

const cards = [{ phraseId: "a", word: "do the dishes" }, { phraseId: "b", word: "make the bed" }, { phraseId: "c", word: "take out the rubbish" }, { phraseId: "d", word: "mop the floor" }];
const settings = normalizeWordDeckSettings({ alternate: true, studentPercent: 50, repeats: 2, timerMode: "CARD", cardSeconds: 15 });
const deck = buildWordDeck(cards, settings, () => .5);
const state: WordDeckLiveState = { deck, at: deck.length - 1, faceUp: true, sound: false, time: 0, expired: true, readDescriptions: false, verdict: null, feedback: null, updatedAt: "2026-10-17T12:00:00Z" };

test("four themed skins pair distinct table, card front and back; old and custom backgrounds survive normalization", () => {
  for (const id of ["FOOD", "CHORES", "TALK", "WEATHER"] as const) {
    assert.equal(normalizeWordDeckSettings({ background: id }).background, id);
    const skin = WORD_DECK_SKINS[id];
    for (const field of ["background", "card", "back", "ink", "accent", "icon", "label"] as const) assert.ok(skin[field]);
  }
  assert.equal(new Set(["FOOD", "CHORES", "TALK", "WEATHER"].map(id => WORD_DECK_SKINS[id as "FOOD"].background)).size, 4);
  for (const background of ["MIDNIGHT", "EMERALD", "VIOLET", "SUNSET", "CUSTOM"] as const)
    assert.equal(normalizeWordDeckSettings({ background }).background, background);
  assert.equal(normalizeWordDeckSettings({ background: "unknown" as "FOOD" }).background, "MIDNIGHT");
});

test("thumbs score one or zero for the card owner; unrated cards never become wrong answers", () => {
  const student = deck.find(card => card.owner === "STUDENT")!;
  const teacher = deck.find(card => card.owner === "TEACHER")!;
  const result = wordDeckScores(deck, { [student.instanceId]: "RIGHT", [teacher.instanceId]: "WRONG" });
  assert.deepEqual(result, { STUDENT: { right: 1, wrong: 0, total: 4 }, TEACHER: { right: 0, wrong: 1, total: 4 } });
  assert.deepEqual(wordDeckScores(deck), { STUDENT: { right: 0, wrong: 0, total: 4 }, TEACHER: { right: 0, wrong: 0, total: 4 } });
});

test("changing a thumb replaces a rating and cannot count the same instance twice", () => {
  const card = deck[0];
  const ratings = { [card.instanceId]: "RIGHT" as const };
  assert.equal(wordDeckScores(deck, ratings)[card.owner!].right, 1);
  const corrected = { ...ratings, [card.instanceId]: "WRONG" as const };
  assert.equal(wordDeckScores(deck, corrected)[card.owner!].right, 0);
  assert.equal(wordDeckScores(deck, corrected)[card.owner!].wrong, 1);
  assert.equal(wordDeckScores(deck, { ...corrected, [card.instanceId]: "RIGHT" })[card.owner!].right, 1);
});

test("repeat instances count separately and shuffle never changes the total", () => {
  const copies = deck.filter(card => card.phraseId === "a");
  assert.equal(copies.length, 2);
  const ratings = Object.fromEntries(copies.map(card => [card.instanceId, "RIGHT" as const]));
  const totals = wordDeckScores(deck, ratings);
  assert.equal(totals.STUDENT.right + totals.TEACHER.right, 2);
  assert.deepEqual(wordDeckScores(shuffleWordDeckTail(deck, 1, () => 0), ratings), totals);
});

test("normalization drops forged IDs, invalid votes, arrays and inherited properties", () => {
  const id = deck[0].instanceId;
  assert.deepEqual(normalizeWordDeckRatings(deck, { [id]: "RIGHT", fake: "RIGHT", [deck[1].instanceId]: 999 }), { [id]: "RIGHT" });
  for (const input of [null, [], "RIGHT", 999, Object.create({ [id]: "RIGHT" })]) assert.deepEqual(normalizeWordDeckRatings(deck, input), {});
});

test("live ratings and early score visibility survive reload and previous-card navigation", () => {
  const ratings = { [deck[0].instanceId]: "WRONG" as const, [deck[7].instanceId]: "RIGHT" as const };
  const restored = normalizeWordDeckLiveState(cards, settings, { ...state, at: 0, ratings, showScores: true })!;
  assert.deepEqual(restored.ratings, ratings);
  assert.equal(restored.showScores, true);
  assert.deepEqual(wordDeckScores(restored.deck, restored.ratings), wordDeckScores(deck, ratings));
  const legacy = normalizeWordDeckLiveState(cards, settings, state)!;
  assert.deepEqual(legacy.ratings, {});
  assert.equal(legacy.showScores, false);
  const solo = normalizeWordDeckLiveState(cards, { ...settings, alternate: false }, { ...state, ratings, showScores: true })!;
  assert.deepEqual(solo.ratings, {});
  assert.equal(solo.showScores, false);
});

test("only teacher controls can rate; early overall grading is not gated behind completion", () => {
  const board = readFileSync("src/components/game/word-deck-board.tsx", "utf8");
  assert.ok(board.includes("const canRateCards = settings.alternate && (live || timerControls) && !observer && !homework"));
  assert.ok(board.includes("if (!canRateCards || !current) return"));
  assert.ok(board.includes("[current.instanceId]: next"));
  assert.ok(board.includes("setRatings(state.ratings ?? {})"));
  assert.ok(board.includes("ratings, showScores, readDescriptions"));
  assert.ok(board.includes("setRatings({})"));
  assert.ok(board.includes("!observer && reviewEditor &&"));
  assert.ok(!board.includes("finished && reviewEditor"));
  assert.ok(board.includes("rateCard(next)"));
  const action = readFileSync("src/lib/actions/word-deck.ts", "utf8");
  const save = action.slice(action.indexOf("export async function saveClassWordDeckLiveStateAction"), action.indexOf("export async function removeWordDeckFromClassAction"));
  assert.ok(save.includes("await requireTeacher()"));
  assert.ok(save.includes("normalizeWordDeckLiveState"));
});

test("timeout stamp has its own space, never changes the card side, respects reduced motion, and cannot block a click", () => {
  const board = readFileSync("src/components/game/word-deck-board.tsx", "utf8");
  const clock = board.slice(board.indexOf("if (!started || (combinedGame"), board.indexOf("if (!feedback) return"));
  assert.ok(!clock.includes("setFaceUp"));
  assert.ok(board.includes("data-word-deck-time-notice"));
  assert.ok(board.indexOf("data-word-deck-time-notice") < board.indexOf("word-deck-card word-deck-deal-in"));
  assert.match(board, /word-deck-time-stamp pointer-events-none/);
  assert.ok(board.includes("Time is up"));
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.ok(css.includes("@keyframes word-deck-time-stamp"));
  assert.ok(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")).includes(".word-deck-time-stamp"));
});
