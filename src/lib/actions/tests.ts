"use server";

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { lessons, notifications, testAssignments, testAttempts, users } from "@/lib/db/schema";
import { ensureTestsTables } from "@/lib/db/ensure-tests";
import { getSession } from "@/lib/session";
import { queueStudentNotification } from "@/lib/notifications";
import { publishUserRealtime } from "@/lib/realtime-server";
import { findLibraryTest } from "@/lib/tests/catalog";
import { gradeTestExercise, libraryTestKey } from "@/lib/tests/grading";
import { selectedTestExerciseIds, type TestAnswers, type TestAssignmentDetail, type TestAttempt, type TestAttemptSummary, type TestExerciseResult, type TestHomeworkCard, type TestReply } from "@/lib/tests/types";
import { saveTestExerciseCheck, serialTestAttempt, startTestAttempt, TestAttemptStaleError } from "@/lib/tests/persistence";
import { testAssignmentNotification } from "@/lib/tests/assignment-notification";
import { isHomeworkResultReaction, type HomeworkResultReaction } from "@/lib/homework-feedback";
import { readTestTeacherFeedback } from "@/lib/tests/feedback";

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

function refreshTestPaths(id: string) {
  for (const path of ["/student/tests", "/student/homework", "/teacher/tests", "/teacher/tests/assigned", "/teacher/homeworks",
    `/student/tests/${id}`, `/student/homework/tests/${id}`, `/teacher/homeworks/tests/${id}`]) revalidatePath(path);
  revalidatePath("/teacher/tests/assigned", "layout");
}

/** Feedback is optional and cannot change grades, answers or completion. */
export async function saveTestFeedbackAction(input: { assignmentId: string; attemptId: string; manualReaction: HomeworkResultReaction | null; teacherNote: string }): Promise<TestReply<TestAttempt>> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { ok: false, error: "forbidden" };
  const parsed = z.object({ assignmentId: idSchema, attemptId: idSchema,
    manualReaction: z.string().nullable().refine((value) => value === null || isHomeworkResultReaction(value)),
    teacherNote: z.string().trim().max(4_000) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const outcome = await db.transaction(async (tx) => {
      // The same parent lock as restart/checking. Historical completed attempts
      // can receive feedback too; a restart never transfers it to the new one.
      const [assignment] = await tx.select({ id: testAssignments.id, studentId: testAssignments.studentId })
        .from(testAssignments).where(and(eq(testAssignments.id, parsed.data.assignmentId), eq(testAssignments.teacherId, session.userId))).for("update");
      if (!assignment) return { ok: false as const, error: "forbidden" as const };
      const [attempt] = await tx.select().from(testAttempts).where(and(eq(testAttempts.id, parsed.data.attemptId),
        eq(testAttempts.assignmentId, assignment.id))).for("update");
      if (!attempt) return { ok: false as const, error: "forbidden" as const };
      if (!attempt.completedAt) return { ok: false as const, error: "invalid" as const };
      const teacherFeedback = readTestTeacherFeedback({ ...parsed.data, updatedAt: new Date().toISOString() });
      const [saved] = await tx.update(testAttempts).set({ teacherFeedback }).where(eq(testAttempts.id, attempt.id)).returning();
      return { ok: true as const, value: serialTestAttempt(saved), studentId: assignment.studentId };
    });
    if (!outcome.ok) return outcome;
    refreshTestPaths(parsed.data.assignmentId);
    await Promise.all([session.userId, outcome.studentId].map((userId) => publishUserRealtime(userId, "homework-review",
      { kind: "TEST", id: parsed.data.assignmentId, attemptId: parsed.data.attemptId, feedbackChanged: true }).catch(() => {})));
    return { ok: true, value: outcome.value };
  } catch { return { ok: false, error: "failed" }; }
}

