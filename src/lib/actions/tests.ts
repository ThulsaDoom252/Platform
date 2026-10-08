"use server";

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { lessons, testAssignments, testAttempts, users } from "@/lib/db/schema";
import { ensureTestsTables } from "@/lib/db/ensure-tests";
import { getSession } from "@/lib/session";
import { queueStudentNotification } from "@/lib/notifications";
import { publishUserRealtime } from "@/lib/realtime-server";
import { findLibraryTest } from "@/lib/tests/catalog";
import { gradeTestExercise, libraryTestKey } from "@/lib/tests/grading";
import { selectedTestExerciseIds, type TestAnswers, type TestAssignmentDetail, type TestAttempt, type TestAttemptSummary, type TestExerciseResult, type TestHomeworkCard, type TestReply } from "@/lib/tests/types";
import { saveTestExerciseCheck, serialTestAttempt } from "@/lib/tests/persistence";

const idSchema = z.uuid();
const checkSchema = z.object({
  exerciseId: z.string().max(100), answers: z.record(z.string().max(100), z.union([z.string().max(200), z.array(z.string().max(200)).max(10)]).nullable()),
}).strict();
const attemptSummaryColumns = {
  id: testAttempts.id, createdAt: testAttempts.createdAt, completedAt: testAttempts.completedAt,
  correct: testAttempts.correct, total: testAttempts.total, percent: testAttempts.percent, checkedExerciseIds: testAttempts.checkedExerciseIds,
};

export async function testStudentsAction(): Promise<{ id: string; name: string }[]> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return [];
  return db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "STUDENT")).orderBy(asc(users.name));
}

export async function assignTestAction(input: { testId: string; studentId: string; exerciseIds: string[] | null; requestId: string }): Promise<TestReply<{ id: string }>> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { ok: false, error: "forbidden" };
  const parsed = z.object({ testId: z.string().max(100), studentId: idSchema, requestId: idSchema,
    exerciseIds: z.array(z.string().max(100)).max(30).nullable() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const test = findLibraryTest(parsed.data.testId);
  const key = test && libraryTestKey(test.id, test.version);
  const exerciseIds = test && selectedTestExerciseIds(test, parsed.data.exerciseIds);
  if (!test || !key || !exerciseIds?.length) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const [student] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, parsed.data.studentId), eq(users.role, "STUDENT"))).limit(1);
    if (!student) return { ok: false, error: "invalid" };
    // Idempotent retry: a slow response never creates duplicate homework.
    const [created] = await db.insert(testAssignments).values({ id: parsed.data.requestId, studentId: student.id,
      teacherId: session.userId, testId: test.id, definition: test, grading: key, exerciseIds })
      .onConflictDoNothing().returning({ id: testAssignments.id });
    if (!created) {
      const [existing] = await db.select({ id: testAssignments.id, exerciseIds: testAssignments.exerciseIds }).from(testAssignments)
        .where(and(eq(testAssignments.id, parsed.data.requestId), eq(testAssignments.teacherId, session.userId),
          eq(testAssignments.studentId, student.id), eq(testAssignments.testId, test.id))).limit(1);
      if (!existing || JSON.stringify(existing.exerciseIds) !== JSON.stringify(exerciseIds)) return { ok: false, error: "invalid" };
    } else {
      await queueStudentNotification({ teacherId: session.userId, studentId: student.id, event: "homeworkAssigned",
        title: test.title, href: `/student/homework/tests/${created.id}` }).catch(() => {});
      await publishUserRealtime(student.id, "homework-review", { kind: "TEST", id: created.id });
    }
    revalidatePath("/student/homework"); revalidatePath("/teacher/homeworks");
    return { ok: true, value: { id: parsed.data.requestId } };
  } catch { return { ok: false, error: "failed" }; }
}

/** Teacher practice deliberately has no database writes or student identity. */
export async function checkPracticeTestAction(testId: string, input: { exerciseId: string; answers: TestAnswers }): Promise<TestReply<TestExerciseResult>> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { ok: false, error: "forbidden" };
  const test = findLibraryTest(testId);
  const key = test && libraryTestKey(test.id, test.version);
  const parsed = checkSchema.safeParse(input);
  if (!test || !key || !parsed.success || Object.keys(parsed.data.answers).length > 100) return { ok: false, error: "invalid" };
  try { return { ok: true, value: gradeTestExercise(test, key, parsed.data.exerciseId, parsed.data.answers) }; }
  catch { return { ok: false, error: "invalid" }; }
}

export async function checkAssignedTestAction(input: { assignmentId: string; attemptId: string; exerciseId: string; answers: TestAnswers }): Promise<TestReply<TestAttempt>> {
  const session = await getSession();
  if (session?.role !== "STUDENT") return { ok: false, error: "forbidden" };
  const parsed = checkSchema.extend({ assignmentId: idSchema, attemptId: idSchema }).safeParse(input);
  if (!parsed.success || Object.keys(parsed.data.answers).length > 100) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const [assignment] = await db.select().from(testAssignments).where(and(eq(testAssignments.id, input.assignmentId),
      eq(testAssignments.studentId, session.userId))).limit(1);
    if (!assignment || !assignment.exerciseIds.includes(input.exerciseId)) return { ok: false, error: "forbidden" };
    const result = gradeTestExercise(assignment.definition, assignment.grading, input.exerciseId, parsed.data.answers);
    const attempt = await db.transaction((tx) => saveTestExerciseCheck(tx, assignment, input.attemptId, result));
    revalidatePath("/student/homework"); revalidatePath("/teacher/homeworks");
    await publishUserRealtime(assignment.teacherId, "homework-review", { kind: "TEST", id: assignment.id });
    return { ok: true, value: attempt };
  } catch { return { ok: false, error: "failed" }; }
}

