import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";
import * as content from "../src/lib/learning-language-content";
import * as regular from "../src/lib/learning-language-regular";
import type { LearningLanguageProgress } from "../src/lib/actions/learning-language";

type Row = Record<string, unknown>;
type Column = { key: string };
type Predicate = (row: Row) => boolean;
const id = "11111111-1111-4111-8111-111111111111", otherId = "22222222-2222-4222-8222-222222222222", teacherId = "33333333-3333-4333-8333-333333333333";
const table = (name: string) => new Proxy({ name } as Record<string, unknown>, { get: (value, key) => key === "name" ? value.name : { key } });
const users = table("users"), cache = table("cache"), jobs = table("jobs");
const idle: LearningLanguageProgress = { language: null, token: null, status: "IDLE", completed: 0, total: 0 };
function compile<T>(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: (key: string) => { assert.ok(key in imports, `Unexpected import: ${key}`); return imports[key]; }, structuredClone, Date, Map, Set, FormData, process: { env: { DEEPL_AUTH_KEY: "test-only" } }, ...globals });
  return exports as T;
}
function fixture(count = 1) {
  const state = { rows: { users: [{ id, role: "STUDENT", learningLanguage: "RU", answers: { q: "unchanged" } }, { id: otherId, role: "STUDENT", learningLanguage: null }] as Row[], cache: [] as Row[], jobs: [] as Row[] }, session: { userId: id, role: "STUDENT" } as { userId: string; role: string } | null,
    segments: Array.from({ length: count }, (_, i): content.LearningSegment => ({ text: `word-${i}`, source: "EN", context: "learning" })), requests: 0, readCount: 0, translationFailure: false, cacheFailure: false, returnUntranslated: false, beforeTranslation: null as (() => Promise<void>) | null, events: [] as string[] };
  const rowsFor = (source: Record<string, unknown>) => state.rows[source.name as keyof typeof state.rows];
  const project = (row: Row, fields?: Record<string, Column>) => fields ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.key]])) : structuredClone(row);
  const ops = {
    eq: (column: Column, value: unknown): Predicate => row => row[column.key] === value,
    and: (...items: Predicate[]): Predicate => row => items.every(item => item(row)),
    or: (...items: Predicate[]): Predicate => row => items.some(item => item(row)),
    isNull: (column: Column): Predicate => row => row[column.key] == null,
    lt: (column: Column, value: Date): Predicate => row => new Date(row[column.key] as string).getTime() < value.getTime(),
    inArray: (column: Column, values: unknown[]): Predicate => row => values.includes(row[column.key]),
  };
  const db = {
    select: (fields?: Record<string, Column>) => {
      state.readCount++;
      let source: Record<string, unknown>, predicate: Predicate = () => true, limit = Infinity;
      const execute = () => { if (source.name === "cache" && state.cacheFailure) throw Error("Cache unavailable"); return rowsFor(source).filter(predicate).slice(0, limit).map(row => project(row, fields)); };
      const query = { from: (next: Record<string, unknown>) => { source = next; return query; }, where: (next: Predicate) => { predicate = next; return query; }, limit: (next: number) => { limit = next; return query; }, then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(execute()).then(resolve) };
      return query;
    },
    update: (source: Record<string, unknown>) => {
      let values: Row, predicate: Predicate = () => true;
      const execute = () => rowsFor(source).filter(predicate).map(row => { Object.assign(row, structuredClone(values)); return structuredClone(row); });
      const query = { set: (next: Row) => { values = next; return query; }, where: (next: Predicate) => { predicate = next; return query; }, returning: async () => execute(), then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(execute()).then(resolve) };
      return query;
    },
    insert: (source: Record<string, unknown>) => ({ values: (values: Row | Row[]) => {
      const entries = Array.isArray(values) ? values : [values];
      const execute = (replace: boolean) => {
        const rows = rowsFor(source);
        for (const entry of entries) {
          const key = source.name === "jobs" ? "studentId" : "id";
          const existing = rows.find(row => row[key] === entry[key]);
          if (existing) { if (replace) Object.assign(existing, structuredClone(entry)); }
          else rows.push(structuredClone(entry));
        }
      };
      return { onConflictDoNothing: async () => execute(false), onConflictDoUpdate: async () => execute(true) };
    } }),
    transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
      const previous = structuredClone(state.rows);
      try { return await run(db); } catch (error) { state.rows = previous; throw error; }
    },
  };
  const service = compile<typeof import("../src/lib/student-learning-language")>("src/lib/student-learning-language.ts", {
    "server-only": {}, "node:crypto": crypto, "drizzle-orm": ops, "@/lib/db": { db }, "@/lib/db/schema": { users, studentLearningTranslations: cache },
    "@/lib/learning-language-content": content, "@/lib/learning-language-regular": regular,
    "@/lib/material-translation": { translateLearningSegments: async (segments: content.LearningSegment[], language: content.LearningLanguage) => {
      state.requests++; if (state.beforeTranslation) await state.beforeTranslation();
      if (state.translationFailure) throw new Error("Translation unavailable");
      if (state.returnUntranslated) return segments.map(segment => segment.text);
      return segments.map(segment => language === "UK" ? `Український: ${segment.text}` : `Русский: ${segment.text}`);
    } },
  });
  const actions = compile<typeof import("../src/lib/actions/learning-language")>("src/lib/actions/learning-language.ts", {
    "node:crypto": crypto, "next/cache": { revalidatePath() {} }, "drizzle-orm": ops, "@/lib/db": { db },
    "@/lib/db/schema": { users, studentLearningTranslations: cache, studentLearningTranslationJobs: jobs }, "@/lib/session": { getSession: async () => state.session },
    "@/lib/learning-language-content": content, "@/lib/student-learning-language": service,
    "@/lib/student-learning-language-inventory": { learningLanguageInventory: async () => structuredClone(state.segments) },
    "@/lib/realtime-server": { publishClassRealtime: async (_: string, event: string) => { state.events.push(event); }, publishUserRealtime: async (_: string, event: string) => { state.events.push(event); } },
  });
  const save = (language: string, studentId = id) => {
    const data = new FormData(); data.set("studentId", studentId); data.set("learningLanguage", language);
    return actions.saveLearningLanguageAction(idle, data);
  };
  return { state, actions, service, save, language: () => state.rows.users[0].learningLanguage, job: () => state.rows.jobs[0] };
}

