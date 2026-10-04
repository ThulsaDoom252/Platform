"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, notifications } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import type { Locale } from "@/lib/i18n";
import { storePublicFile } from "@/lib/public-file-store";
import { fmt, getDictFor } from "@/lib/i18n";
import { notificationPolicy } from "@/lib/notifications";

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

/** Удалить всю свою ленту уведомлений. */
export async function clearMyNotificationsAction() {
  const session = await requireUser();
  await db.delete(notifications).where(eq(notifications.recipientId, session.userId));
  revalidatePath("/", "layout");
}

/**
 * Открытие одного уведомления: оно исчезает, а отправитель получает
 * единственную квитанцию о прочтении.
 */
export async function markMyNotificationReadAction(id: string) {
  const session = await requireUser();
  const [read] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(
      eq(notifications.id, String(id ?? "")),
      eq(notifications.recipientId, session.userId),
      eq(notifications.isRead, false),
    ))
    .returning({
      senderId: notifications.senderId,
      message: notifications.message,
    });

  if (read?.senderId && read.senderId !== session.userId && session.role === "STUDENT") {
    const [sender] = await db.select({ locale: users.locale }).from(users)
      .where(eq(users.id, read.senderId)).limit(1);
    if (sender) {
      const t = getDictFor(sender.locale);
      await db.insert(notifications).values({
        recipientId: read.senderId,
        senderId: session.userId,
        type: "CONTACT_CHANGE_REQUEST",
        relatedStudentId: session.userId,
        href: `/teacher/students/${session.userId}`,
        message: fmt(t.notifications.readReceipt, {
          name: session.name,
          title: read.message,
        }),
      });
    }
  }
  revalidatePath("/", "layout");
}

/** Учитель отвечает на отложенный запрос «отправить уведомление?». */
export async function resolveNotificationPromptAction(id: string, send: boolean) {
  const session = await requireUser();
  if (session.role !== "TEACHER") return;
  const [prompt] = await db.select().from(notifications).where(and(
    eq(notifications.id, String(id ?? "")),
    eq(notifications.recipientId, session.userId),
    eq(notifications.isRead, false),
  )).limit(1);
  const data = prompt?.data;
  if (!prompt || data?.kind !== "SEND_CONFIRMATION" || !data.studentId || !data.message || !data.href) return;

  await db.transaction(async (tx) => {
    if (send) {
      await tx.insert(notifications).values({
        recipientId: data.studentId!,
        senderId: session.userId,
        type: "HOMEWORK_SUBMITTED",
        relatedStudentId: data.studentId!,
        message: data.message!,
        href: data.href!,
      });
    }
    await tx.delete(notifications).where(eq(notifications.id, prompt.id));
  });
  revalidatePath("/", "layout");
}

export async function updateNotificationPolicyAction(formData: FormData) {
  const session = await requireUser();
  if (session.role !== "TEACHER") return;
  const policy = notificationPolicy(formData.get("policy"));
  await db.update(users).set({ notificationPolicy: policy, updatedAt: new Date() })
    .where(eq(users.id, session.userId));
  revalidatePath("/teacher/settings");
}

export type ManualNotificationState = {
  ok?: boolean;
  error?: "forbidden" | "missing" | "notFound";
};

/** Ручное сообщение ученику не зависит от автоматической политики. */
export async function sendManualNotificationAction(
  _previous: ManualNotificationState,
  formData: FormData,
): Promise<ManualNotificationState> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "forbidden" };
  const studentId = String(formData.get("studentId") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 500);
  if (!studentId || !message) return { error: "missing" };
  const [student] = await db.select({ id: users.id }).from(users).where(and(
    eq(users.id, studentId),
    eq(users.role, "STUDENT"),
  )).limit(1);
  if (!student) return { error: "notFound" };
  await db.insert(notifications).values({
    recipientId: student.id,
    senderId: session.userId,
    type: "WISHLIST_NOTE",
    relatedStudentId: student.id,
    message,
    href: "/student",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export type NotificationToastItem = {
  id: string;
  message: string;
  href: string | null;
  confirmation?: { studentId: string; message: string; href: string };
};

/**
 * Global presence heartbeat and live notification polling. A toast is only
 * produced for events created while this browser page is open.
 */
export async function pollMyNotificationsAction(since: string): Promise<{
  cursor: string;
  items: NotificationToastItem[];
}> {
  const session = await requireUser();
  const now = new Date();
  const parsed = new Date(since);
  const after = Number.isNaN(parsed.getTime()) ? now : parsed;
  await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, session.userId));
  const rows = await db.select().from(notifications).where(and(
    eq(notifications.recipientId, session.userId),
    eq(notifications.isRead, false),
    gt(notifications.createdAt, after),
  )).orderBy(asc(notifications.createdAt)).limit(5);
  return {
    cursor: now.toISOString(),
    items: rows.map((row) => ({
      id: row.id,
      message: row.message,
      href: row.href,
      confirmation: row.data?.kind === "SEND_CONFIRMATION" && row.data.studentId && row.data.message && row.data.href
        ? { studentId: row.data.studentId, message: row.data.message, href: row.data.href }
        : undefined,
    })),
  };
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

  /** Поле анкеты: пустое остаётся пустым, длинное подрезается. */
  const field = (key: string, max = 200) =>
    String(formData.get(key) || "").trim().slice(0, max) || null;

  const viber = field("viber", 60);
  const hobby = field("hobby", 300);
  const goal = field("goal", 300);
  const homeland = field("homeland", 120);
  const country = field("country", 120);
  const city = field("city", 120);
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

      const fileName = `${session.userId}-${Date.now()}.${ext}`;
      avatarUrl = await storePublicFile(
        `uploads/avatars/${fileName}`,
        Buffer.from(await file.arrayBuffer()),
        file.type,
      );
    }
  }

  await db
    .update(users)
    .set({
      name,
      email,
      phone,
      telegram,
      viber,
      contactNote,
      hobby,
      goal,
      homeland,
      country,
      city,
      avatarUrl,
      updatedAt: new Date(),
    })
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

/**
 * Запомнить тему в профиле.
 *
 * Сама тема применяется мгновенно из браузера — сюда она уходит только
 * для того, чтобы учитель видел в карточке ученика, чем тот пользуется.
 * Поэтому ответа мы не ждём и ошибки не показываем.
 */
export async function rememberThemeAction(mode: string, accent: string) {
  const session = await getSession();
  if (!session) return;

  await db
    .update(users)
    .set({
      theme: mode === "dark" ? "DARK" : "LIGHT",
      accent: String(accent ?? "").slice(0, 32) || null,
    })
    .where(eq(users.id, session.userId));
}
