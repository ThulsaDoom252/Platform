"use server";

/**
 * Скрипт урока: заметки учителя к конкретному занятию.
 *
 * Виден только учителю — ученику он не отдаётся ни на одной странице.
 * Привязан к уроку, поэтому день, ученик и порядок берутся из самого
 * расписания, а не хранятся отдельно.
 */
import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, lessonScripts, users, type ScriptStyle } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { cleanScriptHtml, scriptPreview } from "@/lib/script-html";

export type ScriptLesson = {
  lessonId: string;
  studentId: string;
  studentName: string;
  studentLevel: string | null;
  avatarUrl: string | null;
  startTime: string;
  duration: number;
  status: string;
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
};

export type ScriptState = { ok?: boolean; error?: string; savedAt?: string };

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

/**
 * Уроки для списка скриптов.
 *
 * Сначала те, что ближе к сегодняшнему дню: готовятся всегда к
 * ближайшему занятию, а не к прошлогоднему.
 */
export async function listScriptLessonsAction(limit = 60): Promise<ScriptLesson[]> {
  await requireTeacher();

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
      html: lessonScripts.html,
      updatedAt: lessonScripts.updatedAt,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.studentId))
    .leftJoin(lessonScripts, eq(lessonScripts.lessonId, lessons.id))
    .orderBy(desc(lessons.startTime))
    .limit(Math.min(200, Math.max(1, limit)));

  return rows.map((r) => ({
    lessonId: r.lessonId,
    studentId: r.studentId,
    studentName: r.studentName,
    studentLevel: r.studentLevel,
    avatarUrl: r.avatarUrl,
    startTime: r.startTime.toISOString(),
    duration: r.duration,
    status: r.status,
    hasScript: !!r.html?.trim(),
    preview: scriptPreview(r.html ?? ""),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  }));
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

  if (!row) return { lessonId: id, html: "", style: {}, updatedAt: null };

  return {
    lessonId: id,
    html: row.html,
    style: row.style ?? {},
    updatedAt: row.updatedAt.toISOString(),
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

  const [lesson] = await db
    .select({ id: lessons.id, startTime: lessons.startTime })
    .from(lessons)
    .where(
      and(
        eq(lessons.studentId, id),
        sql`${lessons.startTime} < now() + interval '1 day'`,
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
  if (!lesson) return { error: "Урок не найден" };

  const clean = cleanScriptHtml(html);
  const now = new Date();
  const safeStyle: ScriptStyle = {
    font: style?.font?.slice(0, 60),
    size: Math.min(48, Math.max(10, Number(style?.size) || 16)),
    color: style?.color?.slice(0, 32),
    background: style?.background?.slice(0, 200),
    backgroundImage: style?.backgroundImage?.slice(0, 2000) ?? null,
  };

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
