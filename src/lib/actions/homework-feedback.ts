"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityGames, lessonAssignments, lessonUnits, wordRevisions, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { teacherWordDeckHomeworkAction } from "@/lib/actions/word-deck";
import { publishClassRealtime, publishUserRealtime } from "@/lib/realtime-server";
import {
  HOMEWORK_OVERALL_REACTION_KEY, HOMEWORK_RESULT_COMMENT_KEY, isHomeworkResultReaction, lessonHomeworkFeedback,
  readHomeworkFeedback, type HomeworkFeedbackKind, type HomeworkFeedbackSettings,
} from "@/lib/homework-feedback";
import { homeworkGradeFeedbackPatchSql } from "@/lib/homework-feedback-persistence";

const validTarget = (kind: unknown, id: unknown) =>
  ["LESSON", "ACTIVITY", "REVISION"].includes(String(kind)) &&
  typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

/** Both reads and writes verify the assignment owner, not a client-supplied student. */
async function feedbackAssignment(kind: HomeworkFeedbackKind, id: string) {
  const session = await getSession();
  if (!session || !validTarget(kind, id)) return null;
  if (kind === "LESSON") {
    const [row] = await db.select({ assignment: lessonAssignments, authorId: lessonUnits.authorId })
      .from(lessonAssignments).innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
      .where(eq(lessonAssignments.id, id)).limit(1);
    if (!row || (session.role === "TEACHER" ? row.authorId !== session.userId : row.assignment.studentId !== session.userId)) return null;
    return { studentId: row.assignment.studentId, settings: lessonHomeworkFeedback(row.assignment.answers ?? {}) };
  }
  if (kind === "ACTIVITY") {
    if (session.role === "TEACHER") {
      const row = await teacherWordDeckHomeworkAction(id);
      return row ? { studentId: row.studentId, settings: readHomeworkFeedback(row.homeworkFeedback) } : null;
    }
    const [row] = await db.select({ wordDeck: activityGames.wordDeck, studentId: activityGames.studentId })
      .from(activityGames).where(and(eq(activityGames.id, id), eq(activityGames.studentId, session.userId), eq(activityGames.kind, "WORD_DECK_HOMEWORK"))).limit(1);
    return row ? { studentId: row.studentId, settings: readHomeworkFeedback(row.wordDeck?.homeworkFeedback) } : null;
  }
  const [row] = await db.select({ studentId: wordRevisions.studentId, ownerId: wordRevisions.assignedByTeacherId, settings: wordRevisions.homeworkFeedback })
    .from(wordRevisions).where(and(eq(wordRevisions.id, id), eq(wordRevisions.placement, "HOMEWORK"))).limit(1);
  if (!row) return null;
  if (session.role === "STUDENT" && row.studentId !== session.userId) return null;
  if (session.role === "TEACHER") {
    if (row.ownerId && row.ownerId !== session.userId) return null;
    if (!row.ownerId) {
      const teachers = await db.select({ id: users.id }).from(users).where(eq(users.role, "TEACHER")).limit(2);
      if (teachers.length !== 1 || teachers[0].id !== session.userId) return null;
    }
  }
  return { studentId: row.studentId, settings: readHomeworkFeedback(row.settings) };
}

export async function homeworkFeedbackAction(kind: HomeworkFeedbackKind, id: string) {
  return (await feedbackAssignment(kind, id))?.settings ?? null;
}

export async function saveHomeworkFeedbackAction(kind: HomeworkFeedbackKind, id: string, input: HomeworkFeedbackSettings): Promise<{ error?: string; settings?: HomeworkFeedbackSettings }> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { error: "Доступно только учителю" };
  if (!validTarget(kind, id) || !input || typeof input.autoEnabled !== "boolean" ||
    (input.manualReaction !== null && !isHomeworkResultReaction(input.manualReaction)) ||
    (input.teacherNote !== undefined && typeof input.teacherNote !== "string")) return { error: "Некорректная реакция" };
  const row = await feedbackAssignment(kind, id);
  if (!row) return { error: "Домашняя работа не найдена" };
  const settings = { ...readHomeworkFeedback({ ...input,
    teacherNote: input.teacherNote === undefined ? row.settings.teacherNote : input.teacherNote,
  }), autoEnabled: kind === "REVISION" && input.autoEnabled };
  if (kind === "LESSON") {
    const current = homeworkGradeFeedbackPatchSql(lessonAssignments.answers, { [HOMEWORK_RESULT_COMMENT_KEY]: settings.teacherNote || null });
    await db.update(lessonAssignments).set({ answers: settings.manualReaction === null
      ? sql`${current} - ${HOMEWORK_OVERALL_REACTION_KEY}`
      : sql`${current} || jsonb_build_object(${HOMEWORK_OVERALL_REACTION_KEY}::text, ${settings.manualReaction}::text)`, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, id));
  } else if (kind === "ACTIVITY") {
    await db.update(activityGames).set({ wordDeck: sql`coalesce(${activityGames.wordDeck}, '{}'::jsonb) || jsonb_build_object('homeworkFeedback', ${JSON.stringify(settings)}::jsonb)` })
      .where(eq(activityGames.id, id));
  } else {
    await db.update(wordRevisions).set({ homeworkFeedback: settings }).where(eq(wordRevisions.id, id));
  }
  for (const path of ["/teacher/homeworks", "/student/homework", `/teacher/homeworks/${id}`, `/teacher/homeworks/activities/${id}`, `/teacher/homeworks/revisions/${id}`, `/student/homework/games/${id}`, `/student/homework/revision/${id}`, `/student/lessons/${id}`, "/student/class"]) revalidatePath(path);
  await publishUserRealtime(row.studentId, "homework-feedback", { kind, id });
  if (kind === "LESSON") await Promise.all([
    publishClassRealtime(row.studentId, "homework-review", { assignmentId: id, gradeFeedback: true }),
    publishUserRealtime(row.studentId, "homework-review", { assignmentId: id, gradeFeedback: true }),
  ]);
  return { settings };
}
