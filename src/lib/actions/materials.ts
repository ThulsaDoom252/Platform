"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materialNodes,
  materialPhrases,
  materialBlocks,
  studentMaterials,
  users,
  type RuleBlock,
} from "@/lib/db/schema";
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

export type NewNode = { name: string; icon: string | null; description?: string | null };

export type CreateOptions = {
  parentId: string | null;
  kind: "FOLDER" | "PAGE";
  scope?: "MATERIAL" | "MISTAKE";
  ownerId?: string | null;
};

/**
 * Создать сразу несколько папок или страниц в одном месте.
 * Корневые разделы общей библиотеки сразу получают все ученики;
 * личное дерево ошибок никому не раздаётся — оно и так принадлежит ученику.
 */
export async function createNodesAction(
  items: NewNode[],
  opts: CreateOptions,
): Promise<BulkState> {
  await requireTeacher();

  const parentId = opts.parentId || null;
  const scope: "MATERIAL" | "MISTAKE" = opts.scope === "MISTAKE" ? "MISTAKE" : "MATERIAL";
  const ownerId = scope === "MISTAKE" ? opts.ownerId || null : null;
  const type: "FOLDER" | "FILE" = opts.kind === "PAGE" ? "FILE" : "FOLDER";

  const clean = (items ?? [])
    .map((i) => ({
      name: String(i?.name ?? "").trim().slice(0, 200),
      icon: i?.icon ? String(i.icon).slice(0, 16) : null,
      description: i?.description ? String(i.description).trim().slice(0, 500) : null,
    }))
    .filter((i) => i.name);

  if (clean.length === 0) return { error: "Введи название" };

  const [{ value: lastOrder } = { value: 0 }] = await db
    .select({ value: max(materialNodes.sortOrder) })
    .from(materialNodes)
    .where(
      parentId
        ? eq(materialNodes.parentId, parentId)
        : and(
            isNull(materialNodes.parentId),
            eq(materialNodes.scope, scope),
            ownerId ? eq(materialNodes.ownerId, ownerId) : isNull(materialNodes.ownerId),
          ),
    );

  const rows = await db
    .insert(materialNodes)
    .values(
      clean.map((i, idx) => ({
        parentId,
        name: i.name,
        icon: i.icon,
        description: i.description,
        scope,
        ownerId,
        // «Страница» — это FILE без fileKind: её открывает читалка.
        type,
        sortOrder: (lastOrder ?? 0) + idx + 1,
      })),
    )
    .returning({ id: materialNodes.id });

  if (!parentId && scope === "MATERIAL") {
    for (const r of rows) await assignToAllStudents(r.id);
  }

  revalidateMaterials();
  return { ok: true, message: `Создано: ${rows.length}` };
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

/**
 * Дополняет список узлов всеми их потомками.
 * `parentId` не имеет внешнего ключа, поэтому каскада нет — считаем вручную.
 */
async function withDescendants(ids: string[]): Promise<string[]> {
  const all = await db
    .select({ id: materialNodes.id, parentId: materialNodes.parentId })
    .from(materialNodes);

  const found = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of all) {
      if (n.parentId && found.has(n.parentId) && !found.has(n.id)) {
        found.add(n.id);
        grew = true;
      }
    }
  }
  return [...found];
}

/** Удалить узел вместе со всем содержимым. */
export async function deleteNodeAction(formData: FormData) {
  await requireTeacher();
  const nodeId = String(formData.get("nodeId") || "");
  if (!nodeId) return;

  await db
    .delete(materialNodes)
    .where(inArray(materialNodes.id, await withDescendants([nodeId])));
  revalidateMaterials();
}

export type BulkState = { ok?: boolean; error?: string; message?: string };

/** Удалить несколько выбранных узлов разом, каждый со своим содержимым. */
export async function deleteNodesAction(ids: string[]): Promise<BulkState> {
  await requireTeacher();

  const clean = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id))];
  if (clean.length === 0) return { error: "Ничего не выбрано" };

  const all = await withDescendants(clean);
  await db.delete(materialNodes).where(inArray(materialNodes.id, all));

  revalidateMaterials();
  return { ok: true, message: `Удалено: ${clean.length}` };
}

