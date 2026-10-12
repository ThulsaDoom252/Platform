import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pageToText, reportToDocxBlob, reportToText, reportToTextBlob, safeFileName, type ExportPage, type Report } from "../src/lib/export-material";
import { parseKeyed } from "../src/lib/keyed-parser";
import { RULE_BLOCK_TYPES, type RuleBlock } from "../src/lib/rule-blocks";
import { studentReportEntries, studentReportMeta, type ReportMaterialNode } from "../src/lib/student-material-report";

const phrase = { icon: null, section: "Characteristics", kind: "PHRASE", phrase: "reliable", transcription: null, transcriptionUs: "/rɪˈlaɪəbəl/", transcriptionUk: "/rɪˈlaɪəbəl/", translation: "надёжный", description: "someone you can trust", note: "Use reliable for people and information.", examples: [{ en: "She is reliable.", tr: "Она надёжная." }] };
const blocks: RuleBlock[] = [
  { type: "heading", text: "Present Perfect" },
  { type: "callout", label: "Важно", text: "Результат связан с настоящим", hint: true },
  { type: "formula", text: "S + have/has + V3" },
  { type: "text", text: "Точное время не называется." },
  { type: "example", en: "I have finished.", tr: "Я закончил.", why: "Важен результат сейчас." },
  { type: "list", items: ["Experience", "Present result"] },
  { type: "table", headers: ["Subject", "Auxiliary"], rows: [["He", "has"]] },
  { type: "word", word: "mention", us: "/ˈmenʃən/", uk: "/ˈmenʃən/", tr: "упоминать", sense: "to talk about something briefly", pattern: "mention something to someone", examples: [{ en: "He mentioned the agenda.", tr: "Он упомянул повестку." }], notes: ["Do not use mention about."] },
  { type: "form", sign: "?", formula: "Have + S + V3?", en: "Have you seen it?", tr: "Ты это видел?" },
  { type: "marker", word: "already", tr: "уже", en: "I have already eaten.", ru: "Я уже поел.", hintText: "Between have and V3" },
  { type: "grid", title: "Question patterns", headers: ["Auxiliary", "Subject", "V3"], rows: [["Has", "she", "arrived?"]] },
  { type: "link", label: "Полный разбор", ru: "https://example.test/ru", uk: "https://example.test/uk" },
];
const verb = { category: "All forms different", base: "go", baseIpa: "/ɡəʊ/", past: "went", pastIpa: "/went/", participle: "gone", participleIpa: "/ɡɒn/", translation: "идти" };
const page: ExportPage = { title: "All studied materials", description: "Student notes", phrases: [phrase], blocks, verbs: [verb] };
const report: Report = { studentName: "Ксения", meta: ["Уровень: A1"], entries: [{ path: ["Личные материалы", "Грамматика", "Present Perfect"], page }] };
const node = (id: string, changes: Partial<ReportMaterialNode> = {}): ReportMaterialNode => ({ id, name: id, description: null, translationLang: "RU", sourceText: null, phrases: [], blocks: [], verbs: [], children: [], ...changes });

test("text export covers every stored grammar, lexis and tense block type", () => {
  assert.deepEqual(new Set(blocks.map((block) => block.type)), new Set(RULE_BLOCK_TYPES));
  const text = pageToText(page);
  for (const expected of ["Present Perfect", "Результат связан", "S + have/has + V3", "Точное время", "I have finished.", "Я закончил.", "Важен результат сейчас.", "Experience", "Present result", "Subject\tAuxiliary", "He\thas", "mention", "/ˈmenʃən/", "упоминать", "to talk about something briefly", "mention something to someone", "He mentioned the agenda.", "Он упомянул повестку.", "Do not use mention about.", "Have + S + V3?", "Have you seen it?", "Ты это видел?", "already", "уже", "I have already eaten.", "Я уже поел.", "Between have and V3", "Question patterns", "Auxiliary\tSubject\tV3", "Has\tshe\tarrived?", "Полный разбор", "https://example.test/ru", "https://example.test/uk"]) assert.ok(text.includes(expected), `Lost content: ${expected}`);
});

test("mixed pages preserve dictionaries, definitions, translations, examples and tips", () => {
  const text = pageToText(page);
  for (const expected of [phrase.section, phrase.phrase, phrase.translation, phrase.description, phrase.note, phrase.transcriptionUs, phrase.examples[0].en, phrase.examples[0].tr]) assert.ok(text.includes(expected));
  assert.ok(text.includes("Present Perfect"));
});

test("irregular verbs include all three forms, pronunciation, translation and category", () => {
  const text = pageToText({ ...page, blocks: [], phrases: [] });
  for (const expected of Object.values(verb)) assert.ok(text.includes(expected));
  assert.ok(text.includes("Base form\tPast Simple\tPast Participle\tПеревод"));
});

for (const fixture of ["keyed-rule.txt", "keyed-lexis.txt", "keyed-tense.txt"]) {
  test(`${fixture}: existing lesson document fields survive text export`, () => {
    const parsed = parseKeyed(readFileSync(`scripts/fixtures/${fixture}`, "utf8"));
    assert.ok(parsed && parsed.type !== "VOCAB");
    const text = pageToText({ title: parsed.title ?? fixture, description: null, phrases: [], blocks: parsed.blocks });
    for (const block of parsed.blocks) {
      const inspect = (value: unknown, key: string) => {
        if (["type", "tone", "variant", "icon", "sign"].includes(key)) return;
        if (typeof value === "string" && value.trim()) assert.ok(text.includes(value), `Lost ${key}: ${value}`);
        else if (Array.isArray(value)) value.forEach((entry) => inspect(entry, key));
        else if (value && typeof value === "object") Object.entries(value).forEach(([childKey, entry]) => inspect(entry, childKey));
      };
      inspect(block, "block");
    }
  });
}