export async function assignedTestDetailAction(id: string): Promise<TestAssignmentDetail | null> {
  const session = await getSession();
  if (!session || !idSchema.safeParse(id).success) return null;
  await ensureTestsTables();
  const [row] = await db.select({ id: testAssignments.id, studentId: testAssignments.studentId, studentName: users.name,
    definition: testAssignments.definition, exerciseIds: testAssignments.exerciseIds, assignedAt: testAssignments.assignedAt })
    .from(testAssignments).innerJoin(users, eq(users.id, testAssignments.studentId)).where(and(eq(testAssignments.id, id),
      session.role === "TEACHER" ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId))).limit(1);
  if (!row) return null;
  const [attempts, latest] = await Promise.all([
    testAttemptHistoryAction(id),
    db.select().from(testAttempts).where(eq(testAttempts.assignmentId, id)).orderBy(desc(testAttempts.createdAt), desc(testAttempts.id)).limit(1),
  ]);
  return { ...row, definition: { ...row.definition, exercises: row.definition.exercises.filter((exercise) => row.exerciseIds.includes(exercise.id)) }, assignedAt: row.assignedAt.toISOString(), attempts,
    latestAttempt: latest[0] ? serialTestAttempt(latest[0]) : null };
}

export async function testAttemptHistoryAction(assignmentId: string, beforeId?: string): Promise<TestAttemptSummary[]> {
  const session = await getSession();
  if (!session || !idSchema.safeParse(assignmentId).success || beforeId && !idSchema.safeParse(beforeId).success) return [];
  await ensureTestsTables();
  const own = session.role === "TEACHER" ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId);
  const cursor = beforeId ? sql` AND (${testAttempts.createdAt}, ${testAttempts.id}) < (SELECT created_at, id FROM test_attempts WHERE id = ${beforeId} AND assignment_id = ${assignmentId})` : sql``;
  const rows = await db.select(attemptSummaryColumns).from(testAttempts).innerJoin(testAssignments,
    eq(testAssignments.id, testAttempts.assignmentId)).where(and(eq(testAssignments.id, assignmentId), own, sql`true ${cursor}`))
    .orderBy(desc(testAttempts.createdAt), desc(testAttempts.id)).limit(50);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null }));
}

export async function testAttemptDetailAction(assignmentId: string, attemptId: string): Promise<TestAttempt | null> {
  const session = await getSession();
  if (!session || !idSchema.safeParse(assignmentId).success || !idSchema.safeParse(attemptId).success) return null;
  await ensureTestsTables();
  const [row] = await db.select({ attempt: testAttempts }).from(testAttempts).innerJoin(testAssignments,
    eq(testAssignments.id, testAttempts.assignmentId)).where(and(eq(testAssignments.id, assignmentId), eq(testAttempts.id, attemptId),
    session.role === "TEACHER" ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId))).limit(1);
  return row ? serialTestAttempt(row.attempt) : null;
}

export async function testHomeworkCardsAction(): Promise<TestHomeworkCard[]> {
  const session = await getSession();
  if (!session) return [];
  await ensureTestsTables();
  const rows = await db.select({ id: testAssignments.id, title: sql<string>`${testAssignments.definition}->>'title'`, exerciseIds: testAssignments.exerciseIds,
    studentId: users.id, studentName: users.name, studentAvatarUrl: users.avatarUrl, assignedAt: testAssignments.assignedAt,
    latestPercent: sql<number | null>`(SELECT percent FROM test_attempts WHERE assignment_id = ${testAssignments.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    submittedAt: sql<Date | null>`(SELECT completed_at FROM test_attempts WHERE assignment_id = ${testAssignments.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    attemptCount: sql<number>`(SELECT count(*)::int FROM test_attempts WHERE assignment_id = ${testAssignments.id})`,
    nextLessonAt: sql<Date | null>`(SELECT min(${lessons.startTime}) FROM ${lessons} WHERE ${lessons.studentId} = ${users.id} AND ${lessons.status} = 'SCHEDULED' AND ${gte(lessons.startTime, new Date())})`,
  }).from(testAssignments).innerJoin(users, eq(users.id, testAssignments.studentId)).where(
    session.role === "TEACHER" ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId))
    .orderBy(desc(testAssignments.assignedAt));
  return rows.map((row) => ({ id: row.id, kind: "TEST", activityType: "TEST", title: row.title,
    exerciseIds: row.exerciseIds, studentId: row.studentId, studentName: row.studentName, studentAvatarUrl: row.studentAvatarUrl,
    assignedAt: row.assignedAt.toISOString(), submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    reviewedAt: null, nextLessonAt: row.nextLessonAt ? new Date(row.nextLessonAt).toISOString() : null,
    started: row.attemptCount > 0, latestPercent: row.latestPercent, attemptCount: row.attemptCount }));
}