/** Parent lock serializes deadlines with completion/restart; only the owning teacher may edit. */
export async function updateTestDeadlineAction(input: { assignmentId: string; dueAt: string | null }): Promise<TestReply<{ dueAt: string | null }>> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { ok: false, error: "forbidden" };
  const parsed = z.object({ assignmentId: idSchema, dueAt: z.string().datetime().nullable() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  if (dueAt && (dueAt.getTime() <= Date.now() || dueAt.getUTCFullYear() > 2100)) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const outcome = await db.transaction(async (tx) => {
      const [assignment] = await tx.select({ id: testAssignments.id, studentId: testAssignments.studentId, dueAt: testAssignments.dueAt })
        .from(testAssignments).where(and(eq(testAssignments.id, parsed.data.assignmentId), eq(testAssignments.teacherId, session.userId))).for("update");
      if (!assignment) return { ok: false as const, error: "forbidden" as const };
      const [latest] = await tx.select({ completedAt: testAttempts.completedAt }).from(testAttempts)
        .where(eq(testAttempts.assignmentId, assignment.id)).orderBy(desc(testAttempts.createdAt), desc(testAttempts.id)).limit(1);
      if (latest?.completedAt) return { ok: false as const, error: "completed" as const };
      const current = assignment.dueAt?.toISOString() ?? null, next = dueAt?.toISOString() ?? null;
      if (current !== next) await tx.update(testAssignments).set({ dueAt }).where(eq(testAssignments.id, assignment.id)).returning({ dueAt: testAssignments.dueAt });
      return { ok: true as const, value: { dueAt: next }, studentId: assignment.studentId, changed: current !== next };
    });
    if (!outcome.ok) return outcome;
    refreshTestPaths(parsed.data.assignmentId);
    if (outcome.changed) await Promise.all([session.userId, outcome.studentId].map((userId) =>
      publishUserRealtime(userId, "homework-review", { kind: "TEST", id: parsed.data.assignmentId, deadlineChanged: true }).catch(() => {})));
    return { ok: true, value: outcome.value };
  } catch { return { ok: false, error: "failed" }; }
}

export async function assignTestAction(input: { testId: string; studentId: string; exerciseIds: string[] | null; requestId: string; notifyStudent?: boolean }): Promise<TestReply<{ id: string }>> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { ok: false, error: "forbidden" };
  const parsed = z.object({ testId: z.string().max(100), studentId: idSchema, requestId: idSchema,
    exerciseIds: z.array(z.string().max(100)).max(30).nullable(), notifyStudent: z.boolean().optional() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const test = findLibraryTest(parsed.data.testId);
  const key = test && libraryTestKey(test.id, test.version);
  const exerciseIds = test && selectedTestExerciseIds(test, parsed.data.exerciseIds);
  if (!test || !key || !exerciseIds?.length) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const [student] = await db.select({ id: users.id, locale: users.locale }).from(users)
      .where(and(eq(users.id, parsed.data.studentId), eq(users.role, "STUDENT"))).limit(1);
    if (!student) return { ok: false, error: "invalid" };
    // Freeze content and private keys per student; assignment + explicit notification commit together.
    const outcome = await db.transaction(async (tx) => {
      const [created] = await tx.insert(testAssignments).values({ id: parsed.data.requestId, studentId: student.id,
        teacherId: session.userId, testId: test.id, definition: test, grading: key, exerciseIds })
        .onConflictDoNothing().returning({ id: testAssignments.id });
      if (!created) {
        const [existing] = await tx.select({ id: testAssignments.id, exerciseIds: testAssignments.exerciseIds }).from(testAssignments)
          .where(and(eq(testAssignments.id, parsed.data.requestId), eq(testAssignments.teacherId, session.userId),
            eq(testAssignments.studentId, student.id), eq(testAssignments.testId, test.id))).limit(1);
        return { valid: !!existing && JSON.stringify(existing.exerciseIds) === JSON.stringify(exerciseIds), created: false };
      }
      if (parsed.data.notifyStudent === true) await tx.insert(notifications).values(testAssignmentNotification({
        id: created.id, assignmentId: created.id, teacherId: session.userId, studentId: student.id,
        locale: student.locale, title: test.title, event: "assigned" }));
      return { valid: true, created: true };
    });
    if (!outcome.valid) return { ok: false, error: "invalid" };
    if (outcome.created) {
      // Compatibility for callers that predate the explicit notification checkbox.
      if (parsed.data.notifyStudent === undefined) await queueStudentNotification({ teacherId: session.userId,
        studentId: student.id, event: "homeworkAssigned", title: test.title,
        href: `/student/tests/${parsed.data.requestId}` }).catch(() => {});
      if (parsed.data.notifyStudent === true) await publishUserRealtime(student.id, "notification", { id: parsed.data.requestId });
      await Promise.all([session.userId, student.id].map((userId) =>
        publishUserRealtime(userId, "homework-review", { kind: "TEST", id: parsed.data.requestId })));
    }
    refreshTestPaths(parsed.data.requestId);
    return { ok: true, value: { id: parsed.data.requestId } };
  } catch { return { ok: false, error: "failed" }; }
}

