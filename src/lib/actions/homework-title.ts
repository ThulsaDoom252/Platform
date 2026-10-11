"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { assignedInteractiveHomework, homeworkPlanForAssignment, homeworkRemovedAt,
  interactiveHomeworkFromEntries, legacyHomeworkFromEntries, normalizeInteractiveHomework } from "@/lib/lesson-homework";
import { normalizeHomeworkTitle, type HomeworkTitleSaveResult } from "@/lib/homework-title";
import { homeworkTitlePatchSql } from "@/lib/homework-title-persistence";
import { publishClassRealtime, publishUserRealtime } from "@/lib/realtime-server";

/** Rename only an assigned homework owned by the signed-in teacher. Null restores its default name. */
export async function renameHomeworkTitleAction(assignmentId: string, supplied: string | null): Promise<HomeworkTitleSaveResult> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { error: "forbidden" };
  if (typeof assignmentId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(assignmentId)) return { error: "unavailable" };
  const title = supplied === null ? null : normalizeHomeworkTitle(supplied);
  if (supplied !== null && title === null) return { error: "invalid" };

  const [row] = await db.select({ id: lessonAssignments.id, studentId: lessonAssignments.studentId,
    answers: lessonAssignments.answers, override: lessonAssignments.contentOverride, homework: lessonUnits.homework })
    .from(lessonAssignments).innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(and(eq(lessonAssignments.id, assignmentId), eq(lessonUnits.authorId, session.userId))).limit(1);
  if (!row || homeworkRemovedAt(row.answers)) return { error: "unavailable" };
  const plan = homeworkPlanForAssignment(normalizeInteractiveHomework(row.override?.interactiveHomework, { allowEmpty: true })
    ?? interactiveHomeworkFromEntries(row.homework), row.answers);
  const legacy = legacyHomeworkFromEntries(row.override?.homework ?? row.homework);
  if (plan ? !assignedInteractiveHomework(plan, row.answers) : !legacy.length) return { error: "unavailable" };

  await db.update(lessonAssignments).set({ answers: homeworkTitlePatchSql(lessonAssignments.answers, title), updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.id));
  for (const path of ["/teacher/homeworks", `/teacher/homeworks/${row.id}`, `/teacher/lessons/given/${row.id}`,
    "/student/homework", `/student/lessons/${row.id}`, "/teacher/class", "/student/class"]) revalidatePath(path);
  // Metadata-only updates must never replace a student's answer currently being typed.
  const event = { assignmentId: row.id, titleChanged: true, gradeFeedback: true };
  await Promise.all([publishClassRealtime(row.studentId, "homework-review", event),
    publishUserRealtime(row.studentId, "homework-review", event)]);
  return { title };
}
