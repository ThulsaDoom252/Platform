import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";
import { FIRST_CONDITIONAL, findLibraryTest } from "../src/lib/tests/catalog";
import { FIRST_CONDITIONAL_KEY, gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import * as types from "../src/lib/tests/types";
import { testAssignmentNotification } from "../src/lib/tests/assignment-notification";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { isHomeworkResultReaction } from "../src/lib/homework-feedback";
import { readTestTeacherFeedback } from "../src/lib/tests/feedback";
import { groupTeacherHomeworksByStudent, groupTeacherHomeworkPriorities, teacherHomeworkOverviewState } from "../src/lib/teacher-homework-order";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;
type Table = Record<string, string> & { $name: string };
const table = (name: string, columns: string[]): Table => Object.fromEntries([["$name", name], ...columns.map((column) => [column, `${name}.${column}`])]) as Table;

/** Executes the real actions and persistence against isolated rows, never a live database. */
function harness() {
  const schema = {
    users: table("users", ["id", "name", "role", "locale", "avatarUrl"]),
    testAssignments: table("assignments", ["id", "studentId", "teacherId", "testId", "definition", "exerciseIds", "assignedAt", "dueAt"]),
    testAttempts: table("attempts", ["id", "assignmentId", "createdAt", "completedAt", "correct", "total", "percent", "checkedExerciseIds", "teacherFeedback"]),
    notifications: table("notices", ["id", "recipientId", "senderId", "href", "data"]),
    lessons: table("lessons", ["startTime", "studentId", "status"]),
  };
  const store: Record<string, Row[]> = { users: [{ id: uuid(2), role: "STUDENT", name: "Student A", locale: "ru" },
    { id: uuid(3), role: "STUDENT", name: "Student B", locale: "en" }], assignments: [], attempts: [], notices: [], lessons: [] };
  let session: { userId: string; role: string } | null = { userId: uuid(1), role: "TEACHER" };
  const events: unknown[][] = [], paths: string[] = [], locks: string[] = [];
  let failNotices = false;
  const eq = (column: unknown, value: unknown): Predicate => (row) => row[String(column)] === value;
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => ({ parts: parts.join("?"), values });
  function context(name: string, row: Row): Row {
    const result: Row = { ...row };
    for (const [key, value] of Object.entries(row)) result[`${name}.${key}`] = value;
    if (name === "attempts") {
      const parent = store.assignments.find((item) => item.id === row.assignmentId);
      if (parent) Object.assign(result, context("assignments", parent));
      Object.assign(result, row); // preserve attempt's own fields after the join
    }
    const student = store.users.find((item) => item.id === (name === "assignments" ? row.studentId : result["assignments.studentId"]));
    if (student) for (const [key, value] of Object.entries(student)) result[`users.${key}`] = value;
    return result;
  }
  function project(row: Row, columns?: Row): Row {
    if (!columns) return Object.fromEntries(Object.entries(row).filter(([key]) => !key.includes(".")));
    return Object.fromEntries(Object.entries(columns).map(([key, column]) => {
      if (typeof column === "string") return [key, row[column]];
      if (column === schema.testAttempts) return [key, project(row)];
      if (key === "title" || key === "cover" || key === "level") return [key, (row["assignments.definition"] as Row)?.[key]];
      const attempts = store.attempts.filter((item) => item.assignmentId === row["assignments.id"]).sort((a, b) => Number(b.createdAt) - Number(a.createdAt) || String(b.id).localeCompare(String(a.id)));
      if (key === "latestPercent") return [key, attempts[0]?.total ? attempts[0].percent : null];
      if (key === "submittedAt") return [key, attempts[0]?.completedAt ?? null];
      if (key === "latestAttemptId") return [key, attempts[0]?.id ?? null];
      if (key === "teacherFeedback") return [key, attempts[0]?.teacherFeedback ?? null];
      if (key === "attemptCount") return [key, attempts.length];
      return [key, undefined];
    }));
  }
  const db = {
    select: (columns?: Row) => {
      let selected = "", filter: Predicate = () => true, ordered = false;
      const read = () => {
        let rows = store[selected].map((row) => context(selected, row)).filter(filter);
        if (ordered) rows = rows.sort((a, b) => Number(b.createdAt) - Number(a.createdAt) || String(b.id).localeCompare(String(a.id)));
        return rows.map((row) => project(row, columns));
      };
      const query = { from: (target: Table) => { selected = target.$name; return query; }, innerJoin: () => query,
        where: (value: Predicate | unknown) => { filter = typeof value === "function" ? value as Predicate : () => true; return query; },
        orderBy: () => { ordered = true; return query; }, limit: async (count: number) => read().slice(0, count),
        for: async () => { locks.push(selected); return read(); }, then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(read()).then(resolve) };
      return query;
    },
    insert: (target: Table) => ({ values: (value: Row) => {
      let conflictAllowed = false, executed = false, result: Row[] = [];
      const run = () => {
        if (executed) return result;
        executed = true;
        if (target.$name === "notices" && failNotices) throw new Error("Notice storage failed");
        if (store[target.$name].some((row) => row.id === value.id)) { if (!conflictAllowed) throw new Error("Duplicate id"); return []; }
        const row = structuredClone({ createdAt: new Date(), assignedAt: new Date(), results: {}, correct: 0, total: 0,
          percent: 0, completedAt: null, dueAt: null, checkedExerciseIds: [], ...value });
        store[target.$name].push(row); result = [row]; return result;
      };
      const query = { onConflictDoNothing: () => { conflictAllowed = true; return query; }, returning: async () => run(),
        then: (resolve: (rows: Row[]) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject) };
      return query;
    } }),
    update: (target: Table) => ({ set: (patch: Row) => ({ where: (filter: Predicate) => ({ returning: async () => {
      const rows = store[target.$name].filter((row) => filter(context(target.$name, row)));
      rows.forEach((row) => Object.assign(row, structuredClone(patch))); return rows;
    } }) }) }),
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone(store);
      try { return await callback(db); }
      catch (error) { for (const key of Object.keys(store)) store[key] = snapshot[key]; throw error; }
    },
  };
  const modules: Record<string, unknown> = {
    "drizzle-orm": { eq, and: (...conditions: unknown[]): Predicate => (row) => conditions.every((condition) => typeof condition !== "function" || condition(row)),
      asc: (column: unknown) => column, desc: (column: unknown) => column, gte: () => () => true, sql },
    "next/cache": { revalidatePath: (path: string) => paths.push(path) }, zod: { z }, "@/lib/db": { db }, "@/lib/db/schema": schema,
    "@/lib/db/ensure-tests": { ensureTestsTables: async () => {} }, "@/lib/session": { getSession: async () => session },
    "@/lib/notifications": { queueStudentNotification: async () => {} }, "@/lib/realtime-server": { publishUserRealtime: async (...args: unknown[]) => events.push(args) },
    "@/lib/tests/catalog": { findLibraryTest }, "@/lib/tests/grading": { gradeTestExercise, libraryTestKey },
    "@/lib/tests/types": types, "./types": types, "@/lib/tests/assignment-notification": { testAssignmentNotification },
    "@/lib/homework-feedback": { isHomeworkResultReaction },
    "@/lib/tests/feedback": { readTestTeacherFeedback }, "./feedback": { readTestTeacherFeedback },
  };
  function load<T>(path: string): T {
    const env = { exports: {}, require: (name: string) => { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; } };
    runInNewContext(ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, env);
    return env.exports as T;
  }
  modules["@/lib/tests/persistence"] = load("lib/tests/persistence.ts");
  const actions = load<typeof import("../src/lib/actions/tests")>("lib/actions/tests.ts");
  return { actions, store, events, paths, locks, login: (role: string | null, userId = uuid(1)) => { session = role ? { role, userId } : null; },
    failNotices: () => { failNotices = true; } };
}
const assignmentInput = (request = 10, student = 2, notifyStudent = true) => ({ testId: FIRST_CONDITIONAL.id,
  studentId: uuid(student), requestId: uuid(request), exerciseIds: ["exercise-1", "exercise-3"], notifyStudent });

