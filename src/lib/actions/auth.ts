"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, destroySession, getSession } from "@/lib/session";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");

  if (!login || !password) {
    return { error: "Введи логин и пароль" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.login, login))
    .limit(1);

  if (!user) {
    return { error: "Неверный логин или пароль" };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return { error: "Неверный логин или пароль" };
  }

  await createSession({ userId: user.id, role: user.role, name: user.name });

  redirect(user.role === "TEACHER" ? "/teacher" : "/student");
}

/** Открыть ученическую часть от лица выбранного ученика. */
export async function viewAsStudentAction(formData: FormData) {
  const teacherSession = await getSession();
  if (!teacherSession || teacherSession.role !== "TEACHER") {
    redirect("/login");
  }
  const studentId = String(formData.get("studentId") || "");
  if (!studentId) return;

  const [teacher, student] = await Promise.all([
    db
      .select({ id: users.id, role: users.role, name: users.name })
      .from(users)
      .where(eq(users.id, teacherSession.userId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: users.id, role: users.role, name: users.name })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!teacher || teacher.role !== "TEACHER") redirect("/login");
  if (!student || student.role !== "STUDENT") return;

  await createSession({
    userId: student.id,
    role: student.role,
    name: student.name,
    impersonatedBy: {
      teacherId: teacher.id,
      teacherName: teacher.name,
    },
  });
  redirect("/student/materials");
}

/** Вернуться из ученического просмотра в исходный аккаунт учителя. */
export async function returnToTeacherAction() {
  const studentSession = await getSession();
  const teacherId = studentSession?.impersonatedBy?.teacherId;
  if (!studentSession || studentSession.role !== "STUDENT" || !teacherId) {
    redirect("/login");
  }

  const [teacher] = await db
    .select({ id: users.id, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, teacherId))
    .limit(1);

  if (!teacher || teacher.role !== "TEACHER") {
    await destroySession();
    redirect("/login");
  }

  const studentId = studentSession.userId;
  await createSession({
    userId: teacher.id,
    role: teacher.role,
    name: teacher.name,
  });
  redirect(`/teacher/students/${studentId}/materials`);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