test("both the student and teacher can save the student's preference after successful preparation", async () => {
  for (const role of ["STUDENT", "TEACHER"]) {
    const f = fixture(); f.state.session = { role, userId: role === "TEACHER" ? teacherId : id };
    const pending = await f.save("UK"); assert.equal(pending.status, "RUNNING"); assert.equal(f.language(), "RU");
    const done = await f.actions.processLearningLanguageBatchAction(id, pending.token!);
    assert.equal(done.status, "DONE"); assert.equal(f.language(), "UK"); assert.equal(f.state.rows.users[1].learningLanguage, null);
    assert.deepEqual(f.state.rows.users[0].answers, { q: "unchanged" }); assert.equal((f.job().segments as unknown[]).length, 0);
    assert.ok(f.state.events.includes("learning-language"));
  }
});

test("a student cannot edit somebody else, anonymous/invalid requests fail before reading private content", async () => {
  for (const session of [null, { role: "STUDENT", userId: otherId }, { role: "ADMIN", userId: id }]) {
    const f = fixture(); f.state.session = session;
    assert.equal((await f.save("UK")).status, "ERROR");
    await assert.rejects(f.actions.learningLanguageProgressAction(id), /доступ/);
    assert.equal(f.state.readCount, 0); assert.equal(f.state.requests, 0); assert.equal(f.state.rows.jobs.length, 0);
  }
  const invalid = fixture(); assert.equal((await invalid.save("UK", "../../users")).status, "ERROR"); assert.equal(invalid.state.readCount, 0);
  const language = fixture(); assert.equal((await language.save("EN")).status, "ERROR"); assert.equal(language.state.requests, 0);
});

