import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { buildRevision, planWords } from "../src/lib/revision-build";
import { DEFAULT_SHOW } from "../src/lib/revision-modes";
import { REVISION_MODES } from "../src/lib/revision-modes";
import { normalizeOptionalTimerSeconds } from "../src/lib/timer-settings";
import * as helpers from "../src/lib/lesson-vocabulary-revision";
import type { LessonWord } from "../src/lib/lesson-unit";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const teacherId = id(1), studentId = id(2), otherStudent = id(3), unitId = id(4), assignmentId = id(5);
const words: LessonWord[] = ["ferry", "tram", "lorry", "van"].map((word, i) => ({ id: id(100 + i), word, category: "Vehicles", icon: "🚌", translation: `перевод-${i}`, description: `A vehicle called ${word}`, imageUrl: i === 0 ? "https://example.com/ferry.jpg" : null, examples: [], note: null, ipaUk: null, ipaUs: null, sectionColor: null }));
const settings = (): helpers.LessonRevisionSettings => ({ title: "Transport review", phraseIds: words.map(w => w.id), modes: ["flashcards", "choose", "pairs", "unscramble", "definition", "definitionPairs"], modeWords: {}, show: { ...DEFAULT_SHOW }, answerSeconds: null, totalSeconds: null, dueAt: null });
type Row = Record<string, unknown>;
type Column = { key: string };
const table = (name: string, fields: string[]) => Object.assign({ $table: name }, Object.fromEntries(fields.map(key => [key, { key }])));
const schema = {
  lessonUnits: table("units", ["id", "authorId"]), users: table("users", ["id", "name", "role", "classWithId"]),
  lessonAssignments: table("assignments", ["id", "unitId", "studentId"]),
  wordRevisions: table("revisions", ["id", "studentId", "assignedByTeacherId", "placement", "wordsSnapshot", "phraseIds"]),
  wordRevisionAttempts: table("attempts", ["id", "revisionId", "finishedAt"]),
  materialPhrases: table("phrases", ["id", "nodeId", "phrase", "icon", "translation", "description", "imageUrl", "kind", "sortOrder"]),
  phraseImages: table("images", ["phraseId", "url", "picked"]),
};
function fixture() {
  const state = { session: { userId: teacherId, role: "TEACHER" } as { userId: string; role: string } | null,
    rows: { units: [{ id: unitId, authorId: teacherId }], users: [{ id: studentId, name: "Student", role: "STUDENT" }, { id: otherStudent, name: "Other", role: "STUDENT" }, { id: teacherId, role: "TEACHER", classWithId: studentId }],
      assignments: [{ id: assignmentId, unitId, studentId }], revisions: [], attempts: [], phrases: [], images: [] } as Record<string, Row[]>,
    base: structuredClone(words), personal: structuredClone(words).map(w => ({ ...w, translation: `личный ${w.translation}` })),
    reads: 0, materialReads: 0, sourceCalls: [] as string[], notifications: [] as unknown[], revalidated: [] as string[], failNotification: false };
  const project = (row: Row, columns?: Record<string, Column>) => columns ? Object.fromEntries(Object.entries(columns).map(([key, col]) => [key, row[col.key]])) : structuredClone(row);
  const ops = {
    eq: (col: Column, value: unknown) => (row: Row) => row[col.key] === value,
    and: (...conditions: ((row: Row) => boolean)[]) => (row: Row) => conditions.every(condition => condition(row)),
    inArray: (col: Column, values: unknown[]) => (row: Row) => values.includes(row[col.key]),
    isNull: (col: Column) => (row: Row) => row[col.key] == null,
    isNotNull: (col: Column) => (row: Row) => row[col.key] != null,
    asc: () => undefined,
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => strings.join("").includes("requestId")
      ? (row: Row) => (row.wordsSnapshot as helpers.LessonRevisionSnapshot)?.requestId === values.at(-1) : { strings, values },
  };
  let tail = Promise.resolve();
  const db = {
    select: (columns?: Record<string, Column>) => {
      let rows: Row[] = [];
      const query = { from: (source: { $table: string }) => { state.reads++; if (source.$table === "phrases") state.materialReads++; rows = state.rows[source.$table]; return query; },
        where: (condition: (row: Row) => boolean) => { rows = rows.filter(condition); return query; },
        orderBy: () => query, limit: async (n: number) => rows.slice(0, n).map(row => project(row, columns)),
        then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(rows.map(row => project(row, columns))).then(resolve) };
      return query;
    },
    insert: (target: { $table: string }) => ({ values: (value: Row) => ({ returning: async (columns: Record<string, Column>) => {
      const row = { id: id(500 + state.rows[target.$table].length), ...structuredClone(value) }; state.rows[target.$table].push(row); return [project(row, columns)];
    } }) }),
    execute: async () => undefined,
    transaction: async <T>(work: (tx: unknown) => Promise<T>) => {
      const previous = tail; let unlock!: () => void; tail = new Promise(resolve => { unlock = resolve; }); await previous;
      try { return await work(db); } finally { unlock(); }
    },
  };
  const exports = {};
  const imports: Record<string, unknown> = {
    "node:crypto": { createHash }, "drizzle-orm": ops, "next/cache": { revalidatePath: (path: string) => state.revalidated.push(path) },
    "@/lib/db": { db }, "@/lib/db/schema": schema, "@/lib/session": { getSession: async () => state.session },
    "@/lib/actions/lessons": {
      lessonAction: async () => { state.sourceCalls.push("base"); return { title: "Transport", words: state.base }; },
      assignedLessonAction: async () => { state.sourceCalls.push("personal"); return { lesson: { title: "Personal transport", words: state.personal } }; },
    },
    "@/lib/student-learning-language": { personalizeLearningContent: async (_id: string, value: unknown) => structuredClone(value) },
    "@/lib/lesson-vocabulary-revision": helpers,
    "@/lib/notifications": { queueStudentNotification: async (input: unknown) => { if (state.failNotification) throw Error("offline"); state.notifications.push(input); } },
  };
  runInNewContext(ts.transpileModule(readFileSync("src/lib/actions/lesson-vocabulary-revision.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: (name: string) => { assert(name in imports, name); return imports[name]; } });
  const actions = exports as typeof import("../src/lib/actions/lesson-vocabulary-revision");
  const sourceFile = ts.createSourceFile("revision.ts", readFileSync("src/lib/actions/revision.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const extracted = ["startRevisionAction", "revisionWordGroupsAction", "copyRevisionBetweenClassAndHomeworkAction"].map(name => sourceFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!.getText(sourceFile)).join("\n");
  const runners = {} as Pick<typeof import("../src/lib/actions/revision"), "startRevisionAction" | "revisionWordGroupsAction" | "copyRevisionBetweenClassAndHomeworkAction">;
  runInNewContext(ts.transpileModule(extracted, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: runners, db, ...schema, ...ops, buildRevision, revisionSnapshotWords: helpers.revisionSnapshotWords,
      prepareLessonRevision: helpers.prepareLessonRevision, randomUUID, REVISION_MODES, normalizeOptionalTimerSeconds,
      queueStudentNotification: async (input: unknown) => state.notifications.push(input),
      getSession: async () => state.session, requireTeacher: async () => { assert.equal(state.session?.role, "TEACHER"); return state.session; },
      wordsOf: async () => { state.materialReads++; return helpers.lessonRevisionWords(state.base); },
      personalizeLearningContent: async (_id: string, value: unknown) => value, revalidatePath() {}, Date });
  return { state, actions, runners };
}

test("lesson revision settings preserve mode order, per-mode subsets and usable media without trusting client words", () => {
  const input = settings(); input.modeWords = { flashcards: [words[0].id, words[1].id], choose: words.map(w => w.id) };
  const result = helpers.prepareLessonRevision(helpers.lessonRevisionWords(words), input);
  assert.deepEqual(result.modes, input.modes); assert.deepEqual(result.modeWords.flashcards, input.modeWords.flashcards);
  assert.equal(result.words[0].imageUrl, words[0].imageUrl);
  assert.equal(buildRevision(result.words, result.modes, { byMode: result.modeWords }).length, 6);
  const invalid: Partial<helpers.LessonRevisionSettings>[] = [{ phraseIds: ["foreign"] }, { modes: ["unknown"] }, { modes: ["flashcards"] }, { modes: ["picture"], modeWords: { picture: [words[1].id] } }, { modeWords: { choose: ["foreign"] } }, { dueAt: "invalid" }];
  for (const patch of invalid) {
    assert.throws(() => helpers.prepareLessonRevision(helpers.lessonRevisionWords(words), { ...settings(), ...patch }));
  }
});

test("anonymous and student callers cannot read a source or assign games", async () => {
  for (const session of [null, { userId: studentId, role: "STUDENT" }]) {
    const f = fixture(); f.state.session = session;
    await assert.rejects(f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId }), /учителя/);
    await assert.rejects(f.actions.assignLessonVocabularyRevisionAction({ unitId, studentId, requestId: id(9), sourceVersion: "", settings: settings() }), /учителя/);
    assert.equal(f.state.reads, 0); assert.equal(f.state.rows.revisions.length, 0);
  }
});

test("source loading checks owner and exact student assignment, and uses personal words rather than the template", async () => {
  const f = fixture(); const result = await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId, assignmentId });
  assert(result.source); assert.equal(result.source.name, "Personal transport"); assert.equal(result.source.words[0].translation, "личный перевод-0");
  assert.deepEqual(f.state.sourceCalls, ["personal"]);
  for (const input of [{ unitId: "bad", studentId }, { unitId: id(999), studentId }, { unitId, studentId: id(999) }, { unitId, studentId: otherStudent, assignmentId }]) {
    const result = await f.actions.lessonVocabularyRevisionSourceAction(input); assert(result.error && !result.source);
  }
  f.state.rows.units[0].authorId = id(999);
  assert((await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId })).error);
  assert.equal(f.state.rows.revisions.length, 0);
});

