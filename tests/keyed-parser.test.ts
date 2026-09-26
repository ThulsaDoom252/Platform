import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKeyed, detectKeyedType } from "../src/lib/keyed-parser";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "scripts", "fixtures", name), "utf8");

/** Разбор нужного типа, заодно проверяя, что тип опознан. */
function parse(name: string, expected: string) {
  const result = parseKeyed(fixture(name));
  assert.ok(result, `${name}: формат не опознан`);
  assert.equal(result.type, expected);
  return result;
}

test("чужой текст ключевым форматом не считается", () => {
  assert.equal(detectKeyedType("Present Perfect\n\nI have done it."), null);
  assert.equal(detectKeyedType("TYPE: SOMETHING\n"), null);
  assert.equal(parseKeyed("обычный вставленный текст"), null);
});

test("словник разбирается с категориями и транскрипциями", () => {
  const r = parse("keyed-vocab.txt", "VOCAB");
  if (r.type !== "VOCAB") return;

  assert.equal(r.title, "Food and cooking");
  assert.equal(r.color, "green");
  assert.deepEqual(r.warnings, []);

  const sections = [...new Set(r.phrases.map((p) => p.section))];
  assert.deepEqual(sections, ["Nouns", "Verbs"]);

  const simmer = r.phrases.find((p) => p.phrase === "simmer");
  assert.ok(simmer, "нет слова simmer");
  assert.equal(simmer.section, "Verbs");
  assert.equal(simmer.sectionColor, "amber");
  assert.equal(simmer.icon, "🍲");
  assert.equal(simmer.transcriptionUs, "/ˈsɪmər/");
  assert.equal(simmer.transcriptionUk, "/ˈsɪmə/");
  assert.equal(simmer.translation, "варить на медленном огне");
  assert.equal(simmer.examples.length, 2);
  assert.equal(simmer.examples[0].en, "Let it simmer for ten minutes.");
  assert.equal(simmer.examples[0].tr, "Дай ему потомиться десять минут.");
  assert.match(simmer.note ?? "", /Не кипит ключом/);

  // Каждое слово обязано дойти полным: без перевода или примеров запись
  // на уроке бесполезна, поэтому это ошибка формата, а не мелочь.
  for (const p of r.phrases) {
    assert.ok(p.translation, `${p.phrase}: нет перевода`);
    assert.equal(p.examples.length, 2, `${p.phrase}: примеров не два`);
  }
});

test("правило разбирается в секции, формулы и сравнения", () => {
  const r = parse("keyed-rule.txt", "RULE");
  if (r.type === "VOCAB") return;

  assert.equal(r.title, "Present Perfect vs Past Simple");
  assert.equal(r.color, "violet");
  assert.match(r.subtitle ?? "", /важен результат сейчас/);
  assert.deepEqual(r.warnings, []);

  const headings = r.blocks
    .filter((b) => b.type === "heading")
    .map((b) => (b.type === "heading" ? b.text : ""));
  assert.deepEqual(headings, [
    "🎯 Зачем это нужно",
    "🧩 Формулы",
    "⚖️ Как выбрать",
    "🗣 Как это звучит в жизни",
  ]);

  assert.ok(
    r.blocks.some((b) => b.type === "formula" && b.text.includes("have/has + V3")),
    "потерялась формула",
  );

  // Подряд идущие сравнения складываются в одну таблицу, а не в две.
  const tables = r.blocks.filter((b) => b.type === "table");
  assert.equal(tables.length, 1);
  if (tables[0].type === "table") {
    assert.deepEqual(tables[0].headers, ["Present Perfect", "Past Simple"]);
    assert.equal(tables[0].rows.length, 2);
  }

  const trap = r.blocks.find((b) => b.type === "callout" && b.tone === "warn");
  assert.ok(trap, "потерялась типичная ошибка");
  if (trap.type === "callout") assert.match(trap.text, /❌.*✅/);

  const bonus = r.blocks.filter((b) => b.type === "callout" && b.tone === "info");
  assert.equal(bonus.length, 2, "бонус приходит двумя строками");
  if (bonus[0].type === "callout") assert.equal(bonus[0].hint, true);
});

