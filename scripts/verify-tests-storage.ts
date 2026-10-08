/** Exercise the actual persistence helper; EVERY fixture is rolled back, including users. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { FIRST_CONDITIONAL } from "../src/lib/tests/catalog";
import { FIRST_CONDITIONAL_KEY, gradeTestExercise } from "../src/lib/tests/grading";
import { saveTestExerciseCheck } from "../src/lib/tests/persistence";

async function main() {
  const production = process.argv.includes("--production");
  const loaded = config({ path: production ? ".env.production.local" : ".env", quiet: true });
  const configured = production ? loaded.parsed?.NEON_DATABASE_URL : loaded.parsed?.DATABASE_URL;
  assert.ok(configured);
  const connection = new URL(configured); assert.notEqual(connection.hostname, "base");
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
  const database = drizzle(pool, { schema });
  const ids = { teacher: randomUUID(), student: randomUUID(), assignment: randomUUID(), other: randomUUID(), attempt: randomUUID(), second: randomUUID() };
  const rollback = new Error("ROLLBACK_VERIFICATION_FIXTURES");
  try {
    try {
      await database.transaction(async (tx) => {
        await tx.insert(schema.users).values([
          { id: ids.teacher, name: "Temporary test teacher", login: ids.teacher, passwordHash: "not-a-password", accessBlocked: true, role: "TEACHER" },
          { id: ids.student, name: "Temporary test student", login: ids.student, passwordHash: "not-a-password", accessBlocked: true, role: "STUDENT" },
        ]);
        const assignment = { id: ids.assignment, teacherId: ids.teacher, studentId: ids.student,
          testId: FIRST_CONDITIONAL.id, definition: FIRST_CONDITIONAL, grading: FIRST_CONDITIONAL_KEY, exerciseIds: ["exercise-1", "exercise-2"] };
        await tx.insert(schema.testAssignments).values(assignment);
        await tx.insert(schema.testAssignments).values({ ...assignment, id: ids.other });
        const answers = Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY["exercise-1"]).map(([id, key]) => [id, key.answer]));
        const full = gradeTestExercise(FIRST_CONDITIONAL, FIRST_CONDITIONAL_KEY, "exercise-1", answers);
        const empty = gradeTestExercise(FIRST_CONDITIONAL, FIRST_CONDITIONAL_KEY, "exercise-1", {});
        const first = await saveTestExerciseCheck(tx, assignment, ids.attempt, full);
        assert.equal(first.percent, 100); assert.equal(first.completedAt, null); assert.equal(first.total, 10);
        const duplicate = await saveTestExerciseCheck(tx, assignment, ids.attempt, empty);
        assert.deepEqual(duplicate, first, "A second check rewrote the submitted answers");
        const secondExercise = { ...empty, exerciseId: "exercise-2" };
        const completed = await saveTestExerciseCheck(tx, assignment, ids.attempt, secondExercise);
        assert.equal(completed.percent, 50); assert.equal(completed.total, 20); assert.ok(completed.completedAt);
        assert.equal(Object.keys(completed.results).length, 2);
        const secondAttempt = await saveTestExerciseCheck(tx, assignment, ids.second, empty);
        assert.equal(secondAttempt.percent, 0);
        const rows = await tx.select().from(schema.testAttempts).where(eq(schema.testAttempts.assignmentId, ids.assignment));
        assert.equal(rows.length, 2); assert.equal(rows.find((row) => row.id === ids.attempt)?.percent, 50);
        await assert.rejects(saveTestExerciseCheck(tx, { ...assignment, id: ids.other }, ids.attempt, full), /Invalid attempt/);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal((await database.select({ id: schema.users.id }).from(schema.users).where(inArray(schema.users.id, [ids.teacher, ids.student]))).length, 0);
    assert.equal((await database.select({ id: schema.testAssignments.id }).from(schema.testAssignments).where(inArray(schema.testAssignments.id, [ids.assignment, ids.other]))).length, 0);
    assert.equal((await database.select({ id: schema.testAttempts.id }).from(schema.testAttempts).where(inArray(schema.testAttempts.id, [ids.attempt, ids.second]))).length, 0);
    console.log("PASS: actual attempt writes, immutable checks, merged exercises, weighted score, separate histories, assignment isolation; all fixtures rolled back");
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error("Tests persistence verification failed", { type: (error as Error).name, message: (error as Error).message }); process.exitCode = 1; });