test("resumable batches survive leaving/reopening the profile; preference is atomic", async () => {
  const f = fixture(30); const pending = await f.save("UK");
  const first = await f.actions.processLearningLanguageBatchAction(id, pending.token!);
  assert.equal(first.completed, 25); assert.equal(first.status, "RUNNING"); assert.equal(f.language(), "RU");
  const reopened = await f.actions.learningLanguageProgressAction(id); assert.equal(reopened.token, pending.token); assert.equal(reopened.completed, 25);
  const done = await f.actions.processLearningLanguageBatchAction(id, reopened.token!);
  assert.equal(done.completed, 30); assert.equal(done.status, "DONE"); assert.equal(f.language(), "UK"); assert.equal(f.state.requests, 2);
});

test("translation errors keep the old language and completed cache, and retries continue the same job", async () => {
  const f = fixture(30); const pending = await f.save("UK"); await f.actions.processLearningLanguageBatchAction(id, pending.token!);
  f.state.translationFailure = true;
  const failed = await f.actions.processLearningLanguageBatchAction(id, pending.token!);
  assert.equal(failed.status, "ERROR"); assert.equal(failed.completed, 25); assert.equal(f.language(), "RU"); assert.equal(f.state.rows.cache.length, 25);
  f.state.translationFailure = false;
  assert.equal((await f.actions.processLearningLanguageBatchAction(id, pending.token!)).status, "DONE"); assert.equal(f.language(), "UK"); assert.equal(f.state.rows.cache.length, 30);
});

test("two open profiles use a lease and do not pay twice for the same batch", async () => {
  const f = fixture(); const pending = await f.save("UK");
  let release: () => void = () => {}; let started: () => void = () => {};
  const entered = new Promise<void>(resolve => { started = resolve; });
  f.state.beforeTranslation = () => new Promise<void>(resolve => { release = resolve; started(); });
  const first = f.actions.processLearningLanguageBatchAction(id, pending.token!); await entered;
  const second = await f.actions.processLearningLanguageBatchAction(id, pending.token!);
  assert.equal(second.waiting, true); assert.equal(f.state.requests, 1); assert.equal(f.language(), "RU");
  release(); assert.equal((await first).status, "DONE"); assert.equal(f.language(), "UK");
});

test("new content created during preparation is included before the language switches", async () => {
  const f = fixture(); const pending = await f.save("UK");
  f.state.beforeTranslation = async () => { f.state.segments.push({ text: "new word", source: "EN", context: "learning" }); f.state.beforeTranslation = null; };
  const first = await f.actions.processLearningLanguageBatchAction(id, pending.token!);
  assert.equal(first.status, "RUNNING"); assert.equal(first.total, 2); assert.equal(f.language(), "RU");
  assert.equal((await f.actions.processLearningLanguageBatchAction(id, pending.token!)).status, "DONE"); assert.equal(f.state.rows.cache.length, 2);
});

test("stale job tokens cannot replace a newer request; prepared languages are reused on a round trip", async () => {
  const f = fixture(); const old = await f.save("UK"); const newer = await f.save("RU");
  const stale = await f.actions.processLearningLanguageBatchAction(id, old.token!);
  assert.equal(stale.token, newer.token); assert.equal(f.state.requests, 0);
  await f.actions.processLearningLanguageBatchAction(id, newer.token!);
  const uk = await f.save("UK"); await f.actions.processLearningLanguageBatchAction(id, uk.token!);
  const requests = f.state.requests;
  assert.equal((await f.save("RU")).status, "DONE"); assert.equal(f.language(), "RU");
  assert.equal((await f.save("UK")).status, "DONE"); assert.equal(f.language(), "UK"); assert.equal(f.state.requests, requests);
});

