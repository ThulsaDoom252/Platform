/**
 * Шпаргалка SAY vs TELL.
 * Запуск: npx tsx scripts/test-parser-say-tell.ts
 */
import { parseRuleText } from "../src/lib/rule-parser";
import { sayVsTell } from "./fixtures/say-vs-tell";

const parsed = parseRuleText(sayVsTell);

function check(ok: unknown, what: string) {
  if (!ok) throw new Error(`не сошлось: ${what}`);
}

const tables = parsed.blocks.filter((b) => b.type === "table");

check(parsed.warnings.length === 0, `предупреждений нет (${parsed.warnings.join("; ")})`);
check(parsed.title?.startsWith("SAY"), "название взято из первой строки");

// Две таблицы «англійська / переклад» приезжают склеенными в одну строку.
const bilingual = tables.filter(
  (t) => t.type === "table" && t.headers.join("|") === "АНГЛІЙСЬКА|ПЕРЕКЛАД",
);
check(bilingual.length === 2, `две двуязычные таблицы, а не ${bilingual.length}`);

for (const t of bilingual) {
  check(t.type === "table" && t.rows.length === 4, "в каждой по четыре строки");
  check(
    t.type === "table" && t.rows.every((r) => r.length === 2 && r.every(Boolean)),
    "обе ячейки заполнены",
  );
  check(
    t.type === "table" && t.rows.every((r) => /[A-Za-z]/.test(r[0]) && /[Ѐ-ӿ]/.test(r[1])),
    "слева английский, справа перевод",
  );
}

const say = bilingual[0];
check(
  say.type === "table" && say.rows[0].join("|") === "She said hello.|Вона привіталась.",
  "первая строка разрезана по границе языков",
);
check(
  say.type === "table" && say.rows[2][0] === '"I\'m ready," she said.',
  "прямая речь в кавычках не потерялась",
);

// Таблица выражений идёт сразу за предыдущей, без пустой строки между ними.
const idioms = tables.find((t) => t.type === "table" && t.headers[0] === "ВИРАЗ");
check(!!idioms, "таблица выражений отделилась по своей шапке");
check(
  idioms?.type === "table" && idioms.rows[0].join("|") === "tell the truth|казати правду",
  "первое выражение на месте",
);

// «SAY TO — якщо все ж хочемо…» — пояснение, а не пример с переводом.
check(
  parsed.blocks.some((b) => b.type === "text" && b.text.startsWith("SAY TO —")),
  "длинное пояснение осталось абзацем",
);

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
    for (const row of block.rows.slice(0, 5)) {
      console.log(`      ${row.join("  ||  ")}`.slice(0, 130));
    }
    if (block.rows.length > 5) console.log(`      …ещё ${block.rows.length - 5}`);
  } else if (block.type === "example") {
    console.log(`${n}. example ${block.en} || ${block.tr ?? ""}`.slice(0, 118));
  } else if (block.type === "list") {
    console.log(`${n}. list    ${block.items.length}`);
  } else {
    console.log(`${n}. ${block.type.padEnd(7)} ${String(block.text).slice(0, 100)}`);
  }
}
