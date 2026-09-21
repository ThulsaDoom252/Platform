import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, lessons, users } from "@/lib/db/schema";
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
};

const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 60 * 1000);

  const soon = await db
    .select({
      id: lessons.id,
      startTime: lessons.startTime,
      topic: lessons.topic,
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.studentId, studentId),
        eq(lessons.status, "SCHEDULED"),
        gte(lessons.startTime, now),
        lte(lessons.startTime, in60),
      ),
    )
    .orderBy(asc(lessons.startTime));

  const stored = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, studentId))
    .orderBy(desc(notifications.createdAt))
    .limit(15);

  const reminders: FeedItem[] = soon.map((l) => {
    const mins = Math.max(1, Math.round((l.startTime.getTime() - now.getTime()) / 60000));
    return {
      id: `rem-${l.id}`,
      kind: "reminder",
      title: fmt(t.notifications.lessonIn, { name: "", mins }).replace("  ", " ").trim(),
      meta: `${timeFmt.format(l.startTime)}${l.topic ? ` · ${l.topic}` : ""}`,
      unread: true,
    };
  });

  const events: FeedItem[] = stored.map((n) => ({
    id: n.id,
    kind: storedKind[n.type] ?? "wishlist",
    title: n.message,
    meta: relTime(n.createdAt, now, t),
    unread: !n.isRead,
  }));

  return {
    items: [...reminders, ...events],
    unreadCount: reminders.length + events.filter((e) => e.unread).length,
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
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 60 * 1000);

  // Уроки, начинающиеся в ближайший час.
  const soon = await db
    .select({
      id: lessons.id,
      startTime: lessons.startTime,
      topic: lessons.topic,
      studentName: users.name,
    })
    .from(lessons)
    .innerJoin(users, eq(lessons.studentId, users.id))
    .where(
      and(
        eq(lessons.status, "SCHEDULED"),
        gte(lessons.startTime, now),
        lte(lessons.startTime, in60),
      ),
    )
    .orderBy(asc(lessons.startTime));

  // Ученики с низким балансом (≤ 3).
  const low = await db
    .select({
      id: users.id,
      name: users.name,
      balance: users.lessonBalance,
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), lte(users.lessonBalance, 3)))
    .orderBy(asc(users.lessonBalance));

  // Сохранённые события.
  const stored = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, teacherId))
    .orderBy(desc(notifications.createdAt))
    .limit(15);

  const reminders: FeedItem[] = soon.map((l) => {
    const mins = Math.max(1, Math.round((l.startTime.getTime() - now.getTime()) / 60000));
    return {
      id: `rem-${l.id}`,
      kind: "reminder",
      title: fmt(t.notifications.lessonIn, { name: l.studentName, mins }),
      meta: `${timeFmt.format(l.startTime)}${l.topic ? ` · ${l.topic}` : ""}`,
      unread: true,
    };
  });

  const balance: FeedItem[] = low.map((s) => ({
    id: `bal-${s.id}`,
    kind: "balance",
    title: fmt(t.notifications.lowBalance, { name: s.name, n: s.balance }),
    meta: t.notifications.lowBalanceHint,
    unread: true,
  }));

  const events: FeedItem[] = stored.map((n) => ({
    id: n.id,
    kind: storedKind[n.type] ?? "wishlist",
    title: n.message,
    meta: relTime(n.createdAt, now, t),
    unread: !n.isRead,
  }));

  const items = [...reminders, ...balance, ...events];
  const unreadCount =
    reminders.length + balance.length + events.filter((e) => e.unread).length;

  return { items, unreadCount };
}
