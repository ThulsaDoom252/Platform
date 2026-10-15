import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertPopularQuestionsCanonicalUnit,
  assertPopularQuestionsHomeworkJsonPortable,
  assertPopularQuestionsHomeworkPreservation,
  popularQuestionsHomeworkAlreadyInstalled,
  popularQuestionsHomeworkSnapshotAvailability,
  popularQuestionsHomeworkUpdateApply,
  type PopularQuestionsHomeworkPreservationSnapshot,
} from "../scripts/update-a2-popular-questions-homework";
import { buildA2PopularQuestionsLesson } from "../src/lib/bundled-lessons/a2-popular-questions";
import { buildPopularQuestionsHomework } from "../src/lib/bundled-lessons/a2-popular-questions-homework";

const script = readFileSync(new URL("../scripts/update-a2-popular-questions-homework.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const lesson = buildA2PopularQuestionsLesson(
  readFileSync(new URL("../scripts/fixtures/a2-popular-questions-student.html", import.meta.url), "utf8"),
  readFileSync(new URL("../scripts/fixtures/a2-popular-questions-teacher.html", import.meta.url), "utf8"),
);
const unitId = "97b73549-c960-46ca-ad96-a415e19394f5";
const folderId = "e0dc647c-9c7b-48c9-b3d0-023af54a1c49";
const canonical = () => ({
  id: unitId, author_id: "324718ca-f381-4478-9555-2eff9f857528", kind: "REGULAR", title: lesson.title,
  description: lesson.description, folder_id: folderId, sections: structuredClone(lesson.sections), homework: [],
  video_url: "optional teacher attachment", updated_at: "preserve", created_at: "preserve",
});
const snapshot = (): PopularQuestionsHomeworkPreservationSnapshot => ({
  folders: [{ id: "folder", digest: "original folder" }],
  units: [{ id: "template", digest: "all non-homework fields and timestamps" }],
  words: [{ id: "word", digest: "original vocabulary" }],
  assignments: [{ id: "assignment", digest: "answers, highlights, visibility, overrides and timestamps" }],
  classState: [{ id: "student", class_focus: { lessonAssignmentId: "assignment" }, class_with_id: null, class_where: "LESSON" }],
  standaloneHomework: [{ id: "homework", digest: "student work" }],
  notifications: [{ id: "notification", digest: "unchanged" }],
});

test("Popular questions homework installer is dry-run by default and rejects unrecognized or repeated flags", () => {
  assert.equal(popularQuestionsHomeworkUpdateApply([]), false);
  assert.equal(popularQuestionsHomeworkUpdateApply(["--apply"]), true);
  for (const args of [["--aply"], ["--apply=true"], ["--apply", "--apply"], ["--apply", "--student"]]) {
    assert.throws(() => popularQuestionsHomeworkUpdateApply(args), assert.AssertionError);
  }
});

test("only empty homework or the exact reviewed plan is accepted; teacher edits are never overwritten", () => {
  const plan = [buildPopularQuestionsHomework()];
  assert.equal(popularQuestionsHomeworkAlreadyInstalled([], plan), false);
  assert.equal(popularQuestionsHomeworkAlreadyInstalled(structuredClone(plan), plan), true);
  for (const previous of [null, {}, ["teacher task"], [{ ...plan[0], title: "Custom plan" }]]) {
    assert.throws(() => popularQuestionsHomeworkAlreadyInstalled(previous, plan), /preserving teacher edits/);
  }
  const edited = structuredClone(plan);
  edited[0].exercises[0].items[0].prompt += " Teacher edit.";
  assert.throws(() => popularQuestionsHomeworkAlreadyInstalled(edited, plan), /preserving teacher edits/);
});

test("Popular questions homework is portable to JSONB with no silent loss of optional values", () => {
  assert.doesNotThrow(() => assertPopularQuestionsHomeworkJsonPortable([buildPopularQuestionsHomework()]));
  for (const value of [{ answer: undefined }, { choices: [undefined] }, { value: new Date() }, { count: NaN }]) {
    assert.throws(() => assertPopularQuestionsHomeworkJsonPortable(value), /JSON portable/);
  }
});

test("canonical unit guards protect teacher identity, A2 folder, all source sections and private answer keys", () => {
  assert.doesNotThrow(() => assertPopularQuestionsCanonicalUnit(canonical(), lesson, unitId, folderId));
  for (const field of ["id", "author_id", "kind", "title", "description", "folder_id", "sections"]) {
    assert.throws(() => assertPopularQuestionsCanonicalUnit({ ...canonical(), [field]: "edited" }, lesson, unitId, folderId), /preserving teacher edits/);
  }
  assert.throws(() => assertPopularQuestionsCanonicalUnit(canonical(), lesson, "ambiguous", folderId), /identities are required/);
  assert.throws(() => assertPopularQuestionsCanonicalUnit(canonical(), lesson, unitId, "ambiguous"), /identities are required/);
  const edited = canonical();
  edited.sections[0].teacherHtml += "Changed answer key";
  assert.throws(() => assertPopularQuestionsCanonicalUnit(edited, lesson, unitId, folderId), /preserving teacher edits/);
  const linuxStored = canonical();
  linuxStored.sections = linuxStored.sections.map(section => ({
    ...section, studentHtml: section.studentHtml.replace(/\r\n/g, "\n"), teacherHtml: section.teacherHtml.replace(/\r\n/g, "\n"),
  }));
  assert.doesNotThrow(() => assertPopularQuestionsCanonicalUnit(linuxStored, lesson, unitId, folderId));
});

test("preservation assertions reject modifications, removals or additions to every protected resource", () => {
  const before = snapshot();
  assert.doesNotThrow(() => assertPopularQuestionsHomeworkPreservation(before, structuredClone(before)));
  for (const key of Object.keys(before) as (keyof PopularQuestionsHomeworkPreservationSnapshot)[]) {
    for (const rows of [[], [{ id: "changed" }], [...before[key], { id: "extra" }]]) {
      assert.throws(() => assertPopularQuestionsHomeworkPreservation(before, { ...structuredClone(before), [key]: rows }), /rolling back/);
    }
  }
});

test("installer only updates template homework with serializable, advisory/row-lock and compare-and-swap safeguards", () => {
  assert(script.includes('"BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY"'));
  assert(script.includes('"SELECT pg_advisory_xact_lock(hashtext($1))"'));
  assert(script.includes('apply ? " FOR UPDATE" : ""'));
  assert.deepEqual([...script.matchAll(/UPDATE public\.(\w+) SET ([^\n]+)/g)].map(match => [match[1], match[2]]), [["lesson_units", "homework=$1::jsonb"]]);
  assert(script.includes("WHERE id=$2 AND author_id=$3 AND homework=$4::jsonb RETURNING id"));
  assert.doesNotMatch(script, /\b(?:INSERT INTO|DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
  assert.doesNotMatch(script, /SET\s+updated_at|queueStudentNotification|publishClassRealtime|from "ably"/i);
  assert(script.includes("assertPopularQuestionsHomeworkPreservation(before, await snapshot(client, unitId))"));
  assert(script.includes('await client.query(apply ? "COMMIT" : "ROLLBACK")'));
  assert(script.includes('if (transactionOpen && client) await client.query("ROLLBACK")'));
  assert(script.includes('resolve(process.argv[1]) === fileURLToPath(import.meta.url)'), "Importing helper functions cannot start production work");
  assert(script.includes('connection.searchParams.set("sslmode", "verify-full")'));
  assert(script.includes("notificationsSent: false, realtimeEventsPublished: 0"));
  assert(script.includes('const UNIT_ID = "88ecfa45-1979-4330-86ab-3151d50c7bb0"'));
  assert(script.includes("matches.length === 1 && matches[0].id === UNIT_ID"));
  assert(script.includes("folders.length === 1 && folders[0].id === FOLDER_ID"));
});

test("existing assignment overrides are counted privately and remain byte-for-byte protected, not rebuilt", () => {
  assert(script.includes('Object.hasOwn(row.answers ?? {}, "hw:plan-override")'));
  assert(script.includes('SELECT id,md5(to_jsonb(a)::text) AS digest FROM public.lesson_assignments a ORDER BY id'));
  assert(script.includes('SELECT id,md5(to_jsonb(h)::text) AS digest FROM public.homework h ORDER BY id'));
  assert(script.includes("to_jsonb(l)-'homework'"));
  assert(script.includes("lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0) === 81"));
  assert(script.includes("plan.exercises.length === 7"));
  assert(script.includes("exercise.items.length, 0) === 20"));
  assert.doesNotMatch(script, /console\.(?:log|error)\((?:targetAssignments|classState|connectionString|env)\b/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:\.content_override|\.answers)/);
});

test("availability summary distinguishes absent, empty, populated and unknown snapshot plans without leaking content", () => {
  const privateText = "private student content";
  const result = popularQuestionsHomeworkSnapshotAvailability([
    { content_override: null },
    { content_override: { title: privateText } },
    { content_override: { interactiveHomework: null } },
    { content_override: { interactiveHomework: { exercises: [] } } },
    { content_override: { interactiveHomework: { exercises: [{ title: privateText }] } } },
    { content_override: { interactiveHomework: "unrecognized" } },
  ]);
  assert.deepEqual(result, {
    personalContentOverridesPreserved: 5, snapshotsWithoutHomework: 2, snapshotsWithEmptyHomework: 1,
    snapshotsWithExistingHomework: 1, snapshotsWithUnrecognizedHomework: 1,
  });
  assert(!JSON.stringify(result).includes(privateText));
});