test("completed tests are Done immediately, not submitted for teacher review or folder waiting counters", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); h.login("STUDENT", uuid(2));
  await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: {} });
  assert.equal(teacherHomeworkOverviewState((await h.actions.testHomeworkCardsAction())[0]), "inProgress");
  await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-3", answers: {} });
  h.login("TEACHER");
  const [card] = await h.actions.testHomeworkCardsAction();
  assert.equal(card.reviewedAt, null, "no teacher-review timestamp is invented");
  assert.equal(teacherHomeworkOverviewState(card), "reviewed");
  assert.equal(groupTeacherHomeworksByStudent([card])[0].counts.submitted, 0);
  assert.equal(groupTeacherHomeworksByStudent([card])[0].counts.reviewed, 1);
  assert.equal(groupTeacherHomeworkPriorities([card], "waiting", false)[0].state, "reviewed");
  assert.equal(card.teacherFeedback, null, "completion needs no feedback");
});

test("optional teacher feedback persists per attempt for both sides without changing grades; restart retains it", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); h.login("STUDENT", uuid(2));
  for (const exerciseId of ["exercise-1", "exercise-3"]) await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId, answers: { q1: "will give" } });
  const original = structuredClone(h.store.attempts[0]); h.login("TEACHER");
  const input = { assignmentId: uuid(10), attemptId: uuid(20), manualReaction: "good" as const, teacherNote: "  Watch the verb after when.\nTry again.  " };
  const response = await h.actions.saveTestFeedbackAction(input); assert.ok(response.ok);
  if (response.ok) assert.equal(response.value.teacherFeedback?.teacherNote, input.teacherNote.trim());
  for (const key of ["results", "correct", "total", "percent", "completedAt", "checkedExerciseIds"]) assert.deepEqual(h.store.attempts[0][key], original[key]);
  assert.equal(teacherHomeworkOverviewState((await h.actions.testHomeworkCardsAction())[0]), "reviewed");
  const noticeCount = h.store.notices.length;
  h.login("STUDENT", uuid(2));
  assert.equal((await h.actions.assignedTestDetailAction(uuid(10)))?.latestAttempt?.teacherFeedback?.manualReaction, "good");
  assert.equal((await h.actions.testHomeworkCardsAction())[0].teacherFeedback?.teacherNote, input.teacherNote.trim());
  h.login("TEACHER");
  await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: false });
  assert.equal(h.store.notices.length, noticeCount, "feedback does not send an unsolicited notification");
  assert.equal((await h.actions.assignedTestDetailAction(uuid(10)))?.latestAttempt?.teacherFeedback, null);
  assert.equal((await h.actions.testAttemptDetailAction(uuid(10), uuid(20)))?.teacherFeedback?.manualReaction, "good");
  assert.ok((await h.actions.saveTestFeedbackAction({ ...input, teacherNote: "Historical feedback edited" })).ok);
  assert.ok((await h.actions.saveTestFeedbackAction({ ...input, manualReaction: null, teacherNote: "" })).ok);
  assert.equal((await h.actions.testAttemptDetailAction(uuid(10), uuid(20)))?.teacherFeedback, null);
  assert.deepEqual(h.store.attempts[0].results, original.results);
});

