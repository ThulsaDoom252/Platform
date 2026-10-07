import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, lessons, users } from "@/lib/db/schema";
import { fmt, getDictFor, type Dict } from "@/lib/i18n";
import { publishUserRealtime } from "@/lib/realtime-server";

export type FeedKind =
  | "reminder"
  | "cancelled"
  | "homework"
  | "wishlist"
  | "contact"
  | "balance";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  title: string;
  meta: string;
  unread: boolean;
  href?: string | null;
  confirmation?: {
    studentId: string;
    message: string;
    href: string;
  };
  cancellationDecision?: "pending" | "charged" | "not_charged";
};

export type NotificationPolicy = "ALWAYS" | "NEVER" | "CONFIRM";
export type StudentNotificationEvent =
  | "homeworkAssigned"
  | "homeworkUpdated"
  | "activityAssigned"
  | "lessonAssigned"
  | "homeworkReviewed"
  | "homeworkRevisionRequested"
  | "revisionAssigned"
  | "materialAdded"
  | "materialUpdated";

export function notificationPolicy(value: unknown): NotificationPolicy {
  return value === "ALWAYS" || value === "NEVER" ? value : "CONFIRM";
}

function eventMessage(t: Dict, event: StudentNotificationEvent, title: string) {
  return fmt(t.notifications[event], { title });
}

/**
 * One notification gateway for all teacher-to-student changes.
 * CONFIRM creates an actionable request for the teacher; ALWAYS sends now.
 */
export async function queueStudentNotification(input: {
  teacherId: string;
  studentId: string;
  event: StudentNotificationEvent;
  title: string;
  href: string;
}) {
  const [[teacher], [student]] = await Promise.all([
    db.select({ policy: users.notificationPolicy, locale: users.locale })
      .from(users).where(eq(users.id, input.teacherId)).limit(1),
    db.select({ name: users.name, locale: users.locale })
      .from(users).where(eq(users.id, input.studentId)).limit(1),
  ]);
  if (!teacher || !student) return;
  const policy = notificationPolicy(teacher.policy);
  if (policy === "NEVER") return;

  const message = eventMessage(getDictFor(student.locale), input.event, input.title);
  if (policy === "ALWAYS") {
    await db.insert(notifications).values({
      recipientId: input.studentId,
      senderId: input.teacherId,
      type: "HOMEWORK_SUBMITTED",
      relatedStudentId: input.studentId,
      message,
      href: input.href,
    });
    await publishUserRealtime(input.studentId, "notification");
    return;
  }

  const teacherT = getDictFor(teacher.locale);
  await db.insert(notifications).values({
    recipientId: input.teacherId,
    senderId: input.teacherId,
    type: "WISHLIST_NOTE",
    relatedStudentId: input.studentId,
    message: fmt(teacherT.notifications.sendPrompt, { name: student.name }),
    data: {
      kind: "SEND_CONFIRMATION",
      studentId: input.studentId,
      message,
      href: input.href,
    },
  });
  await publishUserRealtime(input.teacherId, "notification");
}

const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function relTime(date: Date, now: Date, t: Dict) {
  const diffMin = Math.round((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return t.notifications.justNow;
  if (diffMin < 60) return fmt(t.notifications.minsAgo, { n: diffMin });
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return fmt(t.notifications.hoursAgo, { n: diffH });
  return dayFmt.format(date);
}

const storedKind: Record<string, FeedKind> = {
  LESSON_CANCELLED: "cancelled",
  LESSON_RESCHEDULED: "reminder",
  HOMEWORK_SUBMITTED: "homework",
  WISHLIST_NOTE: "wishlist",
  CONTACT_CHANGE_REQUEST: "contact",
};

function fallbackHref(type: string, recipientRole: "TEACHER" | "STUDENT", studentId: string | null) {
  if (recipientRole === "STUDENT") {
    return type === "WISHLIST_NOTE" ? "/student/materials" : "/student/homework";
  }
  if (type === "LESSON_CANCELLED" || type === "LESSON_RESCHEDULED") return "/teacher/schedule";
  if (type === "HOMEWORK_SUBMITTED") return "/teacher/homeworks";
  return studentId ? `/teacher/students/${studentId}` : "/teacher";
}

function confirmationOf(data: typeof notifications.$inferSelect.data): FeedItem["confirmation"] {
  if (
    data?.kind !== "SEND_CONFIRMATION" ||
    !data.studentId ||
    !data.message ||
    !data.href
  ) return undefined;
  return {
    studentId: data.studentId,
    message: data.message,
    href: data.href,
  };
}

/** Лента ученика: его события + напоминание о ближайшем уроке. */
export async function getStudentFeed(
  studentId: string,
  locale?: string,
): Promise<{ items: FeedItem[]; unreadCount: number }> {
  const t = getDictFor(locale);
  const realNow = new Date();
  const stored = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientId, studentId), eq(notifications.isRead, false)))
    .orderBy(desc(notifications.createdAt))
    .limit(15);

  const events: FeedItem[] = stored.map((n) => ({
    id: n.id,
    kind: storedKind[n.type] ?? "wishlist",
    title: n.message,
    meta: relTime(n.createdAt, realNow, t),
    unread: !n.isRead,
    href: n.href ?? fallbackHref(n.type, "STUDENT", n.relatedStudentId),
    confirmation: confirmationOf(n.data),
  }));

  return {
    items: events,
    unreadCount: events.filter((e) => e.unread).length,
  };
}

export async function getTeacherFeed(
  teacherId: string,
  locale?: string,
): Promise<{
  items: FeedItem[];
  unreadCount: number;
}> {
  const t = getDictFor(locale);
  const realNow = new Date();
  // Сохранённые события.
  const stored = await db
    .select({
      notification: notifications,
      lessonStatus: lessons.status,
      balanceCharged: lessons.balanceCharged,
      chargeResolved: lessons.chargeResolved,
    })
    .from(notifications)
    .leftJoin(lessons, eq(lessons.id, notifications.relatedLessonId))
    .where(and(eq(notifications.recipientId, teacherId), eq(notifications.isRead, false)))
    .orderBy(
      sql`case when ${notifications.type} = 'LESSON_CANCELLED'
        and ${lessons.status} in ('CANCELLED_BY_STUDENT', 'BURNED')
        and ${lessons.chargeResolved} = false then 0 else 1 end`,
      desc(notifications.createdAt),
    )
    .limit(30);

  const events: FeedItem[] = stored.map((row) => {
    const n = row.notification;
    const isCancellation =
      n.type === "LESSON_CANCELLED" &&
      (row.lessonStatus === "CANCELLED_BY_STUDENT" || row.lessonStatus === "BURNED");
    const cancellationDecision = !isCancellation
      ? undefined
      : !row.chargeResolved
        ? "pending" as const
        : row.balanceCharged
          ? "charged" as const
          : "not_charged" as const;
    return {
      id: n.id,
      kind: storedKind[n.type] ?? "wishlist",
      title: n.message,
      meta: relTime(n.createdAt, realNow, t),
      unread: cancellationDecision === "pending" || !n.isRead,
      href: n.href ?? fallbackHref(n.type, "TEACHER", n.relatedStudentId),
      confirmation: confirmationOf(n.data),
      cancellationDecision,
    };
  });

  const items = events;
  const unreadCount = events.filter((e) => e.unread).length;

  return { items, unreadCount };
}
