import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons } from "@/lib/db/schema";
import { scheduleNow } from "@/lib/schedule-time";
import { adjustStudentLessonsInTransaction } from "@/lib/packages";

/** Старую историю могли уже учитывать вручную — повторно её не списываем. */
const AUTOMATIC_COMPLETION_STARTED_AT = new Date("2026-10-01T00:00:00.000Z");

/**
 * Завершает прошедшие занятия и ровно один раз списывает их с баланса.
 * Сначала статус меняется атомарным UPDATE ... RETURNING: параллельный запрос
 * уже не получит те же строки и не сможет списать урок повторно.
 */
export async function completeFinishedLessons(): Promise<number> {
  const now = scheduleNow();
  const due = and(
    eq(lessons.status, "SCHEDULED"),
    gte(lessons.startTime, AUTOMATIC_COMPLETION_STARTED_AT),
    lte(sql`${lessons.startTime} + (${lessons.durationMinutes} * interval '1 minute')`, now),
  );
  // Most page requests have nothing to charge. Avoid a transaction and an
  // UPDATE on every navigation; the atomic update below still prevents races.
  const [pending] = await db.select({ id: lessons.id }).from(lessons).where(due).limit(1);
  if (!pending) return 0;

  return db.transaction(async (tx) => {
    const completed = await tx
      .update(lessons)
      .set({ status: "COMPLETED", chargeResolved: true, updatedAt: new Date() })
      .where(due)
      .returning({ id: lessons.id, studentId: lessons.studentId });

    if (completed.length === 0) return 0;

    for (const row of completed) {
      const charged = await adjustStudentLessonsInTransaction(tx, row.studentId, -1);
      await tx
        .update(lessons)
        .set({ balanceCharged: charged })
        .where(eq(lessons.id, row.id));
    }

    return completed.length;
  });
}