test("feedback rejects students, other teachers, wrong attempts, unfinished tests and forged score changes", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); await h.actions.assignTestAction(assignmentInput(11, 3, false));
  h.login("STUDENT", uuid(2));
  for (const exerciseId of ["exercise-1", "exercise-3"]) await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId, answers: {} });
  const input = { assignmentId: uuid(10), attemptId: uuid(20), manualReaction: "good" as const, teacherNote: "Nice" };
  for (const [role, id] of [[null, uuid(1)], ["STUDENT", uuid(2)], ["TEACHER", uuid(9)]] as const) {
    h.login(role, id); const reply = await h.actions.saveTestFeedbackAction(input); assert.ok(!reply.ok); if (!reply.ok) assert.equal(reply.error, "forbidden");
  }
  h.login("TEACHER");
  for (const bad of [{ ...input, assignmentId: "bad" }, { ...input, manualReaction: "evil" }, { ...input, teacherNote: "a".repeat(4001) }, { ...input, percent: 100 }]) {
    const reply = await h.actions.saveTestFeedbackAction(bad as typeof input); assert.ok(!reply.ok); if (!reply.ok) assert.equal(reply.error, "invalid");
  }
  assert.equal((await h.actions.saveTestFeedbackAction({ ...input, assignmentId: uuid(11) })).ok, false);
  await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: false });
  assert.equal((await h.actions.saveTestFeedbackAction({ ...input, attemptId: uuid(21) })).ok, false);
  assert.ok(h.store.attempts.every((attempt) => !attempt.teacherFeedback));
});

