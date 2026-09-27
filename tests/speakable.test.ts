import { test } from "node:test";
import assert from "node:assert/strict";
import { speakable } from "../src/lib/speakable";

test("обороты из нескольких слов озвучиваются", () => {
  // Ровно эти предлоги оставались немыми, пока кнопка ждала одно слово.
  for (const phrase of [
    "in front of",
    "next to",
    "on the left (side)",
    "on the right (side)",
    "behind",
    "opposite",
    "between",
  ]) {
    assert.equal(speakable(phrase), phrase, phrase);
  }
});

test("целое предложение тоже озвучивается", () => {
  const sentence = "The café is between the bank and the shop.";
  assert.equal(speakable(sentence), sentence);
});

test("перевод не озвучивается", () => {
  for (const text of ["перед, попереду", "навпроти, через дорогу", "під"]) {
    assert.equal(speakable(text), null, text);
  }
});

test("транскрипция и знаки не озвучиваются", () => {
  for (const text of ["/ˈsɪmər/", "/seɪ/", "[red]", "—", "+", "?", "→"]) {
    assert.equal(speakable(text), null, text);
  }
});

test("короткие учебные пометки остаются озвучиваемыми", () => {
  // «V3» и «-s» — это то, что учитель произносит вслух на уроке.
  assert.equal(speakable("V3"), "V3");
  assert.equal(speakable("-s"), "-s");
  assert.equal(speakable("he / she / it"), "he / she / it");
});

test("абзац не озвучивается целиком", () => {
  assert.equal(speakable("a".repeat(200)), null);
  assert.equal(speakable("a"), null);
  assert.equal(speakable("   "), null);
});
