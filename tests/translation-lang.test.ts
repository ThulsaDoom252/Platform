import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectTranslationLang,
  langMarks,
  pageTranslationLang,
} from "../src/lib/translation-lang";

test("русский узнаётся по своим буквам", () => {
  assert.equal(detectTranslationLang(["беженцы", "одноразовый / расходный"]), "RU");
  assert.equal(detectTranslationLang(["Прилагательные", "объём", "жёлтый"]), "RU");
});

test("украинский узнаётся по своим буквам", () => {
  assert.equal(detectTranslationLang(["біженці", "одноразовий"]), "UK");
  assert.equal(detectTranslationLang(["Прикметники", "ґанок", "їжа"]), "UK");
});

test("решает большинство, а не первая встреченная буква", () => {
  /*
   * В переводе попадается имя или цитата на другом языке — одна чужая
   * буква не должна переворачивать решение.
   */
  const mostlyRussian = ["ыыыы", "эээ", "ъ", "ёлка", "і"];
  assert.equal(detectTranslationLang(mostlyRussian), "RU");

  const mostlyUkrainian = ["їжа", "єдність", "ґанок", "південь", "ы"];
  assert.equal(detectTranslationLang(mostlyUkrainian), "UK");
});

test("регистр значения не имеет", () => {
  assert.equal(detectTranslationLang(["ЇЖА"]), "UK");
  assert.equal(detectTranslationLang(["ЁЛКА"]), "RU");
});

test("когда различить нечем — ответа нет", () => {
  // «дом», «кот», «сон» пишутся одинаково на обоих языках.
  assert.equal(detectTranslationLang(["дом", "кот", "сон"]), null);
  assert.equal(detectTranslationLang([]), null);
  assert.equal(detectTranslationLang([null, undefined, ""]), null);
});

test("английский текст языка перевода не задаёт", () => {
  assert.equal(detectTranslationLang(["refugees", "disposable"]), null);
});

test("тексту верим всегда, метке — только когда текст молчит", () => {
  // Ровно тот случай: страница помечена украинской, переводы русские.
  assert.equal(pageTranslationLang(["беженцы"], "UK"), "RU");
  assert.equal(pageTranslationLang(["біженці"], "RU"), "UK");

  // Различить нечем — остаётся прежняя метка.
  assert.equal(pageTranslationLang(["дом"], "UK"), "UK");
  assert.equal(pageTranslationLang([], "RU"), "RU");
});

test("счёт различающих букв виден отдельно", () => {
  assert.deepEqual(langMarks("їжа та ёлка"), { uk: 1, ru: 1 });
  assert.deepEqual(langMarks(""), { uk: 0, ru: 0 });
});
