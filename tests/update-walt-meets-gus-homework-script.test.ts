import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertWaltCanonicalUnit,
  assertWaltHomeworkJsonPortable,
  assertWaltHomeworkPreservation,
  waltHomeworkAlreadyInstalled,
  waltHomeworkUpdateApply,
  type WaltHomeworkPreservationSnapshot,
} from "../scripts/update-walt-meets-gus-homework";
import {
  BREAKING_BAD_FOLDER,
  WALT_MEETS_GUS_DESCRIPTION,
  WALT_MEETS_GUS_QUESTIONS,
  WALT_MEETS_GUS_TITLE,
  WALT_MEETS_GUS_TRANSCRIPT,
  WALT_MEETS_GUS_VIDEO_TITLE,
  WALT_MEETS_GUS_VIDEO_URL,
} from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus";
import { buildWaltMeetsGusHomework } from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus-homework";

const script = readFileSync(new URL("../scripts/update-walt-meets-gus-homework.ts", import.meta.url), "utf8");
const canonical = () => ({
  id: "f0c4c1ec-347b-4529-a8d3-d54083105ca7", author_id: "324718ca-f381-4478-9555-2eff9f857528",
  kind: "ACTIVITY", title: WALT_MEETS_GUS_TITLE, description: WALT_MEETS_GUS_DESCRIPTION,
  folder_id: "d093371f-523e-453e-995e-f3e4279961b0", vocab_node_id: null, lexis: [],
  video_url: WALT_MEETS_GUS_VIDEO_URL, video_title: WALT_MEETS_GUS_VIDEO_TITLE,
  transcript: WALT_MEETS_GUS_TRANSCRIPT, questions: { afterVideo: WALT_MEETS_GUS_QUESTIONS, afterReading: [] },
  activity_ids: [], sections: [], homework: [], sort_order: 10, created_at: "preserve", updated_at: "preserve",
});
const snapshot = (): WaltHomeworkPreservationSnapshot => ({
  units: [{ id: "template", digest: "all non-homework fields" }],
  words: [{ id: "word", digest: "original word" }],
  assignments: [{ id: "existing", digest: "saved answers, highlights, overrides and timestamps" }],
  classState: [{ id: "student", class_focus: { lessonAssignmentId: "existing" }, class_with_id: null, class_where: "LESSON" }],
  standaloneHomework: [{ id: "homework", digest: "student work" }],
  notifications: [{ id: "notification", digest: "unchanged" }],
});

test("Walt homework updater is dry-run by default and rejects unknown or repeated write flags", () => {
  assert.equal(waltHomeworkUpdateApply([]), false);
  assert.equal(waltHomeworkUpdateApply(["--apply"]), true);
  for (const args of [["--aply"], ["--apply=true"], ["--apply", "--apply"], ["--apply", "--student"]]) {
    assert.throws(() => waltHomeworkUpdateApply(args), assert.AssertionError);
  }
});

test("only empty homework can be installed; the exact plan is idempotent and teacher edits are protected", () => {
  const plan = [buildWaltMeetsGusHomework()];
  assert.equal(waltHomeworkAlreadyInstalled([], plan), false);
  assert.equal(waltHomeworkAlreadyInstalled(structuredClone(plan), plan), true);
  for (const homework of [null, {}, ["teacher task"], [{ ...plan[0], title: "Teacher's own plan" }]]) {
    assert.throws(() => waltHomeworkAlreadyInstalled(homework, plan), /preserving teacher edits/);
  }
  const editedItem = structuredClone(plan);
  editedItem[0].exercises[0].items[0].prompt += " Teacher edit.";
  assert.throws(() => waltHomeworkAlreadyInstalled(editedItem, plan), /preserving teacher edits/);
});

test("reviewed plan is JSONB portable and undefined fields cannot be silently stripped", () => {
  assert.doesNotThrow(() => assertWaltHomeworkJsonPortable([buildWaltMeetsGusHomework()]));
  for (const value of [{ answer: undefined }, { choices: [undefined] }, { value: new Date() }, { count: NaN }]) {
    assert.throws(() => assertWaltHomeworkJsonPortable(value), /JSON portable/);
  }
});

test("canonical template guard rejects identity, transcript, lesson and teacher-content changes", () => {
  assert.doesNotThrow(() => assertWaltCanonicalUnit(canonical()));
  for (const field of ["id", "author_id", "kind", "title", "description", "folder_id", "vocab_node_id", "lexis", "video_url", "video_title", "transcript", "questions", "activity_ids", "sections"]) {
    assert.throws(() => assertWaltCanonicalUnit({ ...canonical(), [field]: "edited" }), /preserving teacher edits/);
  }
  assert(BREAKING_BAD_FOLDER === "Breaking Bad");
});

test("saved work, custom versions, class pointers, notifications and non-homework template fields are preserved exactly", () => {
  const before = snapshot();
  assert.doesNotThrow(() => assertWaltHomeworkPreservation(before, structuredClone(before)));
  for (const key of Object.keys(before) as (keyof WaltHomeworkPreservationSnapshot)[]) {
    assert.throws(() => assertWaltHomeworkPreservation(before, { ...structuredClone(before), [key]: [] }), /rolling back/);
    assert.throws(() => assertWaltHomeworkPreservation(before, { ...structuredClone(before), [key]: [...before[key], { id: "extra" }] }), /rolling back/);
    assert.throws(() => assertWaltHomeworkPreservation(before, { ...structuredClone(before), [key]: [{ id: "changed" }] }), /rolling back/);
  }
});

test("database contract is homework-only, serializable, row/advisory locked and compare-and-swap guarded", () => {
  assert(script.includes('"BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY"'));
  assert(script.includes('"SELECT pg_advisory_xact_lock(hashtext($1))"'));
  assert(script.includes('apply ? " FOR UPDATE" : ""'));
  assert.deepEqual([...script.matchAll(/UPDATE public\.(\w+) SET ([^\n]+)/g)].map(match => [match[1], match[2]]), [["lesson_units", "homework=$1::jsonb"]]);
  assert(script.includes("WHERE id=$2 AND author_id=$3 AND homework=$4::jsonb RETURNING id"));
  assert.doesNotMatch(script, /\b(?:INSERT INTO|DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
  assert.doesNotMatch(script, /SET\s+updated_at|queueStudentNotification|publishClassRealtime|from "ably"/i);
  assert(script.includes("assertWaltHomeworkPreservation(before, await snapshot(client))"));
  assert(script.includes('await client.query(apply ? "COMMIT" : "ROLLBACK")'));
  assert(script.includes('if (transactionOpen && client) await client.query("ROLLBACK")'));
  assert(script.includes('resolve(process.argv[1]) === fileURLToPath(import.meta.url)'), "Importing testable helpers must not run production work");
  assert(script.includes('connection.searchParams.set("sslmode", "verify-full")'));
  assert(script.includes("notificationsSent: false, realtimeEventsPublished: 0"));
});
