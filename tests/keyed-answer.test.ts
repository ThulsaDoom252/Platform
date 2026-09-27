import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanKeyedAnswer, looksKeyed } from "../src/lib/keyed-answer";
import { parseKeyed } from "../src/lib/keyed-parser";

const material = [
  "TYPE: VOCAB",
  "TITLE: Sport",
  "",
  "WORD: goalkeeper",
  "ICON: 🧤",
  "US: /ˈɡoʊlkiːpər/",
  "UK: /ˈɡəʊlkiːpə/",
  "TR: воротар",
  "EX: The goalkeeper saved the penalty. | Воротар відбив пенальті.",
  "EX: Their goalkeeper is very tall. | Їхній воротар дуже високий.",
].join("\n");

test("вступление модели срезается", () => {
  const answer = `Ось ваш матеріал:\n\n${material}`;
  assert.equal(cleanKeyedAnswer(answer), material);
});

test("тройные кавычки снимаются", () => {
  assert.equal(cleanKeyedAnswer("```\n" + material + "\n```"), material);
  assert.equal(cleanKeyedAnswer("```text\n" + material + "\n```"), material);
});

test("чистый ответ остаётся собой", () => {
  assert.equal(cleanKeyedAnswer(material), material);
  assert.equal(cleanKeyedAnswer(`  ${material}  `), material);
});

test("очищенный ответ разбирается парсером", () => {
  const parsed = parseKeyed(cleanKeyedAnswer(`Готово!\n\n${material}`));
  assert.ok(parsed && parsed.type === "VOCAB");
  assert.equal(parsed.phrases.length, 1);
  assert.equal(parsed.phrases[0].phrase, "goalkeeper");
  assert.deepEqual(parsed.warnings, []);
});

test("не наш формат опознаётся как чужой", () => {
  assert.equal(looksKeyed("Привет, вот словарь про спорт"), false);
  assert.equal(looksKeyed(material), true);
});
