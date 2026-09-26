import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeBlocks, RULE_BLOCK_TYPES } from "../src/lib/rule-blocks";
import { parseKeyed } from "../src/lib/keyed-parser";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "scripts", "fixtures", name), "utf8");

/**
 * Главная проверка этого файла.
 *
 * Проверка на сервере однажды не знала про новые виды блоков и молча
 * выбрасывала их при сохранении: в предпросмотре материал был целым, а на
 * странице оставался огрызок. Теперь разобранное и сохранённое сверяются
 * целиком — потерять блок незаметно больше нельзя.
 */
for (const name of ["keyed-rule.txt", "keyed-lexis.txt", "keyed-tense.txt"]) {
  test(`${name}: сохранение ничего не теряет`, () => {
    const parsed = parseKeyed(fixture(name));
    assert.ok(parsed && parsed.type !== "VOCAB");

    const saved = sanitizeBlocks(parsed.blocks);
    assert.deepEqual(saved, parsed.blocks);
  });
}

test("проверка знает про каждый вид блока", () => {
  // Один блок каждого вида: если проверка о каком-то не знает, он исчезнет.
  const every = [
    { type: "heading", text: "Заголовок" },
    { type: "callout", text: "Подсказка", tone: "tip", hint: true },
    { type: "formula", text: "have + V3" },
    { type: "text", text: "Пояснение" },
    { type: "example", en: "I have done it.", tr: "Я сделал.", why: "важен результат" },
    { type: "list", items: ["раз", "два"] },
    { type: "table", headers: ["a", "b"], rows: [["1", "2"]] },
    {
      type: "word",
      word: "say",
      icon: "💬",
      us: "/seɪ/",
      uk: "/seɪ/",
      tr: "сказать",
      sense: "важно что сказано",
      pattern: "say something",
      examples: [{ en: "She said nothing.", tr: "Она ничего не сказала." }],
      notes: ["никогда say me"],
    },
    { type: "form", sign: "?", formula: "Have + V3", en: "Have you read it?", tr: "Ты прочитал?" },
    {
      type: "marker",
      word: "just",
      tr: "только что",
      en: "I've just eaten.",
      ru: "Я только что поел.",
      hintText: "между have и V3",
    },
  ];

  assert.equal(every.length, RULE_BLOCK_TYPES.length, "проверены не все виды блоков");

  const saved = sanitizeBlocks(every);
  assert.deepEqual(
    saved.map((b) => b.type),
    every.map((b) => b.type),
  );
  assert.deepEqual(saved, every);
});

test("мусор и подделки не проходят", () => {
  const saved = sanitizeBlocks([
    null,
    "строка",
    { type: "выдуманный", text: "чужое" },
    { type: "heading", text: "" },
    { type: "word", word: "" },
    { type: "callout", text: "норм", tone: "неоновый" },
  ]);

  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], { type: "callout", text: "норм", tone: "info" });
});

test("знак формы понимается в любом написании", () => {
  const parsed = parseKeyed(
    [
      "TYPE: TENSE",
      "TITLE: Тест",
      "FORM: ➕ | подлежащее + V | I read books. | Я читаю книги.",
      "FORM: — | подлежащее + don't + V | I don't read. | Я не читаю.",
      "FORM: питальна | Do + підмет + V | Do you read? | Ти читаєш?",
      "FORM: n/a | формула | She doesn't know. | Она не знает.",
      "FORM: n/a | формула | Is he here? | Он здесь?",
    ].join("\n"),
  );

  assert.ok(parsed && parsed.type !== "VOCAB");

  const signs = parsed.blocks
    .filter((b) => b.type === "form")
    .map((b) => (b.type === "form" ? b.sign : ""));

  // Три написанных по-разному знака поняты как есть, два непонятных
  // выведены из самого предложения.
  assert.deepEqual(signs, ["+", "-", "?", "-", "?"]);
  assert.equal(parsed.warnings.filter((w) => w.includes("непонятный знак")).length, 2);
});
