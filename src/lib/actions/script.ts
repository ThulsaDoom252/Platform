"use server";

/**
 * Скрипт урока: заметки учителя к конкретному занятию.
 *
 * Виден только учителю — ученику он не отдаётся ни на одной странице.
 * Привязан к уроку, поэтому день, ученик и порядок берутся из самого
 * расписания, а не хранятся отдельно.
 */
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessons,
  lessonScripts,
  archivedLessonScripts,
  scriptPresets,
  users,
  type ScriptStyle,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { cleanScriptHtml, scriptPreview } from "@/lib/script-html";
import { scheduleNow } from "@/lib/schedule-time";

export type ScriptLesson = {
  lessonId: string;
  studentId: string;
  studentName: string;
  studentLevel: string | null;
  avatarUrl: string | null;
  startTime: string;
  duration: number;
  status: string;
  cancelReason: string | null;
  deletedAt: string | null;
  /** Есть ли что-то написанное и его начало — для списка. */
  hasScript: boolean;
  preview: string;
  updatedAt: string | null;
};

export type ScriptDoc = {
  lessonId: string;
  html: string;
  style: ScriptStyle;
  updatedAt: string | null;
  archived: boolean;
};

export type ScriptState = { ok?: boolean; error?: string; savedAt?: string };

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

/** Уроки недели: от понедельника до воскресенья включительно. */
export async function listScriptWeekAction(
  fromISO: string,
  toISO: string,
): Promise<ScriptLesson[]> {
  await requireTeacher();

  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];

  const rows = await db
    .select({
      lessonId: lessons.id,
      studentId: lessons.studentId,
      studentName: users.name,
      studentLevel: users.level,
      avatarUrl: users.avatarUrl,
      startTime: lessons.startTime,
      duration: lessons.durationMinutes,
      status: lessons.status,
      cancelReason: lessons.cancelReason,
      deletedAt: sql<Date | null>`null`,
      html: lessonScripts.html,
      updatedAt: lessonScripts.updatedAt,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.studentId))
    .leftJoin(lessonScripts, eq(lessonScripts.lessonId, lessons.id))
    .where(and(gte(lessons.startTime, from), lt(lessons.startTime, to)))
    .orderBy(asc(lessons.startTime));

  return rows.map(toScriptLesson);
}

/**
 * История: только те уроки, к которым скрипт действительно написан.
 *
 * Нужна, чтобы найти прошлую подготовку — по ученику и по дате, а не
 * листая недели назад.
 */
export async function listScriptHistoryAction(limit = 80): Promise<ScriptLesson[]> {
  await requireTeacher();
  const safeLimit = Math.min(200, Math.max(1, limit));

  const [rows, archived] = await Promise.all([
    db
    .select({
      lessonId: lessons.id,
      studentId: lessons.studentId,
      studentName: users.name,
      studentLevel: users.level,
      avatarUrl: users.avatarUrl,
      startTime: lessons.startTime,
      duration: lessons.durationMinutes,
      status: lessons.status,
      cancelReason: lessons.cancelReason,
      deletedAt: sql<Date | null>`null`,
      html: lessonScripts.html,
      updatedAt: lessonScripts.updatedAt,
    })
    .from(lessonScripts)
    .innerJoin(lessons, eq(lessons.id, lessonScripts.lessonId))
    .innerJoin(users, eq(users.id, lessons.studentId))
    .where(and(isNotNull(lessonScripts.html), ne(lessonScripts.html, "")))
    .orderBy(desc(lessonScripts.updatedAt))
    .limit(safeLimit),
    archivedScriptRows(safeLimit),
  ]);

  return [...rows.map(toScriptLesson), ...archived.map(toScriptLesson)]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.deletedAt ?? b.startTime).getTime() -
        new Date(a.updatedAt ?? a.deletedAt ?? a.startTime).getTime(),
    )
    .slice(0, safeLimit);
}

type LessonRow = {
  lessonId: string;
  studentId: string;
  studentName: string;
  studentLevel: string | null;
  avatarUrl: string | null;
  startTime: Date;
  duration: number;
  status: string;
  cancelReason: string | null;
  deletedAt: Date | null;
  html: string | null;
  updatedAt: Date | null;
};

function toScriptLesson(r: LessonRow): ScriptLesson {
  return {
    lessonId: r.lessonId,
    studentId: r.studentId,
    studentName: r.studentName,
    studentLevel: r.studentLevel,
    avatarUrl: r.avatarUrl,
    startTime: r.startTime.toISOString(),
    duration: r.duration,
    status: r.status,
    cancelReason: r.cancelReason,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    hasScript: !!r.html?.trim(),
    preview: scriptPreview(r.html ?? ""),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  };
}

