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

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