export type PhraseInput = {
  section: string | null;
  icon: string | null;
  phrase: string;
  transcription: string | null;
  translation: string;
  examples: { en: string; tr: string }[];
};

function cleanPhrase(p: PhraseInput): PhraseInput | null {
  const phrase = String(p?.phrase ?? "").trim().slice(0, 300);
  if (!phrase) return null;
  return {
    section: p.section ? String(p.section).trim().slice(0, 200) || null : null,
    icon: p.icon ? String(p.icon).slice(0, 16) : null,
    phrase,
    transcription: p.transcription ? String(p.transcription).trim().slice(0, 120) : null,
    translation: String(p?.translation ?? "").trim().slice(0, 600),
    examples: (Array.isArray(p?.examples) ? p.examples : [])
      .map((e) => ({
        en: String(e?.en ?? "").trim().slice(0, 600),
        tr: String(e?.tr ?? "").trim().slice(0, 600),
      }))
      .filter((e) => e.en)
      .slice(0, 10),
  };
}

/**
 * Расставляет записи указанных разделов по алфавиту и переписывает порядок.
 * Заметки 💡 алфавиту не подчиняются — они уходят в конец своего раздела.
 */
async function resortSections(nodeId: string, sections: Set<string | null>) {
  const rows = await db
    .select()
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, nodeId))
    .orderBy(asc(materialPhrases.sortOrder));

  const groups: { section: string | null; items: typeof rows }[] = [];
  for (const r of rows) {
    const key = r.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === key) last.items.push(r);
    else groups.push({ section: key, items: [r] });
  }

  const ordered = groups.flatMap((g) => {
    if (!sections.has(g.section)) return g.items;
    const words = g.items.filter((i) => i.kind !== "NOTE");
    const notes = g.items.filter((i) => i.kind === "NOTE");
    words.sort((a, b) => a.phrase.localeCompare(b.phrase, "en", { sensitivity: "base" }));
    return [...words, ...notes];
  });

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].sortOrder === i + 1) continue;
    await db
      .update(materialPhrases)
      .set({ sortOrder: i + 1 })
      .where(eq(materialPhrases.id, ordered[i].id));
  }
}

/** Добавить слова на страницу, не трогая уже существующие. */
export async function addPhrasesAction(
  nodeId: string,
  items: PhraseInput[],
): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбрана страница" };

  const clean = (items ?? []).map(cleanPhrase).filter((p): p is PhraseInput => !!p);
  if (clean.length === 0) return { error: "Нечего добавлять: пустое слово" };

  const [{ value: last } = { value: 0 }] = await db
    .select({ value: max(materialPhrases.sortOrder) })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, nodeId));

  await db.insert(materialPhrases).values(
    clean.map((p, i) => ({ nodeId, sortOrder: (last ?? 0) + i + 1, ...p })),
  );

  await resortSections(nodeId, new Set(clean.map((p) => p.section)));
  await db
    .update(materialNodes)
    .set({ pageKind: "VOCAB" })
    .where(eq(materialNodes.id, nodeId));

  revalidateMaterials();
  return { ok: true, message: `Добавлено: ${clean.length}` };
}

/** Изменить одно слово. */
export async function updatePhraseAction(
  phraseId: string,
  data: PhraseInput,
): Promise<BulkState> {
  await requireTeacher();
  if (!phraseId) return { error: "Не выбрана запись" };

  const clean = cleanPhrase(data);
  if (!clean) return { error: "Слово не может быть пустым" };

  const [row] = await db
    .update(materialPhrases)
    .set(clean)
    .where(eq(materialPhrases.id, phraseId))
    .returning({ nodeId: materialPhrases.nodeId });

  if (row) await resortSections(row.nodeId, new Set([clean.section]));

  revalidateMaterials();
  return { ok: true, message: "Сохранено" };
}

/** Удалить одно слово. */
export async function deletePhraseAction(phraseId: string): Promise<BulkState> {
  await requireTeacher();
  if (!phraseId) return { error: "Не выбрана запись" };

  await db.delete(materialPhrases).where(eq(materialPhrases.id, phraseId));

  revalidateMaterials();
  return { ok: true, message: "Удалено" };
}

