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
  assert.deepEqual(r.warnings, []);

  const sections = [...new Set(r.phrases.map((p) => p.section))];
  assert.deepEqual(sections, ["Nouns", "Verbs"]);

  const simmer = r.phrases.find((p) => p.phrase === "simmer");
  assert.ok(simmer, "нет слова simmer");
  assert.equal(simmer.section, "Verbs");
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
    r.blocks.some((b) => b.type === "formula" && b.text.includes("have / has + V3")),
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

test("ссылка на разбор необязательна и принимается всеми тремя типами", () => {
  // Правило, лексика и время — один набор ключей: место для ссылки
  // должно работать одинаково, а без неё материал остаётся целым.
  for (const name of ["keyed-rule.txt", "keyed-lexis.txt", "keyed-tense.txt"]) {
    const r = parseKeyed(fixture(name));
    assert.ok(r && r.type !== "VOCAB", name);
    const last = r.blocks.at(-1);
    assert.ok(last?.type === "link", `${name}: ссылка не разобралась`);
  }

  const without = parseKeyed(
    ["TYPE: LEXIS", "TITLE: t", "ITEM: say", "EX: Say it. | Скажи це."].join("\n"),
  );
  assert.ok(without && without.type !== "VOCAB");
  assert.ok(!without.blocks.some((b) => b.type === "link"));
  assert.deepEqual(without.warnings, []);
});

test("время разбирается в построение, сетки, маркеры и разбор примеров", () => {
  const r = parse("keyed-tense.txt", "TENSE");
  if (r.type === "VOCAB") return;

  assert.equal(r.title, "Present Simple");
  assert.deepEqual(r.warnings, []);

  // Формулы короткие: одна подгруппа подлежащих на строку.
  const forms = r.blocks.filter((b) => b.type === "form");
  assert.equal(forms.length, 4);
  assert.deepEqual(
    forms.map((b) => (b.type === "form" ? b.sign : "")),
    ["+", "+", "-", "?"],
  );
  for (const form of forms) {
    if (form.type === "form") {
      assert.ok(form.formula.length <= 40, `формула длинновата: ${form.formula}`);
    }
  }

  // Сетки подстановки — то, что в одну строку не помещается.
  const grids = r.blocks.filter((b) => b.type === "grid");
  assert.equal(grids.length, 3);
  const questions = grids.find((b) => b.type === "grid" && b.title === "Питання");
  assert.ok(questions, "нет сетки вопросов");
  if (questions.type === "grid") {
    assert.deepEqual(questions.headers, ["Допоміжне", "Хто", "Дія"]);
    assert.deepEqual(questions.rows[1], ["Does", "he / she / it", "play?"]);
  }

  const markers = r.blocks.filter((b) => b.type === "marker");
  assert.equal(markers.length, 6);
  const never = markers.find((b) => b.type === "marker" && b.word === "never");
  assert.ok(never, "потерялся маркер never");
  if (never.type === "marker") {
    assert.equal(never.tr, "ніколи");
    assert.match(never.hintText, /not не потрібне/);
  }

  // Третья часть примера — разбор: ради него формат и заведён.
  const examples = r.blocks.filter((b) => b.type === "example");
  assert.equal(examples.length, 3);
  for (const ex of examples) {
    if (ex.type === "example") assert.ok(ex.why, `${ex.en}: нет разбора`);
  }

  // Сравнений языков в материале больше нет.
  assert.ok(
    !r.blocks.some((b) => b.type === "callout" && b.label === "По-нашему"),
    "вернулось сравнение языков",
  );

  // Ссылка всегда последняя и знает обе языковые версии.
  const last = r.blocks.at(-1);
  assert.ok(last && last.type === "link");
  if (last.type === "link") {
    assert.ok(last.ru.includes("/ru/"), last.ru);
    assert.ok(last.uk.includes("/ua/"), last.uk);
  }
});

test("одна ссылка разворачивается в две языковые версии", () => {
  const make = (link: string) =>
    parseKeyed(["TYPE: RULE", "TITLE: t", "TEXT: описание", link].join("\n"));

  const path = make("LINK: https://grammarway.com/ru/present-simple");
  assert.ok(path && path.type !== "VOCAB");
  {
    const block = path.blocks.at(-1);
    if (block?.type === "link") {
      assert.equal(block.ru, "https://grammarway.com/ru/present-simple");
      assert.equal(block.uk, "https://grammarway.com/uk/present-simple");
    } else assert.fail("ссылка не разобралась");
  }

  const query = make("LINK: https://site.com/rule?lang=uk");
  if (query && query.type !== "VOCAB") {
    const block = query.blocks.at(-1);
    if (block?.type === "link") {
      assert.equal(block.ru, "https://site.com/rule?lang=ru");
      assert.equal(block.uk, "https://site.com/rule?lang=uk");
    } else assert.fail("ссылка с параметром не разобралась");
  }

  // Непонятный адрес не ломает разбор: отдаём как есть на обоих языках.
  const plain = make("LINK: https://site.com/present-simple");
  if (plain && plain.type !== "VOCAB") {
    const block = plain.blocks.at(-1);
    if (block?.type === "link") assert.equal(block.ru, block.uk);
  }

  const broken = make("LINK: grammarway.com/present-simple");
  assert.ok(broken && broken.type !== "VOCAB");
  assert.ok(!broken.blocks.some((b) => b.type === "link"));
  assert.match(broken.warnings.join(" "), /должен начинаться с http/);
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

  // Непонятный знак не повод терять строку: обе формы доезжают, о второй
  // сказано в замечаниях.
  assert.equal(r.blocks.filter((b) => b.type === "form").length, 2);

  const said = r.warnings.join(" | ");
  assert.match(said, /COLOR не нужен/);
  assert.match(said, /вне формата/);
  assert.match(said, /непонятный знак/);
  assert.match(said, /5 частей/);
  assert.match(said, /перевод после/);
  assert.match(said, /UNKNOWN/);
});
