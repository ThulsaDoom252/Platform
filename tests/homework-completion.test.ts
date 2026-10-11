import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as homework from "../src/lib/lesson-homework";
import { assignedHomeworkTitle, HOMEWORK_TITLE_KEY } from "../src/lib/homework-title";
import { mergeHomeworkCompletion } from "../src/lib/homework-completion";
import { homeworkDonePatchSql } from "../src/lib/homework-completion-persistence";
import { teacherHomeworkOverviewState, groupTeacherHomeworksByStudent } from "../src/lib/teacher-homework-order";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const id = "00000000-0000-4000-8000-000000000001";
const doneAt = "2026-10-11T19:00:00.000Z";
const plan: homework.InteractiveHomeworkPlan = { kind: "INTERACTIVE_HOMEWORK_V1", title: "Homework",
  exercises: [{ id: "questions", title: "Questions", instruction: "Answer", kind: "question-text", items: [{ id: "one", prompt: "What happened?" }, { id: "two", prompt: "Why?" }] }] };
const initial: Record<string, string> = {
  [homework.homeworkAssignedAtKey()]: "2026-10-11T10:00:00Z", [homework.homeworkAssignedExercisesKey()]: '["questions"]',
  [homework.homeworkValueKey("one")]: "An answer", [homework.homeworkAttemptsKey("one")]: "2", [homework.homeworkRevisionRequestedAtKey()]: "old revision",
  [HOMEWORK_TITLE_KEY]: "Monday homework", "hw:media": '{"video":true,"transcript":true}', "hw:overall-score": "85", "hw:overall-comment": "Well done",
  "hw:reaction:item:one": "check", "hw:note:one": "Teacher note", "regular:answer": "Other lesson section",
};

test("Done changes lifecycle status even without student submission; scores and progress stay real", () => {
  const state = { ...initial, [homework.homeworkReviewedAtKey()]: doneAt };
  assert.equal(homework.homeworkSubmittedAt(state), null);
  const item = { id, title: "Homework", studentId: "student", studentName: "Student", studentAvatarUrl: null, assignedAt: doneAt,
    nextLessonAt: null, started: true, submittedAt: null, reviewedAt: homework.homeworkReviewedAt(state) };
  assert.equal(teacherHomeworkOverviewState(item), "reviewed");
  assert.equal(groupTeacherHomeworksByStudent([item])[0].counts.reviewed, 1);
  assert.equal(groupTeacherHomeworksByStudent([item])[0].counts.inProgress, 0);
  assert.deepEqual(homework.homeworkProgress(plan, state), homework.homeworkProgress(plan, initial));
  assert.equal(state["hw:overall-score"], "85");
  assert.equal(state[homework.homeworkValueKey("two")], undefined);
});

test("completion refresh merges only status keys, never drafts, media or teacher feedback", () => {
  const local = { ...initial, [homework.homeworkValueKey("one")]: "Still typing…" };
  const saved = { [homework.homeworkReviewedAtKey()]: doneAt };
  const merged = mergeHomeworkCompletion(local, saved);
  assert.equal(merged[homework.homeworkReviewedAtKey()], doneAt);
  assert.equal(merged[homework.homeworkRevisionRequestedAtKey()], undefined);
  for (const [key, value] of Object.entries(local)) if (key !== homework.homeworkRevisionRequestedAtKey()) assert.equal(merged[key], value);
  assert.equal(mergeHomeworkCompletion(merged, saved), merged);
  assert.equal(mergeHomeworkCompletion(merged, {})[homework.homeworkReviewedAtKey()], undefined);
});

test("atomic completion patches only reviewed/revision metadata on the current database row", () => {
  const query = new PgDialect().sqlToQuery(homeworkDonePatchSql(sql.identifier("answers"), doneAt));
  assert.match(query.sql, /coalesce\("answers", '\{\}'::jsonb\)/);
  assert.match(query.sql, /jsonb_build_object/);
  assert.deepEqual(query.params, [homework.homeworkRevisionRequestedAtKey(), homework.homeworkReviewedAtKey(), doneAt]);
  assert.ok(!query.params.includes(homework.homeworkSubmittedAtKey()));
  assert.throws(() => homeworkDonePatchSql(sql.identifier("answers"), "not a timestamp"));
});