/**
 * Убрать со страниц всё содержимое, оставив сами страницы на месте.
 * Страница бывает либо словником, либо правилом, поэтому чистим оба хранилища.
 */
export async function clearPagesAction(ids: string[]): Promise<BulkState> {
  await requireTeacher();

  const clean = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id))];
  if (clean.length === 0) return { error: "Ничего не выбрано" };

  await db.delete(materialPhrases).where(inArray(materialPhrases.nodeId, clean));
  await db.delete(materialBlocks).where(inArray(materialBlocks.nodeId, clean));

  revalidateMaterials();
  return {
    ok: true,
    message: clean.length === 1 ? "Страница очищена" : `Очищено страниц: ${clean.length}`,
  };
}

/**
 * Сменить иконки сразу нескольким узлам.
 * Одна иконка на всех и «каждому своя» — это один и тот же вызов,
 * клиент просто присылает разный список пар.
 */
export async function updateNodeIconsAction(
  entries: { id: string; icon: string }[],
): Promise<BulkState> {
  await requireTeacher();

  const clean = (entries ?? []).filter(
    (e) => e && typeof e.id === "string" && e.id && typeof e.icon === "string",
  );
  if (clean.length === 0) return { error: "Иконка не выбрана" };

  for (const e of clean) {
    await db
      .update(materialNodes)
      .set({ icon: e.icon.slice(0, 16) || null })
      .where(eq(materialNodes.id, e.id));
  }

  revalidateMaterials();
  return { ok: true, message: `Иконок обновлено: ${clean.length}` };
}

export type MoveState = { ok?: boolean; error?: string };

/**
 * Ученику выдаётся корневая ветка целиком, поэтому узел, уехавший внутрь
 * папки, не должен оставаться назначенным отдельно — иначе покажется дважды.
 */
async function syncRootAssignment(
  nodeId: string,
  parentId: string | null,
  scope: string,
) {
  if (scope !== "MATERIAL") return;
  if (parentId) {
    await db.delete(studentMaterials).where(eq(studentMaterials.materialNodeId, nodeId));
  } else {
    await assignToAllStudents(nodeId);
  }
}

/**
 * Перенести папку или страницу в другую папку либо в корень.
 * Ученику выдаётся корневая ветка целиком, поэтому назначения
 * пересобираем при каждом переносе — иначе узел покажется дважды.
 */
export async function moveNodeAction(
  nodeId: string,
  parentId: string | null,
): Promise<MoveState> {
  await requireTeacher();

  if (!nodeId) return { error: "Не выбран элемент" };
  if (nodeId === parentId) return { error: "Нельзя вложить элемент в самого себя" };

  const rows = await db
    .select({
      id: materialNodes.id,
      parentId: materialNodes.parentId,
      type: materialNodes.type,
      scope: materialNodes.scope,
      ownerId: materialNodes.ownerId,
    })
    .from(materialNodes);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const node = byId.get(nodeId);
  if (!node) return { error: "Элемент не найден" };
  if ((node.parentId ?? null) === parentId) return { ok: true };

  if (parentId) {
    const target = byId.get(parentId);
    if (!target) return { error: "Папка не найдена" };
    if (target.type !== "FOLDER") return { error: "Вложить можно только в папку" };
    if (target.scope !== node.scope || target.ownerId !== node.ownerId) {
      return { error: "Нельзя переносить между разделами" };
    }
    // Поднимаемся от цели вверх: встретили сам узел — получилось бы кольцо.
    for (let cur: string | null = target.parentId; cur; cur = byId.get(cur)?.parentId ?? null) {
      if (cur === nodeId) return { error: "Нельзя вложить папку в собственную подпапку" };
    }
  }

  const [{ value: lastOrder } = { value: 0 }] = await db
    .select({ value: max(materialNodes.sortOrder) })
    .from(materialNodes)
    .where(
      parentId
        ? eq(materialNodes.parentId, parentId)
        : and(
            isNull(materialNodes.parentId),
            eq(materialNodes.scope, node.scope),
            node.ownerId
              ? eq(materialNodes.ownerId, node.ownerId)
              : isNull(materialNodes.ownerId),
          ),
    );

  await db
    .update(materialNodes)
    .set({ parentId, sortOrder: (lastOrder ?? 0) + 1 })
    .where(eq(materialNodes.id, nodeId));

  await syncRootAssignment(nodeId, parentId, node.scope);

  revalidateMaterials();
  return { ok: true };
}

