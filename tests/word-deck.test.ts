import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWordDeck,
  hasEnoughWordDeckWords,
  normalizeWordDeckSettings,
  randomWordDeckPercentage,
  shuffleWordDeckTail,
  suggestedWordDeckTitle,
} from "../src/lib/word-deck";

const words = [
  { phraseId: "a", word: "alpha" },
  { phraseId: "b", word: "bravo" },
  { phraseId: "c", word: "charlie" },
];

test("число карт равно числу слов, умноженному на повторы", () => {
  assert.equal(buildWordDeck(words, { repeats: 4 }, () => 0.5).length, 12);
});

test("без альтернативного режима роли не назначаются", () => {
  assert.ok(buildWordDeck(words, { repeats: 2 }, () => 0.5).every((card) => card.owner === null));
});

test("процент ученика распределяется точно по всей колоде", () => {
  const deck = buildWordDeck(words, { repeats: 4, alternate: true, studentPercent: 75 }, () => 0.5);
  assert.equal(deck.filter((card) => card.owner === "STUDENT").length, 9);
  assert.equal(deck.filter((card) => card.owner === "TEACHER").length, 3);
});

test("таймеры по умолчанию выключены, значения готовы заранее", () => {
  assert.deepEqual(normalizeWordDeckSettings({}), {
    timerMode: "NONE",
    gameSeconds: 120,
    cardSeconds: 10,
    repeats: 1,
    alternate: false,
    studentPercent: 50,
    sound: true,
    showIcons: false,
    background: "MIDNIGHT",
  });
});

test("иконки на карточках включаются только явно", () => {
  assert.equal(normalizeWordDeckSettings({}).showIcons, false);
  assert.equal(normalizeWordDeckSettings({ showIcons: true }).showIcons, true);
});

test("перемешивание хвоста не трогает уже сданные карты", () => {
  const got = shuffleWordDeckTail([1, 2, 3, 4], 2, () => 0);
  assert.deepEqual(got.slice(0, 2), [1, 2]);
  assert.deepEqual(got.slice(2), [4, 3]);
});

test("в колоде должно быть минимум четыре выбранных слова", () => {
  assert.equal(hasEnoughWordDeckWords(3), false);
  assert.equal(hasEnoughWordDeckWords(4), true);
});

test("название новой игры берётся из одного словника или становится Mix", () => {
  assert.equal(suggestedWordDeckTitle([]), "");
  assert.equal(suggestedWordDeckTitle(["Exploration"]), "Exploration");
  assert.equal(suggestedWordDeckTitle(["Exploration", "Travel"]), "Mix");
});

test("быстрый процент выбирает нужную случайную долю слов", () => {
  const twelve = Array.from({ length: 12 }, (_, index) => index + 1);
  assert.equal(randomWordDeckPercentage(twelve, 25, () => 0.5).length, 3);
  assert.equal(randomWordDeckPercentage(twelve, 50, () => 0.5).length, 6);
  assert.equal(randomWordDeckPercentage(twelve, 75, () => 0.5).length, 9);
  assert.equal(randomWordDeckPercentage([1], 25, () => 0.5).length, 1);
});
