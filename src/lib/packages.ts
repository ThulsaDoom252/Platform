import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, lessonPackages } from "@/lib/db/schema";

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