test("one explicit submission assigns durable HOMEWORK and repeated concurrent retries do not duplicate it", async () => {
  const f = fixture(); const source = (await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId, assignmentId })).source!;
  const input = { unitId, studentId, assignmentId, requestId: id(9), sourceVersion: source.version, settings: settings() };
  const [first, retry] = await Promise.all([f.actions.assignLessonVocabularyRevisionAction(input), f.actions.assignLessonVocabularyRevisionAction(input)]);
  assert(first.ok && retry.ok); assert.equal(first.id, retry.id); assert.equal(f.state.rows.revisions.length, 1);
  const row = f.state.rows.revisions[0]; assert.equal(row.placement, "HOMEWORK"); assert.equal(row.nodeId, null);
  assert.equal((row.wordsSnapshot as helpers.LessonRevisionSnapshot).words[0].translation, "личный перевод-0");
  assert.equal(f.state.notifications.length, 1); assert.equal(f.state.rows.assignments.length, 1); assert.equal(f.state.rows.phrases.length, 0);
  assert(f.state.revalidated.includes("/student/homework") && f.state.revalidated.includes("/teacher/homeworks"));
});

test("stale source versions, foreign words and missing media cannot create a homework or notification", async () => {
  const f = fixture(); const source = (await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId })).source!;
  const input = { unitId, studentId, requestId: id(9), sourceVersion: source.version, settings: settings() };
  assert((await f.actions.assignLessonVocabularyRevisionAction({ ...input, settings: { ...settings(), phraseIds: [id(999)] } })).error);
  assert((await f.actions.assignLessonVocabularyRevisionAction({ ...input, settings: { ...settings(), modes: ["picture"], phraseIds: [words[1].id] } })).error);
  f.state.base[0].word = "edited ferry";
  assert((await f.actions.assignLessonVocabularyRevisionAction(input)).error?.includes("изменился"));
  assert.equal(f.state.rows.revisions.length, 0); assert.equal(f.state.notifications.length, 0);
});

