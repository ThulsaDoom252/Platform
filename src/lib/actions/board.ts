"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { studentBoards, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { sanitizeBoardScene, type BoardScene } from "@/lib/board-scene";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти");
  return session;
}

async function teacherStudent(teacherId: string) {
  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(and(eq(users.id, teacherId), eq(users.role, "TEACHER")))
    .limit(1);
  return teacher?.studentId ?? null;
}

export type ClassBoardState = {
  scene: BoardScene | null;
  updatedAt: string | null;
};

/** Одна доска принадлежит одному ученику; учитель видит доску текущего класса. */
export async function classBoardStateAction(): Promise<ClassBoardState> {
  const session = await requireUser();
  const studentId = session.role === "TEACHER"
    ? await teacherStudent(session.userId)
    : session.userId;
  if (!studentId) return { scene: null, updatedAt: null };

  const [row] = await db
    .select({ scene: studentBoards.scene, updatedAt: studentBoards.updatedAt })
    .from(studentBoards)
    .where(eq(studentBoards.studentId, studentId))
    .limit(1);
  return {
    scene: sanitizeBoardScene(row?.scene) ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/** Сохранять сцену может только учитель текущего класса. */
export async function saveClassBoardAction(
  input: unknown,
): Promise<{ updatedAt?: string; error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доску меняет только учитель" };
  const studentId = await teacherStudent(session.userId);
  if (!studentId) return { error: "Сначала выбери ученика" };
  const scene = sanitizeBoardScene(input);
  if (!scene) return { error: "Сцена доски повреждена или слишком велика" };

  const now = new Date();
  await db
    .insert(studentBoards)
    .values({ studentId, scene, updatedAt: now })
    .onConflictDoUpdate({
      target: studentBoards.studentId,
      set: { scene, updatedAt: now },
    });
  return { updatedAt: now.toISOString() };
}

type BoardCommand = "SHOW" | "FOCUS" | "FLASH";

async function commandBoard(objectId: number | null, boardCommand: BoardCommand) {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Это может только учитель" };
  const studentId = await teacherStudent(session.userId);
  if (!studentId) return { error: "Сначала выбери ученика" };

  const [[student], [board]] = await Promise.all([
    db
      .select({ classFocus: users.classFocus })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
      .limit(1),
    db
      .select({ scene: studentBoards.scene })
      .from(studentBoards)
      .where(eq(studentBoards.studentId, studentId))
      .limit(1),
  ]);
  if (!student) return { error: "Ученик не найден" };

  if (objectId !== null) {
    const scene = sanitizeBoardScene(board?.scene);
    if (!scene?.objects.some((object) => object.id === objectId)) {
      return { error: "Сначала сохрани выбранный объект" };
    }
  }

  await db
    .update(users)
    .set({
      classFocus: {
        at: new Date().toISOString(),
        view: "BOARD",
        boardObjectId: objectId,
        boardCommand,
        ...(student.classFocus?.lessonAssignmentId
          ? { lessonAssignmentId: student.classFocus.lessonAssignmentId }
          : {}),
      },
    })
    .where(eq(users.id, studentId));
  return {};
}

export async function showBoardToStudentAction(): Promise<{ error?: string }> {
  return commandBoard(null, "SHOW");
}

export async function focusBoardObjectAction(
  objectId: number,
): Promise<{ error?: string }> {
  const id = Math.trunc(Number(objectId));
  if (!Number.isFinite(id) || id < 1) return { error: "Объект не выбран" };
  return commandBoard(id, "FOCUS");
}

export async function flashBoardObjectAction(
  objectId: number,
): Promise<{ error?: string }> {
  const id = Math.trunc(Number(objectId));
  if (!Number.isFinite(id) || id < 1) return { error: "Объект не выбран" };
  return commandBoard(id, "FLASH");
}
