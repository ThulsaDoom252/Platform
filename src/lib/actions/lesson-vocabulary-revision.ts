"use server";

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, users, wordRevisions } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { assignedLessonAction, lessonAction } from "@/lib/actions/lessons";
import { personalizeLearningContent } from "@/lib/student-learning-language";
import { lessonRevisionWords, prepareLessonRevision, type LessonRevisionSettings } from "@/lib/lesson-vocabulary-revision";
import { queueStudentNotification } from "@/lib/notifications";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class LessonRevisionIssue extends Error {}
export type LessonRevisionSourceInput = { unitId: string; studentId: string; assignmentId?: string | null };

async function teacherSession() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

async function sourceFor(teacherId: string, input: LessonRevisionSourceInput) {
  if (!uuid.test(input?.unitId ?? "") || !uuid.test(input?.studentId ?? "") || input.assignmentId && !uuid.test(input.assignmentId)) throw new LessonRevisionIssue("Некорректный урок или ученик");
  const [[unit], [student]] = await Promise.all([
    db.select({ id: lessonUnits.id }).from(lessonUnits).where(and(eq(lessonUnits.id, input.unitId), eq(lessonUnits.authorId, teacherId))).limit(1),
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, input.studentId), eq(users.role, "STUDENT"))).limit(1),
  ]);
  if (!unit) throw new LessonRevisionIssue("Урок не найден");
  if (!student) throw new LessonRevisionIssue("Ученик не найден");
  if (input.assignmentId) {
    const [assignment] = await db.select({ id: lessonAssignments.id }).from(lessonAssignments).where(and(
      eq(lessonAssignments.id, input.assignmentId), eq(lessonAssignments.unitId, unit.id), eq(lessonAssignments.studentId, student.id),
    )).limit(1);
    if (!assignment) throw new LessonRevisionIssue("Урок этого ученика не найден");
  }
  const lesson = input.assignmentId ? (await assignedLessonAction(input.assignmentId))?.lesson : await lessonAction(unit.id);
  if (!lesson) throw new LessonRevisionIssue("Урок не найден");
  // Resolve the saved personal lesson version and the recipient's language on
  // the server, never the reusable template's words or client-edited text.
  const words = lessonRevisionWords(await personalizeLearningContent(student.id, lesson.words, undefined, { strict: true }));
  if (!words.length) throw new LessonRevisionIssue("В словаре нет слов для игры");
  return { unitId: unit.id, studentId: student.id, studentName: student.name, assignmentId: input.assignmentId ?? null,
    id: `lesson:${unit.id}`, name: lesson.title, words,
    version: createHash("sha256").update(JSON.stringify([lesson.title, words])).digest("hex") };
}

export async function lessonVocabularyRevisionSourceAction(input: LessonRevisionSourceInput) {
  const session = await teacherSession();
  try { return { source: await sourceFor(session.userId, input) }; }
  catch (error) { return { error: error instanceof LessonRevisionIssue ? error.message : "Не удалось загрузить словарь. Попробуй ещё раз." }; }
}

/** One explicit teacher submission creates one HOMEWORK copy, with no Materials side effects. */
export async function assignLessonVocabularyRevisionAction(
  input: LessonRevisionSourceInput & { requestId: string; sourceVersion: string; settings: LessonRevisionSettings },
): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const session = await teacherSession();
  if (!uuid.test(input?.requestId ?? "")) return { error: "Открой окно назначения заново" };
  let source: Awaited<ReturnType<typeof sourceFor>>, prepared: ReturnType<typeof prepareLessonRevision>;
  try {
    source = await sourceFor(session.userId, input);
    if (source.version !== input.sourceVersion) return { error: "Словарь изменился. Закрой окно и открой настройки заново." };
  } catch (error) { return { error: error instanceof LessonRevisionIssue ? error.message : "Не удалось подготовить словарь. Попробуй ещё раз." }; }
  try { prepared = prepareLessonRevision(source.words, input.settings); }
  catch (error) { return { error: error instanceof Error ? error.message : "Не удалось подготовить игру" }; }
  const { words, ...settings } = prepared;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`lesson-revision:${session.userId}:${input.requestId}`}))`);
    const [existing] = await tx.select({ id: wordRevisions.id }).from(wordRevisions).where(and(
      eq(wordRevisions.assignedByTeacherId, session.userId), eq(wordRevisions.studentId, source.studentId), eq(wordRevisions.placement, "HOMEWORK"),
      sql`${wordRevisions.wordsSnapshot}->>'requestId' = ${input.requestId}`,
    )).limit(1);
    if (existing) return { id: existing.id, created: false };
    const [created] = await tx.insert(wordRevisions).values({
      ...settings, studentId: source.studentId, assignedByTeacherId: session.userId, nodeId: null, placement: "HOMEWORK",
      wordsSnapshot: { version: 1, requestId: input.requestId, unitId: source.unitId, assignmentId: source.assignmentId, words },
    }).returning({ id: wordRevisions.id });
    if (!created) throw new Error("Не удалось сохранить игру");
    return { id: created.id, created: true };
  });
  if (result.created) {
    // Notification preferences are respected; a notification outage must not
    // turn a successfully saved homework into a failed/repeated assignment.
    try { await queueStudentNotification({ teacherId: session.userId, studentId: source.studentId,
      event: "revisionAssigned", title: settings.title, href: `/student/homework/revision/${result.id}` }); } catch { /* assignment is already durable */ }
  }
  for (const path of ["/teacher/homeworks", "/student/homework", "/teacher/class", `/teacher/lessons/${source.unitId}`]) revalidatePath(path);
  return { ok: true, id: result.id };
}
