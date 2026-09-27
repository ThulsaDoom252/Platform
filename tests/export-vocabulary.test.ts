import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKeyed } from "../src/lib/keyed-parser";
import { pageToText, type ExportPage } from "../src/lib/export-material";

function vocabularyPage(): ExportPage {
  const raw = readFileSync(
    join(process.cwd(), "scripts", "fixtures", "keyed-vocab.txt"),
    "utf8",
  );
  const parsed = parseKeyed(raw);
  assert.ok(parsed && parsed.type === "VOCAB");

  return {
    title: parsed.title ?? "",
    description: null,
    blocks: [],
    lang: "UK",
    phrases: parsed.phrases.map((p) => ({
      icon: p.icon,
      section: p.section,
      kind: p.kind,
      phrase: p.phrase,
      transcription: p.transcription,
      transcriptionUs: p.transcriptionUs,
      transcriptionUk: p.transcriptionUk,
      translation: p.translation,
      note: p.note,
      examples: p.examples,
    })),
  };
}

test("текстовая выгрузка несёт подсказки", () => {
  const page = vocabularyPage();
  const notes = page.phrases.map((p) => p.note).filter(Boolean) as string[];
  assert.ok(notes.length > 0, "в образце нет подсказок");

  const text = pageToText(page);
  for (const note of notes) {
    assert.ok(text.includes(note), `подсказка потерялась: ${note}`);
  }
});

test("выгрузка несёт слово, произношение, перевод и примеры", () => {
  const page = vocabularyPage();
  const text = pageToText(page);

  for (const p of page.phrases) {
    assert.ok(text.includes(p.phrase), `нет слова ${p.phrase}`);
    assert.ok(text.includes(p.translation ?? ""), `нет перевода ${p.phrase}`);
    for (const ex of p.examples) {
      assert.ok(text.includes(ex.en), `нет примера у ${p.phrase}`);
      assert.ok(text.includes(ex.tr), `нет перевода примера у ${p.phrase}`);
    }
  }

  // Разные произношения показываются оба, одинаковые — один раз.
  const simmer = page.phrases.find((p) => p.phrase === "simmer");
  assert.ok(simmer);
  assert.ok(text.includes("us /ˈsɪmər/ uk /ˈsɪmə/"), "не видно обоих произношений");

  const ingredient = page.phrases.find((p) => p.phrase === "ingredient");
  assert.ok(ingredient);
  assert.ok(!text.includes("us /ɪnˈɡriːdiənt/ uk"), "одинаковые повторены дважды");
});

test("docx собирается и несёт оформление словника", async () => {
  const { pageToDocxBlob } = await import("../src/lib/export-material");
  const blob = await pageToDocxBlob(vocabularyPage());
  assert.ok(blob.size > 2000, `файл подозрительно мал: ${blob.size}`);
});

test("в окне выгрузки показывается сохранённый исходник", async () => {
  const { pageSourceOrText, pageToText } = await import("../src/lib/export-material");
  const page = vocabularyPage();
  const source = "TYPE: VOCAB\nTITLE: Mixed\n\nWORD: urge\nTR: спонукати";

  // Исходник есть — отдаём его как есть, без пересборки.
  assert.equal(pageSourceOrText({ ...page, sourceText: source }), source);

  // Исходника нет — собираем текст из содержимого, как раньше.
  const rebuilt = pageSourceOrText({ ...page, sourceText: null });
  assert.equal(rebuilt, pageToText(page));
  assert.ok(rebuilt.includes("ingredient"));
});
