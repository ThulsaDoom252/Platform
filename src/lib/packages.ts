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
 * Настраивает, с кем ученик делит пакет.
 *
 * Ноль выбранных одноклассников означает личный пакет. При выходе из общего
 * пула его текущие параметры копируются в личный пакет, поэтому баланс, размер
 * и срок действия не теряются. Один ученик может состоять только в одном пуле.
 */
export async function configureSharedLessonPool(
  studentId: string,
  sharedStudentIds: string[],
): Promise<{ packageId: string | null; error?: string }> {
  const requested = [...new Set(sharedStudentIds)]
    .map(String)
    .filter((id) => id && id !== studentId);

  return db.transaction(async (tx) => {
    const students = await tx
      .select({
        id: users.id,
        name: users.name,
        packageId: users.packageId,
        balance: users.lessonBalance,
      })
      .from(users)
      .where(eq(users.role, "STUDENT"));

    const student = students.find((item) => item.id === studentId);
    if (!student) return { packageId: null, error: "Ученик не найден" };

    const byId = new Map(students.map((item) => [item.id, item]));
    if (requested.some((id) => !byId.has(id))) {
      return { packageId: student.packageId, error: "Некорректный состав общего пула" };
    }

    const packages = await tx.select().from(lessonPackages);
    const packageById = new Map(packages.map((item) => [item.id, item]));
    const touchedPackages = new Set<string>();

    const normalizePackage = async (packageId: string) => {
      const members = await tx
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.packageId, packageId));

      if (members.length === 0) {
        await tx.delete(lessonPackages).where(eq(lessonPackages.id, packageId));
        return;
      }

      const name =
        members.length > 1
          ? members
              .map((member) => member.name)
              .sort((a, b) => a.localeCompare(b))
              .join(" + ")
          : null;
      await tx
        .update(lessonPackages)
        .set({ name })
        .where(eq(lessonPackages.id, packageId));
    };

    const detachToPersonalPackage = async (
      member: (typeof students)[number],
      source: (typeof packages)[number],
    ) => {
      const [personal] = await tx
        .insert(lessonPackages)
        .values({
          name: null,
          totalLessons: source.totalLessons,
          remainingLessons: source.remainingLessons,
          expiresAt: source.expiresAt,
        })
        .returning({ id: lessonPackages.id });

      await tx
        .update(users)
        .set({
          packageId: personal.id,
          lessonBalance: source.remainingLessons,
          updatedAt: new Date(),
        })
        .where(eq(users.id, member.id));
      return personal.id;
    };

    let targetPackage = student.packageId
      ? packageById.get(student.packageId) ?? null
      : null;

    // Личный режим: если ученик был в группе, отделяем только его.
    if (requested.length === 0) {
      if (!targetPackage) return { packageId: null };

      const currentMembers = students.filter(
        (member) => member.packageId === targetPackage!.id,
      );
      if (currentMembers.length <= 1) {
        await tx
          .update(lessonPackages)
          .set({ name: null })
          .where(eq(lessonPackages.id, targetPackage.id));
        return { packageId: targetPackage.id };
      }

      const personalId = await detachToPersonalPackage(student, targetPackage);
      await normalizePackage(targetPackage.id);
      return { packageId: personalId };
    }

    // Для ученика без пакета создаём основу будущего общего пула.
    if (!targetPackage) {
      const [created] = await tx
        .insert(lessonPackages)
        .values({
          totalLessons: student.balance,
          remainingLessons: student.balance,
        })
        .returning();
      targetPackage = created;
      await tx
        .update(users)
        .set({ packageId: created.id, updatedAt: new Date() })
        .where(eq(users.id, student.id));
    }

    const desired = new Set([studentId, ...requested]);

    // Убранные из этого пула ученики получают самостоятельные копии пакета.
    for (const member of students) {
      if (member.packageId !== targetPackage.id || desired.has(member.id)) continue;
      await detachToPersonalPackage(member, targetPackage);
    }

    // Выбранные ученики переходят в текущий пул. Их прежний пакет затем
    // нормализуется: остаётся общим, становится личным или удаляется как пустой.
    for (const memberId of requested) {
      const member = byId.get(memberId)!;
      if (member.packageId && member.packageId !== targetPackage.id) {
        touchedPackages.add(member.packageId);
      }
      await tx
        .update(users)
        .set({
          packageId: targetPackage.id,
          lessonBalance: targetPackage.remainingLessons,
          updatedAt: new Date(),
        })
        .where(eq(users.id, memberId));
    }

    for (const packageId of touchedPackages) {
      await normalizePackage(packageId);
    }
    await normalizePackage(targetPackage.id);
    return { packageId: targetPackage.id };
  });
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
