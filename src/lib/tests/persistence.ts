import { and, eq } from "drizzle-orm";
import type { db } from "@/lib/db";
import { testAttempts } from "@/lib/db/schema";
import { testResultsScore, type TestAttempt, type TestExerciseResult } from "./types";

type TestTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function serialTestAttempt(row: typeof testAttempts.$inferSelect): TestAttempt {
  return { id: row.id, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    correct: row.correct, total: row.total, percent: row.percent, checkedExerciseIds: row.checkedExerciseIds, results: row.results };
}

/** Internal only: the action verifies ownership and grades on the server before calling this. */
export async function saveTestExerciseCheck(tx: TestTransaction, assignment: { id: string; exerciseIds: string[] }, attemptId: string, result: TestExerciseResult): Promise<TestAttempt> {
  await tx.insert(testAttempts).values({ id: attemptId, assignmentId: assignment.id }).onConflictDoNothing();
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
