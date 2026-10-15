"use server";

import { and, asc, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { materialNodes, notifications, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { fmt, getDictFor } from "@/lib/i18n";
import { publishUserRealtime } from "@/lib/realtime-server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function teacherSession() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

/** Folder creation from the copy picker never sends an automatic notification. */
export async function createLessonVocabularyFolderAction(input: {
  studentId: string; parentId?: string | null; name: string;
}): Promise<{ folder?: { id: string; parentId: string | null; name: string }; error?: string }> {
  await teacherSession();
  const studentId = String(input?.studentId ?? "");
  const parentId = input?.parentId ? String(input.parentId) : null;
  const name = String(input?.name ?? "").trim();
  if (!uuid.test(studentId) || parentId && !uuid.test(parentId)) return { error: "Некорректная папка или ученик" };
  if (!name || name.length > 200) return { error: "Введи название папки (до 200 символов)" };
  const [student] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT"))).limit(1);
  if (!student) return { error: "Ученик не найден" };
  const result = await db.transaction(async tx => {
    if (parentId) {
      const [parent] = await tx.select({ id: materialNodes.id }).from(materialNodes).where(and(
        eq(materialNodes.id, parentId), eq(materialNodes.ownerId, studentId),
        eq(materialNodes.scope, "STUDENT"), eq(materialNodes.type, "FOLDER"),
      )).limit(1).for("update");
      if (!parent) return { error: "Папка ученика не найдена" };
    }
    const [{ value: lastOrder } = { value: 0 }] = await tx.select({ value: max(materialNodes.sortOrder) }).from(materialNodes)
      .where(and(eq(materialNodes.scope, "STUDENT"), eq(materialNodes.ownerId, studentId),
        parentId ? eq(materialNodes.parentId, parentId) : isNull(materialNodes.parentId)));
    const [folder] = await tx.insert(materialNodes).values({
      parentId, scope: "STUDENT", ownerId: studentId, type: "FOLDER", pageKind: null,
      name, icon: "📁", sortOrder: (lastOrder ?? 0) + 1,
    }).returning({ id: materialNodes.id, parentId: materialNodes.parentId, name: materialNodes.name });
    return { folder };
  });
  if (result.folder) {
    revalidatePath(`/teacher/students/${studentId}/materials`);
    revalidatePath("/student/materials");
  }
  return result;
}

/** Explicit Send only: no policy-based auto-send and no client-supplied message/recipient. */
export async function notifyLessonVocabularyMaterialAction(nodeId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await teacherSession();
  if (!uuid.test(String(nodeId ?? ""))) return { error: "Материал не найден" };
  const result = await db.transaction(async tx => {
    const [node] = await tx.select({ id: materialNodes.id, name: materialNodes.name, ownerId: materialNodes.ownerId })
      .from(materialNodes).where(and(eq(materialNodes.id, nodeId), eq(materialNodes.scope, "STUDENT"),
        eq(materialNodes.type, "FILE"), eq(materialNodes.pageKind, "VOCAB"))).limit(1).for("update");
    if (!node?.ownerId) return { error: "Материал ученика не найден" };
    const [student] = await tx.select({ id: users.id, locale: users.locale }).from(users)
      .where(and(eq(users.id, node.ownerId), eq(users.role, "STUDENT"))).limit(1);
    if (!student) return { error: "Ученик не найден" };
    const href = `/student/materials?node=${encodeURIComponent(node.id)}`;
    const [existing] = await tx.select({ id: notifications.id }).from(notifications).where(and(
      eq(notifications.senderId, session.userId), eq(notifications.recipientId, student.id),
      eq(notifications.href, href), eq(notifications.type, "WISHLIST_NOTE"),
    )).orderBy(asc(notifications.createdAt)).limit(1);
    if (!existing) await tx.insert(notifications).values({
      recipientId: student.id, senderId: session.userId, relatedStudentId: student.id,
      type: "WISHLIST_NOTE", message: fmt(getDictFor(student.locale).notifications.materialAdded, { title: node.name }), href,
    });
    return { studentId: student.id };
  });
  if (result.error) return { error: result.error };
  if (result.studentId) {
    try { await publishUserRealtime(result.studentId, "notification"); } catch { /* polling delivers the saved notification */ }
    revalidatePath("/", "layout");
    return { ok: true };
  }
  return { error: "Не удалось отправить уведомление" };
}
