/**
 * Шпаргалка про чтение окончания -ed.
 *
 * Особенность формата: таблицы приезжают склеенными в одну строку —
 * последняя ячейка строки слипается с первой ячейкой следующей через
 * пробел. Заголовок таблицы задаёт число колонок, по нему строки и
 * разбираются обратно.
 *
 * Запуск: npx tsx scripts/test-parser-ed-endings.ts
 */
import { parseRuleText } from "../src/lib/rule-parser";

const T = "\t";

const source = [
  `worked Як правильно вимовляти -ED? /t/  ·  /d/  ·  /ɪd/`,
  `У слові «worked» буква e в закінченні «-ed» майже завжди не читається. Чуємо або /t/, або /d/. Лише в одному випадку e читається — закінчення звучить /ɪd/. Про це — нижче.`,
  `-ed читається /t/  —  після глухих приголосних Глухі: p · k · f · s · sh · ch · th (глухе)`,
  [
    `СЛОВО${T}ВИМОВА${T}ОСТАННЯ ЛІТЕРА worked`,
    `work/t/${T}k — глухий stopped`,
    `stop/t/${T}p — глухий watched`,
    `watch/t/${T}ch — глухий laughed`,
    `laugh/t/${T}f — глухий missed`,
    `miss/t/${T}s — глухий washed`,
    `wash/t/${T}sh — глухий`,
  ].join(T),
  `-ed читається /d/  —  після дзвінких приголосних і голосних Дзвінкі: b · g · v · z · m · n · l · r · w · й · голосні (a,e,i,o,u)`,
  [
    `СЛОВО${T}ВИМОВА${T}ОСТАННЯ ЛІТЕРА called`,
    `call/d/${T}l — дзвінкий lived`,
    `liv/d/${T}v — дзвінкий opened`,
    `open/d/${T}n — дзвінкий played`,
    `play/d/${T}й (y) — дзвінкий loved`,
    `lov/d/${T}v — дзвінкий cleaned`,
    `clean/d/${T}n — дзвінкий`,
  ].join(T),
  `-ed читається /ɪd/  —  тільки після t і d Тут «e» читається! Окремий склад: wanted = want-id. Якщо не додати склад — два «t» або «d» поспіль злились би.`,
  [
    `СЛОВО${T}ВИМОВА${T}ОСТАННЯ ЛІТЕРА wanted`,
    `want-/ɪd/${T}t — читаємо окремий склад! needed`,
    `need-/ɪd/${T}d — читаємо окремий склад! started`,
    `start-/ɪd/${T}t — читаємо окремий склад! waited`,
    `wait-/ɪd/${T}t — читаємо окремий склад! ended`,
    `end-/ɪd/${T}d — читаємо окремий склад! visited`,
    `visit-/ɪd/${T}t — читаємо окремий склад!`,
  ].join(T),
  `ШПАРГАЛКА — запам'ятай просто`,
  `ЗВУК${T}ПІСЛЯ ЯКОГО ЗВУКУ${T}ПРИКЛАДИ`,
  `/t/${T}глухий приголосний p k f s sh ch${T}worked, stopped, watched, missed`,
  `/d/${T}дзвінкий приголосний або голосна b g v z m n l r + голосні${T}called, lived, played, opened`,
  `/ɪd/${T}ТІЛЬКИ після t або d окремий склад — «e» читається${T}wanted, needed, started, waited`,
  `💡  «e» в -ed читається ТІЛЬКИ після t і d. Всі інші слова: worked = work+т, called = call+д. Буква «е» — мовчить.`,
  `💡 ЗАПАМ'ЯТАЙ -ed після глухого → /t/  |  після дзвінкого/голосної → /d/ після t або d → /ɪd/ (e читається, окремий склад) wanted = want-id   |   worked = work-t   |   called = call-d`,
].join("\n");

const parsed = parseRuleText(source);

function check(ok: unknown, what: string) {
  if (!ok) throw new Error(`не сошлось: ${what}`);
}

const tables = parsed.blocks.filter((b) => b.type === "table");
const headings = parsed.blocks.filter((b) => b.type === "heading");

check(parsed.warnings.length === 0, `предупреждений нет (${parsed.warnings.join("; ")})`);
check(parsed.title?.startsWith("worked"), "первая строка стала названием правила");
check(headings.length === 4, `четыре заголовка разделов, а не ${headings.length}`);
check(tables.length === 4, `четыре таблицы, а не ${tables.length}`);

// Три склеенных таблицы должны разложиться в 3 колонки по 6 строк.
for (const t of tables.slice(0, 3)) {
  check(t.type === "table" && t.headers.length === 3, "у склеенной таблицы три колонки");
  check(t.type === "table" && t.rows.length === 6, "у склеенной таблицы шесть строк");
  check(
    t.type === "table" && t.rows.every((r) => r.length === 3 && r.every(Boolean)),
    "все ячейки заполнены",
  );
}

const first = tables[0];
check(
  first.type === "table" && first.rows[0].join("|") === "worked|work/t/|k — глухий",
  "первая строка первой таблицы разложена по ячейкам",
);
check(
  first.type === "table" && first.headers.join("|") === "СЛОВО|ВИМОВА|ОСТАННЯ ЛІТЕРА",
  "шапка не утащила первое слово следующей строки",
);

console.log("заголовок:", parsed.title ?? "—");
console.log("подзаголовок:", parsed.subtitle ?? "—");
console.log("предупреждения:", parsed.warnings.length ? parsed.warnings.join("; ") : "нет");
console.log("блоков:", parsed.blocks.length);
console.log("---");

for (const [i, block] of parsed.blocks.entries()) {
  const n = String(i + 1).padStart(2);
  if (block.type === "table") {
    console.log(`${n}. table  колонок ${block.headers.length}, строк ${block.rows.length}`);
    console.log(`     шапка: ${block.headers.join(" | ")}`);
    for (const row of block.rows) console.log(`     ${row.join(" | ")}`);
  } else if (block.type === "list") {
    console.log(`${n}. list   ${block.items.length}`);
    for (const item of block.items) console.log(`     • ${item}`);
  } else if (block.type === "example") {
    console.log(`${n}. example  ${block.en}  ||  ${block.tr ?? ""}`.slice(0, 120));
  } else {
    console.log(`${n}. ${block.type.padEnd(7)} ${String(block.text).slice(0, 96)}`);
  }
}