function harness(options: { role?: string | null; foreign?: boolean; removed?: boolean; draft?: boolean; legacy?: boolean; noContent?: boolean; submitted?: boolean; reviewed?: boolean; raced?: boolean; failed?: boolean } = {}) {
  const session = options.role === null ? null : { userId: "teacher-local", role: options.role ?? "TEACHER" };
  const stored = { ...initial };
  if (options.removed) stored[homework.homeworkRemovedAtKey()] = "removed";
  if (options.draft) delete stored[homework.homeworkAssignedAtKey()];
  if (options.submitted) stored[homework.homeworkSubmittedAtKey()] = "2026-10-11T18:00:00Z";
  if (options.reviewed) stored[homework.homeworkReviewedAtKey()] = doneAt;
  const writes: { where: unknown; query: ReturnType<PgDialect["sqlToQuery"]> }[] = [], paths: string[] = [], events: unknown[][] = [], notices: { event: string; title: string }[] = [];
  let reads = 0;
  const tables = { lessonAssignments: { id: "assignment.id", studentId: "assignment.studentId", answers: sql.identifier("answers"), contentOverride: "assignment.override", unitId: "assignment.unitId" }, lessonUnits: { id: "unit.id", authorId: "unit.authorId", homework: "unit.homework", title: "unit.title" } };
  const db = {
    select: () => {
      let filters: { column?: unknown; value?: unknown }[] = [];
      const query = { from: () => query, innerJoin: () => query, where: (values: typeof filters | (typeof filters)[0]) => { filters = Array.isArray(values) ? values : [values]; return query; }, limit: async () => {
        reads++;
        if (reads > 1) return [{ answers: { ...stored } }];
        if (options.foreign || !filters.some(value => value.column === "unit.authorId" && value.value === session?.userId)) return [];
        const snapshot = { ...stored };
        stored[homework.homeworkValueKey("one")] = "A concurrent student answer";
        if (options.raced) stored[homework.homeworkReviewedAtKey()] = doneAt;
        return [{ id, studentId: "student-local", answers: snapshot, override: null, title: "Original lesson", homework: options.noContent ? [] : options.legacy ? [{ title: "Legacy", text: "Write" }] : [plan] }];
      } };
      return query;
    },
    update: () => ({ set: (patch: { answers: Parameters<PgDialect["sqlToQuery"]>[0] }) => ({ where: (where: unknown) => ({ returning: async () => {
      if (options.failed) throw new Error("Database unavailable");
      if (options.raced) return [];
      const query = new PgDialect().sqlToQuery(patch.answers);
      writes.push({ where, query });
      delete stored[homework.homeworkRevisionRequestedAtKey()];
      stored[homework.homeworkReviewedAtKey()] = String(query.params[2]);
      return [{ answers: { ...stored } }];
    } }) }) }),
  };
  const modules: Record<string, unknown> = {
    "drizzle-orm": { sql, eq: (column: unknown, value: unknown) => ({ column, value }), and: (...values: unknown[]) => values },
    "next/cache": { revalidatePath: (path: string) => paths.push(path) }, "@/lib/db": { db }, "@/lib/db/schema": tables,
    "@/lib/session": { getSession: async () => session }, "@/lib/lesson-homework": homework,
    "@/lib/homework-title": { assignedHomeworkTitle }, "@/lib/homework-completion-persistence": { homeworkDonePatchSql },
    "@/lib/notifications": { queueStudentNotification: async (input: (typeof notices)[0]) => notices.push(input) },
    "@/lib/realtime-server": { publishClassRealtime: async (...args: unknown[]) => events.push(args), publishUserRealtime: async (...args: unknown[]) => events.push(args) },
  };
  const context = { exports: {} as { markHomeworkDoneAction: (id: unknown) => Promise<{ reviewedAt?: string; error?: string }> },
    require: (name: string) => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; } };
  runInNewContext(ts.transpileModule(source("lib/actions/homework-completion.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { action: context.exports.markHomeworkDoneAction, stored, writes, paths, events, notices, reads: () => reads };
}

test("the actual teacher action completes unsubmitted/partial homework without replacing concurrent answers", async () => {
  const h = harness();
  const result = await h.action(id);
  assert.ok(result.reviewedAt); assert.equal(result.error, undefined);
  assert.equal(h.stored[homework.homeworkReviewedAtKey()], result.reviewedAt);
  assert.equal(h.stored[homework.homeworkSubmittedAtKey()], undefined);
  assert.equal(h.stored[homework.homeworkRevisionRequestedAtKey()], undefined);
  assert.equal(h.stored[homework.homeworkValueKey("one")], "A concurrent student answer");
  for (const [key, value] of Object.entries(initial)) if (![homework.homeworkRevisionRequestedAtKey(), homework.homeworkValueKey("one")].includes(key)) assert.equal(h.stored[key], value);
  assert.equal(h.writes.length, 1);
  assert.ok(h.paths.includes("/teacher/homeworks")); assert.ok(h.paths.includes(`/teacher/homeworks/${id}`)); assert.ok(h.paths.includes("/student/homework"));
  assert.equal(h.events.length, 2);
  assert.equal((h.events[0][2] as { statusChanged: boolean }).statusChanged, true);
  assert.equal((h.events[0][2] as { gradeFeedback: boolean }).gradeFeedback, true);
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].event, "homeworkReviewed"); assert.equal(h.notices[0].title, "Monday homework");
});

