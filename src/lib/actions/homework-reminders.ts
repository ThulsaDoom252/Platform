"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, notifications, users, wordRevisions } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDictFor } from "@/lib/i18n";
import { teacherWordDeckHomeworkAction } from "./word-deck";
import { publishUserRealtime } from "@/lib/realtime-server";
import {
  homeworkReminderHref, homeworkReminderMessage, lessonHomeworkReminderDescription,
  readHomeworkReminderTarget, type HomeworkReminderTarget, type HomeworkReminderDescription,
} from "@/lib/homework-reminders";

/** An explicitly requested reminder is manual, independent of automatic notification policy. */
export async function sendHomeworkReminderAction(target: HomeworkReminderTarget): Promise<{ sent?: boolean; error?: "forbidden" | "unavailable" | "failed" }> {
  const session = await getSession();
  if (session?.role !== "TEACHER") return { error: "forbidden" };
  const reference = readHomeworkReminderTarget(target);
  if (!reference) return { error: "unavailable" };
  target = reference;
  let recipient: { id: string; locale: string } | null = null;
  let description: HomeworkReminderDescription | null = null;
  if (target.kind === "LESSON") {
    const [row] = await db.select({ title: lessonUnits.title, homework: lessonUnits.homework,
      override: lessonAssignments.contentOverride, answers: lessonAssignments.answers,
      studentId: users.id, locale: users.locale })
      .from(lessonAssignments).innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
      .innerJoin(users, eq(users.id, lessonAssignments.studentId))
      .where(and(eq(lessonAssignments.id, target.id), eq(lessonUnits.authorId, session.userId), eq(users.role, "STUDENT"))).limit(1);
    if (!row) return { error: "unavailable" };
    recipient = { id: row.studentId, locale: row.locale };
    description = lessonHomeworkReminderDescription(target, { title: row.title, homework: row.homework, contentOverride: row.override, answers: row.answers }, getDictFor(row.locale));
  } else if (target.kind === "ACTIVITY") {
    // Reuse the game owner check, including safe handling of older assignments.
    const activity = await teacherWordDeckHomeworkAction(target.id);
    if (!activity) return { error: "unavailable" };
    const [student] = await db.select({ id: users.id, locale: users.locale }).from(users)
      .where(and(eq(users.id, activity.studentId), eq(users.role, "STUDENT"))).limit(1);
    recipient = student ?? null;
    description = { ...target, title: activity.title };
  } else {
    const [row] = await db.select({ title: wordRevisions.title, ownerId: wordRevisions.assignedByTeacherId,
      studentId: users.id, locale: users.locale }).from(wordRevisions)
      .innerJoin(users, eq(users.id, wordRevisions.studentId))
      .where(and(eq(wordRevisions.id, target.id), eq(wordRevisions.placement, "HOMEWORK"), eq(users.role, "STUDENT"))).limit(1);
    if (!row || (row.ownerId && row.ownerId !== session.userId)) return { error: "unavailable" };
    if (!row.ownerId) {
      const teachers = await db.select({ id: users.id }).from(users).where(eq(users.role, "TEACHER")).limit(2);
      if (teachers.length !== 1 || teachers[0].id !== session.userId) return { error: "unavailable" };
    }
    recipient = { id: row.studentId, locale: row.locale };
    description = { ...target, title: row.title };
  }
  if (!recipient || !description) return { error: "unavailable" };
  const id = randomUUID();
  const href = homeworkReminderHref(target, id);
  if (!href) return { error: "unavailable" };
  await db.insert(notifications).values({
    id, recipientId: recipient.id, senderId: session.userId, type: "HOMEWORK_SUBMITTED",
    relatedStudentId: recipient.id, href, message: homeworkReminderMessage(getDictFor(recipient.locale), description),
    data: { kind: "HOMEWORK_REMINDER" },
  });
  await publishUserRealtime(recipient.id, "notification");
  return { sent: true };
}
