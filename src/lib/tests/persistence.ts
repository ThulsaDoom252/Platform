import { and, desc, eq } from "drizzle-orm";
import type { db } from "@/lib/db";
import { testAssignments, testAttempts } from "@/lib/db/schema";
import { testResultsScore, type TestAttempt, type TestExerciseResult } from "./types";

type TestTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class TestAttemptStaleError extends Error {}

async function lockAssignment(tx: TestTransaction, assignmentId: string) {
  const [assignment] = await tx.select({ id: testAssignments.id }).from(testAssignments)
    .where(eq(testAssignments.id, assignmentId)).for("update");
  if (!assignment) throw new Error("Invalid assignment");
}

async function latestAttempt(tx: TestTransaction, assignmentId: string) {
  const [latest] = await tx.select().from(testAttempts).where(eq(testAttempts.assignmentId, assignmentId))
    .orderBy(desc(testAttempts.createdAt), desc(testAttempts.id)).limit(1);
  return latest;
}

/** A restart creates a new generation, never removes previous results. Call only after ownership checks. */
export async function startTestAttempt(tx: TestTransaction, assignmentId: string, requestId: string) {
  await lockAssignment(tx, assignmentId);
  const latest = await latestAttempt(tx, assignmentId);
  const [existing] = await tx.select().from(testAttempts).where(eq(testAttempts.id, requestId)).limit(1);
  if (existing) {
    if (existing.assignmentId !== assignmentId || latest?.id !== existing.id) throw new TestAttemptStaleError();
    return { attempt: serialTestAttempt(existing), created: false };
  }
  const [created] = await tx.insert(testAttempts).values({ id: requestId, assignmentId,
    createdAt: new Date(Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1)) }).returning();
  return { attempt: serialTestAttempt(created), created: true };
}
export function serialTestAttempt(row: typeof testAttempts.$inferSelect): TestAttempt {
  return { id: row.id, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    correct: row.correct, total: row.total, percent: row.percent, checkedExerciseIds: row.checkedExerciseIds, results: row.results };
}

/** Internal only: the action verifies ownership and grades on the server before calling this. */
export async function saveTestExerciseCheck(tx: TestTransaction, assignment: { id: string; exerciseIds: string[] }, attemptId: string, result: TestExerciseResult): Promise<TestAttempt> {
  // Restart and checking serialize on the same parent row. Old tabs cannot revive an old generation.
  await lockAssignment(tx, assignment.id);
  const latest = await latestAttempt(tx, assignment.id);
  const [existing] = await tx.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).limit(1);
  if (existing && (existing.assignmentId !== assignment.id || existing.id !== latest?.id)
    || !existing && latest) throw new TestAttemptStaleError();
  await tx.insert(testAttempts).values({ id: attemptId, assignmentId: assignment.id,
    createdAt: new Date(Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1)) }).onConflictDoNothing();
  // Row lock merges concurrent exercise checks; first submitted answers are immutable.
  const [current] = await tx.select().from(testAttempts).where(and(eq(testAttempts.id, attemptId),
    eq(testAttempts.assignmentId, assignment.id))).for("update");
  if (!current) throw new Error("Invalid attempt");
  if (current.results[result.exerciseId]) return serialTestAttempt(current);
  const results = { ...current.results, [result.exerciseId]: result };
  const score = testResultsScore(results, assignment.exerciseIds);
  const [saved] = await tx.update(testAttempts).set({ results, correct: score.correct, total: score.total,
    percent: score.percent, checkedExerciseIds: score.checkedExerciseIds,
    completedAt: score.complete ? new Date() : null }).where(eq(testAttempts.id, current.id)).returning();
  return serialTestAttempt(saved);
}
