import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as drizzleOrm from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { PgDialect } from "drizzle-orm/pg-core";
import * as actualSchema from "../src/lib/db/schema";
import * as learningCache from "../src/lib/global-search-learning-cache";
import { pageTranslationLang } from "../src/lib/translation-lang";
import { collectLearningTranslations, type LearningLanguage } from "../src/lib/learning-language-content";
import { dictionaryEntrySearchItem, searchVisibleDictionaryEntries } from "../src/lib/global-search-vocabulary";
import { SEARCH_CATEGORIES, type GlobalSearchResponse } from "../src/lib/global-search-types";
import type { MaterialNode, MaterialPhrase, MaterialVerb } from "../src/lib/materials";

function phrase(id: string, overrides: Partial<MaterialPhrase> = {}): MaterialPhrase {
  return { id, phrase: "over the moon", icon: "🌙", imageUrl: null, description: null,
    gameImageUrl: null, transcription: null, transcriptionUs: null, transcriptionUk: null,
    translation: "на сьомому небі", note: null, section: null, sectionColor: null,
    kind: "PHRASE", examples: [], ...overrides };
}
function verb(id: string, overrides: Partial<MaterialVerb> = {}): MaterialVerb {
  return { id, base: "go", past: "went", participle: "gone", category: null,
    icon: null, baseIpa: null, pastIpa: null, participleIpa: null,
    translation: "іти", ...overrides };
}
function node(id: string, overrides: Partial<MaterialNode> = {}): MaterialNode {
  return { id, name: "Feelings", icon: "📚", imageUrl: null, description: null,
    type: "FILE", fileKind: null, category: null, sizeLabel: null, pageKind: "VOCAB",
    translationLang: "UK", needsFix: false, mergeCount: 1, imageScale: 100,
    sourceText: null, contentBackupAt: null, createdAt: "2026-10-13T00:00:00Z",
    verbs: [], phrases: [], blocks: [], children: [], ...overrides };
}

type Row = Record<string, unknown>;
type Column = { table: string; key: string };
type Predicate = { op: string; values: unknown[]; strings?: string[] };
type QueryLog = { table?: string; limit?: number };
const tableNames = ["users", "materialNodes", "materialPhrases", "materialBlocks", "irregularVerbs", "studentLearningTranslations", "lessonUnits", "wordDeckActivities", "tongueTwisters"];
const tables = Object.fromEntries(tableNames.map((name) => [name, new Proxy({ table: name }, {
  get: (target, key) => key === "table" ? target.table : { table: target.table, key: String(key) },
})]));

