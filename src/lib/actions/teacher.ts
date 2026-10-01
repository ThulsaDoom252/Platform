"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, gte, inArray, lt, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users,
  lessons,
  homework,
  notifications,
  lessonPackages,
  lessonScripts,
  archivedLessonScripts,
  wordDeckActivities,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  decryptStudentPassword,
  encryptStudentPassword,
} from "@/lib/password-vault";
import {
  adjustStudentLessons,
  adjustStudentLessonsInTransaction,
  configureSharedLessonPool,
  setStudentLessons,
} from "@/lib/packages";
import {
  SCHEDULE_FORMAT_TIME_ZONE,
  parseScheduleInput,
  scheduleStartOfWeek,
} from "@/lib/schedule-time";

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    throw new Error("Только учитель может выполнить это действие");
  }
  return session;
}

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Завести ученика. Кроме имени и входа всё необязательно:
 * баланс, израсходованное из пакета, дата первого занятия и сколько
 * уроков уже прошло до платформы.
 */
export async function createStudentAction(formData: FormData) {
  await requireTeacher();
  const name = String(formData.get("name") || "").trim();
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");

  if (!name || !login || !password) return;

  const num = (key: string) =>
    Math.min(100_000, Math.max(0, Math.round(Number(formData.get(key)) || 0)));

  const balance = num("balance");
  const used = num("used");
  const lessonsBefore = num("lessonsBefore");

  const startedRaw = String(formData.get("startedAt") || "");
  const started = startedRaw ? new Date(startedRaw) : null;
  const startedAt =
    started &&
    !Number.isNaN(started.getTime()) &&
    started.getFullYear() >= 1900 &&
    started.getFullYear() <= 2100
      ? started
      : null;

  const studentId = randomUUID();
  const passwordVault = encryptStudentPassword(password, studentId);

  // Пакет заводим, только если есть о чём говорить: остаток или расход.
  let packageId: string | null = null;
  if (balance > 0 || used > 0) {
    const [pkg] = await db
      .insert(lessonPackages)
      .values({ totalLessons: balance + used, remainingLessons: balance })
      .returning({ id: lessonPackages.id });
    packageId = pkg.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    id: studentId,
    name,
    login,
    passwordHash,
    passwordVault,
    role: "STUDENT",
    lessonBalance: balance,
    packageId,
    lessonsBefore,
    startedAt,
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  redirect("/teacher/students");
}

export type StudentPasswordState = {
  ok?: boolean;
  password?: string;
  unavailable?: boolean;
  error?: string;
};

export async function revealStudentPasswordAction(
  studentId: string,
): Promise<StudentPasswordState> {
  await requireTeacher();
  if (!userIdPattern.test(studentId)) return { error: "Ученик не выбран" };

  const [student] = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
      passwordVault: users.passwordVault,
    })
    .from(users)
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .limit(1);

  if (!student) return { error: "Ученик не найден" };

  if (student.passwordVault) {
    const password = decryptStudentPassword(student.passwordVault, student.id);
    if (password) return { password };
  }

  // Старые аккаунты не имели сейфа. Если стандартный пароль из .env
  // всё ещё действительно подходит к хешу, это и есть текущий пароль:
  // безопасно переносим его в новый формат при первом просмотре.
  const legacyDefault = process.env.STUDENT_DEFAULT_PASSWORD;
  if (legacyDefault && await bcrypt.compare(legacyDefault, student.passwordHash)) {
    const passwordVault = encryptStudentPassword(legacyDefault, student.id);
    await db
      .update(users)
      .set({ passwordVault, updatedAt: new Date() })
      .where(and(eq(users.id, student.id), eq(users.role, "STUDENT")));
    return { password: legacyDefault };
  }

  return { unavailable: true };
}

