import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { canRestoreClassNoteFocus, createClassNoteQueue, type ClassNoteSubmission } from "../src/lib/class-note-entry";

test("rapid Enter snapshots keep text, kind and order while another note is saving", async () => {
  const saved: ClassNoteSubmission[] = [], events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const queue = createClassNoteQueue(async entry => { if (!saved.length) await gate; saved.push(entry); return {}; }, (entry, state) => events.push(`${entry.id}:${state}`));
  const first = { id: "1", text: "If I were you…", kind: "NOTE" as const };
  const second = { id: "2", text: "commute", kind: "SPELLING" as const };
  const third = { id: "3", text: "A new note", kind: "NOTE" as const };
  void queue.enqueue(first); void queue.enqueue(second); const done = queue.enqueue(third);
  assert.equal(saved.length, 0); assert.equal(events.length, 3);
  release(); await done;
  assert.deepEqual(saved, [first, second, third]); assert.equal(events.filter(event => event.endsWith(":saved")).length, 3);
});

test("failed notes are retained for explicit retry, do not block following notes, and double-click retry is coalesced", async () => {
  let fail = true; const events: string[] = [], calls: string[] = [];
  const queue = createClassNoteQueue(async entry => { calls.push(entry.id); if (entry.id === "1" && fail) throw Error("offline"); return {}; }, (entry, state) => events.push(`${entry.id}:${state}`));
  const entry = { id: "1", text: "Keep this text", kind: "SPELLING" as const };
  void queue.enqueue(entry); await queue.enqueue({ id: "2", text: "Still saved", kind: "NOTE" });
  assert(events.includes("1:failed") && events.includes("2:saved"));
  fail = false; const retry = queue.enqueue(entry); const duplicate = queue.enqueue(entry);
  await Promise.all([retry, duplicate]); assert.deepEqual(calls, ["1", "2", "1"]); assert(events.includes("1:saved"));
});

test("focus recovery never steals another editor, text selection, an open dialog or a hidden tab", () => {
  const input = { isConnected: true } as HTMLInputElement;
  const doc = { visibilityState: "visible", activeElement: { closest: () => null }, querySelector: () => null, getSelection: () => ({ toString: () => "" }) };
  const allowed = () => canRestoreClassNoteFocus(doc as unknown as Document, input);
  assert.equal(allowed(), true);
  doc.activeElement.closest = () => ({}) as never; assert.equal(allowed(), false);
  doc.activeElement.closest = () => null;
  doc.querySelector = () => ({}) as never; assert.equal(allowed(), false);
  doc.querySelector = () => null;
  doc.getSelection = () => ({ toString: () => "selected lesson text" }); assert.equal(allowed(), false);
  doc.getSelection = () => ({ toString: () => "" }); doc.visibilityState = "hidden"; assert.equal(allowed(), false);
});

type Row = Record<string, unknown>;
type Col = { key: string };
type Predicate = (row: Row) => boolean;
const table = (tag: string, names: string[]) => Object.assign({ tag }, Object.fromEntries(names.map(key => [key, { key }])));
function serverFixture() {
  const teacherId = randomUUID(), studentId = randomUUID();
  const users = table("users", ["id", "classWithId"]), notes = table("notes", ["id", "teacherId", "studentId", "kind", "lessonDay", "createdAt"]);
  const state = { role: "TEACHER", teacherId, studentId, rows: [] as Row[], reads: 0, enrichments: 0, failSpelling: false };
  const eq = (column: Col, value: unknown): Predicate => row => row[column.key] === value;
  const and = (...items: Predicate[]): Predicate => row => items.every(item => item(row));
  const db = {
    select: (fields?: Record<string, Col>) => {
      let data: Row[] = [];
      const output = () => data.map(row => fields ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.key]])) : row);
      const query = { from: (source: { tag: string }) => { state.reads++; data = source.tag === "users" ? [{ id: state.teacherId, classWithId: state.studentId }] : state.rows; return query; },
        where: (predicate: Predicate) => { data = data.filter(predicate); return query; }, orderBy: () => query,
        limit: async (n: number) => output().slice(0, n), then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(output()).then(resolve) };
      return query;
    },
    insert: () => ({ values: (value: Row) => {
      let ignoreConflict = false;
      const query = { onConflictDoNothing: () => { ignoreConflict = true; return query; }, returning: async () => {
        const id = value.id ?? randomUUID(); if (state.rows.some(row => row.id === id)) { if (ignoreConflict) return []; throw Error("duplicate"); }
        const row = { id, ...value }; state.rows.push(row); return [row];
      } }; return query;
    } }),
  };
  const source = ts.createSourceFile("class-tools.ts", readFileSync("src/lib/actions/class-tools.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const declarations = ["requireTeacher", "teacherWithStudent", "listClassLessonNotesAction", "createClassLessonNoteAction"].map(name => source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!.getText(source)).join("\n");
  const exports = {};
  runInNewContext(ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, db, users, classLessonNotes: notes, classVocabularyWords: { translationLang: { key: "translationLang" }, studentId: { key: "studentId" }, updatedAt: { key: "updatedAt" } }, eq, and, asc() {}, desc() {},
      getSession: async () => state.role ? ({ userId: state.teacherId, role: state.role }) : null, noteCard: (row: Row) => row,
      currentLessonContext: async () => ({ lessonId: "lesson", lessonDay: "2026-10-17" }),
      studentLearningLanguage: async () => "RU", personalizeLearningContent: async (_id: string, value: unknown) => value,
      enrichSpellingMistake: async (text: string) => { state.enrichments++; if (state.failSpelling) throw Error("unavailable"); return { english: text, translation: "перевод", translationLang: "RU", partOfSpeech: "VERB", icon: "✏️", examples: [] }; },
    });
  return { state, actions: exports as Pick<typeof import("../src/lib/actions/class-tools"), "createClassLessonNoteAction" | "listClassLessonNotesAction"> };
}

