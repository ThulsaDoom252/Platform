/** Usage: tsx scripts/import-test-results.ts --production --manifest <json> [--apply]
 * Default is a read-only dry run. Manifest IDs make retries idempotent; existing work is never overwritten.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { prepareTestResultsImport } from "../src/lib/tests/import-results";

async function main() {
  const args = process.argv.slice(2);
  const manifestIndex = args.indexOf("--manifest");
  assert.ok(manifestIndex >= 0 && args[manifestIndex + 1], "Manifest is required");
  const prepared = prepareTestResultsImport(JSON.parse(readFileSync(args[manifestIndex + 1], "utf8")));
  const production = args.includes("--production"), apply = args.includes("--apply");
  const env = config({ path: production ? ".env.production.local" : ".env", quiet: true }).parsed;
  const configured = production ? env?.NEON_DATABASE_URL : env?.DATABASE_URL;
  assert.ok(configured, "Database is not configured");
  const connection = new URL(configured);
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
  const database = drizzle(pool, { schema });
  const { student, teacher } = prepared.manifest;
  try {
    await database.transaction(async (tx) => {
      // Exact identities and immutable IDs are checked again inside the write transaction.
      if (!apply) await tx.execute("SET TRANSACTION READ ONLY");
      const identityQuery = tx.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role })
        .from(schema.users).where(inArray(schema.users.id, [student.id, teacher.id]));
      const people = apply ? await identityQuery.for("update") : await identityQuery;
      assert.deepEqual(people.find((row) => row.id === student.id), { ...student, role: "STUDENT" }, "Student identity mismatch");
      assert.deepEqual(people.find((row) => row.id === teacher.id), { ...teacher, role: "TEACHER" }, "Teacher identity mismatch");
      for (const item of prepared.tests) {
        const previous = await tx.select().from(schema.testAssignments).where(and(
          eq(schema.testAssignments.studentId, student.id), eq(schema.testAssignments.testId, item.assignment.testId)));
        assert.ok(previous.every((row) => row.id === item.assignment.id), "This student already has another assignment for this test; review it before importing");
        const [existing] = await tx.select().from(schema.testAssignments).where(eq(schema.testAssignments.id, item.assignment.id));
        if (existing) assert.deepEqual(existing, item.assignment, "Assignment ID already exists with different data");
        else if (apply) await tx.insert(schema.testAssignments).values(item.assignment);
        const importedIds = item.attempts.map((attempt) => attempt.id);
        const history = await tx.select().from(schema.testAttempts).where(eq(schema.testAttempts.assignmentId, item.assignment.id));
        assert.ok(history.every((row) => importedIds.includes(row.id)), "There are newer/unrelated attempts; import aborted without overwriting them");
        for (const attempt of item.attempts) {
          const [saved] = await tx.select().from(schema.testAttempts).where(eq(schema.testAttempts.id, attempt.id));
          if (saved) assert.deepEqual(saved, attempt, "Attempt ID already exists with different data");
          else if (apply) await tx.insert(schema.testAttempts).values(attempt);
          if (apply) {
            const [verified] = await tx.select().from(schema.testAttempts).where(eq(schema.testAttempts.id, attempt.id));
            assert.deepEqual(verified, attempt, "Stored answers did not match the import");
          }
        }
      }
    });
    console.log(JSON.stringify({ mode: apply ? "applied-and-verified" : "read-only-dry-run", student: student.name,
      tests: prepared.tests.map((item) => ({ assignmentId: item.assignment.id, testId: item.assignment.testId,
        attempts: item.attempts.map((attempt) => ({ id: attempt.id, correct: attempt.correct, total: attempt.total, percent: attempt.percent,
          exercises: Object.values(attempt.results).map((result) => ({ exerciseId: result.exerciseId, correct: result.correct, total: result.total, percent: result.percent,
            mistakes: result.questions.filter((question) => !question.correct).map((question) => ({ id: question.id, selected: question.selected, answer: question.answer })) })) })) })) }, null, 2));
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  // Never print connection strings or raw database errors.
  console.error(error instanceof assert.AssertionError ? error.message.split("\n")[0]
    : error instanceof Error && /^(Duplicate|Invalid|Missing|All exercises|Mistakes mismatch|Screenshot score mismatch|Test version mismatch)/.test(error.message) ? error.message : "Test result import failed; no partial transaction was committed.");
  process.exitCode = 1;
});
