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
function allText(block: unknown): string[] {
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

/**
 * То же для словника: у записи переводятся перевод, жёлтая заметка и
 * переводы примеров. Заметку однажды забыли, и она оставалась на прежнем
 * языке, пока всё вокруг менялось.
 */
test("keyed-vocab.txt: кириллица записи нигде не остаётся без перевода", () => {
  const raw = readFileSync(
    join(process.cwd(), "scripts", "fixtures", "keyed-vocab.txt"),
    "utf8",
  );
  const parsed = parseKeyed(raw);
  assert.ok(parsed && parsed.type === "VOCAB");

  // Хотя бы одна заметка в образце должна быть — иначе проверка пустая.
  assert.ok(
    parsed.phrases.some((p) => p.note),
    "в образце нет ни одной заметки",
  );

  for (const p of parsed.phrases) {
    // Что уезжает переводчику.
    const covered = new Set(
      [p.translation, p.note ?? "", ...p.examples.map((e) => e.tr)].filter(Boolean),
    );
    // Что в записи вообще лежит, кроме английского и служебного: слово,
    // транскрипции, значок и категория переводу не подлежат.
    const skip = new Set(
      [
        p.phrase,
        p.section ?? "",
        p.icon ?? "",
        p.transcription ?? "",
        p.transcriptionUs ?? "",
        p.transcriptionUk ?? "",
        ...p.examples.map((e) => e.en),
      ].filter(Boolean),
    );

    const missed = allText(p).filter(
      (text) => CYRILLIC.test(text) && !covered.has(text) && !skip.has(text),
    );
    assert.deepEqual(missed, [], `${p.phrase}: не попадёт в перевод`);
  }
});