test("deadline changes lock the parent, persist for both sides and never change answers or create notices", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput());
  h.login("STUDENT", uuid(2));
  await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: { q1: "will give" } });
  const attempts = structuredClone(h.store.attempts), notices = structuredClone(h.store.notices);
  h.login("TEACHER");
  const dueAt = "2099-10-12T15:30:00.000Z";
  const saved = await h.actions.updateTestDeadlineAction({ assignmentId: uuid(10), dueAt });
  assert.ok(saved.ok); if (saved.ok) assert.equal(saved.value.dueAt, dueAt);
  assert.equal((h.store.assignments[0].dueAt as Date).toISOString(), dueAt);
  const events = h.events.length;
  assert.ok((await h.actions.updateTestDeadlineAction({ assignmentId: uuid(10), dueAt })).ok);
  assert.equal(h.events.length, events, "same deadline does not emit duplicate events");
  assert.equal((await h.actions.testHomeworkCardsAction(uuid(2)))[0].dueAt, dueAt);
  h.login("STUDENT", uuid(2));
  assert.equal((await h.actions.assignedTestDetailAction(uuid(10)))?.dueAt, dueAt);
  assert.equal((await h.actions.testHomeworkCardsAction())[0].dueAt, dueAt);
  h.login("TEACHER");
  assert.ok((await h.actions.updateTestDeadlineAction({ assignmentId: uuid(10), dueAt: "2099-11-12T16:00:00.000Z" })).ok);
  assert.ok((await h.actions.updateTestDeadlineAction({ assignmentId: uuid(10), dueAt: null })).ok);
  assert.equal(h.store.assignments[0].dueAt, null);
  assert.deepEqual(h.store.attempts, attempts); assert.deepEqual(h.store.notices, notices);
  assert.ok(h.locks.includes("assignments")); assert.ok(h.paths.includes("/teacher/tests"));
});

test("deadline editing rejects non-owners, malformed input, past dates and completed latest attempts", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput());
  const input = { assignmentId: uuid(10), dueAt: "2099-10-12T15:30:00.000Z" };
  for (const [role, id] of [[null, uuid(1)], ["STUDENT", uuid(2)], ["TEACHER", uuid(9)]] as const) {
    h.login(role, id); const reply = await h.actions.updateTestDeadlineAction(input);
    assert.ok(!reply.ok); if (!reply.ok) assert.equal(reply.error, "forbidden");
  }
  h.login("TEACHER");
  for (const bad of [{ ...input, assignmentId: "bad" }, { ...input, dueAt: "2020-01-01T00:00:00.000Z" },
    { ...input, dueAt: "not a date" }, { ...input, dueAt: "2200-01-01T00:00:00.000Z" }, { ...input, percent: 100 }]) {
    const reply = await h.actions.updateTestDeadlineAction(bad);
    assert.ok(!reply.ok); if (!reply.ok) assert.equal(reply.error, "invalid");
  }
  assert.equal(h.store.assignments[0].dueAt, null);
  assert.ok((await h.actions.updateTestDeadlineAction(input)).ok);
  h.login("STUDENT", uuid(2));
  for (const exerciseId of ["exercise-1", "exercise-3"]) await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId, answers: {} });
  const saved = structuredClone(h.store.attempts);
  h.login("TEACHER");
  for (const dueAt of [input.dueAt, null]) {
    const reply = await h.actions.updateTestDeadlineAction({ ...input, dueAt });
    assert.ok(!reply.ok); if (!reply.ok) assert.equal(reply.error, "completed");
  }
  assert.deepEqual(h.store.attempts, saved);
  await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: false });
  assert.ok((await h.actions.updateTestDeadlineAction({ ...input, dueAt: null })).ok);
  assert.deepEqual(h.store.attempts[0], saved[0], "old completed attempt remains immutable after restart/deadline edit");
});

