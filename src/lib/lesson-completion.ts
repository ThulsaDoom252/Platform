import "server-only";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonPackages, lessons, users } from "@/lib/db/schema";
import { scheduleNow } from "@/lib/schedule-time";

/** Старую историю могли уже учитывать вручную — повторно её не списываем. */
const AUTOMATIC_COMPLETION_STARTED_AT = new Date("2026-10-01T00:00:00.000Z");

/**
 * Завершает прошедшие занятия и ровно один раз списывает их с баланса.
 * Сначала статус меняется атомарным UPDATE ... RETURNING: параллельный запрос
 * уже не получит те же строки и не сможет списать урок повторно.
 */
export async function completeFinishedLessons(): Promise<number> {
  const now = scheduleNow();

  return db.transaction(async (tx) => {
    const completed = await tx
      .update(lessons)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(
        and(
          eq(lessons.status, "SCHEDULED"),
          gte(lessons.startTime, AUTOMATIC_COMPLETION_STARTED_AT),
          lte(
            sql`${lessons.startTime} + (${lessons.durationMinutes} * interval '1 minute')`,
            now,
          ),
        ),
      )
      .returning({ studentId: lessons.studentId });

    if (completed.length === 0) return 0;

    const counts = new Map<string, number>();
    for (const row of completed) {
      counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1);
    }

    const students = await tx
      .select({ id: users.id, packageId: users.packageId })
      .from(users)
      .where(inArray(users.id, [...counts.keys()]));

    const packageCounts = new Map<string, number>();
    for (const student of students) {
      const count = counts.get(student.id) ?? 0;
      if (student.packageId) {
        packageCounts.set(
          student.packageId,
          (packageCounts.get(student.packageId) ?? 0) + count,
        );
      } else if (count > 0) {
        await tx
          .update(users)
          .set({
            lessonBalance: sql`greatest(0, ${users.lessonBalance} - ${count})`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, student.id));
      }
    }

    for (const [packageId, count] of packageCounts) {
      const [updated] = await tx
        .update(lessonPackages)
        .set({
          remainingLessons: sql`greatest(0, ${lessonPackages.remainingLessons} - ${count})`,
        })
        .where(eq(lessonPackages.id, packageId))
        .returning({ remaining: lessonPackages.remainingLessons });
      if (updated) {
        await tx
          .update(users)
          .set({ lessonBalance: updated.remaining, updatedAt: new Date() })
          .where(eq(users.packageId, packageId));
      }
    }

    return completed.length;
  });
}