export async function updateStudentPasswordAction(
  _previous: StudentPasswordState,
  formData: FormData,
): Promise<StudentPasswordState> {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const newPassword = String(formData.get("newPassword") || "").trim();
  if (!userIdPattern.test(studentId)) return { error: "Ученик не выбран" };
  if (!newPassword || newPassword.length > 128) {
    return { error: "Пароль должен содержать от 1 до 128 символов" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      passwordVault: encryptStudentPassword(newPassword, studentId),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .returning({ id: users.id, passwordHash: users.passwordHash });

  if (!updated) return { error: "Ученик не найден" };
  if (!(await bcrypt.compare(newPassword, updated.passwordHash))) {
    return { error: "Пароль не удалось проверить после сохранения" };
  }

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/login");
  return { ok: true, password: newPassword };
}

export async function setStudentAccessBlockedAction(
  studentId: string,
  blocked: boolean,
): Promise<{ ok?: boolean; blocked?: boolean; error?: string }> {
  await requireTeacher();
  if (!userIdPattern.test(studentId)) return { error: "Ученик не выбран" };

  const [updated] = await db
    .update(users)
    .set({ accessBlocked: !!blocked, updatedAt: new Date() })
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .returning({ id: users.id });
  if (!updated) return { error: "Ученик не найден" };

  revalidatePath(`/teacher/students/${studentId}`);
  return { ok: true, blocked: !!blocked };
}

export async function adjustBalanceAction(formData: FormData) {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const delta = Number(formData.get("delta") || 0);
  if (!studentId || !delta) return;

  await adjustStudentLessons(studentId, delta);

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher");
}

export type BalanceSettings = {
  /** Остаток уроков — ставится ровно, без прибавления. */
  remaining: number;
  /** Размер пакета, который ученик сейчас тратит. */
  packageTotal: number;
  /** До какого числа действителен пакет. Пусто — без срока. */
  expiresAt: string | null;
  /** Уроки, проведённые до платформы. */
  lessonsBefore: number;
  /** Начало занятий. Пусто — берётся дата первого урока. */
  startedAt: string | null;
  statsApproximate: boolean;
  showBalance: boolean;
  showPackageSize: boolean;
  showTotalLessons: boolean;
  showExpiry: boolean;
  /** Может ли ученик выгружать материалы в текст и docx. */
  allowExport: boolean;
  /** Остальные ученики, которые делят с этим учеником один пул. */
  sharedStudentIds: string[];
};

/** Баланс, пакет, история занятий и видимость — одним сохранением. */
export async function saveBalanceSettingsAction(
  studentId: string,
  s: BalanceSettings,
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeacher();
  if (!studentId) return { error: "Не выбран ученик" };

  const remainingRaw: unknown = s?.remaining;
  if (remainingRaw === null || remainingRaw === undefined || remainingRaw === "") {
    return { error: "Укажите количество оставшихся уроков" };
  }
  const remaining = Number(remainingRaw);
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > 100_000) {
    return { error: "Остаток уроков должен быть целым числом от 0 до 100000" };
  }

  const num = (v: unknown, max = 100_000) =>
    Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  const date = (v: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    // Недобранный год (поле отдаёт «0002-…», пока набираешь) — не дата.
    return d.getFullYear() >= 1900 && d.getFullYear() <= 2100 ? d : null;
  };

  const sharedStudentIds = Array.isArray(s.sharedStudentIds)
    ? s.sharedStudentIds.map(String)
    : [];
  const pool = await configureSharedLessonPool(studentId, sharedStudentIds);
  if (pool.error) return { error: pool.error };

  // Сначала формируем окончательный состав, затем меняем остаток только у него.
  await setStudentLessons(studentId, remaining);

  const [student] = await db
    .select({ packageId: users.packageId })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  if (student?.packageId) {
    await db
      .update(lessonPackages)
      .set({ totalLessons: num(s.packageTotal), expiresAt: date(s.expiresAt) })
      .where(eq(lessonPackages.id, student.packageId));
  }

  await db
    .update(users)
    .set({
      // Поправка к посчитанным урокам: учитель правит видимую сумму,
      // поэтому она бывает и отрицательной.
      lessonsBefore: Math.max(-100_000, Math.min(100_000, Math.round(Number(s.lessonsBefore) || 0))),
      startedAt: date(s.startedAt),
      statsApproximate: !!s.statsApproximate,
      showBalance: !!s.showBalance,
      showPackageSize: !!s.showPackageSize,
      showTotalLessons: !!s.showTotalLessons,
      showExpiry: !!s.showExpiry,
      allowExport: !!s.allowExport,
      updatedAt: new Date(),
    })
    .where(eq(users.id, studentId));

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher/students");
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

export async function createLessonAction(formData: FormData) {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const startTime = String(formData.get("startTime") || "");
  const comment = String(formData.get("comment") || "").trim();
  const commentVisible = formData.get("commentVisible") === "on";
  if (!studentId || !startTime) return;

  const parsedStart = parseScheduleInput(startTime);
  if (!parsedStart) return;

  await db.insert(lessons).values({
    studentId,
    startTime: parsedStart,
    teacherComment: comment || null,
    teacherCommentVisible: commentVisible,
    status: "SCHEDULED",
  });

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher");
}

export async function updateLessonStatusAction(formData: FormData) {
  await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const status = String(formData.get("status") || "") as
    | "COMPLETED"
    | "BURNED"
    | "CANCELLED_BY_STUDENT"
    | "SCHEDULED";
  if (!lessonId || !status) return;

  const studentId = await db.transaction(async (tx) => {
    const shouldCharge = status === "COMPLETED" || status === "BURNED";
    const [claimed] = await tx
      .update(lessons)
      .set({
        status,
        chargeResolved: shouldCharge,
        updatedAt: new Date(),
      })
      .where(and(eq(lessons.id, lessonId), ne(lessons.status, status)))
      .returning({
        studentId: lessons.studentId,
        balanceCharged: lessons.balanceCharged,
      });
    if (!claimed) return null;

    let balanceCharged = claimed.balanceCharged;
    if (shouldCharge && !balanceCharged) {
      balanceCharged = await adjustStudentLessonsInTransaction(
        tx,
        claimed.studentId,
        -1,
      );
    } else if (!shouldCharge && balanceCharged) {
      await adjustStudentLessonsInTransaction(tx, claimed.studentId, 1);
      balanceCharged = false;
    }

    await tx
      .update(lessons)
      .set({
        balanceCharged,
      })
      .where(eq(lessons.id, lessonId));
    return claimed.studentId;
  });

  if (studentId) revalidateSchedule(studentId);
}

export async function createHomeworkAction(formData: FormData) {
  const session = await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const requestedActivityId = String(formData.get("activityId") || "");
  if (!studentId || !title) return;

  const [ownedActivity] = requestedActivityId
    ? await db
        .select({ id: wordDeckActivities.id })
        .from(wordDeckActivities)
        .where(
          and(
            eq(wordDeckActivities.id, requestedActivityId),
            eq(wordDeckActivities.authorId, session.userId),
          ),
        )
        .limit(1)
    : [];

  await db.insert(homework).values({
    studentId,
    title,
      description: description || null,
      activityId: ownedActivity?.id ?? null,
    status: "NOT_DONE",
  });

  revalidatePath(`/teacher/students/${studentId}`);
}

export async function updateHomeworkStatusAction(formData: FormData) {
  await requireTeacher();
  const homeworkId = String(formData.get("homeworkId") || "");
  const studentId = String(formData.get("studentId") || "");
  const status = String(formData.get("status") || "") as
    | "REVIEWED"
    | "NEEDS_REVISION";
  const feedback = String(formData.get("feedback") || "").trim();
  if (!homeworkId || !status) return;

  await db
    .update(homework)
    .set({
      status,
      teacherFeedback: feedback || null,
      updatedAt: new Date(),
    })
    .where(eq(homework.id, homeworkId));

  revalidatePath(`/teacher/students/${studentId}`);
}

// ---------- Расписание: редактирование и назначение уроков ----------

const dtFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});
const dFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});