test("student folders query only the selected student AND current owner's assignments", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); await h.actions.assignTestAction(assignmentInput(11, 3, false));
  h.login("TEACHER", uuid(9)); await h.actions.assignTestAction(assignmentInput(12, 2, false));
  h.login("TEACHER");
  assert.deepEqual((await h.actions.testHomeworkCardsAction()).map((item) => item.id).sort(), [uuid(10), uuid(11)]);
  assert.deepEqual((await h.actions.testHomeworkCardsAction(uuid(2))).map((item) => item.id), [uuid(10)]);
  assert.equal((await h.actions.testHomeworkCardsAction(uuid(8))).length, 0);
  assert.equal((await h.actions.testHomeworkCardsAction("../other" )).length, 0);
  h.login("STUDENT", uuid(2));
  assert.deepEqual((await h.actions.testHomeworkCardsAction()).map((item) => item.id).sort(), [uuid(10), uuid(12)]);
  assert.equal((await h.actions.testHomeworkCardsAction(uuid(3))).length, 0);
  h.login(null); assert.equal((await h.actions.testHomeworkCardsAction()).length, 0);
});

test("assigning freezes an independent test for each student; optional notifications deep-link to Tests", async () => {
  const h = harness();
  assert.ok((await h.actions.assignTestAction(assignmentInput())).ok);
  assert.ok((await h.actions.assignTestAction(assignmentInput(11, 3, false))).ok);
  assert.equal(h.store.assignments.length, 2); assert.equal(h.store.notices.length, 1);
  assert.equal(h.store.notices[0].href, `/student/tests/${uuid(10)}`);
  assert.equal(h.store.notices[0].recipientId, uuid(2));
  assert.match(String(h.store.notices[0].message), /Учитель назначил/);
  assert.notEqual(h.store.assignments[0].definition, h.store.assignments[1].definition);
  assert.notEqual(h.store.assignments[0].grading, h.store.assignments[1].grading);
  assert.deepEqual(h.store.assignments[0].exerciseIds, ["exercise-1", "exercise-3"]);
  assert.ok(h.paths.includes("/student/tests")); assert.ok(h.paths.includes("/teacher/tests/assigned"));
});

test("retries do not duplicate assignments or notifications; a failed notice rolls back assignment", async () => {
  const h = harness();
  await h.actions.assignTestAction(assignmentInput()); await h.actions.assignTestAction(assignmentInput());
  assert.equal(h.store.assignments.length, 1); assert.equal(h.store.notices.length, 1);
  assert.equal((await h.actions.assignTestAction(assignmentInput(10, 3))).ok, false);
  const failed = harness(); failed.failNotices();
  assert.equal((await failed.actions.assignTestAction(assignmentInput())).ok, false);
  assert.equal(failed.store.assignments.length, 0); assert.equal(failed.store.notices.length, 0);
});

