import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessonPackages, lessons } from "@/lib/db/schema";

/**
 * Списать (-1) или вернуть (+1) урок ученику.
 *
 * Если ученик состоит в общем пакете, меняется пул пакета, а поле
 * lessonBalance каждого участника обновляется как зеркало остатка —
 * поэтому весь остальной интерфейс продолжает читать lessonBalance.
 */
export async function adjustStudentLessons(studentId: string, delta: number) {
  const [student] = await db
    .select({ id: users.id, packageId: users.packageId, balance: users.lessonBalance })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!student) return;

  if (student.packageId) {
    const [pkg] = await db
      .select()
      .from(lessonPackages)
      .where(eq(lessonPackages.id, student.packageId))
      .limit(1);
    if (!pkg) return;

    const next = Math.max(0, pkg.remainingLessons + delta);
    await db
      .update(lessonPackages)
      .set({ remainingLessons: next })
      .where(eq(lessonPackages.id, pkg.id));

    // Зеркалим остаток всем участникам пакета.
    await db
      .update(users)
      .set({ lessonBalance: next, updatedAt: new Date() })
      .where(eq(users.packageId, pkg.id));
    return;
  }

  await db
    .update(users)
    .set({ lessonBalance: Math.max(0, student.balance + delta), updatedAt: new Date() })
    .where(eq(users.id, studentId));
}

/**
 * Поставить остаток уроков ровно в указанное число.
 * Пакет общий, поэтому остаток — это пул: число ставится пакету
 * и зеркалится всем его участникам.
 */
export async function setStudentLessons(studentId: string, remaining: number) {
  const value = Math.max(0, Math.round(remaining));

  const [student] = await db
    .select({ packageId: users.packageId })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!student) return;

  if (student.packageId) {
    await db
      .update(lessonPackages)
      .set({ remainingLessons: value })
      .where(eq(lessonPackages.id, student.packageId));

    await db
      .update(users)
      .set({ lessonBalance: value, updatedAt: new Date() })
      .where(eq(users.packageId, student.packageId));
    return;
  }

  await db
    .update(users)
    .set({ lessonBalance: value, updatedAt: new Date() })
    .where(eq(users.id, studentId));
}

/**
 * Сколько уроков проведено и когда был первый.
 * К посчитанным прибавляются уроки «до платформы», а дата начала
 * берётся из профиля, если учитель задал её вручную.
 */
export async function getStudentStats(studentId: string) {
  const [row] = await db
    .select({
      done: sql<number>`count(*)::int`,
      firstAt: sql<Date | null>`min(${lessons.startTime})`,
    })
    .from(lessons)
    .where(and(eq(lessons.studentId, studentId), eq(lessons.status, "COMPLETED")));

  const [student] = await db
    .select({
      before: users.lessonsBefore,
      startedAt: users.startedAt,
      approximate: users.statsApproximate,
    })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  const onPlatform = row?.done ?? 0;
  const before = student?.before ?? 0;

  return {
    onPlatform,
    before,
    total: onPlatform + before,
    firstLessonAt: row?.firstAt ?? null,
    startedAt: student?.startedAt ?? row?.firstAt ?? null,
    approximate: student?.approximate ?? false,
  };
}

/** Пакет ученика (для показа остатка и срока действия). */
export async function getStudentPackage(studentId: string) {
  const [student] = await db
    .select({ packageId: users.packageId })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!student?.packageId) return null;

  const [pkg] = await db
    .select()
    .from(lessonPackages)
    .where(eq(lessonPackages.id, student.packageId))
    .limit(1);
  return pkg ?? null;
}
