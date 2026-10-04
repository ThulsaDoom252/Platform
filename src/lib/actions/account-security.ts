"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  normalizeTeacherLogin,
  validateTeacherLogin,
  validateTeacherPassword,
  type SecurityActionState,
} from "@/lib/account-security";

async function currentTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") return null;

  const [teacher] = await db
    .select({
      id: users.id,
      login: users.login,
      passwordHash: users.passwordHash,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return teacher?.role === "TEACHER" ? teacher : null;
}

export async function changeTeacherLoginAction(
  _previous: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  const teacher = await currentTeacher();
  if (!teacher) return { error: "AUTH_REQUIRED" };

  const login = normalizeTeacherLogin(formData.get("newLogin"));
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (!currentPassword) return { error: "CURRENT_PASSWORD_REQUIRED" };

  const validationError = validateTeacherLogin(login);
  if (validationError) return { error: validationError };
  if (login === teacher.login) return { error: "LOGIN_SAME" };
  if (!(await bcrypt.compare(currentPassword, teacher.passwordHash))) {
    return { error: "WRONG_PASSWORD" };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.login, login), ne(users.id, teacher.id)))
    .limit(1);
  if (existing) return { error: "LOGIN_TAKEN" };

  try {
    await db
      .update(users)
      .set({ login, updatedAt: new Date() })
      .where(and(eq(users.id, teacher.id), eq(users.role, "TEACHER")));
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code
      ?? (error as { cause?: { code?: string } })?.cause?.code;
    return { error: code === "23505" ? "LOGIN_TAKEN" : "UNKNOWN" };
  }

  revalidatePath("/teacher/settings");
  revalidatePath("/login");
  return { success: "LOGIN" };
}

export async function changeTeacherPasswordAction(
  _previous: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  const teacher = await currentTeacher();
  if (!teacher) return { error: "AUTH_REQUIRED" };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");
  if (!currentPassword) return { error: "CURRENT_PASSWORD_REQUIRED" };

  const validationError = validateTeacherPassword(newPassword, confirmation);
  if (validationError) return { error: validationError };
  if (!(await bcrypt.compare(currentPassword, teacher.passwordHash))) {
    return { error: "WRONG_PASSWORD" };
  }
  if (await bcrypt.compare(newPassword, teacher.passwordHash)) {
    return { error: "PASSWORD_SAME" };
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, teacher.id), eq(users.role, "TEACHER")));
  } catch {
    return { error: "UNKNOWN" };
  }

  revalidatePath("/teacher/settings");
  return { success: "PASSWORD" };
}
