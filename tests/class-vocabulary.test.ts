import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classVocabularyDirection,
  cleanClassVocabularyText,
  normalizeClassVocabularyLang,
} from "../src/lib/class-vocabulary";

test("английский текст переводится на выбранный язык", () => {
  assert.equal(classVocabularyDirection("come up with"), "FROM_ENGLISH");
});

test("украинский и русский текст переводятся на английский", () => {
  assert.equal(classVocabularyDirection("можливість"), "TO_ENGLISH");
  assert.equal(classVocabularyDirection("возможность"), "TO_ENGLISH");
});

test("выделение очищается от переносов и ограничивается", () => {
  assert.equal(cleanClassVocabularyText("  come\n\tup   with  "), "come up with");
  assert.equal(cleanClassVocabularyText("abcdef", 3), "abc");
});

test("украинский язык используется по умолчанию", () => {
  assert.equal(normalizeClassVocabularyLang(undefined), "UK");
  assert.equal(normalizeClassVocabularyLang("RU"), "RU");
});
