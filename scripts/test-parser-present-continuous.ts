/**
 * Шпаргалка Present Continuous.
 *
 * Особенность формата: схемы предложений приезжают трижды — сначала
 * расплющенной строкой с приклеенной копией в ячейках, потом теми же
 * ячейками отдельно, и только третьей строкой идёт читаемое предложение
 * с переводом. Полезна из них последняя.
 *
 * Запуск: npx tsx scripts/test-parser-present-continuous.ts
 */
import { parseRuleText } from "../src/lib/rule-parser";
import { presentContinuous } from "./fixtures/present-continuous";

const parsed = parseRuleText(presentContinuous);

function check(ok: unknown, what: string) {
  if (!ok) throw new Error(`не сошлось: ${what}`);
}

const tables = parsed.blocks.filter((b) => b.type === "table");
const examples = parsed.blocks.filter((b) => b.type === "example");

check(parsed.warnings.length === 0, `предупреждений нет (${parsed.warnings.join("; ")})`);
check(parsed.title?.startsWith("PRESENT CONTINUOUS"), "название взято из первой строки");

// Предложения с переводом без тире должны стать примерами, а не абзацами.
check(examples.length === 9, `девять примеров, а не ${examples.length}`);
check(
  examples.some(
    (e) => e.type === "example" && e.en === "I am eating right now." && e.tr === "Я зараз їм.",
  ),
  "«I am eating right now. Я зараз їм.» разделено на пример и перевод",
);
check(
  examples.some((e) => e.type === "example" && e.en === "Are they watching TV?"),
  "вопрос тоже стал примером",
);

// Схема предложения приезжает трижды: расплющенной строкой, ячейками и
// их дублем. Остаться должна одна строка ячеек.
const schema = tables.find(
  (t) => t.type === "table" && t.rows.length === 1 && t.rows[0][0] === "ХТО I",
);
check(schema?.type === "table" && schema.headers.length === 0, "у схемы нет шапки");
check(schema?.type === "table" && schema.rows[0].length === 6, "в схеме шесть частей");
check(
  schema?.type === "table" && !schema.rows[0][0].includes("am/is/are"),
  "расплющенная копия выброшена",
);

// Таблица отрицаний не должна склеиться со следующими за ней схемами.
const negation = tables.find(
  (t) => t.type === "table" && t.headers[1] === "ЗАПЕРЕЧЕННЯ",
);
check(negation?.type === "table" && negation.headers.length === 3, "три колонки у отрицаний");
check(negation?.type === "table" && negation.rows.length === 3, "три строки у отрицаний");

// Сравнительная таблица с пустым первым заголовком.
const compare = tables.find(
  (t) => t.type === "table" && t.headers[1] === "PRESENT SIMPLE",
);
check(compare?.type === "table" && compare.headers[0] === "", "пустой первый заголовок");
check(compare?.type === "table" && compare.rows.length === 4, "четыре строки сравнения");

const counts = new Map<string, number>();
for (const b of parsed.blocks) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);

console.log("название:", parsed.title ?? "—");
console.log("предупреждения:", parsed.warnings.length ? parsed.warnings.join("; ") : "нет");
console.log("блоков:", parsed.blocks.length, "—", [...counts].map(([t, n]) => `${t}:${n}`).join(", "));
console.log("---");

for (const [i, block] of parsed.blocks.entries()) {
  const n = String(i + 1).padStart(2);
  if (block.type === "table") {
    console.log(`${n}. table   ${block.headers.length} кол. × ${block.rows.length} стр.`);
    if (block.headers.length) console.log(`      шапка: ${block.headers.join(" | ")}`);
    for (const row of block.rows.slice(0, 4)) {
      console.log(`      ${row.join(" | ")}`.slice(0, 120));
    }
    if (block.rows.length > 4) console.log(`      …ещё ${block.rows.length - 4}`);
  } else if (block.type === "list") {
    console.log(`${n}. list    ${block.items.length}: ${block.items.slice(0, 3).join(" / ")}`);
  } else if (block.type === "example") {
    console.log(`${n}. example ${block.en} || ${block.tr ?? ""}`.slice(0, 118));
  } else {
    console.log(`${n}. ${block.type.padEnd(7)} ${String(block.text).slice(0, 100)}`);
  }
}