/**
 * Поставить узел рядом с другим — до или после него.
 * Новым родителем становится родитель цели, поэтому одним действием
 * и переставляем внутри папки, и переносим между папками.
 */
export async function reorderNodeAction(
  nodeId: string,
  targetId: string,
  position: "before" | "after",
): Promise<MoveState> {
  await requireTeacher();

  if (!nodeId || !targetId || nodeId === targetId) return { error: "Некуда переставлять" };

  const rows = await db
    .select({
      id: materialNodes.id,
      parentId: materialNodes.parentId,
      scope: materialNodes.scope,
      ownerId: materialNodes.ownerId,
      sortOrder: materialNodes.sortOrder,
      name: materialNodes.name,
    })
    .from(materialNodes);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const node = byId.get(nodeId);
  const target = byId.get(targetId);
  if (!node || !target) return { error: "Элемент не найден" };
  if (target.scope !== node.scope || target.ownerId !== node.ownerId) {
    return { error: "Нельзя переносить между разделами" };
  }

  const newParent = target.parentId ?? null;
  for (let cur: string | null = newParent; cur; cur = byId.get(cur)?.parentId ?? null) {
    if (cur === nodeId) return { error: "Нельзя вложить папку в собственную подпапку" };
  }

  const siblings = rows
    .filter(
      (r) =>
        r.id !== nodeId &&
        (r.parentId ?? null) === newParent &&
        r.scope === node.scope &&
        (r.ownerId ?? null) === (node.ownerId ?? null),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const at = siblings.findIndex((r) => r.id === targetId);
  if (at < 0) return { error: "Элемент не найден" };

  const index = position === "before" ? at : at + 1;
  const ordered = [...siblings.slice(0, index), node, ...siblings.slice(index)];

  // Переписываем порядок целиком: так не остаётся ни дыр, ни одинаковых номеров.
  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i];
    const order = i + 1;
    if (r.id === nodeId) {
      await db
        .update(materialNodes)
        .set({ parentId: newParent, sortOrder: order })
        .where(eq(materialNodes.id, r.id));
    } else if (r.sortOrder !== order) {
      await db
        .update(materialNodes)
        .set({ sortOrder: order })
        .where(eq(materialNodes.id, r.id));
    }
  }

  if ((node.parentId ?? null) !== newParent) {
    await syncRootAssignment(nodeId, newParent, node.scope);
  }

  revalidateMaterials();
  return { ok: true };
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

  await db
    .update(materialNodes)
    .set({
      // Страница запоминает, чем её наполнили, и исходник для «Редактировать».
      pageKind: mode === "mistake" ? "MISTAKE" : mode === "rule" ? "RULE" : "VOCAB",
      sourceText: raw.slice(0, 200_000),
      ...(applyTitle && result.title ? { name: result.title } : {}),
      ...(applyTitle && result.description ? { description: result.description } : {}),
    })
    .where(eq(materialNodes.id, nodeId));

  const count = result.phrases.filter((p) => p.kind === "PHRASE").length;
  const notes = result.phrases.filter((p) => p.kind === "NOTE").length;

  revalidateMaterials();
  return {
    ok: true,
    message: `Сохранено: ${count} записей${notes ? `, ${notes} заметок` : ""}`,
    warnings: result.warnings,
  };
}

const MAX_TEXT = 4000;
const MAX_BLOCKS = 400;

function str(v: unknown): string {
  return typeof v === "string" ? v.slice(0, MAX_TEXT) : "";
}

/**
 * Блоки приходят из браузера (там разбирается HTML буфера обмена),
 * поэтому форму данных проверяем на сервере, а не доверяем клиенту.
 */