test("notes/spelling use their corresponding categories and retrying the same request cannot duplicate saved records", async () => {
  const { state, actions } = serverFixture();
  const noteId = randomUUID(), spellingId = randomUUID();
  const save = () => actions.createClassLessonNoteAction("Keep this note", "NOTE", state.studentId, noteId);
  const [first, duplicate] = await Promise.all([save(), save()]);
  assert(first.note && duplicate.note); assert.equal(first.note.id, duplicate.note.id); assert.equal(state.rows.length, 1);
  assert.equal((await save()).note?.id, noteId);
  await actions.createClassLessonNoteAction("commute", "SPELLING", state.studentId, spellingId);
  await actions.createClassLessonNoteAction("commute", "SPELLING", state.studentId, spellingId);
  assert.equal(state.rows.length, 2); assert.equal(state.rows[0].kind, "NOTE"); assert.equal(state.rows[1].kind, "SPELLING");
  assert.equal(state.rows[1].partOfSpeech, "VERB"); assert.equal(state.enrichments, 1);
});

test("anonymous/student access, invalid types, wrong students and foreign request collisions cannot write or disclose notes", async () => {
  const { state, actions } = serverFixture();
  for (const role of ["STUDENT", "ADMIN", ""]) {
    state.role = role;
    await assert.rejects(actions.createClassLessonNoteAction("secret", "NOTE", state.studentId, randomUUID()), /Teacher/);
    await assert.rejects(actions.listClassLessonNotesAction(state.studentId), /Teacher/);
  }
  assert.equal(state.reads, 0); state.role = "TEACHER";
  const request = randomUUID(); await actions.createClassLessonNoteAction("private", "NOTE", state.studentId, request);
  state.studentId = randomUUID();
  assert((await actions.createClassLessonNoteAction("private", "NOTE", randomUUID(), request)).error);
  assert((await actions.createClassLessonNoteAction("private", "NOTE", state.studentId, request)).error);
  assert((await actions.createClassLessonNoteAction("x", "BAD" as "NOTE", state.studentId, randomUUID())).error);
  assert((await actions.createClassLessonNoteAction("x", "NOTE", state.studentId, "invalid")).error);
  assert.equal((await actions.listClassLessonNotesAction(randomUUID())).length, 0); assert.equal(state.rows.length, 1);
});

test("a spelling failure creates no half-record; retry keeps its request ID and original note requests remain compatible", async () => {
  const { state, actions } = serverFixture(); const request = randomUUID(); state.failSpelling = true;
  assert((await actions.createClassLessonNoteAction("commute", "SPELLING", state.studentId, request)).error); assert.equal(state.rows.length, 0);
  state.failSpelling = false;
  assert((await actions.createClassLessonNoteAction("commute", "SPELLING", state.studentId, request)).note);
  await actions.createClassLessonNoteAction("legacy"); await actions.createClassLessonNoteAction("legacy");
  assert.equal(state.rows.length, 3);
});

test("the class starts Notes as an input only; history remains independently dockable/resizable and is keyed by student", () => {
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert.match(room, /if \(key === "notes"\) setNotesHistoryFor\(null\)/);
  assert.match(room, /Boolean\(notesExpanded && !notesPlacement\.floating\)/);
  assert.match(room, /<ClassNoteQuickEntry key=\{partner\.id\} studentId=\{partner\.id\} enabled=\{open\.notes\}/);
  assert.match(room, /notesExpanded && <div id="class-notes-history"/);
  assert.match(room, /onResize=\{\(width, height\) => resizePanel\("notes", width, height\)\}/);
  assert.match(room, /onClose=\{\(\) => setNotesHistoryFor\(null\)\}/);
  assert.match(room, /refreshKey=\{notesRefresh\} compact embedded historyOnly/);
});