async function newAssignedAttempt(input: { assignmentId: string; requestId: string; notifyStudent?: boolean }, teacher: boolean): Promise<TestReply<TestAttempt>> {
  const session = await getSession();
  if (session?.role !== (teacher ? "TEACHER" : "STUDENT")) return { ok: false, error: "forbidden" };
  const parsed = z.object({ assignmentId: idSchema, requestId: idSchema, notifyStudent: z.boolean().optional() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const [assignment] = await db.select({ id: testAssignments.id, teacherId: testAssignments.teacherId,
      studentId: testAssignments.studentId, title: sql<string>`${testAssignments.definition}->>'title'`, locale: users.locale })
      .from(testAssignments).innerJoin(users, eq(users.id, testAssignments.studentId)).where(and(eq(testAssignments.id, parsed.data.assignmentId),
        teacher ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId))).limit(1);
    if (!assignment) return { ok: false, error: "forbidden" };
    const saved = await db.transaction(async (tx) => {
      const result = await startTestAttempt(tx, assignment.id, parsed.data.requestId);
      if (result.created && teacher && parsed.data.notifyStudent) await tx.insert(notifications).values(testAssignmentNotification({
        id: result.attempt.id, assignmentId: assignment.id, teacherId: session.userId, studentId: assignment.studentId,
        locale: assignment.locale, title: assignment.title, event: "restarted" }));
      return result;
    });
    refreshTestPaths(assignment.id);
    if (saved.created) {
      if (teacher && parsed.data.notifyStudent) await publishUserRealtime(assignment.studentId, "notification", { id: saved.attempt.id });
      await Promise.all([assignment.teacherId, assignment.studentId].map((userId) =>
        publishUserRealtime(userId, "homework-review", { kind: "TEST", id: assignment.id, restarted: true })));
    }
    return { ok: true, value: saved.attempt };
  } catch (error) { return { ok: false, error: error instanceof TestAttemptStaleError ? "stale" : "failed" }; }
}

export async function restartAssignedTestAction(input: { assignmentId: string; requestId: string; notifyStudent?: boolean }): Promise<TestReply<TestAttempt>> {
  return newAssignedAttempt(input, true);
}

export async function startNewTestAttemptAction(input: { assignmentId: string; requestId: string }): Promise<TestReply<TestAttempt>> {
  return newAssignedAttempt(input, false);
}

export async function remindAssignedTestAction(input: { assignmentId: string; requestId: string }): Promise<TestReply<{ id: string }>> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { ok: false, error: "forbidden" };
  const parsed = z.object({ assignmentId: idSchema, requestId: idSchema }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    await ensureTestsTables();
    const [assignment] = await db.select({ id: testAssignments.id, studentId: testAssignments.studentId,
      title: sql<string>`${testAssignments.definition}->>'title'`, locale: users.locale }).from(testAssignments)
      .innerJoin(users, eq(users.id, testAssignments.studentId)).where(and(eq(testAssignments.id, parsed.data.assignmentId),
        eq(testAssignments.teacherId, session.userId))).limit(1);
    if (!assignment) return { ok: false, error: "forbidden" };
    const notice = testAssignmentNotification({ id: parsed.data.requestId, assignmentId: assignment.id, teacherId: session.userId,
      studentId: assignment.studentId, locale: assignment.locale, title: assignment.title, event: "reminder" });
    const [created] = await db.insert(notifications).values(notice).onConflictDoNothing().returning({ id: notifications.id });
    if (!created) {
      const [existing] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, notice.id),
        eq(notifications.recipientId, notice.recipientId), eq(notifications.senderId, notice.senderId), eq(notifications.href, notice.href),
        sql`${notifications.data}->>'kind' = 'HOMEWORK_REMINDER'`)).limit(1);
      if (!existing) return { ok: false, error: "invalid" };
    } else await publishUserRealtime(assignment.studentId, "notification", { id: created.id });
    return { ok: true, value: { id: notice.id } };
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
    refreshTestPaths(assignment.id);
    await Promise.all([assignment.teacherId, assignment.studentId].map((userId) =>
      publishUserRealtime(userId, "homework-review", { kind: "TEST", id: assignment.id })));
    return { ok: true, value: attempt };
  } catch (error) { return { ok: false, error: error instanceof TestAttemptStaleError ? "stale" : "failed" }; }
}

