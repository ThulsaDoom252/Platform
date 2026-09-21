"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { materialNodes, materialPhrases, studentMaterials, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { parseMaterial, type ParserMode } from "@/lib/materials-parser";

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    throw new Error("Редактировать материалы может только учитель");
  }
  return session;
}

function revalidateMaterials() {
  revalidatePath("/teacher/materials");
  revalidatePath("/student/materials");
  revalidatePath("/student/mistakes");
  revalidatePath("/teacher/students", "layout");
}

/** Назначает ветку всем ученикам — материалы по умолчанию доступны всем. */
async function assignToAllStudents(nodeId: string) {
  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "STUDENT"));
  if (students.length === 0) return;

  const existing = await db
    .select({ studentId: studentMaterials.studentId })
    .from(studentMaterials)
    .where(eq(studentMaterials.materialNodeId, nodeId));
  const have = new Set(existing.map((e) => e.studentId));

  const rows = students
    .filter((s) => !have.has(s.id))
    .map((s) => ({ studentId: s.id, materialNodeId: nodeId }));
  if (rows.length) await db.insert(studentMaterials).values(rows);
}

export type NodeState = { ok?: boolean; error?: string; nodeId?: string };

/** Создать папку или страницу. Корневые разделы сразу видят все ученики. */
export async function createNodeAction(
  _prev: NodeState,
  formData: FormData,
): Promise<NodeState> {
  await requireTeacher();

  const parentId = String(formData.get("parentId") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const kind = String(formData.get("kind") || "FOLDER");
  // MATERIAL — общая библиотека, MISTAKE — личное дерево ошибок ученика.
  const scope = String(formData.get("scope") || "MATERIAL") === "MISTAKE"
    ? "MISTAKE"
    : "MATERIAL";
  const ownerId = String(formData.get("ownerId") || "") || null;

  if (!name) return { error: "Введи название" };

  const [{ value: lastOrder } = { value: 0 }] = await db
    .select({ value: max(materialNodes.sortOrder) })
    .from(materialNodes)
    .where(
      parentId
        ? eq(materialNodes.parentId, parentId)
        : and(
            isNull(materialNodes.parentId),
            eq(materialNodes.scope, scope),
            ownerId && scope === "MISTAKE"
              ? eq(materialNodes.ownerId, ownerId)
              : isNull(materialNodes.ownerId),
          ),
    );

  const [row] = await db
    .insert(materialNodes)
    .values({
      parentId,
      name,
      icon,
      scope,
      ownerId: scope === "MISTAKE" ? ownerId : null,
      // «Страница» — это FILE без fileKind: её открывает читалка фраз.
      type: kind === "PAGE" ? "FILE" : "FOLDER",
      sortOrder: (lastOrder ?? 0) + 1,
    })
    .returning();

  // Личное дерево ошибок никому не раздаётся — оно и так принадлежит ученику.
  if (!parentId && scope === "MATERIAL") await assignToAllStudents(row.id);

  revalidateMaterials();
  return { ok: true, nodeId: row.id };
}

/** Переименовать узел, сменить иконку и подзаголовок. */
export async function updateNodeAction(
  _prev: NodeState,
  formData: FormData,
): Promise<NodeState> {
  await requireTeacher();

  const nodeId = String(formData.get("nodeId") || "");
  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;

  if (!nodeId) return { error: "Не выбран элемент" };
  if (!name) return { error: "Введи название" };

  await db
    .update(materialNodes)
    .set({ name, icon, description })
    .where(eq(materialNodes.id, nodeId));

  revalidateMaterials();
  return { ok: true, nodeId };
}

/** Удалить узел вместе со всем содержимым. */
export async function deleteNodeAction(formData: FormData) {
  await requireTeacher();
  const nodeId = String(formData.get("nodeId") || "");
  if (!nodeId) return;

  // parentId не имеет внешнего ключа, поэтому потомков собираем вручную.
  const all = await db
    .select({ id: materialNodes.id, parentId: materialNodes.parentId })
    .from(materialNodes);

  const toDelete = new Set<string>([nodeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of all) {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        grew = true;
      }
    }
  }

  await db.delete(materialNodes).where(inArray(materialNodes.id, [...toDelete]));
  revalidateMaterials();
}

export type ParseState = {
  ok?: boolean;
  error?: string;
  message?: string;
  warnings?: string[];
};

/**
 * Разобрать вставленный текст и заменить им содержимое страницы.
 * Старые фразы страницы удаляются — это осознанная замена, а не дополнение.
 */
export async function savePageContentAction(
  _prev: ParseState,
  formData: FormData,
): Promise<ParseState> {
  await requireTeacher();

  const nodeId = String(formData.get("nodeId") || "");
  const mode = (String(formData.get("mode") || "vocabulary") as ParserMode) ?? "vocabulary";
  const raw = String(formData.get("raw") || "");
  const applyTitle = formData.get("applyTitle") === "on";

  if (!nodeId) return { error: "Не выбрана страница" };

  const result = parseMaterial(raw, mode);
  if (result.phrases.length === 0) {
    return { error: result.warnings[0] ?? "Не удалось разобрать текст" };
  }

  await db.delete(materialPhrases).where(eq(materialPhrases.nodeId, nodeId));

  await db.insert(materialPhrases).values(
    result.phrases.map((p, i) => ({
      nodeId,
      sortOrder: i + 1,
      icon: p.icon,
      phrase: p.phrase,
      transcription: p.transcription,
      translation: p.translation,
      section: p.section,
      kind: p.kind,
      examples: p.examples,
    })),
  );

  if (applyTitle && (result.title || result.description)) {
    await db
      .update(materialNodes)
      .set({
        ...(result.title ? { name: result.title } : {}),
        ...(result.description ? { description: result.description } : {}),
      })
      .where(eq(materialNodes.id, nodeId));
  }

  const count = result.phrases.filter((p) => p.kind === "PHRASE").length;
  const notes = result.phrases.filter((p) => p.kind === "NOTE").length;

  revalidateMaterials();
  return {
    ok: true,
    message: `Сохранено: ${count} записей${notes ? `, ${notes} заметок` : ""}`,
    warnings: result.warnings,
  };
}

/** Выдать ветку конкретному ученику (или снять доступ). */
export async function toggleAssignmentAction(formData: FormData) {
  await requireTeacher();
  const studentId = String(formData.get("studentId") || "");
  const nodeId = String(formData.get("nodeId") || "");
  const assign = formData.get("assign") === "on";
  if (!studentId || !nodeId) return;

  if (assign) {
    const [existing] = await db
      .select({ id: studentMaterials.id })
      .from(studentMaterials)
      .where(
        and(
          eq(studentMaterials.studentId, studentId),
          eq(studentMaterials.materialNodeId, nodeId),
        ),
      )
      .limit(1);
    if (!existing) {
      await db.insert(studentMaterials).values({ studentId, materialNodeId: nodeId });
    }
  } else {
    await db
      .delete(studentMaterials)
      .where(
        and(
          eq(studentMaterials.studentId, studentId),
          eq(studentMaterials.materialNodeId, nodeId),
        ),
      );
  }

  revalidateMaterials();
}