/** Понедельник недели, в которую попадает дата. */
function weekStartOf(d: Date) {
  return scheduleStartOfWeek(d);
}

function revalidateSchedule(studentId?: string) {
  revalidatePath("/teacher/schedule");
  revalidatePath("/teacher");
  revalidatePath("/teacher/script");
  revalidatePath("/student");
  revalidatePath("/student/schedule");
  revalidatePath("/student/class");
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
}

/** Отмена урока учителем (до проведения). Комментарий увидит ученик. */
export async function cancelLessonByTeacherAction(formData: FormData) {
  const session = await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const comment = String(formData.get("comment") || "").trim();
  const chargeLesson = formData.get("chargeLesson") === "on";
  if (!lessonId || !comment) return;

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return;

  if (lesson.status !== "SCHEDULED") return;

  const now = new Date();
  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(lessons)
      .set({
        status: "CANCELLED_BY_TEACHER",
        cancelReason: comment,
        cancelledAt: now,
        balanceCharged: false,
        chargeResolved: true,
        teacherComment: comment,
        teacherCommentVisible: true,
        updatedAt: now,
      })
      .where(and(eq(lessons.id, lessonId), eq(lessons.status, "SCHEDULED")))
      .returning({ id: lessons.id });
    if (!claimed) return;

    const applied = chargeLesson
      ? await adjustStudentLessonsInTransaction(tx, lesson.studentId, -1)
      : false;
    if (applied) {
      await tx
        .update(lessons)
        .set({ balanceCharged: true })
        .where(eq(lessons.id, lessonId));
    }

    await tx.insert(notifications).values({
      recipientId: lesson.studentId,
      type: "LESSON_CANCELLED",
      relatedStudentId: lesson.studentId,
      relatedLessonId: lessonId,
      message: `${session.name} отменил урок ${dtFmt.format(lesson.startTime)}. Причина: ${comment}. ${applied ? "Урок списан с баланса." : "Урок не списан с баланса."}`,
    });
  });

  revalidateSchedule(lesson.studentId);
}