async function archivedScriptRows(limit: number): Promise<LessonRow[]> {
  return db
    .select({
      lessonId: archivedLessonScripts.originalLessonId,
      studentId: archivedLessonScripts.studentId,
      studentName: archivedLessonScripts.studentName,
      studentLevel: users.level,
      avatarUrl: users.avatarUrl,
      startTime: archivedLessonScripts.startTime,
      duration: archivedLessonScripts.durationMinutes,
      status: sql<string>`'DELETED'`,
      cancelReason: archivedLessonScripts.cancelReason,
      deletedAt: archivedLessonScripts.deletedAt,
      html: archivedLessonScripts.html,
      updatedAt: archivedLessonScripts.updatedAt,
    })
    .from(archivedLessonScripts)
    .leftJoin(users, eq(users.id, archivedLessonScripts.studentId))
    .where(
      and(
        isNotNull(archivedLessonScripts.html),
        ne(archivedLessonScripts.html, ""),
      ),
    )
    .orderBy(desc(archivedLessonScripts.updatedAt))
    .limit(limit);
}

/**
 * Уроки для списка скриптов.
 *
 * Сначала те, что ближе к сегодняшнему дню: готовятся всегда к
 * ближайшему занятию, а не к прошлогоднему.
 */
export async function listScriptLessonsAction(limit = 60): Promise<ScriptLesson[]> {
  await requireTeacher();
  const safeLimit = Math.min(200, Math.max(1, limit));

  const [rows, archived] = await Promise.all([
    db
    .select({
      lessonId: lessons.id,
      studentId: lessons.studentId,
      studentName: users.name,
      studentLevel: users.level,
      avatarUrl: users.avatarUrl,
      startTime: lessons.startTime,
      duration: lessons.durationMinutes,
      status: lessons.status,
      cancelReason: lessons.cancelReason,
      deletedAt: sql<Date | null>`null`,
      html: lessonScripts.html,
      updatedAt: lessonScripts.updatedAt,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.studentId))
    .leftJoin(lessonScripts, eq(lessonScripts.lessonId, lessons.id))
    .orderBy(desc(lessons.startTime))
    .limit(safeLimit),
    archivedScriptRows(safeLimit),
  ]);

  return [...rows.map(toScriptLesson), ...archived.map(toScriptLesson)]
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    )
    .slice(0, safeLimit);
}

/** Метаданные конкретного скрипта без зависимости от лимита общего списка. */
export async function getScriptLessonAction(
  lessonId: string,
): Promise<ScriptLesson | null> {
  await requireTeacher();
  const id = String(lessonId ?? "");
  if (!id) return null;

  const [active] = await db
    .select({
      lessonId: lessons.id,
      studentId: lessons.studentId,
      studentName: users.name,
      studentLevel: users.level,
      avatarUrl: users.avatarUrl,
      startTime: lessons.startTime,
      duration: lessons.durationMinutes,
      status: lessons.status,
      cancelReason: lessons.cancelReason,
      deletedAt: sql<Date | null>`null`,
      html: lessonScripts.html,
      updatedAt: lessonScripts.updatedAt,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.studentId))
    .leftJoin(lessonScripts, eq(lessonScripts.lessonId, lessons.id))
    .where(eq(lessons.id, id))
    .limit(1);
  if (active) return toScriptLesson(active);

  const [archived] = await db
    .select({
      lessonId: archivedLessonScripts.originalLessonId,
      studentId: archivedLessonScripts.studentId,
      studentName: archivedLessonScripts.studentName,
      studentLevel: users.level,
      avatarUrl: users.avatarUrl,
      startTime: archivedLessonScripts.startTime,
      duration: archivedLessonScripts.durationMinutes,
      status: sql<string>`'DELETED'`,
      cancelReason: archivedLessonScripts.cancelReason,
      deletedAt: archivedLessonScripts.deletedAt,
      html: archivedLessonScripts.html,
      updatedAt: archivedLessonScripts.updatedAt,
    })
    .from(archivedLessonScripts)
    .leftJoin(users, eq(users.id, archivedLessonScripts.studentId))
    .where(eq(archivedLessonScripts.originalLessonId, id))
    .limit(1);

  return archived ? toScriptLesson(archived) : null;
}

/** Скрипт одного урока. Пустой — значит его ещё не писали. */
export async function getScriptAction(lessonId: string): Promise<ScriptDoc | null> {
  await requireTeacher();
  const id = String(lessonId ?? "");
  if (!id) return null;

  const [row] = await db
    .select()
    .from(lessonScripts)
    .where(eq(lessonScripts.lessonId, id))
    .limit(1);

  if (!row) {
    const [archived] = await db
      .select()
      .from(archivedLessonScripts)
      .where(eq(archivedLessonScripts.originalLessonId, id))
      .limit(1);
    if (archived) {
      return {
        lessonId: id,
        html: archived.html,
        style: archived.style ?? {},
        updatedAt: archived.updatedAt.toISOString(),
        archived: true,
      };
    }
    return { lessonId: id, html: "", style: {}, updatedAt: null, archived: false };
  }

  return {
    lessonId: id,
    html: row.html,
    style: row.style ?? {},
    updatedAt: row.updatedAt.toISOString(),
    archived: false,
  };
}