test("report inventory preserves folder paths and verb-only/source-only pages without duplicate grants", () => {
  const vocabulary = node("Vocabulary", { phrases: [phrase] });
  const verbs = node("Irregular verbs", { verbs: [verb] });
  const source = node("Legacy source", { sourceText: "Preserved lesson notes" });
  const folder = node("Folder", { children: [vocabulary, verbs, source, node("Empty")] });
  const before = structuredClone(folder);
  const entries = studentReportEntries([{ title: "Общая база", nodes: [folder, vocabulary] }]);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0].path, ["Общая база", "Folder", "Vocabulary"]);
  assert.deepEqual(entries[1].page.verbs, [verb]);
  const text = reportToText({ ...report, entries });
  assert.ok(text.includes("СОДЕРЖАНИЕ") && text.includes("1. Общая база / Folder / Vocabulary"));
  assert.ok(text.includes("Preserved lesson notes"));
  assert.deepEqual(folder, before, "Reading the report changed a material");
});

test("cyclic and deeply nested report trees cannot recurse indefinitely", () => {
  const a = node("a", { phrases: [phrase] });
  const b = node("b", { blocks });
  a.children = [b]; b.children = [a];
  assert.equal(studentReportEntries([{ title: "Personal", nodes: [a, b] }]).length, 2);
  let nested = node("leaf", { verbs: [verb] });
  for (let depth = 0; depth < 1200; depth++) nested = node(`folder-${depth}`, { children: [nested] });
  const entries = studentReportEntries([{ title: "Personal", nodes: [nested] }]);
  assert.equal(entries.length, 1); assert.equal(entries[0].path.length, 1202);
});

test("stored source is a fallback only, never a replacement for manually edited materials", () => {
  assert.ok(pageToText({ ...page, sourceText: "STALE SOURCE" }).includes(phrase.phrase));
  assert.ok(!pageToText({ ...page, sourceText: "STALE SOURCE" }).includes("STALE SOURCE"));
  const source = `Full legacy source ${"long note ".repeat(20_000)}END OF SOURCE`;
  assert.ok(pageToText({ title: "Old page", description: null, phrases: [], blocks: [], sourceText: source }).endsWith("END OF SOURCE"));
});

test("legacy null collections/blocks do not break the rest of the report", () => {
  const legacy = { ...page, blocks: [null, { type: "word", word: "survive", examples: null, notes: null }, { type: "table", headers: null, rows: [null] }, { type: "list", items: null }], phrases: [{ ...phrase, examples: null }] } as unknown as ExportPage;
  const text = pageToText(legacy);
  assert.ok(text.includes("survive") && text.includes(phrase.phrase) && text.includes("gone"));
});

test("report metadata accepts aggregate timestamp strings, missing dates and approximate lessons", () => {
  const student = { level: "A1", lessonsBefore: 5, startedAt: null, approximate: true };
  const now = new Date("2026-10-09T12:00:00Z");
  const meta = studentReportMeta(student, { done: 10, firstAt: "2026-09-04 12:00:00" }, now);
  assert.ok(meta.includes("Проведено уроков: ≈ 15"));
  assert.ok(meta.includes("Занимаемся с: 04.09.2026"));
  assert.deepEqual(studentReportMeta(student, { done: 10, firstAt: new Date("2026-09-04T12:00:00Z") }, now), meta);
  assert.ok(studentReportMeta({ ...student, startedAt: "invalid" }, { done: 10, firstAt: "2026-09-04" }, now).includes("Занимаемся с: 04.09.2026"));
  assert.ok(!studentReportMeta(student, { done: 0, firstAt: null }, now).some((line) => line.startsWith("Занимаемся с:")));
});

test("download is a complete UTF-8 text file with readable Cyrillic and Windows line endings", async () => {
  const blob = reportToTextBlob(report);
  assert.equal(blob.type, "text/plain;charset=utf-8");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(bytes);
  assert.equal(text.replace(/\r\n/g, "\n"), reportToText(report));
  assert.ok(text.includes("Ксения") && text.includes("надёжный"));
  assert.equal(safeFileName('Отчёт — A/B: "Student"', "txt"), "Отчёт — A B Student.txt");
  assert.equal(safeFileName("Student"), "Student.docx");
});

test("existing Word report remains available for mixed pages, verbs and legacy blocks", async () => {
  const blob = await reportToDocxBlob({ ...report, entries: [...report.entries, { path: ["Legacy"], page: { ...page, blocks: [null] as unknown as RuleBlock[] } }] });
  assert.ok(blob.size > 2000);
});

test("teacher report errors are visible and text download does not depend on the Word library", () => {
  const button = readFileSync("src/components/materials/report-button.tsx", "utf8");
  assert.match(button, /try \{\s*const data = await buildStudentReportAction/);
  assert.match(button, /!report && error/);
  assert.ok(button.includes('download("txt")') && button.includes("reportToTextBlob(report)"));
  const loader = readFileSync("src/lib/student-material-report-data.ts", "utf8");
  assert.ok(loader.includes("visibleNodeIds") && !loader.includes("phraseImages") && !loader.includes(".update(") && !loader.includes(".delete("));
});