function sanitizeBlocks(input: unknown): RuleBlock[] {
  if (!Array.isArray(input)) return [];
  const out: RuleBlock[] = [];

  for (const raw of input.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;

    switch (b.type) {
      case "heading":
      case "formula":
      case "text": {
        const text = str(b.text);
        if (text) out.push({ type: b.type, text });
        break;
      }
      case "callout": {
        const text = str(b.text);
        if (!text) break;
        const tone = ["key", "warn", "tip", "info"].includes(String(b.tone))
          ? (b.tone as "key" | "warn" | "tip" | "info")
          : "info";
        const label = str(b.label);
        out.push({ type: "callout", text, tone, ...(label ? { label } : {}) });
        break;
      }
      case "example": {
        const en = str(b.en);
        if (!en) break;
        const tr = str(b.tr);
        out.push({ type: "example", en, ...(tr ? { tr } : {}) });
        break;
      }
      case "list": {
        const items = Array.isArray(b.items)
          ? b.items.map(str).filter(Boolean).slice(0, 100)
          : [];
        if (items.length) out.push({ type: "list", items });
        break;
      }
      case "table": {
        const headers = Array.isArray(b.headers)
          ? b.headers.map(str).slice(0, 10)
          : [];
        const rows = Array.isArray(b.rows)
          ? b.rows
              .filter(Array.isArray)
              .map((r) => (r as unknown[]).map(str).slice(0, 10))
              .slice(0, 200)
          : [];
        if (headers.length || rows.length) out.push({ type: "table", headers, rows });
        break;
      }
    }
  }
  return out;
}

export type BlocksState = { ok?: boolean; error?: string; message?: string };

/** Сохранить правило: блоки полностью заменяют прежнее содержимое страницы. */
export async function saveRuleBlocksAction(
  _prev: BlocksState,
  formData: FormData,
): Promise<BlocksState> {
  await requireTeacher();

  const nodeId = String(formData.get("nodeId") || "");
  const applyTitle = formData.get("applyTitle") === "on";
  const title = String(formData.get("title") || "").trim();
  const subtitle = String(formData.get("subtitle") || "").trim();

  if (!nodeId) return { error: "Не выбрана страница" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("blocks") || "[]"));
  } catch {
    return { error: "Не удалось прочитать разобранное содержимое" };
  }

  const blocks = sanitizeBlocks(parsed);
  if (blocks.length === 0) return { error: "Пустое правило — нечего сохранять" };

  // Страница может быть либо правилом, либо словником — чистим оба хранилища.
  await db.delete(materialBlocks).where(eq(materialBlocks.nodeId, nodeId));
  await db.delete(materialPhrases).where(eq(materialPhrases.nodeId, nodeId));

  await db.insert(materialBlocks).values(
    blocks.map((b, i) => ({ nodeId, sortOrder: i + 1, type: b.type, data: b })),
  );

  await db
    .update(materialNodes)
    .set({
      pageKind: "RULE",
      sourceText: String(formData.get("sourceText") || "").slice(0, 200_000),
      ...(applyTitle && title ? { name: title } : {}),
      ...(applyTitle && subtitle ? { description: subtitle } : {}),
    })
    .where(eq(materialNodes.id, nodeId));

  const tables = blocks.filter((b) => b.type === "table").length;
  revalidateMaterials();
  return {
    ok: true,
    message: `Сохранено: ${blocks.length} блоков${tables ? `, таблиц: ${tables}` : ""}`,
  };
}

/**
 * Сохранить правило после ручной правки.
 * Блоки приходят уже разобранными, поэтому проверяем их так же строго,
 * как и при вставке из буфера.
 */
export async function saveRuleEditAction(
  nodeId: string,
  blocks: unknown,
  sourceText: string,
): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбрана страница" };

  const clean = sanitizeBlocks(blocks);
  if (clean.length === 0) return { error: "Пустое правило — нечего сохранять" };

  await db.delete(materialBlocks).where(eq(materialBlocks.nodeId, nodeId));
  await db.delete(materialPhrases).where(eq(materialPhrases.nodeId, nodeId));

  await db.insert(materialBlocks).values(
    clean.map((b, i) => ({ nodeId, sortOrder: i + 1, type: b.type, data: b })),
  );

  await db
    .update(materialNodes)
    .set({ pageKind: "RULE", sourceText: String(sourceText ?? "").slice(0, 200_000) })
    .where(eq(materialNodes.id, nodeId));

  revalidateMaterials();
  return { ok: true, message: `Сохранено блоков: ${clean.length}` };
}

