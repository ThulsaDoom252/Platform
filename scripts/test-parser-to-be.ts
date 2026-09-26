/**
 * Шпаргалка TO BE.
 *
 * Особенность формата: таблицы приехали по одной ячейке на строку —
 * сначала шапка из трёх строк капсом, потом строки по три. Табуляций
 * в них нет совсем, поэтому обычный разбор таблиц тут не срабатывает.
 *
 * Запуск: npx tsx scripts/test-parser-to-be.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRuleText } from "../src/lib/rule-parser";

const source = readFileSync(join(process.cwd(), "scripts", "fixtures", "to-be.txt"), "utf8");
const parsed = parseRuleText(source);

function check(ok: unknown, what: string) {
  if (!ok) throw new Error(`не сошлось: ${what}`);
}

const tables = parsed.blocks.filter((b) => b.type === "table");
const headings = parsed.blocks.filter((b) => b.type === "heading");

check(parsed.warnings.length === 0, `предупреждений нет (${parsed.warnings.join("; ")})`);
check(parsed.title === "TO BE", `название «TO BE», а не «${parsed.title}»`);

// Девять таблиц приехали по ячейке на строку и должны собраться в три
// колонки. Десятая — итоговая строка с табуляциями, она без шапки.
const perLine = tables.filter((t) => t.type === "table" && t.headers.length === 3);
check(tables.length === 10, `десять таблиц всего, а не ${tables.length}`);
check(perLine.length === 9, `девять таблиц по три колонки, а не ${perLine.length}`);

const first = tables[0];
check(
  first.type === "table" && first.headers.join("|") === 'ХТО (підмет)|"="|ПРИКЛАД',
  "шапка первой таблицы разобрана",
);
check(first.type === "table" && first.rows.length === 7, "в первой таблице семь строк");
check(
  first.type === "table" && first.rows[0].join("|") === "I (тільки я)|AM|I am tired. / I am a student.",
  "первая строка разложена по ячейкам",
);

// У таблицы отрицаний первая колонка без заголовка — шапка дополняется пустой.
const negation = tables.find(
  (t) => t.type === "table" && t.headers[1]?.includes("СТВЕРДЖЕННЯ"),
);
check(negation?.type === "table" && negation.headers[0] === "", "пустой первый заголовок");
check(negation?.type === "table" && negation.rows.length === 3, "три строки отрицаний");

// Разделы с эмодзи и тире — заголовки, а не абзацы.
check(
  headings.some((h) => h.type === "heading" && h.text.includes("МІСЦЕЗНАХОДЖЕННЯ")),
  "«📍 МІСЦЕЗНАХОДЖЕННЯ — де знаходиться» стал заголовком",
);
check(headings.length >= 19, `заголовков не меньше 19, а не ${headings.length}`);

// Итоговая строка с табуляциями не должна разрезаться расклейкой пополам.
const last = tables[tables.length - 1];
check(
  last.type === "table" && last.rows.length === 1 && last.rows[0].length === 3,
  "строка «ГОЛОВНЕ» осталась одной строкой из трёх ячеек",
);

const counts = new Map<string, number>();
for (const b of parsed.blocks) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);

console.log("название:", parsed.title ?? "—");
console.log("подзаголовок:", parsed.subtitle ?? "—");
console.log("предупреждения:", parsed.warnings.length ? parsed.warnings.join("; ") : "нет");
console.log("блоков:", parsed.blocks.length, "—", [...counts].map(([t, n]) => `${t}:${n}`).join(", "));
console.log("---");

for (const [i, block] of parsed.blocks.entries()) {
  const n = String(i + 1).padStart(2);
  if (block.type === "table") {
    console.log(`${n}. table   ${block.headers.length} кол. × ${block.rows.length} стр.`);
    if (block.headers.length) console.log(`      шапка: ${block.headers.join(" | ")}`);
    for (const row of block.rows.slice(0, 3)) console.log(`      ${row.join(" | ")}`);
    if (block.rows.length > 3) console.log(`      …ещё ${block.rows.length - 3}`);
  } else if (block.type === "list") {
    console.log(`${n}. list    ${block.items.length}: ${block.items.slice(0, 3).join(" / ")}`);
  } else if (block.type === "example") {
    console.log(`${n}. example ${block.en} || ${block.tr ?? ""}`.slice(0, 110));
  } else {
    console.log(`${n}. ${block.type.padEnd(7)} ${String(block.text).slice(0, 96)}`);
  }
}
