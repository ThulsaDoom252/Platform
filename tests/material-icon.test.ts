import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { automaticMaterialIcon, resolveMaterialIcon } from "../src/lib/material-icon";
import { PICKER_GROUPS } from "../src/lib/icons-data";

test("material icon is selected automatically from the name, with a vocabulary fallback", () => {
  assert.equal(automaticMaterialIcon("Food"), "🍎");
  assert.equal(automaticMaterialIcon("Travel"), "✈️");
  assert.equal(automaticMaterialIcon("qzxv"), "📚");
  assert.equal(automaticMaterialIcon(""), "📚");
  for (const suffix of [" — Vocabulary", " – Словарь", " - Словник"])
    assert.equal(automaticMaterialIcon(`Travel${suffix}`), automaticMaterialIcon("Travel"));
  assert.equal(resolveMaterialIcon("Travel", undefined), "✈️");
  assert.equal(resolveMaterialIcon("Travel", null), "✈️");
});

test("manual icon takes precedence over automatic selection and survives renaming", () => {
  for (const name of ["Food", "Travel", "qzxv", ""])
    assert.equal(resolveMaterialIcon(name, "🐱"), "🐱");
  assert.equal(resolveMaterialIcon("Food", "  🐱  "), "🐱");
  assert.notEqual(resolveMaterialIcon("Food", null), "🐱");
});

test("all icons offered by the existing picker are accepted, including ZWJ/modifier sequences", () => {
  for (const group of PICKER_GROUPS) for (const [icon] of group.icons)
    assert.equal(resolveMaterialIcon("Vocabulary", icon), icon);
  for (const name of ["Food", "Travel", "Characteristics", "Household chores — Vocabulary"])
    assert.equal(resolveMaterialIcon(name, automaticMaterialIcon(name)), automaticMaterialIcon(name));
});

test("server rejects arbitrary text, oversized strings and malformed icon types", () => {
  for (const value of ["", " ", "cat", "<script>alert(1)</script>", "📚🐱", "x".repeat(10000), 1, {}, [], false])
    assert.equal(resolveMaterialIcon("Food", value), null);
});

test("copy action validates and persists the chosen node icon without changing copied word icons or ownership", () => {
  const source = readFileSync("src/lib/actions/lessons.ts", "utf8");
  const start = source.indexOf("export async function addLessonVocabularyToMaterialsAction(");
  const end = source.indexOf("\nexport async function", start + 1);
  const action = source.slice(start, end < 0 ? undefined : end);
  assert.match(action, /icon\?: string \| null/);
  assert.match(action, /await requireTeacher\(\)/);
  assert.match(action, /resolveMaterialIcon\(name, input\?\.icon\)/);
  assert.ok(action.indexOf("if (!icon)") < action.indexOf("await Promise.all"));
  assert.match(action, /ownerId: studentId,\s+name,\s+icon,/);
  assert.match(action, /eq\(lessonUnits.authorId, session.userId\)/);
  assert.match(action, /eq\(materialNodes.ownerId, studentId\)/);
  assert.match(action, /icon: word.icon/);
  assert.ok(!action.includes('icon: "📚"'));
});

test("the lesson dialog offers automatic/manual selection and submits the displayed icon", () => {
  const source = readFileSync("src/components/lessons/lesson-vocab-to-materials.tsx", "utf8");
  assert.match(source, /selectedIcon, setSelectedIcon\] = useState<string \| null>\(null\)/);
  assert.match(source, /const icon = selectedIcon \?\? automaticIcon/);
  assert.match(source, /<IconPicker value=\{icon\}/);
  assert.match(source, /setSelectedIcon\(next\); setPickingIcon\(false\)/);
  assert.match(source, /setSelectedIcon\(null\)/);
  assert.match(source, /parentId: parentId \|\| null,\s+name,\s+icon,/);
  assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(source, /aria-expanded=\{pickingIcon\}/);
  assert.match(source, /iconButton.current\?\.focus\(\)/);
});

test("the real copy action saves manual/automatic icons and preserves all vocabulary data in an isolated transaction", async () => {
  const source = readFileSync("src/lib/actions/lessons.ts", "utf8");
  const start = source.indexOf("export async function addLessonVocabularyToMaterialsAction(");
  const actionSource = source.slice(start, source.indexOf("\nexport async function", start + 1));
  const code = ts.transpileModule(actionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const selected of ["🐱", undefined, "<script>"]) {
    const writes: { table: string; row: Record<string, unknown> | Record<string, unknown>[] }[] = [];
    let selectCount = 0;
    const word = { word: "friendly", icon: "😊", translation: "дружелюбный", examples: [{ en: "A friendly person.", tr: "Дружелюбный человек." }], imageUrl: "/test-only.jpg" };
    const rows = [[{ id: "lesson-local", kind: "REGULAR" }], [{ id: "student-local" }], [word], [{ value: 2 }]];
    const db = {
      select: () => {
        const result = rows[selectCount++];
        const query = { from: () => query, where: () => query, limit: () => query, orderBy: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
        return query;
      },
      transaction: async (run: (tx: unknown) => unknown) => run({ insert: (table: { table: string }) => ({ values: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        writes.push({ table: table.table, row });
        return { returning: async () => [{ id: "material-local" }] };
      } }) }),
    };
    const tables = Object.fromEntries(["lessonUnits", "lessonWords", "materialNodes", "materialPhrases", "phraseImages", "users"].map((table) => [table, { table, id: `${table}.id` }]));
    const context = { exports: {} as { addLessonVocabularyToMaterialsAction: (unitId: string, input: unknown) => Promise<{ nodeId?: string; error?: string }> }, db, ...tables, requireTeacher: async () => ({ userId: "teacher-local" }), resolveMaterialIcon, eq: () => null, and: () => null, isNull: () => null, asc: () => null, max: () => null, randomUUID: () => "phrase-local", revalidatePath: () => {} };
    Object.assign(context, { studentLearningLanguage: async () => null, personalizeLearningContent: async (_studentId: string, value: unknown) => value });
    runInNewContext(code, context);
    const result = await context.exports.addLessonVocabularyToMaterialsAction("lesson-local", { studentId: "student-local", name: "Travel", icon: selected });
    if (selected === "<script>") { assert.ok(result.error); assert.equal(writes.length, 0); assert.equal(selectCount, 0); continue; }
    assert.equal(result.nodeId, "material-local");
    const node = writes.find((write) => write.table === "materialNodes")!.row as Record<string, unknown>;
    assert.equal(node.icon, selected ?? "✈️"); assert.equal(node.ownerId, "student-local"); assert.equal(node.scope, "STUDENT"); assert.equal(node.sortOrder, 3);
    const phrase = (writes.find((write) => write.table === "materialPhrases")!.row as Record<string, unknown>[])[0];
    assert.equal(phrase.icon, "😊"); assert.equal(phrase.phrase, "friendly"); assert.equal(phrase.translation, word.translation); assert.equal(phrase.examples, word.examples);
    assert.equal((writes.find((write) => write.table === "phraseImages")!.row as Record<string, unknown>[])[0].url, word.imageUrl);
  }
});