test("student omissions and mistakes persist per exercise; total is weighted, results are immutable", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); h.login("STUDENT", uuid(2));
  const first = await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: { q1: "will give", q2: "will arrive" } });
  assert.ok(first.ok); if (!first.ok) return;
  assert.equal(first.value.percent, 10); assert.equal(first.value.completedAt, null);
  const question = first.value.results["exercise-1"].questions[2];
  assert.equal(question.selected, null); assert.equal(question.correct, false); assert.ok(question.explanation.ru);
  const changed = await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: {} });
  assert.ok(changed.ok); if (changed.ok) assert.equal(changed.value.correct, 1);
  const answers = Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY["exercise-3"]).map(([id, key]) => [id, key.answer]));
  const last = await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-3", answers });
  assert.ok(last.ok); if (!last.ok) return;
  assert.equal(last.value.percent, 64); assert.ok(last.value.completedAt);
  assert.equal(last.value.results["exercise-3"].percent, 100); assert.equal(last.value.results["exercise-1"].percent, 10);
  assert.equal(h.store.attempts.length, 1); assert.ok(h.locks.every((table) => table === "assignments" || table === "attempts"));
});

test("teacher restart retains old results, creates a blank latest attempt and isolates the other student", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); await h.actions.assignTestAction(assignmentInput(11, 3, false));
  h.login("STUDENT", uuid(2));
  await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: {} });
  const old = structuredClone(h.store.attempts[0]); h.login("TEACHER");
  const reset = await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: false });
  assert.ok(reset.ok); if (!reset.ok) return;
  assert.equal(reset.value.total, 0); assert.deepEqual(Object.keys(reset.value.results), []);
  assert.deepEqual(h.store.attempts[0], old); assert.equal(h.store.attempts.length, 2);
  assert.ok(Number(new Date(reset.value.createdAt)) > Number(old.createdAt));
  await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: false });
  assert.equal(h.store.attempts.length, 2); assert.equal(h.store.notices.length, 1);
  h.login("STUDENT", uuid(2));
  const stale = await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-3", answers: {} });
  assert.ok(!stale.ok); if (!stale.ok) assert.equal(stale.error, "stale");
  assert.ok((await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(21), exerciseId: "exercise-1", answers: {} })).ok);
  h.login("STUDENT", uuid(3)); assert.equal((await h.actions.assignedTestDetailAction(uuid(11)))?.attempts.length, 0);
});

test("reminders and restart notifications target only the assignment owner and are idempotent", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput(10, 2, false));
  const input = { assignmentId: uuid(10), requestId: uuid(30) };
  assert.ok((await h.actions.remindAssignedTestAction(input)).ok); assert.ok((await h.actions.remindAssignedTestAction(input)).ok);
  assert.equal(h.store.notices.length, 1); assert.equal((h.store.notices[0].data as Row).kind, "HOMEWORK_REMINDER");
  assert.ok((await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(31), notifyStudent: true })).ok);
  assert.equal(h.store.notices.length, 2); assert.match(String(h.store.notices[1].message), /перезапустил/);
});

test("students and other teachers cannot assign, remind, restart or read someone else's test/history", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput());
  h.login("STUDENT", uuid(3));
  assert.equal((await h.actions.assignTestAction(assignmentInput(11))).ok, false);
  assert.equal((await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(20) })).ok, false);
  assert.equal((await h.actions.startNewTestAttemptAction({ assignmentId: uuid(10), requestId: uuid(20) })).ok, false);
  assert.equal((await h.actions.remindAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(20) })).ok, false);
  assert.equal(await h.actions.assignedTestDetailAction(uuid(10)), null);
  assert.equal((await h.actions.testAttemptHistoryAction(uuid(10))).length, 0);
  h.login("TEACHER", uuid(9));
  assert.equal((await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(20) })).ok, false);
  assert.equal((await h.actions.remindAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(20) })).ok, false);
  assert.equal(await h.actions.assignedTestDetailAction(uuid(10)), null); assert.equal(h.store.attempts.length, 0);
  h.login(null); assert.equal((await h.actions.assignTestAction(assignmentInput(11))).ok, false);
});