/** Решение учителя по отмене ученика прямо из уведомления. */
export async function setCancellationChargeAction(formData: FormData) {
  const session = await requireTeacher();
  const notificationId = String(formData.get("notificationId") || "");
  const shouldCharge = formData.get("charge") === "yes";
  if (!notificationId) return;

  const studentId = await db.transaction(async (tx) => {
    const [entry] = await tx
      .select({
        lessonId: lessons.id,
        studentId: lessons.studentId,
        status: lessons.status,
        resolved: lessons.chargeResolved,
      })
      .from(notifications)
      .innerJoin(lessons, eq(lessons.id, notifications.relatedLessonId))
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, session.userId),
          eq(notifications.type, "LESSON_CANCELLED"),
        ),
      )
      .limit(1);
    if (
      !entry ||
      entry.resolved ||
      (entry.status !== "CANCELLED_BY_STUDENT" && entry.status !== "BURNED")
    ) {
      return null;
    }

    const [claimed] = await tx
      .update(lessons)
      .set({
        chargeResolved: true,
        updatedAt: new Date(),
      })
      .where(and(eq(lessons.id, entry.lessonId), eq(lessons.chargeResolved, false)))
      .returning({ id: lessons.id });
    if (!claimed) return null;

    const charged = shouldCharge
      ? await adjustStudentLessonsInTransaction(tx, entry.studentId, -1)
      : false;
    await tx
      .update(lessons)
      .set({ balanceCharged: charged })
      .where(eq(lessons.id, entry.lessonId));
    await tx
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
    return entry.studentId;
  });

  revalidatePath("/teacher", "layout");
  if (studentId) revalidateSchedule(studentId);
}