export async function assignedTestDetailAction(id: string): Promise<TestAssignmentDetail | null> {
  const session = await getSession();
  if (!session || !idSchema.safeParse(id).success) return null;
  await ensureTestsTables();
  const [row] = await db.select({ id: testAssignments.id, studentId: testAssignments.studentId, studentName: users.name,
    definition: testAssignments.definition, exerciseIds: testAssignments.exerciseIds, assignedAt: testAssignments.assignedAt, dueAt: testAssignments.dueAt })
    .from(testAssignments).innerJoin(users, eq(users.id, testAssignments.studentId)).where(and(eq(testAssignments.id, id),
      session.role === "TEACHER" ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId))).limit(1);
  if (!row) return null;
  const [attempts, latest] = await Promise.all([
    testAttemptHistoryAction(id),
    db.select().from(testAttempts).where(eq(testAttempts.assignmentId, id)).orderBy(desc(testAttempts.createdAt), desc(testAttempts.id)).limit(1),
  ]);
  return { ...row, definition: { ...row.definition, exercises: row.definition.exercises.filter((exercise) => row.exerciseIds.includes(exercise.id)) }, assignedAt: row.assignedAt.toISOString(), attempts,
    dueAt: row.dueAt?.toISOString() ?? null, latestAttempt: latest[0] ? serialTestAttempt(latest[0]) : null };
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

export async function testHomeworkCardsAction(studentId?: string): Promise<TestHomeworkCard[]> {
  const session = await getSession();
  if (!session || studentId !== undefined && !idSchema.safeParse(studentId).success) return [];
  await ensureTestsTables();
  const rows = await db.select({ id: testAssignments.id, title: sql<string>`${testAssignments.definition}->>'title'`, exerciseIds: testAssignments.exerciseIds,
    cover: sql<TestHomeworkCard["cover"]>`${testAssignments.definition}->'cover'`, level: sql<TestHomeworkCard["level"]>`${testAssignments.definition}->>'level'`,
    studentId: users.id, studentName: users.name, studentAvatarUrl: users.avatarUrl, assignedAt: testAssignments.assignedAt, dueAt: testAssignments.dueAt,
    latestPercent: sql<number | null>`(SELECT CASE WHEN total > 0 THEN percent ELSE NULL END FROM test_attempts WHERE assignment_id = ${testAssignments.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    submittedAt: sql<Date | null>`(SELECT completed_at FROM test_attempts WHERE assignment_id = ${testAssignments.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    latestAttemptId: sql<string | null>`(SELECT id FROM test_attempts WHERE assignment_id = ${testAssignments.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    teacherFeedback: sql<unknown>`(SELECT teacher_feedback FROM test_attempts WHERE assignment_id = ${testAssignments.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    attemptCount: sql<number>`(SELECT count(*)::int FROM test_attempts WHERE assignment_id = ${testAssignments.id})`,
    nextLessonAt: sql<Date | null>`(SELECT min(${lessons.startTime}) FROM ${lessons} WHERE ${lessons.studentId} = ${users.id} AND ${lessons.status} = 'SCHEDULED' AND ${gte(lessons.startTime, new Date())})`,
  }).from(testAssignments).innerJoin(users, eq(users.id, testAssignments.studentId)).where(and(
    session.role === "TEACHER" ? eq(testAssignments.teacherId, session.userId) : eq(testAssignments.studentId, session.userId),
    studentId ? eq(testAssignments.studentId, studentId) : undefined))
    .orderBy(desc(testAssignments.assignedAt));
  return rows.map((row) => ({ id: row.id, kind: "TEST", activityType: "TEST", title: row.title,
    exerciseIds: row.exerciseIds, studentId: row.studentId, studentName: row.studentName, studentAvatarUrl: row.studentAvatarUrl,
    assignedAt: row.assignedAt.toISOString(), submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    reviewedAt: null, latestAttemptId: row.latestAttemptId, teacherFeedback: readTestTeacherFeedback(row.teacherFeedback),
    nextLessonAt: row.nextLessonAt ? new Date(row.nextLessonAt).toISOString() : null,
    dueAt: row.dueAt?.toISOString() ?? null, started: row.latestPercent !== null, latestPercent: row.latestPercent, attemptCount: row.attemptCount, cover: row.cover ?? undefined, level: row.level }));
}