test("empty inventories save immediately without any translator request", async () => {
  const f = fixture(0); const saved = await f.save("UK");
  assert.equal(saved.status, "DONE"); assert.equal(f.language(), "UK"); assert.equal(f.state.requests, 0);
});

test("cache is student/language/source specific; content remains fresh and duplicate concurrent reads are coalesced", async () => {
  const f = fixture(0); const word = { word: "cat", translation: "кот", translationLang: "RU", progress: 1 };
  const [first, duplicate] = await Promise.all([f.service.personalizeLearningContent(id, word, "UK"), f.service.personalizeLearningContent(id, word, "UK")]);
  assert.equal(f.state.requests, 1); assert.equal(first.translation, duplicate.translation);
  const next = await f.service.personalizeLearningContent(id, { ...word, progress: 2 }, "UK"); assert.equal(next.progress, 2); assert.equal(f.state.requests, 1);
  await f.service.personalizeLearningContent(otherId, word, "UK"); assert.equal(f.state.requests, 2);
  await f.service.personalizeLearningContent(id, { ...word, word: "dog" }, "UK"); assert.equal(f.state.requests, 3);
  await f.service.personalizeLearningContent(id, { ...word, translation: "котик" }, "UK"); assert.equal(f.state.requests, 4, "A teacher's changed sense/wording must not reuse an obsolete translation");
  assert.equal(f.service.learningSegmentId(id, "RU", f.state.segments[0] ?? { text: "cat", context: "a" }) === f.service.learningSegmentId(id, "UK", { text: "cat", context: "a" }), false);
  assert.equal(word.translation, "кот");
});

test("accounts with no explicit learning preference remain unchanged and do not trigger bulk translation", async () => {
  const f = fixture(0); const value = { word: "cat", translation: "кот" };
  assert.equal(await f.service.personalizeLearningContent(otherId, value), value); assert.equal(f.state.requests, 0);
});

test("English-only cached headwords are repaired without touching other cached values or learner history", async () => {
  const f = fixture(0);
  const segment: content.LearningSegment = { text: "be flustered", source: "EN", context: "Feelings vocabulary", requiresCyrillic: true };
  const key = f.service.learningSegmentId(id, "RU", segment);
  f.state.rows.cache.push({ id: key, studentId: id, language: "RU", translation: "be flustered" },
    { id: "unrelated", studentId: otherId, language: "RU", translation: "unchanged" });
  assert.deepEqual(await f.service.resolveLearningSegments(id, "RU", [segment]), ["Русский: be flustered"]);
  assert.equal(f.state.rows.cache[0].translation, "Русский: be flustered");
  assert.equal(f.state.rows.cache[1].translation, "unchanged");
  assert.deepEqual(f.state.rows.users[0].answers, { q: "unchanged" });
  await f.service.resolveLearningSegments(id, "RU", [segment]); assert.equal(f.state.requests, 1);
});

test("an untranslated response cannot poison new or existing cache entries", async () => {
  const f = fixture(0); f.state.returnUntranslated = true;
  const segment: content.LearningSegment = { text: "be mortified", source: "EN", context: "Feelings vocabulary", requiresCyrillic: true };
  await assert.rejects(f.service.resolveLearningSegments(id, "RU", [segment]), /Перевод не завершён/);
  assert.equal(f.state.rows.cache.length, 0);
  assert.equal(content.validLearningTranslation({ text: "API", source: "EN", context: "Brand" }, "API"), true);
});

