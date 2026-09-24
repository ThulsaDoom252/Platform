"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, destroySession } from "@/lib/session";

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

/**
 * Временный вход в ученика одним кликом для локальной разработки.
 * Проверка повторяется на сервере: скрытой кнопки недостаточно как защиты.
 */
export async function testStudentLoginAction(formData: FormData) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Тестовый вход доступен только в локальной разработке");
  }

  const studentId = String(formData.get("studentId") || "");
  if (!studentId) return;

  const [student] = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  // Удалённый между открытием страницы и кликом аккаунт просто не войдёт.
  if (!student || student.role !== "STUDENT") return;

  await createSession({
    userId: student.id,
    role: student.role,
    name: student.name,
  });
  redirect("/student");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
