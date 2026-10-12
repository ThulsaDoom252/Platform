/** Runs real actions against isolated, access-blocked fixtures in one rollback-only transaction. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as orm from "drizzle-orm";
import { z } from "zod";
import * as schema from "../src/lib/db/schema";
import { FIRST_CONDITIONAL, findLibraryTest } from "../src/lib/tests/catalog";
import { FIRST_CONDITIONAL_KEY, gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import * as types from "../src/lib/tests/types";
import * as persistence from "../src/lib/tests/persistence";
import { testAssignmentNotification } from "../src/lib/tests/assignment-notification";
import { parseTestDeadlineInput } from "../src/lib/tests/deadline";
import { isHomeworkResultReaction } from "../src/lib/homework-feedback";
import { readTestTeacherFeedback } from "../src/lib/tests/feedback";
import { teacherHomeworkOverviewState } from "../src/lib/teacher-homework-order";

async function main() {
  const production = process.argv.includes("--production");
  const loaded = config({ path: production ? ".env.production.local" : ".env", quiet: true });
  const configured = production ? loaded.parsed?.NEON_DATABASE_URL : loaded.parsed?.DATABASE_URL;
  assert.ok(configured);
  const connection = new URL(configured); assert.notEqual(connection.hostname, "base");
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
  const database = drizzle(pool, { schema });
  const ids = { teacher: randomUUID(), otherTeacher: randomUUID(), student: randomUUID(), otherStudent: randomUUID(), assignment: randomUUID(), other: randomUUID(), attempt: randomUUID(), restart: randomUUID() };
  const rollback = new Error("ROLLBACK_DEADLINE_FIXTURES");
  try {
    try {
      await database.transaction(async (tx) => {
        await tx.insert(schema.users).values([
          { id: ids.teacher, name: "Deadline QA teacher", login: ids.teacher, passwordHash: "not-a-password", accessBlocked: true, role: "TEACHER" },
          { id: ids.otherTeacher, name: "Deadline QA other teacher", login: ids.otherTeacher, passwordHash: "not-a-password", accessBlocked: true, role: "TEACHER" },
          { id: ids.student, name: "Deadline QA student", login: ids.student, passwordHash: "not-a-password", accessBlocked: true, role: "STUDENT" },
          { id: ids.otherStudent, name: "Deadline QA other student", login: ids.otherStudent, passwordHash: "not-a-password", accessBlocked: true, role: "STUDENT" },
        ]);
        const assignment = { id: ids.assignment, teacherId: ids.teacher, studentId: ids.student,
          testId: FIRST_CONDITIONAL.id, definition: FIRST_CONDITIONAL, grading: FIRST_CONDITIONAL_KEY, exerciseIds: ["exercise-1"] };
        await tx.insert(schema.testAssignments).values([assignment, { ...assignment, id: ids.other, teacherId: ids.otherTeacher, studentId: ids.otherStudent }]);
        let session: { userId: string; role: string } | null = { userId: ids.teacher, role: "TEACHER" };
        const events: unknown[][] = [];
        const modules: Record<string, unknown> = {
          "drizzle-orm": orm, zod: { z }, "next/cache": { revalidatePath() {} }, "@/lib/db": { db: tx }, "@/lib/db/schema": schema,
          "@/lib/db/ensure-tests": { ensureTestsTables: async () => {} }, "@/lib/session": { getSession: async () => session },
          "@/lib/notifications": { queueStudentNotification: async () => {} }, "@/lib/realtime-server": { publishUserRealtime: async (...args: unknown[]) => { events.push(args); } },
          "@/lib/tests/catalog": { findLibraryTest }, "@/lib/tests/grading": { gradeTestExercise, libraryTestKey },
          "@/lib/tests/types": types, "@/lib/tests/persistence": persistence, "@/lib/tests/assignment-notification": { testAssignmentNotification },
          "@/lib/homework-feedback": { isHomeworkResultReaction }, "@/lib/tests/feedback": { readTestTeacherFeedback },
        };
        const env = { exports: {}, require: (name: string) => { assert.ok(name in modules); return modules[name]; } };
        runInNewContext(ts.transpileModule(readFileSync("src/lib/actions/tests.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, env);
        const actions = env.exports as typeof import("../src/lib/actions/tests");
        const dueAt = parseTestDeadlineInput("2099-10-12T18:30")!;
        assert.ok((await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt })).ok);
        assert.equal((await actions.assignedTestDetailAction(ids.assignment))?.dueAt, dueAt);
        const cards = await actions.testHomeworkCardsAction(ids.student);
        assert.equal(cards.length, 1); assert.equal(cards[0].id, ids.assignment); assert.equal(cards[0].dueAt, dueAt);
        assert.equal((await actions.testHomeworkCardsAction(ids.otherStudent)).length, 0);
        session = { userId: ids.student, role: "STUDENT" };
        assert.equal((await actions.assignedTestDetailAction(ids.assignment))?.dueAt, dueAt);
        assert.equal((await actions.testHomeworkCardsAction(ids.otherStudent)).length, 0);
        assert.equal((await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt: null })).ok, false);
        session = { userId: ids.otherTeacher, role: "TEACHER" };
        assert.equal((await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt: null })).ok, false);
        session = { userId: ids.teacher, role: "TEACHER" };
        assert.ok((await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt: "2099-11-12T16:00:00.000Z" })).ok);
        assert.ok((await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt: null })).ok);
        assert.equal((await actions.testHomeworkCardsAction(ids.student))[0].dueAt, null);
        session = { userId: ids.student, role: "STUDENT" };
        const complete = await actions.checkAssignedTestAction({ assignmentId: ids.assignment, attemptId: ids.attempt, exerciseId: "exercise-1", answers: {} });
        assert.ok(complete.ok); if (!complete.ok) throw new Error("Fixture failed to complete");
        assert.ok(complete.value.completedAt); assert.equal(complete.value.percent, 0);
        const feedbackInput = { assignmentId: ids.assignment, attemptId: ids.attempt, manualReaction: "good" as const, teacherNote: "Check present tense after when.\nGood effort." };
        assert.equal((await actions.saveTestFeedbackAction(feedbackInput)).ok, false, "student cannot edit feedback");
        session = { userId: ids.teacher, role: "TEACHER" };
        assert.equal(teacherHomeworkOverviewState((await actions.testHomeworkCardsAction(ids.student))[0]), "reviewed", "completed 0% test is Done, not awaiting review");
        const feedbackSaved = await actions.saveTestFeedbackAction(feedbackInput);
        assert.ok(feedbackSaved.ok); if (!feedbackSaved.ok) throw new Error("Feedback was not saved");
        assert.equal(feedbackSaved.value.teacherFeedback?.manualReaction, "good");
        for (const key of ["results", "completedAt", "total", "correct", "percent"] as const) assert.deepEqual(feedbackSaved.value[key], complete.value[key]);
        assert.equal((await actions.testHomeworkCardsAction(ids.student))[0].teacherFeedback?.teacherNote, feedbackInput.teacherNote);
        session = { userId: ids.student, role: "STUDENT" };
        assert.equal((await actions.assignedTestDetailAction(ids.assignment))?.latestAttempt?.teacherFeedback?.manualReaction, "good");
        session = { userId: ids.otherTeacher, role: "TEACHER" };
        assert.equal((await actions.saveTestFeedbackAction(feedbackInput)).ok, false);
        session = { userId: ids.teacher, role: "TEACHER" };
        const forbidden = await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt });
        assert.ok(!forbidden.ok); if (!forbidden.ok) assert.equal(forbidden.error, "completed");
        assert.equal((await actions.testHomeworkCardsAction(ids.student))[0].latestPercent, 0);
        assert.ok((await actions.testHomeworkCardsAction(ids.student))[0].submittedAt);
        assert.ok((await actions.restartAssignedTestAction({ assignmentId: ids.assignment, requestId: ids.restart, notifyStudent: false })).ok);
        assert.ok((await actions.updateTestDeadlineAction({ assignmentId: ids.assignment, dueAt })).ok);
        assert.deepEqual(await actions.testAttemptDetailAction(ids.assignment, ids.attempt), feedbackSaved.value);
        assert.equal((await actions.assignedTestDetailAction(ids.assignment))?.latestAttempt?.teacherFeedback, null);
        assert.equal((await actions.saveTestFeedbackAction({ ...feedbackInput, attemptId: ids.restart })).ok, false, "unfinished attempt rejects feedback");
        assert.ok((await actions.saveTestFeedbackAction({ ...feedbackInput, teacherNote: "Historical attempt comment" })).ok);
        assert.equal((await actions.testAttemptDetailAction(ids.assignment, ids.attempt))?.teacherFeedback?.teacherNote, "Historical attempt comment");
        assert.equal((await actions.testHomeworkCardsAction(ids.student))[0].submittedAt, null);
        assert.ok(events.some((event) => event[0] === ids.student && (event[2] as { deadlineChanged?: boolean }).deadlineChanged));
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal((await database.select({ id: schema.users.id }).from(schema.users).where(orm.inArray(schema.users.id, [ids.teacher, ids.otherTeacher, ids.student, ids.otherStudent]))).length, 0);
    assert.equal((await database.select({ id: schema.testAssignments.id }).from(schema.testAssignments).where(orm.inArray(schema.testAssignments.id, [ids.assignment, ids.other]))).length, 0);
    assert.equal((await database.select({ id: schema.testAttempts.id }).from(schema.testAttempts).where(orm.inArray(schema.testAttempts.id, [ids.attempt, ids.restart]))).length, 0);
    console.log("PASS: real deadline actions, school time round trip, scoped student folders, teacher/student isolation, completed-result protection, restart history; all fixtures rolled back");
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error("Deadline verification failed", { type: (error as Error).name, code: (error as { code?: string }).code ?? "unknown" }); process.exitCode = 1; });