test("public assigned content never reveals unassigned exercises or the private grading key", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); h.login("STUDENT", uuid(2));
  const detail = await h.actions.assignedTestDetailAction(uuid(10)); assert.ok(detail);
  assert.deepEqual(detail.definition.exercises.map((exercise) => exercise.id), ["exercise-1", "exercise-3"]);
  assert.ok(!("grading" in detail));
  const created = await h.actions.startNewTestAttemptAction({ assignmentId: uuid(10), requestId: uuid(50) });
  assert.ok(created.ok); assert.equal(h.store.notices.length, 1);
  await h.actions.startNewTestAttemptAction({ assignmentId: uuid(10), requestId: uuid(50) }); assert.equal(h.store.attempts.length, 1);
});

test("a tab with an unsaved old attempt cannot create a generation after a teacher restart", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput());
  await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: false });
  h.login("STUDENT", uuid(2));
  const reply = await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: {} });
  assert.ok(!reply.ok); if (!reply.ok) assert.equal(reply.error, "stale");
  assert.equal(h.store.attempts.length, 1); assert.equal(h.store.attempts[0].id, uuid(21));
});

test("restart + notification roll back together; repeated notified restart sends only once", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput(10, 2, false)); h.failNotices();
  assert.equal((await h.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: true })).ok, false);
  assert.equal(h.store.attempts.length, 0); assert.equal(h.store.notices.length, 0);
  const success = harness(); await success.actions.assignTestAction(assignmentInput(10, 2, false));
  for (let retry = 0; retry < 2; retry++) await success.actions.restartAssignedTestAction({ assignmentId: uuid(10), requestId: uuid(21), notifyStudent: true });
  assert.equal(success.store.attempts.length, 1); assert.equal(success.store.notices.length, 1);
});

test("unassigned exercises, malformed ids and another student's attempt id cannot be used", async () => {
  const h = harness(); await h.actions.assignTestAction(assignmentInput()); await h.actions.assignTestAction(assignmentInput(11, 3, false));
  h.login("STUDENT", uuid(3)); await h.actions.startNewTestAttemptAction({ assignmentId: uuid(11), requestId: uuid(20) });
  h.login("STUDENT", uuid(2));
  const unassigned = await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(21), exerciseId: "exercise-2", answers: {} });
  assert.ok(!unassigned.ok); if (!unassigned.ok) assert.equal(unassigned.error, "forbidden");
  assert.equal((await h.actions.checkAssignedTestAction({ assignmentId: uuid(10), attemptId: uuid(20), exerciseId: "exercise-1", answers: {} })).ok, false);
  assert.equal(await h.actions.testAttemptDetailAction(uuid(10), uuid(20)), null);
  assert.equal((await h.actions.startNewTestAttemptAction({ assignmentId: "bad", requestId: uuid(21) })).ok, false);
  assert.equal(h.store.attempts.length, 1);
});

test("Tests is reachable for students on both navigation surfaces and completed instances stay in the list", () => {
  for (const file of ["components/student/sidebar-nav.tsx", "components/student/mobile-nav.tsx"])
    assert.ok(source(file).includes('{ href: "/student/tests", label: t.nav.tests, Icon: ClipboardCheck }'));
  assert.ok(source("app/student/tests/page.tsx").includes("testHomeworkCardsAction()"));
  const assignedList = source("components/tests/assigned-tests-list.tsx");
  assert.ok(assignedList.includes("awaiting: items.filter((item) => !item.submittedAt)"));
  assert.ok(assignedList.includes("passed: items.filter((item) => Boolean(item.submittedAt))"));
  for (const section of ["awaiting", "passed"])
    assert.ok(assignedList.includes(`sections.${section}.map((item) => <TestAssignmentCard`));
  assert.ok(source("components/tests/test-runner.tsx").includes("results[exercise.id].percent"));
  for (const locale of ["en", "ru", "uk"] as const) for (const event of ["assigned", "restarted", "reminder"] as const) {
    const notice = testAssignmentNotification({ id: uuid(1), assignmentId: uuid(10), teacherId: uuid(1), studentId: uuid(2), title: "First conditional", locale, event });
    assert.ok(notice.message.includes("First conditional")); assert.equal(notice.href, `/student/tests/${uuid(10)}`);
    assert.ok(TEST_LABELS[locale].restartConfirm); assert.ok(TEST_LABELS[locale].notify);
  }
});