/** Удаление урока (обычно уже проведённого). Списанный урок возвращается на баланс. */
export async function deleteLessonAction(formData: FormData) {
  const session = await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const comment = String(formData.get("comment") || "").trim();
  const deleteScript = formData.get("deleteScript") === "on";
  if (!lessonId) return;

  const [lesson] = await db
    .select({
      lesson: lessons,
      studentName: users.name,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.studentId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return;

  await db.transaction(async (tx) => {
    const deletedAt = new Date();
    // Удалённый урок никогда не считается списанным: если списание было,
    // возвращаем его до удаления той записи, которая это подтверждает.
    if (lesson.lesson.balanceCharged) {
      const [claimed] = await tx
        .update(lessons)
        .set({ balanceCharged: false })
        .where(and(eq(lessons.id, lessonId), eq(lessons.balanceCharged, true)))
        .returning({ id: lessons.id });
      if (claimed) {
        await adjustStudentLessonsInTransaction(
          tx,
          lesson.lesson.studentId,
          1,
        );
      }
    }

    await tx.insert(notifications).values({
      recipientId: lesson.lesson.studentId,
      type: "LESSON_CANCELLED",
      relatedStudentId: lesson.lesson.studentId,
      relatedLessonId: lessonId,
      message: `${session.name} удалил урок ${dtFmt.format(lesson.lesson.startTime)}${comment ? `. Комментарий: ${comment}` : ""}. Урок не списан с баланса.`,
    });

    const [script] = await tx
      .select()
      .from(lessonScripts)
      .where(eq(lessonScripts.lessonId, lessonId))
      .limit(1);

    if (script && !deleteScript) {
      await tx
        .insert(archivedLessonScripts)
        .values({
          originalLessonId: lessonId,
          studentId: lesson.lesson.studentId,
          studentName: lesson.studentName,
          startTime: lesson.lesson.startTime,
          durationMinutes: lesson.lesson.durationMinutes,
          html: script.html,
          style: script.style,
          cancelReason: lesson.lesson.cancelReason,
          deletedAt,
          createdAt: script.createdAt,
          updatedAt: deletedAt,
        })
        .onConflictDoUpdate({
          target: archivedLessonScripts.originalLessonId,
          set: {
            html: script.html,
            style: script.style,
            cancelReason: lesson.lesson.cancelReason,
            deletedAt,
            updatedAt: deletedAt,
          },
        });
    }

    await tx.delete(lessons).where(eq(lessons.id, lessonId));
  });

  revalidatePath("/teacher/script");
  revalidateSchedule(lesson.lesson.studentId);
}

/** Перенос урока на новую дату и время. */
export type RescheduleState = {
  ok?: boolean;
  error?: string;
  startTime?: string;
};

export async function rescheduleLessonAction(
  _previous: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  const session = await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const newStart = String(formData.get("newStartTime") || "");
  const comment = String(formData.get("comment") || "").trim();
  if (!lessonId || !newStart) return { error: "Выбери новую дату и время" };

  const start = parseScheduleInput(newStart);
  if (!start) return { error: "Некорректные дата или время" };

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return { error: "Урок не найден" };

  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  const conflicts = await db
    .select({
      studentName: users.name,
      startTime: lessons.startTime,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.studentId))
    .where(
      and(
        ne(lessons.id, lessonId),
        inArray(lessons.status, ["SCHEDULED", "COMPLETED"]),
        lt(lessons.startTime, end),
        gt(
          sql`${lessons.startTime} + (${lessons.durationMinutes} * interval '1 minute')`,
          start,
        ),
      ),
    )
    .orderBy(lessons.startTime);
  if (conflicts.length > 0) {
    const occupied = conflicts
      .map((item) => `${item.studentName} (${dtFmt.format(item.startTime)})`)
      .join(", ");
    return {
      error: `Это время уже занято: ${occupied}. Выбери другой слот.`,
    };
  }

  const [updated] = await db.transaction(async (tx) => {
    if (lesson.balanceCharged) {
      const [claimed] = await tx
        .update(lessons)
        .set({ balanceCharged: false })
        .where(and(eq(lessons.id, lessonId), eq(lessons.balanceCharged, true)))
        .returning({ id: lessons.id });
      if (claimed) {
        await adjustStudentLessonsInTransaction(tx, lesson.studentId, 1);
      }
    }
    const rows = await tx
      .update(lessons)
      .set({
        startTime: start,
        status: "SCHEDULED",
        balanceCharged: false,
        chargeResolved: false,
        cancelReason: null,
        cancelledAt: null,
        teacherComment: comment || null,
        teacherCommentVisible: true,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, lessonId))
      .returning({ startTime: lessons.startTime });

    if (rows[0]) {
      await tx.insert(notifications).values({
        recipientId: lesson.studentId,
        type: "LESSON_RESCHEDULED",
        relatedStudentId: lesson.studentId,
        relatedLessonId: lessonId,
        message: `${session.name} перенёс урок с ${dtFmt.format(lesson.startTime)} на ${dtFmt.format(rows[0].startTime)}${comment ? `. Комментарий: ${comment}` : ""}`,
      });
    }
    return rows;
  });
  if (!updated) return { error: "Не удалось перенести урок" };

  revalidateSchedule(lesson.studentId);
  return { ok: true, startTime: updated.startTime.toISOString() };
}

export type AssignState = { ok?: boolean; message?: string; error?: string };

/**
 * Назначение урока на слот. При «повторять еженедельно» уроки проставляются
 * по балансу ученика: недель = баланс / (уроков в неделю, включая новый).
 */
export async function assignLessonAction(
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const startRaw = String(formData.get("startTime") || "");
  const topic = String(formData.get("topic") || "").trim();
  const comment = String(formData.get("comment") || "").trim();
  const recurring = formData.get("recurring") === "on";

  if (!studentId) return { error: "Выбери ученика" };
  if (!startRaw) return { error: "Не указано время урока" };

  const start = parseScheduleInput(startRaw);
  if (!start) return { error: "Некорректная дата" };

  const [student] = await db
    .select()
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!student) return { error: "Ученик не найден" };

  const base = {
    studentId,
    topic: topic || null,
    teacherComment: comment || null,
    teacherCommentVisible: Boolean(comment),
    status: "SCHEDULED" as const,
  };

  if (!recurring) {
    await db.insert(lessons).values({ ...base, startTime: start });
    revalidateSchedule(studentId);
    return { ok: true, message: `Урок назначен на ${dtFmt.format(start)}` };
  }

  if (student.lessonBalance <= 0) {
    return { error: "У ученика нулевой баланс — сначала пополни уроки" };
  }

  // Сколько уроков у ученика уже стоит на этой неделе (+ новый).
  const ws = weekStartOf(start);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 7);
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(lessons)
    .where(
      and(
        eq(lessons.studentId, studentId),
        eq(lessons.status, "SCHEDULED"),
        gte(lessons.startTime, ws),
        lt(lessons.startTime, we),
      ),
    );
  const perWeek = (row?.c ?? 0) + 1;
  const weeks = Math.min(26, Math.max(1, Math.floor(student.lessonBalance / perWeek)));

  const values = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i * 7);
    return { ...base, startTime: d };
  });
  await db.insert(lessons).values(values);

  const last = values[values.length - 1].startTime;
  revalidateSchedule(studentId);
  return {
    ok: true,
    message: `Уроки проставлены до ${dFmt.format(last)} — ${weeks} шт., по ${perWeek} в неделю`,
  };
}