test("submitted and legacy homework use the same safe completion; student submission is not fabricated", async () => {
  for (const options of [{ submitted: true }, { legacy: true }]) {
    const h = harness(options); const result = await h.action(id);
    assert.ok(result.reviewedAt);
    assert.equal(h.stored[homework.homeworkSubmittedAtKey()], options.submitted ? "2026-10-11T18:00:00Z" : undefined);
  }
});

test("already Done and concurrent completion are idempotent and do not duplicate notifications", async () => {
  for (const options of [{ reviewed: true }, { raced: true }]) {
    const h = harness(options); assert.equal((await h.action(id)).reviewedAt, doneAt);
    assert.equal(h.writes.length, 0); assert.equal(h.notices.length, 0); assert.equal(h.events.length, 0);
  }
});

test("anonymous users, students, foreign/removed/unassigned/no-content work and bad ids cannot be completed", async () => {
  for (const options of [{ role: null }, { role: "STUDENT" }, { foreign: true }, { removed: true }, { draft: true }, { noContent: true }]) {
    const h = harness(options); assert.ok((await h.action(id)).error);
    assert.equal(h.writes.length, 0); assert.equal(h.notices.length, 0); assert.equal(h.events.length, 0);
  }
  for (const value of ["invalid", null, 123]) { const h = harness(); assert.equal((await h.action(value)).error, "unavailable"); assert.equal(h.reads(), 0); }
  const h = harness({ failed: true }); await assert.rejects(h.action(id), /Database unavailable/);
  assert.equal(h.events.length, 0); assert.equal(h.notices.length, 0);
});

test("teacher controls do not require submission; students cannot accidentally submit completed homework", () => {
  assert.match(source("app/teacher/homeworks/page.tsx"), /!activity && state !== "reviewed" && <MarkHomeworkDoneButton/);
  assert.match(source("app/teacher/homeworks/[id]/page.tsx"), /<MarkHomeworkDoneButton/);
  const ui = source("components/lessons/interactive-homework.tsx");
  assert.match(ui, /session.teacher && assignedAt && !reviewedAt/);
  assert.match(ui, /disabled=\{reviewBusy \|\| Boolean\(submittedAt\) \|\| Boolean\(reviewedAt\)\}/);
  const submit = source("lib/actions/lesson-homework.ts").split("export async function submitInteractiveHomeworkForReviewAction(")[1].split("export async function reviewInteractiveHomeworkAction(")[0];
  assert.match(submit, /if \(homeworkReviewedAt\(state\)\) return \{ error:/);
  assert.match(source("lib/actions/lessons.ts"), /isStudent && responseKey === homeworkReviewedAtKey\(\)/);
  assert.match(source("components/tests/tests-live-list.tsx"), /statusChanged === true/);
  const button = source("components/teacher/mark-homework-done-button.tsx");
  assert.match(button, /role="dialog" aria-modal="true"/); assert.match(button, /role="alert"/);
});