// ---------------------------------------------------------------- копирование

export type CopyNode = {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  type: "FOLDER" | "FILE";
};

/** Дерево, в которое можно скопировать: общая библиотека или ошибки ученика. */
export type CopyTree = {
  key: string;
  label: string;
  scope: "MATERIAL" | "MISTAKE";
  ownerId: string | null;
  nodes: CopyNode[];
};

/** Все деревья, доступные как место назначения. */
export async function listCopyTargetsAction(): Promise<CopyTree[]> {
  await requireTeacher();

  const rows = await db
    .select({
      id: materialNodes.id,
      parentId: materialNodes.parentId,
      name: materialNodes.name,
      icon: materialNodes.icon,
      type: materialNodes.type,
      scope: materialNodes.scope,
      ownerId: materialNodes.ownerId,
      sortOrder: materialNodes.sortOrder,
    })
    .from(materialNodes)
    .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name));

  const students = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "STUDENT"));

  const pick = (scope: string, ownerId: string | null) =>
    rows
      .filter((r) => r.scope === scope && (r.ownerId ?? null) === ownerId)
      .map(({ id, parentId, name, icon, type }) => ({
        id,
        parentId,
        name,
        icon,
        type: type as "FOLDER" | "FILE",
      }));

  return [
    {
      key: "material",
      label: "Общая библиотека",
      scope: "MATERIAL" as const,
      ownerId: null,
      nodes: pick("MATERIAL", null),
    },
    ...students.map((s) => ({
      key: `mistake-${s.id}`,
      label: `Ошибки — ${s.name}`,
      scope: "MISTAKE" as const,
      ownerId: s.id,
      nodes: pick("MISTAKE", s.id),
    })),
  ];
}

export type CopyInput = {
  /** Что копируем — выбранные узлы верхнего уровня. */
  ids: string[];
  /** Какие вложенные узлы взять с собой. Пусто — только сами выбранные. */
  includeIds: string[];
  targetParentId: string | null;
  targetScope: "MATERIAL" | "MISTAKE";
  targetOwnerId: string | null;
  /** Повторить в месте назначения цепочку родительских папок. */
  keepPath: boolean;
};

/**
 * Копирует узлы вместе с содержимым в другое место — хоть в дерево
 * другого ученика. Оригиналы не трогаются, у копий новые id.
 */