export async function markNotificationsReadAction() {
  const session = await requireTeacher();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientId, session.userId));
  revalidatePath("/teacher");
}

/* Текста подписи здесь нет: язык знает только страница. */
export type StudentNotesState = { ok?: boolean; error?: string };

/**
 * Контакты и анкета ученика общие для обеих сторон: ученик правит их в
 * своём профиле, а учитель — в карточке ученика.
 */
export async function saveStudentProfileFieldsAction(
  _prev: StudentNotesState,
  formData: FormData,
): Promise<StudentNotesState> {
  await requireTeacher();

  const studentId = String(formData.get("studentId") || "");
  if (!userIdPattern.test(studentId)) return { error: "Не выбран ученик" };

  const field = (key: string, max: number) =>
    String(formData.get(key) || "").trim().slice(0, max) || null;

  // Эти четыре поля ученик сохраняет без дополнительного урезания —
  // учительская форма должна вести себя так же, чтобы не потерять данные.
  const sharedField = (key: string) =>
    String(formData.get(key) || "").trim() || null;

  const updated = await db
    .update(users)
    .set({
      email: sharedField("email"),
      phone: sharedField("phone"),
      telegram: sharedField("telegram"),
      viber: field("viber", 60),
      contactNote: sharedField("contactNote"),
      hobby: field("hobby", 300),
      homeland: field("homeland", 120),
      country: field("country", 120),
      city: field("city", 120),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .returning({ id: users.id });

  if (updated.length === 0) return { error: "Ученик не найден" };

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/student/profile");
  revalidatePath("/student/class");
  return { ok: true };
}

/**
 * Заметки учителя об ученике и доступ к прошедшим урокам.
 *
 * Всё это видит только учитель, поэтому и правится только отсюда —
 * в профиле ученика таких полей нет.
 */
export async function saveStudentNotesAction(
  _prev: StudentNotesState,
  formData: FormData,
): Promise<StudentNotesState> {
  await requireTeacher();

  const studentId = String(formData.get("studentId") || "");
  if (!studentId) return { error: "Не выбран ученик" };

  const field = (key: string, max: number) =>
    String(formData.get(key) || "").trim().slice(0, max) || null;

  await db
    .update(users)
    .set({
      // Уровень и цель ученик видит у себя, остальное — только учитель.
      level: field("level", 120),
      goal: field("goal", 500),
      levelAtStart: field("levelAtStart", 120),
      frequentMistakes: field("frequentMistakes", 2000),
      teacherNote: field("teacherNote", 2000),
      showPastLessons: formData.get("showPastLessons") === "on",
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")));

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/student/schedule");
  revalidatePath("/student/profile");
  return { ok: true };
}
