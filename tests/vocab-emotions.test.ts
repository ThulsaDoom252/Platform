import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMaterial } from "../src/lib/materials-parser";

/**
 * Словник в прежнем виде: значок, слово, транскрипция, тире, перевод,
 * а под ним пример с буллитом. Ключевой формат его не касается, и
 * ломать привычную вставку нельзя.
 */
test("словник с эмодзи и буллитами разбирается целиком", () => {
  const raw = readFileSync(
    join(process.cwd(), "scripts", "fixtures", "vocab-emotions.txt"),
    "utf8",
  );
  const r = parseMaterial(raw, "vocabulary");

  assert.equal(r.title, "VOCABULARY");
  assert.equal(r.description, "ЛЕКСИКА");
  assert.deepEqual(r.warnings, []);
  assert.equal(r.phrases.length, 11);

  for (const p of r.phrases) {
    assert.ok(p.icon, `${p.phrase}: потерян значок`);
    assert.ok(p.transcription, `${p.phrase}: потеряна транскрипция`);
    assert.ok(p.translation, `${p.phrase}: потерян перевод`);
    assert.equal(p.examples.length, 1, `${p.phrase}: пример не один`);
    assert.match(p.section ?? "", /Adjectives/, `${p.phrase}: потеряна категория`);
  }

  const shy = r.phrases.find((p) => p.phrase === "shy");
  assert.ok(shy);
  assert.equal(shy.icon, "🙈");
  assert.equal(shy.transcription, "/ʃaɪ/");
  assert.equal(shy.translation, "сором'язливий");
  assert.deepEqual(shy.examples[0], {
    en: "She is very shy.",
    tr: "Вона дуже сором'язлива.",
  });
});
