"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { assignedInteractiveHomework, homeworkPlanForAssignment, homeworkRemovedAt, homeworkRemovedAtKey,
  homeworkReviewedAt, homeworkReviewedAtKey, interactiveHomeworkFromEntries, legacyHomeworkFromEntries, normalizeInteractiveHomework } from "@/lib/lesson-homework";
import { homeworkDonePatchSql } from "@/lib/homework-completion-persistence";
import type { HomeworkDoneResult } from "@/lib/homework-completion";
import { assignedHomeworkTitle } from "@/lib/homework-title";
import { queueStudentNotification } from "@/lib/notifications";
import { publishClassRealtime, publishUserRealtime } from "@/lib/realtime-server";

/** A teacher can finish their student's assigned homework without a student submission. */
export async function markHomeworkDoneAction(assignmentId: string): Promise<HomeworkDoneResult> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { error: "forbidden" };
  if (typeof assignmentId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(assignmentId)) return { error: "unavailable" };
  const [row] = await db.select({ id: lessonAssignments.id, studentId: lessonAssignments.studentId,
    answers: lessonAssignments.answers, override: lessonAssignments.contentOverride, homework: lessonUnits.homework, title: lessonUnits.title })
    .from(lessonAssignments).innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(and(eq(lessonAssignments.id, assignmentId), eq(lessonUnits.authorId, session.userId))).limit(1);
  if (!row || homeworkRemovedAt(row.answers)) return { error: "unavailable" };
  const plan = homeworkPlanForAssignment(normalizeInteractiveHomework(row.override?.interactiveHomework, { allowEmpty: true })
    ?? interactiveHomeworkFromEntries(row.homework), row.answers);
  const legacy = legacyHomeworkFromEntries(row.override?.homework ?? row.homework);
  if (plan ? !assignedInteractiveHomework(plan, row.answers) : !legacy.length) return { error: "unavailable" };
  const existing = homeworkReviewedAt(row.answers);
  if (existing) return { reviewedAt: existing };

  const reviewedAt = new Date().toISOString();
  const [saved] = await db.update(lessonAssignments)
    .set({ answers: homeworkDonePatchSql(lessonAssignments.answers, reviewedAt), updatedAt: new Date() })
    .where(and(eq(lessonAssignments.id, row.id),
      sql`nullif(${lessonAssignments.answers}->>${homeworkReviewedAtKey()}, '') is null`,
      sql`nullif(${lessonAssignments.answers}->>${homeworkRemovedAtKey()}, '') is null`))
    .returning({ answers: lessonAssignments.answers });
  if (!saved) {
    // A concurrent click may have completed the work already. Never send duplicate notifications.
    const [current] = await db.select({ answers: lessonAssignments.answers }).from(lessonAssignments).where(eq(lessonAssignments.id, row.id)).limit(1);
    const done = current && !homeworkRemovedAt(current.answers) ? homeworkReviewedAt(current.answers) : null;
    return done ? { reviewedAt: done } : { error: "unavailable" };
  }

  for (const path of ["/teacher/homeworks", `/teacher/homeworks/${row.id}`, `/teacher/lessons/given/${row.id}`,
    "/student/homework", `/student/lessons/${row.id}`, "/student", "/teacher/class", "/student/class"]) revalidatePath(path);
  const event = { assignmentId: row.id, statusChanged: true, gradeFeedback: true };
  await Promise.all([publishClassRealtime(row.studentId, "homework-review", event),
    publishUserRealtime(row.studentId, "homework-review", event)]);
  await queueStudentNotification({ teacherId: session.userId, studentId: row.studentId, event: "homeworkReviewed",
    title: assignedHomeworkTitle(saved.answers, row.title), href: `/student/lessons/${row.id}?section=homework` });
  return { reviewedAt };
}