test("assigned worksheet overlays preserve answer/grade/attempt JSON byte for byte", async () => {
  const f = fixture(0); f.state.rows.users[0].learningLanguage = "UK";
  const lesson = { regularSections: [{ id: "a", title: "Translate", tone: "exercise", studentHtml: '<ol class="translation-check"><li>Она работает.</li></ol>', teacherHtml: "", defaultOpen: true }] };
  const answers = { "regular-exercise-override:a:1": JSON.stringify({ title: "Edit", instruction: "", kind: "fill", items: [{ prompt: "Она работает.", answers: ["She works."] }] }), "regular-answer:a:1": "She worked", "regular-attempts:a:1": '["She worked"]', "hw:score": "92", "hw:plan-override": '{"kind":"old"}' };
  const result = await f.service.personalizeAssignedLearningContent(id, lesson, answers);
  for (const [key, value] of Object.entries(answers)) if (!key.startsWith("regular-exercise-override:")) assert.equal(result.answers[key], value);
  const override = JSON.parse(result.answers["regular-exercise-override:a:1"]);
  assert.equal(override.translationLanguage, "UK"); assert.deepEqual(override.items[0].answers, ["She works."]);
  assert.notEqual(override.items[0].prompt, "Она работает."); assert.equal(lesson.regularSections[0].studentHtml, '<ol class="translation-check"><li>Она работает.</li></ol>');
});

test("read-only localization failures retain the entire saved payload and report a warning without caching a fake translation", async () => {
  for (const cause of ["translationFailure", "cacheFailure", "returnUntranslated"] as const) {
    const f = fixture(0); f.state[cause] = true;
    const value = { words: [{ word: "gut", translation: "кишка", translationLang: "RU" }],
      plan: [{ mode: "choose", word: { word: "gut", translation: "кишка" }, options: ["кишка", "кот"] }],
      answers: { q: "exact student answer", score: "90" }, attempts: [{ finishedAt: "unchanged" }] };
    const before = JSON.stringify(value); let warnings = 0;
    const result = await f.service.personalizeLearningContent(id, value, "UK", { onWarning: () => { warnings++; } });
    assert.equal(result, value); assert.equal(JSON.stringify(result), before); assert.equal(warnings, 1);
    assert.equal(f.state.rows.cache.length, 0); assert.equal(f.language(), "RU");
    assert.deepEqual(f.state.rows.users[0].answers, { q: "unchanged" });
  }
});

test("strict assignments/grading still reject unavailable or invalid translations before writes", async () => {
  for (const cause of ["translationFailure", "returnUntranslated"] as const) {
    const f = fixture(0); f.state[cause] = true;
    await assert.rejects(f.service.personalizeLearningContent(id, { word: "pretty", translation: "красивый" }, "UK", { strict: true }));
    assert.equal(f.state.rows.cache.length, 0); assert.equal(f.language(), "RU");
  }
});

test("failed assigned lesson reads preserve raw override JSON, grades and attempts, and recover on the next successful read", async () => {
  const f = fixture(0); f.state.rows.users[0].learningLanguage = "UK"; f.state.translationFailure = true;
  const lesson = { words: [{ word: "going to → gonna", translation: "разговорная форма going to" }], regularSections: [{ id: "a", title: "Translate", tone: "exercise", studentHtml: '<ol class="translation-check"><li>Она работает.</li></ol>', teacherHtml: "", defaultOpen: true }] };
  const answers = { "regular-exercise-override:a:1": '{ "title": "Custom", "items": [{"prompt":"Она работает.","answers":["She works."]}] }',
    "regular-answer:a:1": "She worked", "regular-attempts:a:1": '["She worked"]', "hw:score": "92", "hw:plan-override": '{"kind":"old"}' };
  const before = JSON.stringify({ lesson, answers });
  const failed = await f.service.personalizeAssignedLearningContent(id, lesson, answers);
  assert.equal(failed.lesson, lesson); assert.equal(failed.answers, answers); assert.equal(failed.translationWarning, true);
  assert.equal(f.state.rows.cache.length, 0); assert.equal(JSON.stringify({ lesson, answers }), before);
  f.state.translationFailure = false;
  const recovered = await f.service.personalizeAssignedLearningContent(id, lesson, answers);
  assert.notEqual(recovered.lesson.words[0].translation, lesson.words[0].translation); assert.equal(recovered.translationWarning, undefined);
  assert.equal(recovered.answers["hw:score"], "92"); assert.equal(recovered.answers["regular-attempts:a:1"], '["She worked"]');
  assert.equal(JSON.stringify({ lesson, answers }), before);
});