test("snapshot games start and resume after the lesson changes, without material nodes or duplicate attempts", async () => {
  const f = fixture(); const source = (await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId })).source!;
  const assigned = await f.actions.assignLessonVocabularyRevisionAction({ unitId, studentId, requestId: id(9), sourceVersion: source.version, settings: settings() });
  f.state.base = []; f.state.session = { userId: studentId, role: "STUDENT" };
  const started = await f.runners.startRevisionAction(assigned.id!); assert(started.ok);
  const savedWords = planWords(f.state.rows.attempts[0].plan as ReturnType<typeof buildRevision>);
  assert(savedWords.some(item => item.word.word === "ferry")); assert.equal(f.state.materialReads, 0);
  assert.equal((await f.runners.startRevisionAction(assigned.id!)).attemptId, started.attemptId); assert.equal(f.state.rows.attempts.length, 1);
  f.state.session = { userId: otherStudent, role: "STUDENT" };
  assert((await f.runners.startRevisionAction(assigned.id!)).error?.includes("чужое"));
});

test("snapshot word groups remain available for later homework-to-class transfers, scoped to their assigning teacher", async () => {
  const f = fixture(); const source = (await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId })).source!;
  const assigned = await f.actions.assignLessonVocabularyRevisionAction({ unitId, studentId, requestId: id(9), sourceVersion: source.version, settings: settings() });
  assert.equal((await f.runners.revisionWordGroupsAction([`revision-${assigned.id}`]))[0].words.length, 4);
  f.state.session = { userId: id(999), role: "TEACHER" };
  assert.equal((await f.runners.revisionWordGroupsAction([`revision-${assigned.id}`]))[0].words.length, 0);
});

