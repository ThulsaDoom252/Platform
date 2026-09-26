import { test } from "node:test";
import assert from "node:assert/strict";
import {
  needsProtection,
  protectTerms,
  restoreTerms,
} from "../src/lib/protect-terms";

/** Что увидит переводчик: текст без тегов. */
const visible = (text: string) => restoreTerms(protectTerms(text));

test("английский термин внутри пояснения помечен, а текст цел", () => {
  const source = "Прийменник on означає на поверхні.";
  const wrapped = protectTerms(source);

  assert.ok(wrapped.includes("<k>on</k>"), wrapped);
  assert.equal(visible(source), source, "текст не должен измениться");
});

test("помечается всё английское, что встречается в пояснении", () => {
  const cases: [string, string[]][] = [
    ["Для he / she / it додається -s.", ["he / she / it", "-s"]],
    ["V3 — третя форма дієслова.", ["V3"]],
    ["Скорочення doesn't забирає -s на себе.", ["doesn't", "-s"]],
    ["Кажуть I have got a car замість I have a car.", ["I have got a car"]],
    ["Present Simple потрібен для звичок.", ["Present Simple"]],
  ];

  for (const [source, terms] of cases) {
    const wrapped = protectTerms(source);
    for (const term of terms) {
      assert.ok(wrapped.includes(`<k>${term}</k>`), `${source} → ${wrapped}`);
    }
    assert.equal(visible(source), source);
  }
});

test("сплошной английский не защищается: это пример, его и переводим", () => {
  const source = "She works in a bank.";
  assert.equal(needsProtection(source), false);
  assert.ok(!protectTerms(source).includes("<k>"));
});

test("текст без английского остаётся собой", () => {
  const source = "Дія відбувається регулярно.";
  assert.equal(needsProtection(source), false);
  assert.equal(visible(source), source);
});

test("угловые скобки и амперсанд переживают защиту", () => {
  const source = "Порівняй on <-> in & at.";
  assert.equal(visible(source), source);
});

test("снятие тегов переживает переводчик, который их переставил", () => {
  // Переводчик возвращает тег в своём написании — снимаем любое.
  assert.equal(restoreTerms("Прийменник <K>on</K> означає"), "Прийменник on означає");
  assert.equal(restoreTerms("Прийменник <k />on</k> означає"), "Прийменник on означає");
});
