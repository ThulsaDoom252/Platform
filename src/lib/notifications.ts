import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, lessons } from "@/lib/db/schema";
import { fmt, getDictFor, type Dict } from "@/lib/i18n";

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
  cancellationDecision?: "pending" | "charged" | "not_charged";
};

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
    .where(eq(notifications.recipientId, studentId))
    .orderBy(desc(notifications.createdAt))
    .limit(15);

  const events: FeedItem[] = stored.map((n) => ({
    id: n.id,
    kind: storedKind[n.type] ?? "wishlist",
    title: n.message,
    meta: relTime(n.createdAt, realNow, t),
    unread: !n.isRead,
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
    .where(eq(notifications.recipientId, teacherId))
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
      cancellationDecision,
    };
  });

  const items = events;
  const unreadCount = events.filter((e) => e.unread).length;

  return { items, unreadCount };
}
