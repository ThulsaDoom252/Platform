import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKeyed } from "../src/lib/keyed-parser";
import type { RuleBlock } from "../src/lib/rule-blocks";

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Весь кириллический текст страницы должен доезжать до перевода.
 *
 * Части, которые никто не отправлял переводчику, молча оставались на
 * прежнем языке: формула «підмет + don't + V», разбор примера, ячейки
 * сетки. Проверка перечисляет всё, что переводится, и сверяет с тем,
 * что в блоках вообще есть.
 */
function translatableText(block: RuleBlock): string[] {
  switch (block.type) {
    case "heading":
    case "text":
      return [block.text];
    case "callout":
      return [block.label ?? "", block.text];
    case "formula":
      return [block.text];
    case "example":
      return [block.tr ?? "", block.why ?? ""];
    case "list":
      return block.items;
    case "table":
      return [...block.headers, ...block.rows.flat()];
    case "word":
      return [block.tr ?? "", block.sense ?? "", ...block.notes,
        ...block.examples.map((e) => e.tr)];
    case "form":
      return [block.formula, block.tr];
    case "marker":
      return [block.tr, block.ru, block.hintText];
    case "grid":
      return [block.title ?? "", ...block.headers, ...block.rows.flat()];
    case "link":
      return [block.label];
  }
}

/** Всё, что в блоке вообще лежит — включая то, что переводить не надо. */
function allText(block: RuleBlock): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(block);
  return out;
}

for (const name of ["keyed-rule.txt", "keyed-lexis.txt", "keyed-tense.txt"]) {
  test(`${name}: кириллица нигде не остаётся без перевода`, () => {
    const raw = readFileSync(join(process.cwd(), "scripts", "fixtures", name), "utf8");
    const parsed = parseKeyed(raw);
    assert.ok(parsed && parsed.type !== "VOCAB");

    for (const block of parsed.blocks) {
      const covered = new Set(translatableText(block).filter(Boolean));
      const missed = allText(block).filter(
        (text) => CYRILLIC.test(text) && !covered.has(text),
      );
      assert.deepEqual(
        missed,
        [],
        `${block.type}: эти куски не попадут в перевод — ${missed.join(" | ")}`,
      );
    }
  });
}