export async function copyNodesAction(input: CopyInput): Promise<BulkState> {
  await requireTeacher();

  const roots = [...new Set((input?.ids ?? []).filter(Boolean))];
  if (roots.length === 0) return { error: "Нечего копировать" };

  const scope: "MATERIAL" | "MISTAKE" =
    input.targetScope === "MISTAKE" ? "MISTAKE" : "MATERIAL";
  const ownerId = scope === "MISTAKE" ? input.targetOwnerId || null : null;
  const targetParentId = input.targetParentId || null;

  const all = await db.select().from(materialNodes);
  const byId = new Map(all.map((n) => [n.id, n]));
  const include = new Set(input.includeIds ?? []);

  if (targetParentId) {
    const target = byId.get(targetParentId);
    if (!target) return { error: "Папка назначения не найдена" };
    if (target.type !== "FOLDER") return { error: "Копировать можно только в папку" };
    if (target.scope !== scope || (target.ownerId ?? null) !== ownerId) {
      return { error: "Папка назначения из другого дерева" };
    }
    // Внутрь самого себя копировать нельзя — получилось бы бесконечно.
    for (let cur: string | null = targetParentId; cur; cur = byId.get(cur)?.parentId ?? null) {
      if (roots.includes(cur)) {
        return { error: "Нельзя копировать ветку внутрь себя самой" };
      }
    }
  }

  /** Следующий свободный номер в папке назначения. */
  async function nextOrder(parentId: string | null): Promise<number> {
    const [{ value } = { value: 0 }] = await db
      .select({ value: max(materialNodes.sortOrder) })
      .from(materialNodes)
      .where(
        parentId
          ? eq(materialNodes.parentId, parentId)
          : and(
              isNull(materialNodes.parentId),
              eq(materialNodes.scope, scope),
              ownerId ? eq(materialNodes.ownerId, ownerId) : isNull(materialNodes.ownerId),
            ),
      );
    return (value ?? 0) + 1;
  }

  /** Папка с таким именем в месте назначения — иначе заводим новую. */
  async function ensureFolder(name: string, icon: string | null, parentId: string | null) {
    const existing = all.find(
      (n) =>
        n.type === "FOLDER" &&
        n.name === name &&
        (n.parentId ?? null) === parentId &&
        n.scope === scope &&
        (n.ownerId ?? null) === ownerId,
    );
    if (existing) return existing.id;

    const [row] = await db
      .insert(materialNodes)
      .values({
        parentId,
        name,
        icon,
        scope,
        ownerId,
        type: "FOLDER",
        sortOrder: await nextOrder(parentId),
      })
      .returning();
    all.push(row);
    byId.set(row.id, row);
    if (!parentId && scope === "MATERIAL") await assignToAllStudents(row.id);
    return row.id;
  }

  /** src → копия: по этой паре потом переносим содержимое страниц. */
  const pairs: { srcId: string; newId: string }[] = [];

  async function copyNode(srcId: string, parentId: string | null) {
    const src = byId.get(srcId);
    if (!src) return;

    const [row] = await db
      .insert(materialNodes)
      .values({
        parentId,
        name: src.name,
        icon: src.icon,
        description: src.description,
        imageUrl: src.imageUrl,
        scope,
        ownerId,
        type: src.type,
        fileUrl: src.fileUrl,
        fileKind: src.fileKind,
        category: src.category,
        sizeLabel: src.sizeLabel,
        pageKind: src.pageKind,
        sourceText: src.sourceText,
        sortOrder: await nextOrder(parentId),
      })
      .returning();

    pairs.push({ srcId, newId: row.id });
    if (!parentId && scope === "MATERIAL") await assignToAllStudents(row.id);

    for (const child of all.filter((n) => n.parentId === srcId)) {
      if (include.has(child.id)) await copyNode(child.id, row.id);
    }
  }

  for (const rootId of roots) {
    let parentId = targetParentId;

    if (input.keepPath) {
      // Цепочка родителей оригинала, сверху вниз.
      const chain: typeof all = [];
      for (
        let cur: string | null = byId.get(rootId)?.parentId ?? null;
        cur;
        cur = byId.get(cur)?.parentId ?? null
      ) {
        const node = byId.get(cur);
        if (node) chain.unshift(node);
      }
      for (const folder of chain) {
        parentId = await ensureFolder(folder.name, folder.icon, parentId);
      }
    }

    await copyNode(rootId, parentId);
  }

  // Содержимое страниц переносим одним заходом.
  const srcIds = pairs.map((p) => p.srcId);
  if (srcIds.length) {
    const idOf = new Map(pairs.map((p) => [p.srcId, p.newId]));

    const phrases = await db
      .select()
      .from(materialPhrases)
      .where(inArray(materialPhrases.nodeId, srcIds));
    if (phrases.length) {
      await db.insert(materialPhrases).values(
        phrases.map(({ id: _id, createdAt: _c, nodeId, ...rest }) => ({
          ...rest,
          nodeId: idOf.get(nodeId)!,
        })),
      );
    }

    const blocks = await db
      .select()
      .from(materialBlocks)
      .where(inArray(materialBlocks.nodeId, srcIds));
    if (blocks.length) {
      await db.insert(materialBlocks).values(
        blocks.map(({ id: _id, createdAt: _c, nodeId, ...rest }) => ({
          ...rest,
          nodeId: idOf.get(nodeId)!,
        })),
      );
    }
  }

  revalidateMaterials();
  return { ok: true, message: `Скопировано элементов: ${pairs.length}` };
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
