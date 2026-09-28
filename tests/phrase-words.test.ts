import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTranscription, wordCount } from "../src/lib/phrase-words";

test("одно слово — транскрипция показывается", () => {
  for (const word of ["fork", "umbrella", "sneeze", "Weather"]) {
    assert.equal(hasTranscription(word), true, word);
  }
});

test("артикль слово не удваивает", () => {
  assert.equal(wordCount("a fork"), 1);
  assert.equal(wordCount("an umbrella"), 1);
  assert.equal(wordCount("the weather"), 1);
  // Артикль снимается, значит остаётся одно слово — транскрипция нужна.
  assert.equal(hasTranscription("a piece"), true);
  assert.equal(hasTranscription("an umbrella"), true);
  assert.equal(hasTranscription("a piece of cake"), false);
});

test("дефис и апостроф слово не разрывают", () => {
  assert.equal(wordCount("well-known"), 1);
  assert.equal(wordCount("don't"), 1);
  assert.equal(wordCount("mother-in-law"), 1);
  assert.equal(hasTranscription("well-known"), true);
});

test("пояснение в скобках частью выражения не считается", () => {
  assert.equal(wordCount("side (of the road)"), 1);
  assert.equal(hasTranscription("fork (cutlery)"), true);
});

test("инфинитивное to слова не удваивает", () => {
  // «to fade» в словнике — это глагол fade, а не выражение из двух слов.
  assert.equal(wordCount("to fade"), 1);
  assert.equal(hasTranscription("to overturn"), true);
  assert.equal(hasTranscription("to give up"), false);
});

test("вариант через слеш — то же слово", () => {
  assert.equal(wordCount("weed / weeds"), 1);
  assert.equal(hasTranscription("close-knit / tight-knit"), true);
});

test("выражению транскрипция не нужна", () => {
  for (const phrase of [
    "a piece of cake",
    "in front of",
    "to give up",
    "on the left",
    "take care of sth",
    "to look forward",
  ]) {
    assert.equal(hasTranscription(phrase), false, phrase);
  }
});

test("пустая запись транскрипции не получает", () => {
  assert.equal(hasTranscription(""), false);
  assert.equal(hasTranscription("   "), false);
  assert.equal(hasTranscription("—"), false);
  assert.equal(wordCount(""), 0);
});

test("знаки препинания слов не добавляют", () => {
  assert.equal(wordCount("fork!"), 1);
  assert.equal(wordCount("fork, spoon"), 2);
  assert.equal(wordCount("«fork»"), 1);
});