/** Execute the real action against an isolated, read-only relational fixture. */
function actionHarness({ session = { userId: "teacher-one", role: "TEACHER" }, rows = {}, library = [] }: {
  session?: { userId: string; role: string } | null;
  rows?: Record<string, Row[]>;
  library?: MaterialNode[];
} = {}) {
  const reads: QueryLog[] = [];
  const libraryCalls: string[] = [];
  const valueOf = (value: unknown, context: Record<string, Row>): unknown => {
    if (value && typeof value === "object" && "table" in value && "key" in value) {
      const column = value as Column;
      return context[column.table]?.[column.key];
    }
    if (value && typeof value === "object" && "op" in value) {
      const expression = value as Predicate;
      if (expression.op === "pageHint") {
        const nodeId = context.materialNodes.id;
        const texts = (rows.materialPhrases ?? []).filter((row) => row.nodeId === nodeId)
          .flatMap((row) => [row.translation, row.section, row.note] as (string | null)[]);
        texts.push(...(rows.materialBlocks ?? []).filter((row) => row.nodeId === nodeId).map((row) => JSON.stringify(row.data)));
        return pageTranslationLang(texts, (context.materialNodes.translationLang ?? "RU") as "RU" | "UK");
      }
      if (expression.op === "cachedTitle") {
        const phrase = context.materialPhrases;
        return phrase.kind === "NOTE" ? cachedValue(phrase.phrase, null, valueOf(expression.values[0], context), context) : phrase.phrase;
      }
      if (expression.op === "cachedText" || expression.op === "cachedTranslation") {
        const current = valueOf(expression.values[0], context);
        let english = expression.values[1] === null ? null : valueOf(expression.values[1], context);
        if (expression.op === "cachedTranslation" && ((typeof english === "string" && /[\u0400-\u04ff]/.test(english))
          || (expression.values[3] && matches(expression.values[3] as Predicate, context)))) english = null;
        return cachedValue(current, english, valueOf(expression.values[2], context), context);
      }
      if (expression.op === "sql") {
        if (expression.strings!.join("").trim() === "example->>'en'") return context.example?.en;
        if (expression.strings!.join("").trim() === "example->>'tr'") return context.example?.tr;
        if (expression.values.length === 1 && expression.strings!.join("").trim() === "") return valueOf(expression.values[0], context);
      }
    }
    return value;
  };
  const cachedValue = (current: unknown, english: unknown, hint: unknown, context: Record<string, Row>): unknown => {
    const language = context.users?.learningLanguage;
    if (context.materialNodes.scope !== "STUDENT" || (language !== "RU" && language !== "UK")) return current;
    const cache = new Map((rows.studentLearningTranslations ?? [])
      .filter((row) => row.studentId === context.users.id && row.language === language)
      .map((row) => [String(row.id), String(row.translation)]));
    if (english === null) {
      const value = { translationLang: hint, phrases: [{ kind: "NOTE", phrase: "", translation: current }] };
      return learningCache.applyCachedDictionaryTranslations(value, String(context.users.id), language, cache).phrases[0].translation;
    }
    const value = { translationLang: hint, examples: [{ en: english, tr: current }] };
    return learningCache.applyCachedDictionaryTranslations(value, String(context.users.id), language, cache).examples[0].tr;
  };
  const like = (value: unknown, pattern: unknown) => {
    if (typeof value !== "string" || typeof pattern !== "string") return false;
    let source = "^";
    for (let index = 0; index < pattern.length; index++) {
      const char = pattern[index];
      if (char === "\\" && index + 1 < pattern.length) source += pattern[++index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      else if (char === "%") source += ".*";
      else if (char === "_") source += ".";
      else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(source + "$", "isu").test(value);
  };
  const matches = (predicate: Predicate, context: Record<string, Row>): boolean => {
    const values = predicate.values.map((value) => valueOf(value, context));
    switch (predicate.op) {
      case "and": return predicate.values.every((value) => matches(value as Predicate, context));
      case "or": return predicate.values.some((value) => matches(value as Predicate, context));
      case "eq": return values[0] === values[1];
      case "isNull": return values[0] === null;
      case "inArray": return (values[1] as unknown[]).includes(values[0]);
      case "ilike": return like(values[0], values[1]);
      case "sql": {
        const text = predicate.strings!.join("?");
        if (text.includes("coalesce(")) return (values[0] ?? "") !== "VERBS";
        if (text.includes("jsonb_array_elements(")) return (values[0] as { en: string; tr: string }[])
          .some((example) => like(example.en, values[1]) || like(valueOf(predicate.values[2], { ...context, example }), values[3]));
        if (text.startsWith("not exists")) {
          const table = (predicate.values[0] as { table: string }).table;
          const key = (predicate.values[1] as Column).key;
          return !(rows[table] ?? []).some((row) => row[key] === values[2]);
        }
        if (text.includes("= 'STUDENT'")) return (rows.users ?? [])
          .some((user) => user.id === values[2] && user.role === "STUDENT");
        assert.fail(`Unexpected search SQL: ${text}`);
      }
      default: assert.fail(`Unexpected predicate ${predicate.op}`);
    }
  };
  const db = {
    select: (selection: Record<string, unknown>) => {
      const log: QueryLog = {};
      let contexts: Record<string, Row>[] = [];
      let maximum = Infinity;
      let ordering: Column[] = [];
      const query = {
        from: (table: { table: string }) => {
          log.table = table.table; reads.push(log);
          contexts = (rows[table.table] ?? []).map((row) => ({ [table.table]: row }));
          return query;
        },
        innerJoin: (table: { table: string }, condition: Predicate) => {
          contexts = contexts.flatMap((context) => (rows[table.table] ?? [])
            .map((row) => ({ ...context, [table.table]: row }))
            .filter((joined) => matches(condition, joined)));
          return query;
        },
        leftJoin: (table: { table: string }, condition: Predicate) => {
          contexts = contexts.flatMap((context) => {
            const joined = (rows[table.table] ?? []).map((row) => ({ ...context, [table.table]: row }))
              .filter((row) => matches(condition, row));
            return joined.length ? joined : [{ ...context, [table.table]: {} }];
          });
          return query;
        },
        where: (condition: Predicate) => { contexts = contexts.filter((context) => matches(condition, context)); return query; },
        orderBy: (...columns: Column[]) => { ordering = columns; return query; },
        limit: (count: number) => { maximum = count; log.limit = count; return query; },
        then: (resolve: (value: Row[]) => unknown) => {
          if (ordering.length) contexts.sort((left, right) => {
            for (const column of ordering) {
              const leftValue = valueOf(column, left), rightValue = valueOf(column, right);
              if (leftValue === rightValue) continue;
              return String(leftValue).localeCompare(String(rightValue), "en", { numeric: true });
            }
            return 0;
          });
          return Promise.resolve(contexts.slice(0, maximum).map((context) => Object.fromEntries(
            Object.entries(selection).map(([key, column]) => [key, valueOf(column, context)]),
          ))).then(resolve);
        },
      };
      return query;
    },
  };
  const operations = Object.fromEntries(["and", "or", "eq", "ilike", "inArray", "isNull"]
    .map((op) => [op, (...values: unknown[]) => ({ op, values })]));
  const imports: Record<string, unknown> = {
    "drizzle-orm": { ...operations, asc: (column: Column) => column,
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings: [...strings], values }) },
    "@/lib/db": { db }, "@/lib/db/schema": tables,
    "@/lib/materials": { getStudentLibrary: async (userId: string) => { libraryCalls.push(userId); return library; } },
    "@/lib/session": { getSession: async () => session },
    "@/lib/global-search-types": { SEARCH_CATEGORIES },
    "@/lib/global-search-vocabulary": { dictionaryEntrySearchItem, searchVisibleDictionaryEntries },
    "@/lib/global-search-learning-cache": {
      dictionaryPageTranslationHintSql: () => ({ op: "pageHint", values: [] }),
      cachedDictionaryPhraseTitleSql: (hint: unknown) => ({ op: "cachedTitle", values: [hint] }),
      cachedDictionaryTextSql: (current: unknown, english: unknown, hint: unknown) => ({ op: "cachedText", values: [current, english, hint] }),
      cachedDictionaryTranslationSql: (current: unknown, english: unknown, hint: unknown, note: unknown) => ({ op: "cachedTranslation", values: [current, english, hint, note] }),
    },
  };
  const exports = {} as { globalSearchAction: (input: { query: unknown; categories: unknown; includeVocabularyEntries?: unknown }) => Promise<GlobalSearchResponse> };
  const code = ts.transpileModule(readFileSync("src/lib/actions/global-search.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  return { search: exports.globalSearchAction, reads, libraryCalls };
}

test("dictionary content is off unless the exact boolean true is sent, for both roles", async () => {
  for (const role of ["TEACHER", "STUDENT"]) for (const flag of [undefined, false, "true", 1, {}, null]) {
    const visible = node("visible");
    Object.defineProperty(visible, "phrases", { get: () => assert.fail("Disabled search inspected dictionary contents") });
    const harness = actionHarness({ session: { userId: "account-one", role }, library: [visible] });
    const result = await harness.search({ query: "moon", categories: ["MATERIALS"], includeVocabularyEntries: flag });
    assert.equal(result.items.length, 0);
    assert.ok(harness.reads.every((read) => !["materialPhrases", "irregularVerbs"].includes(read.table!)));
  }
});

test("authentication, short/invalid queries and excluded categories prevent all content reads", async () => {
  const denied = actionHarness({ session: null });
  const response = await denied.search({ query: "moon", categories: SEARCH_CATEGORIES, includeVocabularyEntries: true });
  assert.equal(response.error, "UNAUTHORIZED"); assert.equal(denied.reads.length, 0);
  for (const role of ["TEACHER", "STUDENT"]) {
    for (const input of [
      { query: " m ", categories: ["MATERIALS"] },
      { query: 12, categories: ["MATERIALS"] },
      { query: "moon", categories: [] },
      { query: "moon", categories: "MATERIALS" },
    ]) {
      const harness = actionHarness({ session: { userId: "account-one", role } });
      assert.equal((await harness.search({ ...input, includeVocabularyEntries: true })).items.length, 0);
      assert.equal(harness.reads.length, 0); assert.equal(harness.libraryCalls.length, 0);
    }
  }
  const student = actionHarness({ session: { userId: "student-one", role: "STUDENT" } });
  assert.equal((await student.search({ query: "moon", categories: ["STUDENTS", "GAMES", "LESSONS"], includeVocabularyEntries: true })).items.length, 0);
  assert.equal(student.libraryCalls.length, 0); assert.equal(student.reads.length, 0);
  const teacher = actionHarness();
  await teacher.search({ query: "moon", categories: ["LESSONS"], includeVocabularyEntries: true });
  assert.deepEqual(teacher.reads.map((read) => read.table), ["lessonUnits"]);
});

test("student searches only the session's visible personalized library, including nested granted dictionaries", async () => {
  const visible = node("granted-dictionary", { phrases: [phrase("entry-visible")] });
  const own = node("personal-dictionary", { name: "Personal words", phrases: [phrase("entry-own", { phrase: "moonlit", translation: "місячний" })] });
  const harness = actionHarness({ session: { userId: "student-one", role: "STUDENT" },
    library: [node("granted-section", { type: "FOLDER", children: [visible] }), own],
    rows: { materialPhrases: [{ id: "hidden-other-student", phrase: "moon" }, { id: "ungranted-shared", phrase: "moon" }] } });
  const result = await harness.search({ query: "  MOON  ", categories: SEARCH_CATEGORIES, includeVocabularyEntries: true });
  assert.deepEqual(Array.from(result.items, (item) => item.id), ["phrase:entry-visible", "phrase:entry-own"]);
  assert.deepEqual(harness.libraryCalls, ["student-one"]); assert.equal(harness.reads.length, 0);
  assert.equal(result.items[0].title, "over the moon");
  assert.equal(result.items[0].subtitle, "Feelings · на сьомому небі");
  assert.equal(result.items[0].href, "/student/materials?node=granted-dictionary&entry=entry-visible");
  assert.equal((await harness.search({ query: "сьомому", categories: ["MATERIALS"], includeVocabularyEntries: true })).items[0].id, "phrase:entry-visible");
  assert.equal((await harness.search({ query: "седьмом", categories: ["MATERIALS"], includeVocabularyEntries: true })).items.length, 0);
});

test("student entry matching includes visible notes, sections and both example texts but never game-only descriptions or source", () => {
  const visible = node("dictionary", { sourceText: "private source token", phrases: [phrase("word", {
    phrase: "delighted", note: "Usage tip", section: "Happy feelings", description: "hidden-clue-token",
    examples: [{ en: "The crowd cheered.", tr: "Натовп радів." }],
  })] });
  for (const query of ["delighted", "usage", "feelings", "crowd", "натовп", "сьомому"]) {
    assert.equal(searchVisibleDictionaryEntries([visible], query, 12)[0].id, "phrase:word");
  }
  for (const query of ["hidden-clue-token", "private source token"]) assert.equal(searchVisibleDictionaryEntries([visible], query, 12).length, 0);
});

test("only the reader-visible entries are searched and irregular verb forms are supported", () => {
  const nodes = [
    node("folder", { type: "FOLDER", phrases: [phrase("hidden-folder")] }),
    node("attachment", { fileKind: "PDF", phrases: [phrase("hidden-attachment")], verbs: [verb("hidden-attachment-verb")] }),
    node("rule", { blocks: [{ type: "text", text: "Rule" }] as MaterialNode["blocks"], phrases: [phrase("hidden-rule")] }),
    node("verbs", { pageKind: "VERBS", verbs: [verb("verb-one")], phrases: [phrase("hidden-verb-phrase")] }),
    node("empty-verbs", { pageKind: "VERBS", phrases: [phrase("empty-verbs-phrase")] }),
    node("legacy", { pageKind: null, fileKind: "", phrases: [phrase("legacy-phrase")] }),
  ];
  assert.deepEqual(searchVisibleDictionaryEntries(nodes, "moon", 12).map((item) => item.id), ["phrase:empty-verbs-phrase", "phrase:legacy-phrase"]);
  for (const query of ["go", "went", "gone", "іти"]) {
    const hit = searchVisibleDictionaryEntries(nodes, query, 12)[0];
    assert.equal(hit.id, "verb:verb-one"); assert.equal(hit.title, "go · went · gone");
    assert.equal(hit.href, "/student/materials?node=verbs&entry=verb-one");
  }
});

test("teacher entry queries obey the material explorer's ownership scopes and actual reader precedence", async () => {
  const scopes: [string, string, string | null, string, string | null][] = [
    ["shared", "MATERIAL", null, "FILE", null],
    ["mine", "PERSONAL", "teacher-one", "FILE", "VOCAB"],
    ["student", "STUDENT", "student-one", "FILE", "VOCAB"],
    ["other-personal", "PERSONAL", "teacher-two", "FILE", "VOCAB"],
    ["owned-shared", "MATERIAL", "student-one", "FILE", "VOCAB"],
    ["mistakes", "MISTAKE", "student-one", "FILE", "VOCAB"],
    ["orphan", "STUDENT", "missing-user", "FILE", "VOCAB"],
    ["teacher-student-scope", "STUDENT", "teacher-two", "FILE", "VOCAB"],
    ["folder", "MATERIAL", null, "FOLDER", "VOCAB"],
    ["rule", "MATERIAL", null, "FILE", "RULE"],
    ["verbs", "MATERIAL", null, "FILE", "VERBS"],
    ["empty-verbs", "MATERIAL", null, "FILE", "VERBS"],
    ["attachment", "MATERIAL", null, "FILE", "VOCAB"],
  ];
  const rows = {
    users: [{ id: "student-one", role: "STUDENT", name: "Victoria" }, { id: "teacher-one", role: "TEACHER", name: "Vlad" }, { id: "teacher-two", role: "TEACHER", name: "Other" }],
    materialNodes: scopes.map(([id, scope, ownerId, type, pageKind]) => ({ id, scope, ownerId, type, pageKind,
      fileKind: id === "attachment" ? "PDF" : id === "empty-verbs" ? "" : null,
      name: id + " dictionary", icon: "📚", description: null, category: null })),
    materialPhrases: scopes.map(([id]) => ({ id: id + "-entry", nodeId: id, phrase: "over the moon", translation: "happy", note: null, section: null, description: null, icon: null, examples: [], sortOrder: 0 })),
    materialBlocks: [{ id: "rule-block", nodeId: "rule" }],
    irregularVerbs: [
      { id: "verb-entry", nodeId: "verbs", base: "moon", past: "mooned", participle: "mooned", translation: null, category: null, icon: null, sortOrder: 0 },
      { id: "attachment-verb", nodeId: "attachment", base: "moon", past: "mooned", participle: "mooned", translation: null, category: null, icon: null, sortOrder: 0 },
    ],
  };
  const harness = actionHarness({ rows });
  const result = await harness.search({ query: "moon", categories: ["MATERIALS"], includeVocabularyEntries: true });
  assert.deepEqual(Array.from(result.items, (item) => item.id), ["phrase:empty-verbs-entry", "phrase:mine-entry", "phrase:shared-entry", "phrase:student-entry", "verb:verb-entry"]);
  const byId = new Map(result.items.map((item) => [item.id, item]));
  assert.equal(byId.get("phrase:mine-entry")!.href, "/teacher/materials?view=mine&node=mine&entry=mine-entry");
  assert.equal(byId.get("phrase:shared-entry")!.href, "/teacher/materials?view=shared&node=shared&entry=shared-entry");
  assert.equal(byId.get("phrase:student-entry")!.href, "/teacher/materials?view=students&student=student-one&node=student&entry=student-entry");
  assert.equal(byId.get("phrase:student-entry")!.subtitle, "student dictionary · happy · Victoria");
  assert.ok(harness.reads.filter((read) => ["materialPhrases", "irregularVerbs"].includes(read.table!)).every((read) => read.limit === 12));
});

test("teacher matches phrase translations, notes, descriptions and example values, not JSON field names; wildcards are literal", async () => {
  const harness = actionHarness({ rows: {
    materialNodes: [{ id: "dict", scope: "MATERIAL", ownerId: null, type: "FILE", fileKind: null, pageKind: null, name: "Feelings", icon: null }],
    materialPhrases: [{ id: "phrase", nodeId: "dict", phrase: "delighted 100%", translation: "радісний", note: "idiomatic usage",
      description: "game clue", section: "Emotions", icon: null, sortOrder: 0, examples: [{ en: "The crowd cheered.", tr: "Натовп радів." }] }],
  } });
  for (const query of ["100%", "радісний", "usage", "game clue", "crowd", "натовп", "emotions"]) {
    const response = await harness.search({ query, categories: ["MATERIALS"], includeVocabularyEntries: true });
    assert.ok(response.items.some((item) => item.id === "phrase:phrase"), query);
  }
  for (const query of ["_%", "translation", "zz%", "\\%", "en", "tr"])
    assert.equal((await harness.search({ query, categories: ["MATERIALS"], includeVocabularyEntries: true })).items
      .filter((item) => item.id.startsWith("phrase:")).length, 0, query);
});

test("node matches and dictionary entry hits share the existing per-category result cap", async () => {
  const entries = Array.from({ length: 30 }, (_, index) => phrase(`entry-${index}`, { phrase: `moon phrase ${index}` }));
  const library = [node("named-node", { name: "Moon folder", type: "FOLDER" }), node("dict", { phrases: entries })];
  const student = actionHarness({ session: { userId: "student-one", role: "STUDENT" }, library });
  const studentResult = await student.search({ query: "moon", categories: ["MATERIALS"], includeVocabularyEntries: true });
  assert.equal(studentResult.items.length, 12); assert.equal(studentResult.items[0].id, "named-node");
  assert.equal(searchVisibleDictionaryEntries(library, "moon", 0).length, 0);
  const teacher = actionHarness({ rows: {
    materialNodes: [
      { id: "named", name: "Moon folder", type: "FOLDER", fileKind: null, scope: "MATERIAL", ownerId: null },
      { id: "dict", name: "Feelings", type: "FILE", fileKind: null, scope: "MATERIAL", ownerId: null, pageKind: "VOCAB" },
    ],
    materialPhrases: entries.map((entry, index) => ({ ...entry, nodeId: "dict", sortOrder: index })),
  } });
  const teacherResult = await teacher.search({ query: "moon", categories: ["MATERIALS"], includeVocabularyEntries: true });
  assert.equal(teacherResult.items.length, 12); assert.equal(teacherResult.items[0].id, "named");
});

test("the same word in distinct dictionaries remains separate, with URL-escaped context and entry IDs", () => {
  const results = searchVisibleDictionaryEntries([
    node("first & second", { phrases: [phrase("entry & one")] }),
    node("third", { phrases: [phrase("entry two")] }),
  ], "moon", 12);
  assert.equal(results.length, 2); assert.notEqual(results[0].id, results[1].id);
  assert.equal(results[0].href, "/student/materials?node=first%20%26%20second&entry=entry%20%26%20one");
  assert.equal(dictionaryEntrySearchItem({ id: "record", nodeId: "node", nodeName: "Vocabulary", title: "word",
    translation: null, icon: null, kind: "phrase", scope: "STUDENT", ownerId: "student & id" }, "TEACHER").href,
  "/teacher/materials?view=students&student=student%20%26%20id&node=node&entry=record");
});

test("the search action is read-only and does not request translation or persist any account preference", () => {
  const source = readFileSync("src/lib/actions/global-search.ts", "utf8");
  assert.match(source, /^"use server";/);
  for (const forbidden of [/db\.insert\(/, /db\.update\(/, /db\.delete\(/, /revalidatePath/, /translateLearningSegments/, /set.*Preference/])
    assert.doesNotMatch(source, forbidden);
});

test("the real Drizzle PostgreSQL compiler emits parameterized, scoped and bounded entry queries without a database connection", async () => {
  const queries: { sql: string; parameters: unknown[] }[] = [];
  const db = drizzle(async (sql, parameters) => { queries.push({ sql, parameters }); return { rows: [] }; });
  const imports: Record<string, unknown> = {
    "drizzle-orm": drizzleOrm, "@/lib/db": { db }, "@/lib/db/schema": actualSchema,
    "@/lib/materials": { getStudentLibrary: () => assert.fail("Teacher query requested a student library") },
    "@/lib/session": { getSession: async () => ({ userId: "00000000-0000-0000-0000-000000000001", role: "TEACHER" }) },
    "@/lib/global-search-types": { SEARCH_CATEGORIES },
    "@/lib/global-search-vocabulary": { dictionaryEntrySearchItem, searchVisibleDictionaryEntries },
    "@/lib/global-search-learning-cache": learningCache,
  };
  const exports = {} as { globalSearchAction: (input: unknown) => Promise<GlobalSearchResponse> };
  const code = ts.transpileModule(readFileSync("src/lib/actions/global-search.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  const query = "100%_ ' quoted";
  await exports.globalSearchAction({ query, categories: ["MATERIALS"], includeVocabularyEntries: true });
  const entryQueries = queries.filter((request) => / from "(?:material_phrases|irregular_verbs)"/.test(request.sql));
  assert.equal(entryQueries.length, 2);
  for (const request of entryQueries) {
    assert.match(request.sql, /inner join "material_nodes"/);
    assert.match(request.sql, /"material_nodes"\."file_kind" is null/);
    assert.match(request.sql, /"material_nodes"\."owner_id" is null/);
    assert.match(request.sql, /exists \(select 1 from "users" where "users"\."id" = "material_nodes"\."owner_id" and "users"\."role" = 'STUDENT'\)/);
    assert.match(request.sql, /limit \$\d+$/);
    assert.equal(request.parameters.at(-1), 12);
    assert.ok(request.parameters.includes("%100\\%\\_ ' quoted%"));
    assert.ok(!request.sql.includes("quoted"));
  }
  assert.match(entryQueries.find((request) => request.sql.includes('from "material_phrases"'))!.sql,
    /jsonb_array_elements\("material_phrases"\."examples"\) as example/);
});

function cachedRows(value: unknown, studentId: string, language: LearningLanguage, translations: Record<string, string>): Row[] {
  return collectLearningTranslations(value, language).segments.map((segment) => ({
    id: learningCache.dictionaryLearningSegmentId(studentId, language, segment),
    studentId, language, translation: translations[segment.text] ?? assert.fail(`Missing fixture translation for ${segment.text}`),
  }));
}

test("teacher student-owned dictionary matches and previews the saved display-language overlay, not obsolete source translations", async () => {
  const item = { id: "rattle-entry", nodeId: "student-dictionary", phrase: "rattle", translation: "волноваться",
    kind: "PHRASE", note: "Обычный совет", section: "Feelings", description: null, icon: null, sortOrder: 0,
    examples: [{ en: "She felt rattled.", tr: "Она испытывала тревогу." }] };
  const payload = { translationLang: "RU", phrases: [item] };
  const rows = {
    users: [{ id: "student-one", role: "STUDENT", name: "Victoria", learningLanguage: "UK" }],
    materialNodes: [{ id: "student-dictionary", scope: "STUDENT", ownerId: "student-one", type: "FILE",
      fileKind: null, pageKind: "VOCAB", translationLang: "RU", name: "Feelings", icon: "📚" }],
    materialPhrases: [item],
    studentLearningTranslations: cachedRows(payload, "student-one", "UK", {
      rattle: "знервуватися", "Обычный совет": "Підказка для розмови", "She felt rattled.": "Вона почувалася збентеженою.",
    }),
  };
  const originalRows = JSON.stringify(rows);
  const harness = actionHarness({ rows });
  for (const query of ["rattle", "знерв", "підказка", "збентеженою", "She felt"]) {
    const result = await harness.search({ query, categories: ["MATERIALS"], includeVocabularyEntries: true });
    assert.equal(result.items.length, 1, query);
    assert.equal(result.items[0].title, "rattle");
    assert.equal(result.items[0].subtitle, "Feelings · знервуватися · Victoria");
    assert.equal(result.items[0].href, "/teacher/materials?view=students&student=student-one&node=student-dictionary&entry=rattle-entry");
  }
  for (const query of ["волноваться", "обычный", "испытывала"])
    assert.equal((await harness.search({ query, categories: ["MATERIALS"], includeVocabularyEntries: true })).items.length, 0, query);
  assert.equal(JSON.stringify(rows), originalRows, "Search changed a source row or cache");
});

test("saved explanatory NOTE titles and irregular-verb translations follow the student's language without translating English/category text", async () => {
  const note = { id: "note-entry", nodeId: "notes", phrase: "Полезные слова", translation: "Важные нюансы",
    kind: "NOTE", note: null, section: "Stored category", description: null, icon: null, examples: [], sortOrder: 0 };
  const entry = { id: "verb-entry", nodeId: "verbs", base: "go", past: "went", participle: "gone", translation: "идти",
    category: "Motion category", icon: null, sortOrder: 0 };
  const roots = [
    { translationLang: "RU", phrases: [note] },
    { translationLang: "RU", verbs: [entry] },
  ];
  const harness = actionHarness({ rows: {
    users: [{ id: "student-one", role: "STUDENT", learningLanguage: "UK", name: "Victoria" }],
    materialNodes: ["notes", "verbs"].map((id) => ({ id, scope: "STUDENT", ownerId: "student-one", type: "FILE",
      fileKind: null, pageKind: id === "verbs" ? "VERBS" : "VOCAB", translationLang: "RU", name: id })),
    materialPhrases: [note], irregularVerbs: [entry],
    studentLearningTranslations: cachedRows(roots, "student-one", "UK", {
      "Полезные слова": "Корисні слова", "Важные нюансы": "Важливі нюанси", go: "іти",
    }),
  } });
  const translatedNote = (await harness.search({ query: "корисні", categories: ["MATERIALS"], includeVocabularyEntries: true })).items[0];
  assert.equal(translatedNote.title, "Корисні слова"); assert.equal(translatedNote.subtitle, "notes · Важливі нюанси · Victoria");
  const translatedVerb = (await harness.search({ query: "іти", categories: ["MATERIALS"], includeVocabularyEntries: true })).items[0];
  assert.equal(translatedVerb.title, "go · went · gone"); assert.equal(translatedVerb.subtitle, "verbs · іти · Victoria");
  for (const query of ["went", "Motion category", "Stored category"])
    assert.equal((await harness.search({ query, categories: ["MATERIALS"], includeVocabularyEntries: true })).items.length, 1, query);
  assert.equal((await harness.search({ query: "полезные", categories: ["MATERIALS"], includeVocabularyEntries: true })).items.length, 0);
});

test("missing, stale, other-student and other-language cache records preserve stored fields without a cache fill", async () => {
  const item = { id: "entry", nodeId: "dict", phrase: "rattle", translation: "волноваться", kind: "PHRASE",
    note: null, section: null, examples: [], icon: null, sortOrder: 0 };
  const key = cachedRows({ translationLang: "RU", phrases: [item] }, "student-one", "UK", { rattle: "знервуватися" })[0];
  for (const cache of [[], [{ ...key, studentId: "student-two" }], [{ ...key, language: "RU" }], [{ ...key, id: "stale-source-key" }]]) {
    const harness = actionHarness({ rows: {
      users: [{ id: "student-one", role: "STUDENT", learningLanguage: "UK", name: "Victoria" }],
      materialNodes: [{ id: "dict", scope: "STUDENT", ownerId: "student-one", type: "FILE", fileKind: null,
        pageKind: "VOCAB", translationLang: "RU", name: "Feelings" }],
      materialPhrases: [item], studentLearningTranslations: cache,
    } });
    const result = await harness.search({ query: "rattle", categories: ["MATERIALS"], includeVocabularyEntries: true });
    assert.equal(result.items[0].subtitle, "Feelings · волноваться · Victoria");
    assert.equal((await harness.search({ query: "знерв", categories: ["MATERIALS"], includeVocabularyEntries: true })).items.length, 0);
  }
});

test("cached dictionary keys stay identical to the canonical learningSegmentId with escaped, multilingual and UTF-16-boundary text", () => {
  const canonicalSource = readFileSync("src/lib/student-learning-language.ts", "utf8");
  const start = canonicalSource.indexOf("export function learningSegmentId(");
  const end = canonicalSource.indexOf("\nconst pending", start);
  const canonical = {} as { learningSegmentId: typeof learningCache.dictionaryLearningSegmentId };
  runInNewContext(ts.transpileModule(canonicalSource.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: canonical, createHash });
  const originals = ["rattle", 'quote " slash \\ newline\nКирилиця', "\u00a0\ufeff🙂\u2028text",
    "x".repeat(999) + "🙂", "🙂".repeat(501), "a🙂".repeat(501), "ы".repeat(1001)];
  for (const phrase of originals) {
    const plan = collectLearningTranslations({ translationLang: "RU", phrases: [{ phrase, translation: null }] }, "UK");
    for (const segment of plan.segments) {
      assert.equal(learningCache.dictionaryLearningSegmentId("student-one", "UK", segment), canonical.learningSegmentId("student-one", "UK", segment));
    }
    const { sql } = new PgDialect().sqlToQuery(learningCache.learningJsonPrefixSql(drizzleOrm.sql`${phrase}::text`));
    assert.match(sql, /sum\(case when octet_length\(character\) = 4 then 2 else 1 end\)/);
    assert.match(sql, /units = 1001/); assert.match(sql, /chr\(92\) \|\| 'u' \|\| to_hex\(55296/);
  }
});

test("bounded pure cached hydration uses page hints, preserves uncached fields and does not change originals or hidden/source metadata", () => {
  const value = { translationLang: "RU", sourceText: "Original source", phrases: [
    { phrase: "rattle", translation: "волноваться", note: "Обычный совет", description: "A game clue", section: "Category",
      examples: [{ en: "She felt rattled.", tr: "Она испытывала тревогу." }] },
    { phrase: "cat", translation: "кот", note: null, examples: [] },
  ] };
  const original = JSON.stringify(value);
  const plan = collectLearningTranslations(value, "UK");
  assert.equal(plan.segments.find((segment) => segment.text === "cat")!.source, "EN");
  const noteSegment = plan.segments.find((segment) => segment.text === "Обычный совет")!;
  assert.equal(noteSegment.source, "RU"); assert.equal(noteSegment.context, "English learning translation");
  const rattle = plan.segments.find((segment) => segment.text === "rattle")!;
  const cache = new Map([[learningCache.dictionaryLearningSegmentId("student-one", "UK", rattle), "знервуватися"]]);
  const hydrated = learningCache.applyCachedDictionaryTranslations(value, "student-one", "UK", cache);
  assert.equal(hydrated.phrases[0].translation, "знервуватися");
  assert.equal(hydrated.phrases[1].translation, "кот");
  assert.equal(hydrated.phrases[0].phrase, "rattle"); assert.equal(hydrated.phrases[0].description, "A game clue");
  assert.equal(hydrated.phrases[0].section, "Category"); assert.equal(hydrated.sourceText, "Original source");
  assert.equal(JSON.stringify(value), original);
});

test("cached SQL is read-only and guards cache by exact key, student and current language without calling translation services", () => {
  const source = readFileSync("src/lib/global-search-learning-cache.ts", "utf8");
  for (const forbidden of [/db\.insert\(/, /db\.update\(/, /db\.delete\(/, /translateLearningSegments/, /resolveLearningSegments/, /ensure.*Schema/])
    assert.doesNotMatch(source, forbidden);
  const { sql } = new PgDialect().sqlToQuery(learningCache.cachedDictionaryTextSql(
    drizzleOrm.sql`${actualSchema.materialPhrases.translation}`, drizzleOrm.sql`${actualSchema.materialPhrases.phrase}`,
    learningCache.dictionaryPageTranslationHintSql(),
  ));
  assert.match(sql, /"student_learning_translations"\."id" = encode\(sha256/);
  assert.match(sql, /"student_learning_translations"\."student_id" = "users"\."id"/);
  assert.match(sql, /"student_learning_translations"\."language"::text = "users"\."learning_language"::text/);
  assert.match(sql, /coalesce\(\(select "student_learning_translations"\."translation"/);
});
