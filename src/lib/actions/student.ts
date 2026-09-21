"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessons, homework, wishlistNotes, contactChangeRequests, notifications } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

async function requireStudent() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    throw new Error("Только ученик может выполнить это действие");
  }
  return session;
}

async function getTeacherId() {
  const [teacher] = await db.select().from(users).where(eq(users.role, "TEACHER")).limit(1);
  return teacher?.id ?? null;
}

// Отмена доступна только 8:00-21:00. Если до урока меньше 4 часов - урок сгорает.
const CANCEL_WINDOW_START_HOUR = 8;
const CANCEL_WINDOW_END_HOUR = 21;
const BURN_THRESHOLD_HOURS = 4;

export async function cancelLessonAction(formData: FormData) {
  const session = await requireStudent();
  const lessonId = String(formData.get("lessonId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!lessonId || !reason) return;

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.studentId !== session.userId || lesson.status !== "SCHEDULED") return;

  const now = new Date();
  const nowHour = now.getHours();
  if (nowHour < CANCEL_WINDOW_START_HOUR || nowHour >= CANCEL_WINDOW_END_HOUR) {
    // Вне окна отмены - действие недоступно (на бэкенде тоже блокируем, не только в UI).
    return;
  }

  const diffHours = (lesson.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const nextStatus = diffHours < BURN_THRESHOLD_HOURS ? "BURNED" : "CANCELLED_BY_STUDENT";

  await db
    .update(lessons)
    .set({
      status: nextStatus,
      cancelReason: reason,
      cancelledAt: now,
      updatedAt: now,
    })
    .where(eq(lessons.id, lessonId));

  const teacherId = await getTeacherId();
  if (teacherId) {
    await db.insert(notifications).values({
      recipientId: teacherId,
      type: "LESSON_CANCELLED",
      relatedStudentId: session.userId,
      message:
        nextStatus === "BURNED"
          ? `${session.name} отменил(а) урок менее чем за 4 часа — урок сгорел. Причина: ${reason}`
          : `${session.name} отменил(а) урок. Причина: ${reason}`,
    });
  }

  revalidatePath("/student");
}

export async function submitHomeworkAction(formData: FormData) {
  const session = await requireStudent();
  const homeworkId = String(formData.get("homeworkId") || "");
  if (!homeworkId) return;

  const [hw] = await db
    .update(homework)
    .set({ status: "SUBMITTED", updatedAt: new Date() })
    .where(eq(homework.id, homeworkId))
    .returning();

  const teacherId = await getTeacherId();
  if (teacherId && hw) {
    await db.insert(notifications).values({
      recipientId: teacherId,
      type: "HOMEWORK_SUBMITTED",
      relatedStudentId: session.userId,
      message: `${session.name} сдал(а) домашнее задание: «${hw.title}»`,
    });
  }

  revalidatePath("/student");
  revalidatePath("/teacher");
}

export async function addWishlistNoteAction(formData: FormData) {
  const session = await requireStudent();
  const body = String(formData.get("body") || "").trim();
  if (!body) return;

  await db.insert(wishlistNotes).values({ studentId: session.userId, body });

  const teacherId = await getTeacherId();
  if (teacherId) {
    await db.insert(notifications).values({
      recipientId: teacherId,
      type: "WISHLIST_NOTE",
      relatedStudentId: session.userId,
      message: `${session.name} оставил(а) пожелание: ${body}`,
    });
  }

  revalidatePath("/student");
}

export async function requestContactChangeAction(formData: FormData) {
  const session = await requireStudent();
  const field = String(formData.get("field") || "").trim();
  const newValue = String(formData.get("newValue") || "").trim();
  if (!field || !newValue) return;

  const [student] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const oldValue = field === "phone" ? student?.phone : student?.contactNote;

  await db.insert(contactChangeRequests).values({
    studentId: session.userId,
    field,
    oldValue: oldValue ?? null,
    newValue,
  });

  const teacherId = await getTeacherId();
  if (teacherId) {
    await db.insert(notifications).values({
      recipientId: teacherId,
      type: "CONTACT_CHANGE_REQUEST",
      relatedStudentId: session.userId,
      message: `${session.name} просит изменить «${field}» на «${newValue}» — нужно подтверждение`,
    });
  }

  revalidatePath("/student");
}

export async function updateThemeAction(formData: FormData) {
  const session = await requireStudent();
  const theme = String(formData.get("theme") || "LIGHT") as "LIGHT" | "DARK";

  await db.update(users).set({ theme }).where(eq(users.id, session.userId));
  revalidatePath("/student");
}