test("notification failure cannot turn a saved assignment into a failure or duplicate; legacy games still resolve their material words", async () => {
  const f = fixture(); f.state.failNotification = true;
  const source = (await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId })).source!;
  const assigned = await f.actions.assignLessonVocabularyRevisionAction({ unitId, studentId, requestId: randomUUID(), sourceVersion: source.version, settings: settings() });
  assert(assigned.ok && assigned.id); assert.equal(f.state.rows.revisions.length, 1);
  f.state.rows.revisions[0].wordsSnapshot = null; f.state.session = { userId: studentId, role: "STUDENT" };
  assert((await f.runners.startRevisionAction(assigned.id)).ok); assert.equal(f.state.materialReads, 1);
});

test("a lesson snapshot can be copied to class and back to homework without a material foreign key or shared progress", async () => {
  const f = fixture();
  const source = (await f.actions.lessonVocabularyRevisionSourceAction({ unitId, studentId })).source!;
  const original = await f.actions.assignLessonVocabularyRevisionAction({ unitId, studentId, requestId: id(9), sourceVersion: source.version, settings: settings() });
  const setup = { ...settings(), nodeId: `revision-${original.id}` };
  const copied = await f.runners.copyRevisionBetweenClassAndHomeworkAction(original.id!, "CLASS", setup);
  assert(copied.ok && copied.id); assert.equal(f.state.rows.revisions[1].nodeId, null);
  assert.equal(f.state.rows.revisions[1].placement, "CLASS");
  assert.notEqual((f.state.rows.revisions[1].wordsSnapshot as helpers.LessonRevisionSnapshot).requestId, id(9));
  assert.equal(f.state.rows.attempts.length, 0);
  const returned = await f.runners.copyRevisionBetweenClassAndHomeworkAction(copied.id, "HOMEWORK", setup);
  assert(returned.ok); assert.equal(f.state.rows.revisions[2].nodeId, null);
  assert.equal(f.state.rows.revisions[2].placement, "HOMEWORK");
  assert((await f.runners.copyRevisionBetweenClassAndHomeworkAction(original.id!, "CLASS", { ...setup, phraseIds: [id(999)] })).error);
  f.state.session = { userId: id(999), role: "TEACHER" };
  assert((await f.runners.copyRevisionBetweenClassAndHomeworkAction(original.id!, "CLASS", setup)).error);
  assert.equal(f.state.rows.revisions.length, 3);
  f.state.session = { userId: studentId, role: "STUDENT" };
  assert((await f.runners.startRevisionAction(returned.id!)).ok);
  assert.equal(f.state.materialReads, 0);
});