/**
 * Скрипт урока с ближайшим сегодняшним занятием ученика.
 *
 * Нужен классу: там известен ученик, но не урок. Берём сегодняшний, а
 * если его нет — ближайший прошедший, чтобы подготовка не терялась.
 */
export async function getClassScriptAction(
  studentId: string,
): Promise<(ScriptDoc & { lessonAt: string }) | null> {
  await requireTeacher();
  const id = String(studentId ?? "");
  if (!id) return null;

  const tomorrow = new Date(scheduleNow().getTime() + 24 * 60 * 60 * 1000);
  const [lesson] = await db
    .select({ id: lessons.id, startTime: lessons.startTime })
    .from(lessons)
    .where(
      and(
        eq(lessons.studentId, id),
        lt(lessons.startTime, tomorrow),
      ),
    )
    .orderBy(desc(lessons.startTime))
    .limit(1);

  if (!lesson) return null;

  const doc = await getScriptAction(lesson.id);
  return doc && { ...doc, lessonAt: lesson.startTime.toISOString() };
}

/** Сохранить скрипт. Разметка чистится: показывается она через innerHTML. */
export async function saveScriptAction(
  lessonId: string,
  html: string,
  style: ScriptStyle,
): Promise<ScriptState> {
  await requireTeacher();

  const id = String(lessonId ?? "");
  if (!id) return { error: "Не выбран урок" };

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1);
  const clean = cleanScriptHtml(html);
  const now = new Date();
  const safeStyle: ScriptStyle = {
    font: style?.font?.slice(0, 60),
    size: Math.min(48, Math.max(10, Number(style?.size) || 16)),
    color: style?.color?.slice(0, 32),
    background: style?.background?.slice(0, 200),
    backgroundImage: style?.backgroundImage?.slice(0, 2000) ?? null,
  };

  if (!lesson) {
    const [archived] = await db
      .update(archivedLessonScripts)
      .set({ html: clean, style: safeStyle, updatedAt: now })
      .where(eq(archivedLessonScripts.originalLessonId, id))
      .returning({ id: archivedLessonScripts.id });
    if (!archived) return { error: "Урок и его скрипт не найдены" };
    revalidatePath("/teacher/script");
    return { ok: true, savedAt: now.toISOString() };
  }

  await db
    .insert(lessonScripts)
    .values({ lessonId: id, html: clean, style: safeStyle, updatedAt: now })
    .onConflictDoUpdate({
      target: lessonScripts.lessonId,
      set: { html: clean, style: safeStyle, updatedAt: now },
    });

  revalidatePath("/teacher/script");
  return { ok: true, savedAt: now.toISOString() };
}

/** Скрипт удаляется отдельно; сам урок и его статус не меняются. */
export async function deleteScriptAction(lessonId: string): Promise<ScriptState> {
  await requireTeacher();
  const id = String(lessonId ?? "");
  if (!id) return { error: "Не выбран скрипт" };

  await db.transaction(async (tx) => {
    await tx.delete(lessonScripts).where(eq(lessonScripts.lessonId, id));
    await tx
      .delete(archivedLessonScripts)
      .where(eq(archivedLessonScripts.originalLessonId, id));
  });
  revalidatePath("/teacher/script");
  return { ok: true };
}

export type ScriptPreset = {
  id: string;
  name: string;
  html: string;
  style: ScriptStyle;
  createdAt: string;
};

/** Больше пяти заготовок держать незачем: список сам станет свалкой. */
const MAX_SCRIPT_PRESETS = 5;

export async function listScriptPresetsAction(): Promise<ScriptPreset[]> {
  await requireTeacher();

  const rows = await db
    .select()
    .from(scriptPresets)
    .orderBy(asc(scriptPresets.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    html: r.html,
    style: r.style ?? {},
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Запомнить нынешний скрипт как заготовку. */
export async function saveScriptPresetAction(
  name: string,
  html: string,
  style: ScriptStyle,
): Promise<ScriptState> {
  await requireTeacher();

  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) return { error: "Дай заготовке название" };

  const [{ value: count = 0 } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(scriptPresets);
  if (Number(count) >= MAX_SCRIPT_PRESETS) {
    return { error: "Заготовок уже пять — удали лишнюю" };
  }

  await db.insert(scriptPresets).values({
    name: clean,
    html: cleanScriptHtml(html),
    style: style ?? {},
  });

  revalidatePath("/teacher/script");
  return { ok: true };
}

export async function deleteScriptPresetAction(id: string): Promise<ScriptState> {
  await requireTeacher();
  const presetId = String(id ?? "");
  if (!presetId) return { error: "Не выбрана заготовка" };

  await db.delete(scriptPresets).where(eq(scriptPresets.id, presetId));
  revalidatePath("/teacher/script");
  return { ok: true };
}
