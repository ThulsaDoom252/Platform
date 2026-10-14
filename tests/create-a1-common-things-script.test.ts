import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertCommonThingsAssignmentPreservation,
  commonThingsImportApply,
  type CommonThingsAssignmentRow,
} from "../scripts/create-a1-common-things";

const studentId = "a3cb07c5-a78e-4f55-947f-9a6df1f3b14f";
const openSections = ["regular:common-things-02"];
const script = readFileSync(new URL("../scripts/create-a1-common-things.ts", import.meta.url), "utf8");
const assignment = (id: string, unitId: string): CommonThingsAssignmentRow => ({
  id, unit_id: unitId, student_id: studentId, open_sections: [...openSections],
  highlights: {}, answers: {}, content_override: null, finished_at: null,
  created_at: new Date("2026-10-14T00:00:00Z"), updated_at: new Date("2026-10-14T00:00:00Z"),
});
const sorted = (rows: CommonThingsAssignmentRow[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

test("Common things import is dry-run by default and rejects misspelled or duplicate write flags", () => {
  assert.equal(commonThingsImportApply([]), false);
  assert.equal(commonThingsImportApply(["--apply"]), true);
  for (const args of [["--aply"], ["--apply=true"], ["--apply", "--apply"], ["--apply", "--switch-class"]]) {
    assert.throws(() => commonThingsImportApply(args), assert.AssertionError);
  }
});

test("production changes are insert-only, transaction guarded and restricted to the lesson, words and exact assignment", () => {
  assert(script.includes('apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN READ ONLY"'));
  assert(script.includes('await client.query(apply ? "COMMIT" : "ROLLBACK")'));
  assert(script.includes('if (transactionOpen && client) await client.query("ROLLBACK")'));
  assert.deepEqual([...script.matchAll(/INSERT INTO public\.(\w+)/g)].map(match => match[1]), [
    "lesson_units", "lesson_words", "lesson_assignments",
  ]);
  assert.doesNotMatch(script, /\b(?:UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
  assert(script.includes("if (!existingLesson) {"));
  assert(script.includes("if (!existingAssignment) {"));
  assert(script.includes("isDeepStrictEqual(existingLesson.sections, lesson.sections)"));
  assert(script.includes("isDeepStrictEqual(words, wordContent)"));
  assert(script.includes("isDeepStrictEqual(savedPeople, people)"));
  assert(script.includes("notificationsSent: false, realtimeEventsPublished: 0"));
  assert.doesNotMatch(script, /queueStudentNotification|publishClassRealtime|from "ably"/);
  assert(script.includes('resolve(process.argv[1]) === fileURLToPath(import.meta.url)'), "Importing the helper must not run production work");
});

test("a new assignment starts with only vocabulary open and preserves every prior assignment", () => {
  const prior = { ...assignment("old", "prior-unit"), answers: { response: "saved work" }, highlights: { selected: "yellow" } };
  const added = assignment("new", "common-things");
  assert.doesNotThrow(() => assertCommonThingsAssignmentPreservation([prior], sorted([prior, added]), added.id, added.unit_id, openSections));
  for (const bad of [
    { ...added, student_id: "another-student" },
    { ...added, open_sections: [...openSections, "regular:common-things-05"] },
    { ...added, answers: { fabricated: "answer" } },
    { ...added, highlights: { fabricated: "yellow" } },
    { ...added, content_override: { title: "Other" } },
    { ...added, finished_at: new Date() },
  ]) {
    assert.throws(() => assertCommonThingsAssignmentPreservation([prior], sorted([prior, bad]), added.id, added.unit_id, openSections), assert.AssertionError);
  }
});

test("repeat application reuses even a completed or privately edited assignment without resetting its work", () => {
  const existing = {
    ...assignment("existing", "common-things"), open_sections: [],
    answers: { response: "saved answer", status: "correct" }, highlights: { selected: "yellow" },
    content_override: { title: "Ksenia's own lesson" }, finished_at: new Date("2026-10-13T00:00:00Z"),
  };
  assert.doesNotThrow(() => assertCommonThingsAssignmentPreservation([existing], [existing], existing.id, existing.unit_id, openSections));
  for (const changed of [
    { ...existing, answers: {} },
    { ...existing, highlights: {} },
    { ...existing, open_sections: [...openSections] },
    { ...existing, content_override: null },
    { ...existing, finished_at: null },
    { ...existing, updated_at: new Date() },
  ]) {
    assert.throws(() => assertCommonThingsAssignmentPreservation([existing], [changed], existing.id, existing.unit_id, openSections), assert.AssertionError);
  }
});

test("duplicate, removed or extra assignments fail preservation checks", () => {
  const prior = assignment("prior", "other-unit"), target = assignment("target", "common-things");
  const previous = sorted([prior, target]);
  for (const saved of [[target], sorted([prior, target, assignment("extra", "unrelated")]), sorted([prior, target, target])]) {
    assert.throws(() => assertCommonThingsAssignmentPreservation(previous, saved, target.id, target.unit_id, openSections), assert.AssertionError);
  }
  const duplicate = assignment("second", "common-things");
  assert.throws(() => assertCommonThingsAssignmentPreservation(sorted([target, duplicate]), sorted([target, duplicate]), target.id, target.unit_id, openSections), assert.AssertionError);
  assert.throws(() => assertCommonThingsAssignmentPreservation([target], [target], "changed-id", target.unit_id, openSections), assert.AssertionError);
});