test("лексика разбирается в карточки слов", () => {
  const r = parse("keyed-lexis.txt", "LEXIS");
  if (r.type === "VOCAB") return;

  assert.equal(r.color, "amber");
  assert.deepEqual(r.warnings, []);

  const words = r.blocks.filter((b) => b.type === "word");
  assert.equal(words.length, 4);

  const tell = words.find((b) => b.type === "word" && b.word === "tell");
  assert.ok(tell, "нет слова tell");
  if (tell.type === "word") {
    assert.equal(tell.us, "/tel/");
    assert.equal(tell.sense, "важно КОМУ сказано, адресат обязателен");
    assert.equal(tell.pattern, "tell somebody something");
    assert.equal(tell.examples.length, 2);
    assert.equal(tell.notes.length, 1);
  }

  // CONTRAST собирается в ту же таблицу, что и COMPARE у правил.
  const tables = r.blocks.filter((b) => b.type === "table");
  assert.equal(tables.length, 1);
  if (tables[0].type === "table") assert.equal(tables[0].rows.length, 2);

  const traps = r.blocks.filter((b) => b.type === "callout" && b.tone === "warn");
  assert.equal(traps.length, 2);
});

test("время разбирается в построение, маркеры и разобранные примеры", () => {
  const r = parse("keyed-tense.txt", "TENSE");
  if (r.type === "VOCAB") return;

  assert.equal(r.title, "Present Perfect");
  assert.deepEqual(r.warnings, []);

  const forms = r.blocks.filter((b) => b.type === "form");
  assert.equal(forms.length, 3);
  assert.deepEqual(
    forms.map((b) => (b.type === "form" ? b.sign : "")),
    ["+", "-", "?"],
  );
  if (forms[2].type === "form") {
    assert.equal(forms[2].en, "Have you read it?");
    assert.equal(forms[2].tr, "Ты это прочитал?");
  }

  const markers = r.blocks.filter((b) => b.type === "marker");
  assert.equal(markers.length, 7);
  const never = markers.find((b) => b.type === "marker" && b.word === "never");
  assert.ok(never, "потерялся маркер never");
  if (never.type === "marker") {
    assert.equal(never.tr, "никогда");
    assert.match(never.hintText, /второе not не нужно/);
  }

  // Третья часть примера — разбор: ради него формат и заведён.
  const examples = r.blocks.filter((b) => b.type === "example");
  assert.equal(examples.length, 3);
  for (const ex of examples) {
    if (ex.type === "example") assert.ok(ex.why, `${ex.en}: нет разбора`);
  }

  assert.ok(
    r.blocks.some((b) => b.type === "callout" && b.label === "По-нашему"),
    "потерялась аналогия с русским",
  );
});

test("кривые строки не роняют разбор, а попадают в замечания", () => {
  const r = parseKeyed(
    [
      "TYPE: TENSE",
      "TITLE: Тест",
      "COLOR: неоновый",
      "просто строка без ключа",
      "FORM: + | формула | пример | перевод",
      "FORM: ! | формула | пример | перевод",
      "MARKER: just | только что | I've just eaten.",
      "EX: Only English without translation",
      "UNKNOWN: что-то своё",
    ].join("\n"),
  );

  assert.ok(r);
  if (!r || r.type === "VOCAB") return;

  assert.equal(r.color, null, "негодный цвет не должен доезжать");
  // Непонятный знак не повод терять строку: обе формы доезжают, о второй
  // сказано в замечаниях.
  assert.equal(r.blocks.filter((b) => b.type === "form").length, 2);

  const said = r.warnings.join(" | ");
  assert.match(said, /неизвестный цвет/);
  assert.match(said, /вне формата/);
  assert.match(said, /непонятный знак/);
  assert.match(said, /5 частей/);
  assert.match(said, /перевод после/);
  assert.match(said, /UNKNOWN/);
});
