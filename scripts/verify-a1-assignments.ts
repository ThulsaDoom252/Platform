/** Real assignment actions and storage, using blocked QA identities in a rollback-only transaction. */
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
import { A1_GRAMMAR_TESTS } from "../src/lib/tests/a1-grammar-tests";
import { A1_GRAMMAR_KEYS } from "../src/lib/tests/a1-grammar-keys";
import { findLibraryTest } from "../src/lib/tests/catalog";
import { gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import * as types from "../src/lib/tests/types";
import * as persistence from "../src/lib/tests/persistence";
import { testAssignmentNotification } from "../src/lib/tests/assignment-notification";

async function main() {
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert.ok(env?.NEON_DATABASE_URL);
  const connection = new URL(env.NEON_DATABASE_URL); connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10000, statement_timeout: 20000, application_name: "a1-import-qa" });
  const database = drizzle(pool, { schema });
  const teacher = randomUUID(), student = randomUUID(), otherStudent = randomUUID(), assignmentIds: string[] = [], attemptIds: string[] = [], notificationIds: string[] = [];
  const rollback = new Error("ROLLBACK_A1_QA");
  let exercises = 0, answerFields = 0;
  try {
    try {
      await database.transaction(async tx => {
        await tx.insert(schema.users).values([
          { id: teacher, name: "A1 QA teacher", login: teacher, passwordHash: "not-a-password", accessBlocked: true, role: "TEACHER" },
          { id: student, name: "A1 QA student", login: student, passwordHash: "not-a-password", accessBlocked: true, role: "STUDENT" },
          { id: otherStudent, name: "A1 QA isolated student", login: otherStudent, passwordHash: "not-a-password", accessBlocked: true, role: "STUDENT" },
        ]);
        let session = { userId: teacher, role: "TEACHER" };
        const modules: Record<string, unknown> = {
          "drizzle-orm": orm, zod: { z }, "next/cache": { revalidatePath() {} }, "@/lib/db": { db: tx }, "@/lib/db/schema": schema,
          "@/lib/db/ensure-tests": { ensureTestsTables: async () => {} }, "@/lib/session": { getSession: async () => session },
          "@/lib/notifications": { queueStudentNotification: async () => { throw new Error("Unexpected real notification"); } },
          "@/lib/realtime-server": { publishUserRealtime: async () => {} }, "@/lib/tests/catalog": { findLibraryTest },
          "@/lib/tests/grading": { gradeTestExercise, libraryTestKey }, "@/lib/tests/types": types, "@/lib/tests/persistence": persistence,
          "@/lib/tests/assignment-notification": { testAssignmentNotification },
        };
        const sandbox = { exports: {}, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } };
        runInNewContext(ts.transpileModule(readFileSync("src/lib/actions/tests.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
        const actions = sandbox.exports as typeof import("../src/lib/actions/tests");
        for (const definition of A1_GRAMMAR_TESTS) {
          console.log("Checking " + definition.id);
          const requestId = randomUUID(); assignmentIds.push(requestId);
          session = { userId: teacher, role: "TEACHER" };
          const created = await actions.assignTestAction({ testId: definition.id, studentId: student, exerciseIds: null, requestId, notifyStudent: false });
          assert.ok(created.ok, definition.id + ": assignment");
          const [stored] = await tx.select().from(schema.testAssignments).where(orm.eq(schema.testAssignments.id, requestId));
          assert.deepEqual(stored.definition, definition);
          assert.deepEqual(stored.grading, A1_GRAMMAR_KEYS[definition.id]);
          console.log("Assigned and snapshot verified");
          session = { userId: otherStudent, role: "STUDENT" };
          assert.equal(await actions.assignedTestDetailAction(requestId), null);
          console.log("Student isolation verified");
          session = { userId: student, role: "STUDENT" };
          const attemptId = randomUUID(); attemptIds.push(attemptId);
          const started = await actions.startNewTestAttemptAction({ assignmentId: requestId, requestId: attemptId });
          assert.ok(started.ok, definition.id + ": start");
          for (const exercise of definition.exercises) {
            const answers = Object.fromEntries(Object.entries(A1_GRAMMAR_KEYS[definition.id][exercise.id]).map(([id, key]) => [id, key.answer]));
            const checked = await actions.checkAssignedTestAction({ assignmentId: requestId, attemptId, exerciseId: exercise.id, answers });
            assert.ok(checked.ok, definition.id + "/" + exercise.id);
            if (!checked.ok) throw new Error("A1 check failed");
            assert.equal(checked.value.percent, 100);
            assert.equal(checked.value.results[exercise.id].total, exercise.questions.length);
            exercises++; answerFields += exercise.questions.length;
          }
          const detail = await actions.assignedTestDetailAction(requestId);
          assert.ok(detail?.latestAttempt?.completedAt);
          assert.equal(detail.latestAttempt.percent, 100);
          const completed = detail.latestAttempt;
          session = { userId: teacher, role: "TEACHER" };
          if (definition.id === "a1-adjectives") {
            const reminderId = randomUUID(); notificationIds.push(reminderId);
            assert.ok((await actions.remindAssignedTestAction({ assignmentId: requestId, requestId: reminderId })).ok);
            const restartedId = randomUUID(); attemptIds.push(restartedId);
            assert.ok((await actions.restartAssignedTestAction({ assignmentId: requestId, requestId: restartedId, notifyStudent: false })).ok);
            assert.ok((await actions.updateTestDeadlineAction({ assignmentId: requestId, dueAt: "2099-10-12T18:30:00.000Z" })).ok);
            assert.deepEqual(await actions.testAttemptDetailAction(requestId, attemptId), completed);
            assert.equal((await actions.assignedTestDetailAction(requestId))!.definition.exercises.length, 3);
          }
        }
        assert.equal(exercises, 111); assert.equal(answerFields, 1238);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal((await database.select({ id: schema.users.id }).from(schema.users).where(orm.inArray(schema.users.id, [teacher, student, otherStudent]))).length, 0);
    assert.equal((await database.select({ id: schema.testAssignments.id }).from(schema.testAssignments).where(orm.inArray(schema.testAssignments.id, assignmentIds))).length, 0);
    assert.equal((await database.select({ id: schema.testAttempts.id }).from(schema.testAttempts).where(orm.inArray(schema.testAttempts.id, attemptIds))).length, 0);
    assert.equal((await database.select({ id: schema.notifications.id }).from(schema.notifications).where(orm.inArray(schema.notifications.id, notificationIds))).length, 0);
    console.log(JSON.stringify({ topics: 36, exercises, answerFields, assignmentAndCompletion: "passed", perStudentIsolation: "passed", historyRestartDeadlineReminder: "passed", allFixtures: "rolled back" }));
  } finally { await pool.end(); }
}
void main();
