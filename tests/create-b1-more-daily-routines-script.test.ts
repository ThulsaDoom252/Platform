import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDailyRoutinesCanonicalUnit, assertDailyRoutinesJsonPortable, assertDailyRoutinesPreservation,
  dailyRoutinesImportApply, type DailyRoutinesInsertionPlan, type DailyRoutinesPreservationSnapshot,
} from "../scripts/create-b1-more-daily-routines";
import { buildB1MoreDailyRoutinesLesson } from "../src/lib/bundled-lessons/b1-more-daily-routines";

const script = readFileSync(new URL("../scripts/create-b1-more-daily-routines.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const lesson = buildB1MoreDailyRoutinesLesson();
const unitId = uuid(20), folderId = uuid(21);
const canonical = () => ({
  id: unitId, author_id: "324718ca-f381-4478-9555-2eff9f857528", kind: "REGULAR", title: lesson.title,
  description: lesson.description, folder_id: folderId, sections: structuredClone(lesson.sections),
  homework: structuredClone(lesson.homework), video_url: "optional teacher attachment", created_at: "unchanged", updated_at: "unchanged",
});
const snapshot = (): DailyRoutinesPreservationSnapshot => ({
  folders: [{ id: uuid(1), digest: "old folder and timestamps" }],
  units: [{ id: uuid(2), digest: "old lesson including private keys" }],
  words: [{ id: uuid(3), digest: "old vocabulary and examples" }],
  assignments: [{ id: uuid(4), digest: "student answers highlights overrides visibility and timestamps" }],
  classState: [{ id: uuid(5), digest: "class partner location and active lesson" }],
  standaloneHomework: [{ id: uuid(6), digest: "student homework" }],
  notifications: [{ id: uuid(7), digest: "notification" }],
});
const plan = (createFolder = true): DailyRoutinesInsertionPlan => ({
  newFolderId: createFolder ? folderId : null, newLessonId: unitId,
  newWordIds: Array.from({ length: 19 }, (_, index) => uuid(100 + index)),
});
function withInsertion(before: DailyRoutinesPreservationSnapshot, insertion: DailyRoutinesInsertionPlan) {
  const after = structuredClone(before);
  if (insertion.newFolderId) after.folders.push({ id: insertion.newFolderId, digest: "new B1 folder" });
  if (insertion.newLessonId) after.units.push({ id: insertion.newLessonId, digest: "new requested lesson" });
  after.words.push(...insertion.newWordIds.map(id => ({ id, digest: "new lesson word" })));
  for (const rows of Object.values(after)) rows.sort((left, right) => left.id.localeCompare(right.id));
  return after;
}

test("More daily routines importer is read-only by default and accepts only one exact apply flag", () => {
  assert.equal(dailyRoutinesImportApply([]), false);
  assert.equal(dailyRoutinesImportApply(["--apply"]), true);
  for (const args of [["--aply"], ["--apply=true"], ["--apply", "--apply"], ["--apply", "--assign"]]) {
    assert.throws(() => dailyRoutinesImportApply(args), assert.AssertionError);
  }
});

test("existing reviewed lesson is idempotent; identity, content, private keys and homework edits are protected", () => {
  assert.doesNotThrow(() => assertDailyRoutinesCanonicalUnit(canonical(), lesson, unitId, folderId));
  for (const field of ["id", "author_id", "kind", "title", "description", "folder_id", "sections", "homework"]) {
    assert.throws(() => assertDailyRoutinesCanonicalUnit({ ...canonical(), [field]: "teacher edit" }, lesson, unitId, folderId), /preserving teacher edits/);
  }
  for (const [badUnit, badFolder] of [["invalid", folderId], [unitId, "invalid"]]) {
    assert.throws(() => assertDailyRoutinesCanonicalUnit(canonical(), lesson, badUnit, badFolder), /identities are required/);
  }
  const edited = canonical();
  edited.sections[0].teacherHtml += " Changed private key.";
  assert.throws(() => assertDailyRoutinesCanonicalUnit(edited, lesson, unitId, folderId), /preserving teacher edits/);
  const editedHomework = canonical();
  editedHomework.homework[0].exercises[0].items[0].prompt += " Custom instruction.";
  assert.throws(() => assertDailyRoutinesCanonicalUnit(editedHomework, lesson, unitId, folderId), /preserving teacher edits/);
});

test("only LF/CRLF differences are allowed for existing lesson comparison, without changing source objects", () => {
  const stored = canonical();
  stored.sections = stored.sections.map(section => ({ ...section,
    studentHtml: section.studentHtml.replace(/\r?\n/g, "\r\n"), teacherHtml: section.teacherHtml.replace(/\r?\n/g, "\r\n"),
  }));
  const before = structuredClone(stored);
  assert.doesNotThrow(() => assertDailyRoutinesCanonicalUnit(stored, lesson, unitId, folderId));
  assert.deepEqual(stored, before);
  stored.sections[1].studentHtml += " ";
  assert.throws(() => assertDailyRoutinesCanonicalUnit(stored, lesson, unitId, folderId), /preserving teacher edits/);
});

test("the entire lesson, words, private keys and homework remain JSONB portable", () => {
  assert.doesNotThrow(() => assertDailyRoutinesJsonPortable(lesson));
  for (const value of [{ answer: undefined }, { choices: [undefined] }, { count: NaN }, { createdAt: new Date() }]) {
    assert.throws(() => assertDailyRoutinesJsonPortable(value), /JSON portable/);
  }
});

test("dry-run or idempotent import preserves every original row exactly", () => {
  const before = snapshot();
  assert.doesNotThrow(() => assertDailyRoutinesPreservation(before, structuredClone(before)));
  for (const key of Object.keys(before) as (keyof DailyRoutinesPreservationSnapshot)[]) {
    for (const rows of [[], [{ id: uuid(300), digest: "changed" }], [...before[key], { id: uuid(301), digest: "extra" }],
      [{ ...before[key][0], digest: "changed data or timestamp" }]]) {
      assert.throws(() => assertDailyRoutinesPreservation(before, { ...structuredClone(before), [key]: rows }), /rolling back/);
    }
  }
});

test("apply may insert one requested lesson and nineteen words, with or without a new exact B1 folder", () => {
  const before = snapshot();
  for (const createFolder of [true, false]) {
    const insertion = plan(createFolder);
    assert.doesNotThrow(() => assertDailyRoutinesPreservation(before, withInsertion(before, insertion), insertion));
  }
});

test("planned insertions cannot hide prior edits, deleted rows, duplicate identities or extra records", () => {
  const before = snapshot(), insertion = plan();
  for (const key of Object.keys(before) as (keyof DailyRoutinesPreservationSnapshot)[]) {
    const edited = withInsertion(before, insertion);
    edited[key][0].digest = "changed original";
    assert.throws(() => assertDailyRoutinesPreservation(before, edited, insertion), /rolling back/);
    const missing = withInsertion(before, insertion);
    missing[key] = missing[key].filter(row => row.id !== before[key][0].id);
    assert.throws(() => assertDailyRoutinesPreservation(before, missing, insertion), /rolling back/);
    const extra = withInsertion(before, insertion);
    extra[key].push({ id: uuid(500), digest: "unplanned" });
    assert.throws(() => assertDailyRoutinesPreservation(before, extra, insertion), /rolling back/);
  }
  const duplicate = withInsertion(before, insertion);
  duplicate.units.push({ ...duplicate.units[0] });
  assert.throws(() => assertDailyRoutinesPreservation(before, duplicate, insertion), /duplicate identities/);
  const changedPlan = { ...insertion, newWordIds: [...insertion.newWordIds.slice(1), insertion.newWordIds[1]] };
  assert.throws(() => assertDailyRoutinesPreservation(before, withInsertion(before, changedPlan), changedPlan), /rolling back/);
  for (const badPlan of [
    { ...insertion, newWordIds: insertion.newWordIds.slice(1) },
    { ...insertion, newLessonId: null },
    { ...insertion, newLessonId: null, newWordIds: [] },
    { ...insertion, newWordIds: [...insertion.newWordIds.slice(1), before.words[0].id] },
  ]) assert.throws(() => assertDailyRoutinesPreservation(before, withInsertion(before, badPlan), badPlan), /rolling back/);
});

test("production writes are insert-only and limited to one lesson, its words and the missing B1 folder", () => {
  assert.deepEqual([...script.matchAll(/INSERT INTO public\.(\w+)/g)].map(match => match[1]), ["lesson_folders", "lesson_units", "lesson_words"]);
  assert.doesNotMatch(script, /\b(?:UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
  assert(script.includes('if (apply && !previous) {'));
  assert(script.includes('if (!existingFolder) {'));
  assert(script.includes("folders.length <= 1"));
  assert(script.includes('folders[0].name === "B1"'));
  assert(script.includes("matches.length <= 1"));
  assert(script.includes('owner[0].name === "Vlad" && owner[0].role === "TEACHER"'));
  assert(script.includes('const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528"'));
  assert.doesNotMatch(script, /INSERT INTO public\.(?:lesson_assignments|homework|notifications)|queueStudentNotification|publishClassRealtime|from "ably"/);
  assert(script.includes("studentAssignmentsCreated: 0, studentWorkChanged: false, existingContentOverwritten: false"));
  assert(script.includes("notificationsSent: false, realtimeEventsPublished: 0"));
});

test("transaction isolation, advisory and row locks, verification and safe execution guard protect production", () => {
  assert(script.includes('"BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY"'));
  assert(script.includes('"SELECT pg_advisory_xact_lock(hashtext($1))"'));
  assert(script.includes("`${AUTHOR_ID}:lesson-folder:B1`"));
  assert(script.includes('apply ? " FOR UPDATE" : ""'));
  assert(script.includes("assertDailyRoutinesPreservation(before, await snapshot(client), plan)"));
  assert(script.includes('await client.query(apply ? "COMMIT" : "ROLLBACK")'));
  assert(script.includes('if (transactionOpen && client) await client.query("ROLLBACK")'));
  assert(script.includes('resolve(process.argv[1]) === fileURLToPath(import.meta.url)'));
  assert(script.includes('connection.searchParams.set("sslmode", "verify-full")'));
  assert.doesNotMatch(script, /console\.(?:log|error)\((?:env|connection|before|after|owner|words)\b/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:\.answers|\.content_override)/);
});
