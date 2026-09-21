"use server";

import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, notifications } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import type { Locale } from "@/lib/i18n";

const ALLOWED_LOCALES: Locale[] = ["en", "ru", "uk"];

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти в аккаунт");
  return session;
}

/** Пометить свои уведомления прочитанными (работает для любой роли). */
export async function markMyNotificationsReadAction() {
  const session = await requireUser();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientId, session.userId));
  revalidatePath("/", "layout");
}

/** Язык интерфейса — каждый меняет только себе. */
export async function updateLocaleAction(formData: FormData) {
  const session = await requireUser();
  const locale = String(formData.get("locale") || "") as Locale;
  if (!ALLOWED_LOCALES.includes(locale)) return;

  await db
    .update(users)
    .set({ locale, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  revalidatePath("/", "layout");
}

// Загрузка фото: только картинки, не больше 2 МБ.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type ProfileState = { ok?: boolean; message?: string; error?: string };

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await requireUser();

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!me) return { error: "Профиль не найден" };

  const email = String(formData.get("email") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const telegram = String(formData.get("telegram") || "").trim() || null;
  const contactNote = String(formData.get("contactNote") || "").trim() || null;
  // Имя меняет только учитель (аккаунты учеников заводит он).
  const name =
    session.role === "TEACHER"
      ? String(formData.get("name") || "").trim() || me.name
      : me.name;

  let avatarUrl = me.avatarUrl;

  if (formData.get("removePhoto") === "on") {
    avatarUrl = null;
  } else {
    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      const ext = MIME_EXT[file.type];
      if (!ext) return { error: "Поддерживаются только PNG, JPEG и WebP" };
      if (file.size > MAX_AVATAR_BYTES) return { error: "Файл больше 2 МБ" };

      const dir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(dir, { recursive: true });
      const fileName = `${session.userId}-${Date.now()}.${ext}`;
      await fs.writeFile(
        path.join(dir, fileName),
        Buffer.from(await file.arrayBuffer()),
      );
      avatarUrl = `/uploads/${fileName}`;
    }
  }

  await db
    .update(users)
    .set({ name, email, phone, telegram, contactNote, avatarUrl, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  // Учитель должен знать, что ученик обновил контакты.
  if (session.role === "STUDENT") {
    const [teacher] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "TEACHER"))
      .limit(1);
    if (teacher) {
      await db.insert(notifications).values({
        recipientId: teacher.id,
        type: "CONTACT_CHANGE_REQUEST",
        relatedStudentId: session.userId,
        message: `${me.name} обновил(а) контактные данные в профиле`,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Сохранено" };
}
