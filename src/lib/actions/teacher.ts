"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users,
  lessons,
  homework,
  notifications,
  lessonPackages,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  adjustStudentLessons,
  configureSharedLessonPool,
  setStudentLessons,
} from "@/lib/packages";

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    throw new Error("Только учитель может выполнить это действие");
  }
  return session;
}

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
    name,
    login,
    passwordHash,
    role: "STUDENT",
    lessonBalance: balance,
    packageId,
    lessonsBefore,
    startedAt,
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
}

export async function resetStudentPasswordAction(formData: FormData) {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const newPassword = String(formData.get("newPassword") || "");
  if (!studentId || !newPassword) return;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, studentId));

  revalidatePath(`/teacher/students/${studentId}`);
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

  await db.insert(lessons).values({
    studentId,
    startTime: new Date(startTime),
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
  const studentId = String(formData.get("studentId") || "");
  const status = String(formData.get("status") || "") as
    | "COMPLETED"
    | "BURNED"
    | "CANCELLED_BY_STUDENT"
    | "SCHEDULED";
  if (!lessonId || !status) return;

  if (status === "COMPLETED") {
    // Списываем только за фактически проведённый урок — из общего пакета, если он есть.
    await adjustStudentLessons(studentId, -1);
  }

  await db
    .update(lessons)
    .set({ status, updatedAt: new Date() })
    .where(eq(lessons.id, lessonId));

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher");
}

export async function createHomeworkAction(formData: FormData) {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!studentId || !title) return;

  await db.insert(homework).values({
    studentId,
    title,
    description: description || null,
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
});
const dFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/** Понедельник недели, в которую попадает дата. */
function weekStartOf(d: Date) {
  const r = new Date(d);
  r.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

function revalidateSchedule(studentId?: string) {
  revalidatePath("/teacher/schedule");
  revalidatePath("/teacher");
  revalidatePath("/student");
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
}

/** Отмена урока учителем (до проведения). Комментарий увидит ученик. */
export async function cancelLessonByTeacherAction(formData: FormData) {
  const session = await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const comment = String(formData.get("comment") || "").trim();
  if (!lessonId) return;

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return;

  const now = new Date();
  await db
    .update(lessons)
    .set({
      status: "CANCELLED_BY_TEACHER",
      cancelReason: comment || null,
      cancelledAt: now,
      teacherComment: comment || null,
      teacherCommentVisible: true,
      updatedAt: now,
    })
    .where(eq(lessons.id, lessonId));

  await db.insert(notifications).values({
    recipientId: lesson.studentId,
    type: "LESSON_CANCELLED",
    relatedStudentId: lesson.studentId,
    message: `${session.name} отменил урок ${dtFmt.format(lesson.startTime)}${comment ? `. Комментарий: ${comment}` : ""}`,
  });

  revalidateSchedule(lesson.studentId);
}

/** Удаление урока (обычно уже проведённого). Списанный урок возвращается на баланс. */
export async function deleteLessonAction(formData: FormData) {
  const session = await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const comment = String(formData.get("comment") || "").trim();
  if (!lessonId) return;

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return;

  // Проведённый урок списывал баланс — при удалении возвращаем в пакет.
  if (lesson.status === "COMPLETED") {
    await adjustStudentLessons(lesson.studentId, 1);
  }

  await db.insert(notifications).values({
    recipientId: lesson.studentId,
    type: "LESSON_CANCELLED",
    relatedStudentId: lesson.studentId,
    message: `${session.name} удалил урок ${dtFmt.format(lesson.startTime)}${comment ? `. Комментарий: ${comment}` : ""}`,
  });

  await db.delete(lessons).where(eq(lessons.id, lessonId));

  revalidateSchedule(lesson.studentId);
}

/** Перенос урока на новую дату и время. */
export async function rescheduleLessonAction(formData: FormData) {
  const session = await requireTeacher();
  const lessonId = String(formData.get("lessonId") || "");
  const newStart = String(formData.get("newStartTime") || "");
  const comment = String(formData.get("comment") || "").trim();
  if (!lessonId || !newStart) return;

  const start = new Date(newStart);
  if (Number.isNaN(start.getTime())) return;

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return;

  await db
    .update(lessons)
    .set({
      startTime: start,
      status: "SCHEDULED",
      teacherComment: comment || null,
      teacherCommentVisible: true,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, lessonId));

  await db.insert(notifications).values({
    recipientId: lesson.studentId,
    type: "LESSON_RESCHEDULED",
    relatedStudentId: lesson.studentId,
    message: `${session.name} перенёс урок с ${dtFmt.format(lesson.startTime)} на ${dtFmt.format(start)}${comment ? `. Комментарий: ${comment}` : ""}`,
  });

  revalidateSchedule(lesson.studentId);
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

  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return { error: "Некорректная дата" };

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
    d.setDate(start.getDate() + i * 7);
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
