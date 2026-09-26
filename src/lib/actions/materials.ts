"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materialNodes,
  materialPhrases,
  materialBlocks,
  studentMaterials,
  users,
  lessons,
  type RuleBlock,
  type ContentBackup,
  type RuleBlockVariant,
} from "@/lib/db/schema";
import {
  getOwnedTree,
  getMaterialsTree,
  type MaterialNode,
  type MaterialPhrase,
} from "@/lib/materials";
import { getSession } from "@/lib/session";
import { parseMaterial, type ParserMode } from "@/lib/materials-parser";
import { parseRuleText } from "@/lib/rule-parser";
import {
  ruleHasFormattingIssue,
  vocabularyHasFormattingIssue,
} from "@/lib/material-formatting";
import { transcribe } from "@/lib/transcription";
import { checkSpelling, type Misspelling } from "@/lib/spellcheck";
import { mergeImportTrees, splitIcon, type ImportNode } from "@/lib/tree-import";
import { parseImportedFileContent } from "@/lib/material-import-content";
import {
  isSafeAutomaticIcon,
  suggestVocabularyIcon,
  vocabularyFallbackIcon,
} from "@/lib/icon-suggest";
import { suggestVocabularyIconsWithAi } from "@/lib/vocabulary-icon-ai";
import {
  translateMaterialText,
  translateRuleBlocks,
  translateVocabulary,
  type MaterialTranslationLang,
  type VocabularyTranslationInput,
} from "@/lib/material-translation";

export type { Misspelling };

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

export type NodeState = { ok?: boolean; error?: string; nodeId?: string };

export type NewNode = { name: string; icon: string | null; description?: string | null };

/**
 * MATERIAL  — общая база, её разделы выдаются выбранным ученикам.
 * PERSONAL  — база учителя, ученики её не видят вовсе.
 * STUDENT   — личные материалы конкретного ученика, своя структура.
 * MISTAKE   — его же дерево ошибок.
 *
 * Деревья независимы: перестановки в одном не задевают остальные,
 * материалы переносятся между ними копированием.
 */
export type NodeScope = "MATERIAL" | "PERSONAL" | "STUDENT" | "MISTAKE";

/**
 * Удаление материалов всегда обратимое: узлы остаются в базе вместе со
 * словами, правилами и структурой, но пропадают из активного дерева.
 */
const archivedScope = (scope: NodeScope) => `ARCHIVED_${scope}`;

/** У личных деревьев есть владелец, у общей базы — нет. */
const isOwned = (scope: NodeScope) => scope !== "MATERIAL";

const OWNED_SCOPES = ["MISTAKE", "PERSONAL", "STUDENT"];

function asScope(value: unknown): NodeScope {
  return OWNED_SCOPES.includes(String(value)) ? (value as NodeScope) : "MATERIAL";
}

export type CreateOptions = {
  parentId: string | null;
  kind: "FOLDER" | "PAGE";
  scope?: NodeScope;
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
  const scope = asScope(opts.scope);
  const ownerId = isOwned(scope) ? opts.ownerId || null : null;
  const type: "FOLDER" | "FILE" = opts.kind === "PAGE" ? "FILE" : "FOLDER";

  const clean = (items ?? [])
    .map((i) => ({
      name: String(i?.name ?? "").trim().slice(0, 200),
      // Сложные emoji (семьи, профессии, региональные флаги) состоят из
      // нескольких code point и легко превышают 16 UTF-16 символов.
      icon: i?.icon ? String(i.icon).slice(0, 64) : null,
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

  // Разделы общей базы никому не раздаются сами — доступ выдаёт учитель.

  revalidateMaterials();
  return { ok: true, message: `Создано: ${rows.length}` };
}

export type ImportSummary = {
  created: number;
  reused: number;
  /** Файлы, содержимое которых сразу разобрано и сохранено. */
  parsed?: number;
  /** Файлы с текстом, который не удалось безопасно разобрать. */
  parseFailed?: number;
  /** Одноимённые файлы, которые были объединены без удаления старого содержимого. */
  mergedFiles?: number;
  /** Разобрано, но парсер оставил предупреждения для ручной проверки. */
  parsedWithWarnings?: number;
  error?: string;
  /** Упёрлись в потолок — часть дерева не завелась, надо сказать вслух. */
  truncated?: boolean;
};

/** Сколько узлов разрешаем завести за один раз и как глубоко лезем. */
const IMPORT_LIMIT = 500;
const IMPORT_DEPTH = 8;

/** Имя для сравнения: без значка, без лишних пробелов, без регистра. */
function matchKey(name: string, icon?: string | null) {
  const bare = icon ? name : splitIcon(name).name;
  return bare.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Завести дерево целиком, дополняя то, что уже есть.
 *
 * Совпадение ищем по названию среди соседей: папки дополняем детьми,
 * файлы объединяем добавлением новых фраз/блоков без удаления старых.
 * Поэтому повторная часть структуры не создаёт дублей рядом.
 */
export async function importTreeAction(
  nodes: ImportNode[],
  opts: {
    parentId: string | null;
    scope?: NodeScope;
    ownerId?: string | null;
    parseContents?: boolean;
  },
): Promise<ImportSummary> {
  await requireTeacher();

  const scope = asScope(opts.scope);
  const ownerId = isOwned(scope) ? opts.ownerId || null : null;

  let created = 0;
  let reused = 0;
  let truncated = false;
  let parsed = 0;
  let parseFailed = 0;
  let mergedFiles = 0;
  let parsedWithWarnings = 0;

  type ExistingFile = {
    pageKind: string | null;
    sourceText: string | null;
    formattingIssue: boolean;
  };

  const cleanKey = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase();
  const phraseMergeKey = (phrase: {
    phrase: string;
    transcription?: string | null;
    translation?: string | null;
    section?: string | null;
    kind?: string | null;
    examples?: unknown;
  }) =>
    JSON.stringify([
      cleanKey(phrase.phrase),
      cleanKey(phrase.transcription),
      cleanKey(phrase.translation),
      cleanKey(phrase.section),
      cleanKey(phrase.kind),
      phrase.examples ?? [],
    ]);

  /**
   * Наполняет новый файл или добавляет в существующий только новые элементы.
   * Старые фразы, блоки и исходник никогда не удаляются и не заменяются.
   */
  async function fillFile(
    id: string,
    item: ImportNode,
    path: string[],
    existingFile?: ExistingFile,
  ) {
    if (!opts.parseContents || typeof item.content !== "string" || !item.content.trim()) return;

    const preferredKind =
      existingFile?.pageKind === "RULE" ||
      existingFile?.pageKind === "VOCAB" ||
      existingFile?.pageKind === "MISTAKE"
        ? existingFile.pageKind
        : null;
    const result = parseImportedFileContent(item.content, path, scope, preferredKind);
    if ("error" in result) {
      parseFailed++;
      return;
    }

    await db.transaction(async (tx) => {
      if (result.kind === "RULE") {
        const blocks = sanitizeBlocks(result.blocks);
        if (blocks.length === 0) throw new Error("Правило разобралось без содержимого");
        const oldBlocks = existingFile
          ? await tx
              .select({ sortOrder: materialBlocks.sortOrder, data: materialBlocks.data })
              .from(materialBlocks)
              .where(eq(materialBlocks.nodeId, id))
          : [];
        const known = new Set(oldBlocks.map((block) => JSON.stringify(block.data)));
        const fresh = blocks.filter((block) => {
          const key = JSON.stringify(block);
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        const start = oldBlocks.reduce((value, block) => Math.max(value, block.sortOrder), 0);
        if (fresh.length > 0) {
          await tx.insert(materialBlocks).values(
            fresh.map((block, index) => ({
              nodeId: id,
              sortOrder: start + index + 1,
              type: block.type,
              data: block,
            })),
          );
        }
      } else {
        const phrases = result.phrases.slice(0, 2_000);
        if (phrases.length === 0) throw new Error("Словарь разобрался без записей");
        const oldPhrases = existingFile
          ? await tx
              .select({
                sortOrder: materialPhrases.sortOrder,
                phrase: materialPhrases.phrase,
                transcription: materialPhrases.transcription,
                translation: materialPhrases.translation,
                section: materialPhrases.section,
                kind: materialPhrases.kind,
                examples: materialPhrases.examples,
              })
              .from(materialPhrases)
              .where(eq(materialPhrases.nodeId, id))
          : [];
        const known = new Set(oldPhrases.map(phraseMergeKey));
        const fresh = phrases.filter((phrase) => {
          const key = phraseMergeKey(phrase);
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        const start = oldPhrases.reduce((value, phrase) => Math.max(value, phrase.sortOrder), 0);
        if (fresh.length > 0) {
          await tx.insert(materialPhrases).values(
            fresh.map((phrase, index) => ({
              nodeId: id,
              sortOrder: start + index + 1,
              icon: phrase.icon,
              phrase: phrase.phrase,
              transcription: phrase.transcription,
              translation: phrase.translation,
              section: phrase.section,
              kind: phrase.kind,
              examples: phrase.examples,
            })),
          );
        }
      }

      const oldSource = existingFile?.sourceText?.trim() ?? "";
      const incomingSource = result.sourceText.trim();
      const sourceText =
        !oldSource || oldSource === incomingSource || oldSource.includes(incomingSource)
          ? oldSource || incomingSource
          : incomingSource.includes(oldSource)
            ? incomingSource
            : `${oldSource}\n\n${incomingSource}`;

      await tx
        .update(materialNodes)
        .set({
          pageKind: existingFile?.pageKind || result.kind,
          sourceText,
          formattingIssue:
            !!existingFile?.formattingIssue || result.warnings.length > 0,
        })
        .where(eq(materialNodes.id, id));
    });

    parsed++;
    if (result.warnings.length > 0) parsedWithWarnings++;
  }

  async function level(
    items: ImportNode[],
    parentId: string | null,
    depth: number,
    path: string[],
  ) {
    if (items.length === 0) return;
    // Слишком глубоко — дальше не лезем, но и молчать об этом не станем.
    if (depth > IMPORT_DEPTH) {
      truncated = true;
      return;
    }

    const existing = await db
      .select({
        id: materialNodes.id,
        name: materialNodes.name,
        icon: materialNodes.icon,
        type: materialNodes.type,
        pageKind: materialNodes.pageKind,
        sourceText: materialNodes.sourceText,
        formattingIssue: materialNodes.formattingIssue,
        mergeCount: materialNodes.mergeCount,
      })
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

    const byName = new Map(existing.map((e) => [matchKey(e.name, e.icon), e]));

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

    let order = lastOrder ?? 0;

    for (const item of items) {
      const name = String(item?.name ?? "").trim().slice(0, 200);
      if (!name) continue;
      const children = Array.isArray(item.children) ? item.children : [];
      // Дети есть — значит папка, что бы ни стояло в разметке.
      const type: "FOLDER" | "FILE" =
        children.length > 0 || item.kind === "FOLDER" ? "FOLDER" : "FILE";

      const hit = byName.get(matchKey(name));
      let id: string;

      if (hit) {
        reused++;
        id = hit.id;
        const fileCollision = type === "FILE" && hit.type === "FILE";
        if (fileCollision) {
          const incomingCount = Math.min(
            99,
            Math.max(1, Math.trunc(Number(item.mergeCount) || 1)),
          );
          hit.mergeCount = Math.min(99, Math.max(1, hit.mergeCount) + incomingCount);
          await db
            .update(materialNodes)
            .set({ mergeCount: hit.mergeCount })
            .where(eq(materialNodes.id, hit.id));
          mergedFiles++;
          try {
            await fillFile(id, item, [...path, name], hit);
          } catch (error) {
            console.error(`Не удалось объединить импортированный файл «${name}»:`, error);
            parseFailed++;
          }
        }
        // Прошлый раз это был лист, а теперь к нему приехали дети —
        // значит на деле это папка. Иначе они повисли бы внутри файла.
        if (children.length > 0 && hit.type !== "FOLDER") {
          await db
            .update(materialNodes)
            .set({ type: "FOLDER" })
            .where(eq(materialNodes.id, hit.id));
        }
      } else {
        if (created >= IMPORT_LIMIT) {
          truncated = true;
          continue;
        }
        order++;
        const [row] = await db
          .insert(materialNodes)
          .values({
            parentId,
            name,
            icon: item.icon ? String(item.icon).slice(0, 64) : null,
            scope,
            ownerId,
            type,
            sortOrder: order,
            mergeCount:
              type === "FILE"
                ? Math.min(99, Math.max(1, Math.trunc(Number(item.mergeCount) || 1)))
                : 1,
          })
          .returning({ id: materialNodes.id });

        created++;
        id = row.id;
        const importedMergeCount =
          type === "FILE"
            ? Math.min(99, Math.max(1, Math.trunc(Number(item.mergeCount) || 1)))
            : 1;
        byName.set(matchKey(name), {
          id,
          name,
          icon: item.icon ?? null,
          type,
          pageKind: null,
          sourceText: null,
          formattingIssue: false,
          mergeCount: importedMergeCount,
        });
        if (importedMergeCount > 1) mergedFiles++;

        if (type === "FILE") {
          try {
            await fillFile(id, item, [...path, name]);
          } catch (error) {
            console.error(`Не удалось наполнить импортированный файл «${name}»:`, error);
            parseFailed++;
          }
        }
      }

      // В файл вкладывать нечего: дети идут только в папку.
      if (children.length > 0 && type === "FOLDER") {
        await level(children, id, depth + 1, [...path, name]);
      }
    }
  }

  // Клиент уже показывает объединённый предпросмотр, но сервер повторяет
  // слияние сам: входящим данным доверять нельзя, а дубли не должны съедать лимит.
  const prepared = mergeImportTrees(Array.isArray(nodes) ? nodes : []);
  await level(prepared, opts.parentId || null, 0, []);

  if (created === 0 && reused === 0) {
    return { created: 0, reused: 0, error: "Нечего создавать" };
  }

  revalidateMaterials();
  return {
    created,
    reused,
    parsed,
    parseFailed,
    mergedFiles,
    parsedWithWarnings,
    truncated,
  };
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

/** Спрятать узлы в архив, не удаляя их содержимое из базы. */
async function archiveNodes(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const rows = await db
    .select({ id: materialNodes.id, scope: materialNodes.scope })
    .from(materialNodes)
    .where(inArray(materialNodes.id, ids));

  let archived = 0;
  for (const scope of ["MATERIAL", "PERSONAL", "STUDENT", "MISTAKE"] as const) {
    const scopeIds = rows.filter((row) => row.scope === scope).map((row) => row.id);
    if (scopeIds.length === 0) continue;

    const changed = await db
      .update(materialNodes)
      .set({ scope: archivedScope(scope) })
      .where(inArray(materialNodes.id, scopeIds))
      .returning({ id: materialNodes.id });
    archived += changed.length;
  }

  return archived;
}

/** Убрать узел и всё его содержимое в восстанавливаемый архив. */
export async function deleteNodeAction(formData: FormData) {
  await requireTeacher();
  const nodeId = String(formData.get("nodeId") || "");
  if (!nodeId) return;

  await archiveNodes(await withDescendants([nodeId]));
  revalidateMaterials();
}

export type BulkState = { ok?: boolean; error?: string; message?: string };

/**
 * Поставить или снять внутреннюю отметку «нужно исправить».
 * Это состояние доступно только учителю и не меняет сам материал.
 */
export async function setMaterialsNeedsFixAction(
  ids: string[],
  needsFix: boolean,
): Promise<BulkState> {
  await requireTeacher();

  const clean = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id))];
  if (clean.length === 0) return { error: "Ничего не выбрано" };

  const updated = await db
    .update(materialNodes)
    .set({ needsFix: !!needsFix })
    .where(inArray(materialNodes.id, clean))
    .returning({ id: materialNodes.id });

  if (updated.length === 0) return { error: "Материалы не найдены" };

  revalidateMaterials();
  return {
    ok: true,
    message: needsFix
      ? updated.length === 1
        ? "Отмечено красным: нужно исправить"
        : `Отмечено красным: ${updated.length}`
      : updated.length === 1
        ? "Красная отметка снята"
        : `Красных отметок снято: ${updated.length}`,
  };
}

type FormattingTarget = { scope: NodeScope; ownerId: string | null };

/**
 * Сервер сам фиксирует точную базу, которую разрешено проверять. Это не даёт
 * подменённому запросу случайно просканировать другое дерево ученика.
 */
async function formattingTarget(
  rawScope: unknown,
  rawOwnerId?: unknown,
): Promise<FormattingTarget | null> {
  const session = await requireTeacher();
  const scope = String(rawScope);
  if (!(["MATERIAL", "PERSONAL", "STUDENT", "MISTAKE"] as string[]).includes(scope)) {
    return null;
  }

  if (scope === "MATERIAL") return { scope, ownerId: null };
  if (scope === "PERSONAL") return { scope, ownerId: session.userId };

  const ownerId = String(rawOwnerId ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
    return null;
  }
  const [student] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, ownerId), eq(users.role, "STUDENT")))
    .limit(1);
  return student ? { scope: scope as NodeScope, ownerId } : null;
}

const formattingTreeWhere = ({ scope, ownerId }: FormattingTarget) =>
  and(
    eq(materialNodes.scope, scope),
    ownerId ? eq(materialNodes.ownerId, ownerId) : isNull(materialNodes.ownerId),
  );

export type FormattingScanState = BulkState & {
  checked?: number;
  issues?: number;
  ignored?: number;
};

/**
 * Пройти по всем страницам ровно одного дерева и сохранить результат.
 * Содержимое материалов здесь только читается; меняются лишь жёлтые отметки.
 */
export async function scanTreeFormattingAction(
  scope: NodeScope,
  ownerId?: string | null,
): Promise<FormattingScanState> {
  const target = await formattingTarget(scope, ownerId);
  if (!target) return { error: "Не удалось определить дерево для проверки" };

  const nodes = await db
    .select({
      id: materialNodes.id,
      pageKind: materialNodes.pageKind,
      sourceText: materialNodes.sourceText,
      fileKind: materialNodes.fileKind,
      ignored: materialNodes.formattingScanIgnored,
    })
    .from(materialNodes)
    .where(and(formattingTreeWhere(target), eq(materialNodes.type, "FILE")));

  const active = nodes.filter((node) => !node.ignored);
  const ignored = nodes.length - active.length;
  if (active.length === 0) {
    return {
      ok: true,
      checked: 0,
      issues: 0,
      ignored,
      message: ignored
        ? `Проверять нечего · исключено: ${ignored}`
        : "В этом дереве пока нет файлов для проверки",
    };
  }

  const ids = active.map((node) => node.id);
  const [phraseRows, blockRows] = await Promise.all([
    db
      .select()
      .from(materialPhrases)
      .where(inArray(materialPhrases.nodeId, ids))
      .orderBy(asc(materialPhrases.sortOrder)),
    db
      .select()
      .from(materialBlocks)
      .where(inArray(materialBlocks.nodeId, ids))
      .orderBy(asc(materialBlocks.sortOrder)),
  ]);

  const phrases = new Map<string, typeof phraseRows>();
  for (const row of phraseRows) {
    const list = phrases.get(row.nodeId) ?? [];
    list.push(row);
    phrases.set(row.nodeId, list);
  }
  const blocks = new Map<string, RuleBlock[]>();
  for (const row of blockRows) {
    const list = blocks.get(row.nodeId) ?? [];
    list.push(row.data as RuleBlock);
    blocks.set(row.nodeId, list);
  }

  const issueIds: string[] = [];
  const cleanIds: string[] = [];
  let checked = 0;

  for (const node of active) {
    const nodePhrases = phrases.get(node.id) ?? [];
    const nodeBlocks = blocks.get(node.id) ?? [];
    const kind =
      node.pageKind === "RULE" || node.pageKind === "VOCAB" || node.pageKind === "MISTAKE"
        ? node.pageKind
        : nodeBlocks.length > 0
          ? "RULE"
          : nodePhrases.length > 0
            ? "VOCAB"
            : null;

    // Загруженные PDF/DOC и ещё не наполненные страницы форматировать нечем.
    if (!kind || (node.fileKind && nodePhrases.length === 0 && nodeBlocks.length === 0)) {
      cleanIds.push(node.id);
      continue;
    }

    checked++;
    const issue =
      kind === "RULE"
        ? ruleHasFormattingIssue(node.sourceText, nodeBlocks)
        : vocabularyHasFormattingIssue(
            node.sourceText,
            nodePhrases.map((row) => ({
              phrase: row.phrase,
              transcription: row.transcription,
              translation: row.translation,
              section: row.section,
              kind: row.kind,
              examples: row.examples ?? [],
            })),
            kind === "MISTAKE" ? "mistake" : "vocabulary",
          );
    (issue ? issueIds : cleanIds).push(node.id);
  }

  await db.transaction(async (tx) => {
    if (issueIds.length > 0) {
      await tx
        .update(materialNodes)
        .set({ formattingIssue: true })
        .where(inArray(materialNodes.id, issueIds));
    }
    if (cleanIds.length > 0) {
      await tx
        .update(materialNodes)
        .set({ formattingIssue: false })
        .where(inArray(materialNodes.id, cleanIds));
    }
  });

  revalidateMaterials();
  return {
    ok: true,
    checked,
    issues: issueIds.length,
    ignored,
    message: issueIds.length
      ? `Проверено: ${checked} · найдено проблем: ${issueIds.length}${ignored ? ` · исключено: ${ignored}` : ""}`
      : `Проверено: ${checked} · проблем не найдено${ignored ? ` · исключено: ${ignored}` : ""}`,
  };
}

/** Снять все жёлтые результаты в одном дереве, не меняя список исключений. */
export async function clearTreeFormattingMarksAction(
  scope: NodeScope,
  ownerId?: string | null,
): Promise<BulkState> {
  const target = await formattingTarget(scope, ownerId);
  if (!target) return { error: "Не удалось определить дерево" };

  const cleared = await db
    .update(materialNodes)
    .set({ formattingIssue: false })
    .where(and(formattingTreeWhere(target), eq(materialNodes.formattingIssue, true)))
    .returning({ id: materialNodes.id });

  revalidateMaterials();
  return {
    ok: true,
    message: cleared.length ? `Жёлтых отметок снято: ${cleared.length}` : "Жёлтых отметок нет",
  };
}

/**
 * Робот у файла — постоянное исключение из сканирования. Повторный клик
 * возвращает файл в будущие проверки. Уже найденная жёлтая отметка остаётся,
 * пока учитель отдельно не снимет результаты проверки.
 */
export async function toggleFormattingScanIgnoredAction(nodeId: string): Promise<BulkState> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return { error: "Файл не выбран" };

  const [node] = await db
    .select({
      type: materialNodes.type,
      ignored: materialNodes.formattingScanIgnored,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, id))
    .limit(1);
  if (!node || node.type !== "FILE") return { error: "Файл не найден" };

  const ignored = !node.ignored;
  await db
    .update(materialNodes)
    .set({ formattingScanIgnored: ignored })
    .where(eq(materialNodes.id, id));

  revalidateMaterials();
  return {
    ok: true,
    message: ignored
      ? "Файл исключён из будущих проверок"
      : "Файл возвращён в будущие проверки",
  };
}

/** Убрать выбранные ветки в восстанавливаемый архив. */
export async function deleteNodesAction(ids: string[]): Promise<BulkState> {
  await requireTeacher();

  const clean = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id))];
  if (clean.length === 0) return { error: "Ничего не выбрано" };

  const all = await withDescendants(clean);
  const archived = await archiveNodes(all);

  revalidateMaterials();
  return { ok: true, message: `В архиве: ${archived}` };
}

export type WipeWhat = { personal?: boolean; mistakes?: boolean; access?: boolean };
export type WipeSummary = { nodes: number; grants: number; error?: string };

/**
 * Убрать материалы ученика из активного дерева.
 *
 * Выбирается, что именно сносить: личное дерево, ошибки, выданные
 * разделы общей базы. Сама общая база не трогается никогда — у ученика
 * забирается только доступ к ней.
 *
 * Личные узлы не удаляются физически: они переходят в архив и могут быть
 * восстановлены. Доступ к общей базе можно выдать заново в любой момент.
 */
export async function wipeStudentMaterialsAction(
  studentId: string,
  what: WipeWhat,
): Promise<WipeSummary> {
  await requireTeacher();

  const id = String(studentId ?? "");
  if (!id) return { nodes: 0, grants: 0, error: "Не выбран ученик" };

  // Чужие деревья под ту же кнопку попасть не должны: чистим только
  // то, что принадлежит именно ученику.
  const [student] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!student || student.role !== "STUDENT") {
    return { nodes: 0, grants: 0, error: "Это не ученик" };
  }

  const scopes: NodeScope[] = [];
  if (what?.personal) scopes.push("STUDENT");
  if (what?.mistakes) scopes.push("MISTAKE");

  if (scopes.length === 0 && !what?.access) {
    return { nodes: 0, grants: 0, error: "Не выбрано, что удалять" };
  }

  let nodes = 0;
  for (const scope of scopes) {
    const archived = await db
      .update(materialNodes)
      .set({ scope: archivedScope(scope) })
      .where(and(eq(materialNodes.ownerId, id), eq(materialNodes.scope, scope)))
      .returning({ id: materialNodes.id });
    nodes += archived.length;
  }

  let grants = 0;
  if (what?.access) {
    const gone = await db
      .delete(studentMaterials)
      .where(eq(studentMaterials.studentId, id))
      .returning({ id: studentMaterials.id });
    grants = gone.length;
  }

  revalidateMaterials();
  revalidatePath(`/teacher/students/${id}/materials`);
  revalidatePath(`/teacher/students/${id}/mistakes`);
  return { nodes, grants };
}

/** Вернуть всё личное дерево ученика из архива одним действием. */
export async function restoreStudentMaterialsAction(
  studentId: string,
): Promise<void> {
  await requireTeacher();

  const id = String(studentId ?? "");
  if (!id) return;

  await db
    .update(materialNodes)
    .set({ scope: "STUDENT" })
    .where(
      and(
        eq(materialNodes.ownerId, id),
        eq(materialNodes.scope, archivedScope("STUDENT")),
      ),
    );

  revalidateMaterials();
  revalidatePath(`/teacher/students/${id}/materials`);
}

/** Орфография названия. Словари лежат на сервере, в браузер не уезжают. */
export async function checkSpellingAction(text: string): Promise<Misspelling[]> {
  await requireTeacher();
  return checkSpelling(String(text ?? ""));
}

/** Транскрипция слова. Словарь лежит на сервере, в браузер не уезжает. */
export async function transcribeAction(phrase: string): Promise<string | null> {
  await requireTeacher();
  return transcribe(String(phrase ?? "").slice(0, 120));
}

export type DraftTranslationState = {
  translation: string | null;
  examples: string[];
  error?: string;
};

/** Контекстный автоперевод одной редактируемой словарной карточки. */
export async function translateVocabularyDraftAction(
  draft: {
    phrase: string;
    section?: string | null;
    translation?: string | null;
    examples?: { en: string; tr?: string | null }[];
  },
  target: MaterialTranslationLang,
): Promise<DraftTranslationState> {
  await requireTeacher();
  const phrase = String(draft?.phrase ?? "").trim().slice(0, 500);
  const lang: MaterialTranslationLang = target === "RU" ? "RU" : "UK";
  if (!phrase) return { translation: null, examples: [] };

  const examples = (Array.isArray(draft?.examples) ? draft.examples : [])
    .map((example) => ({
      en: String(example?.en ?? "").trim().slice(0, 800),
      currentTranslation: String(example?.tr ?? "").trim().slice(0, 800),
    }))
    .filter((example) => example.en)
    .slice(0, 10);

  try {
    const translated = await translateVocabulary(
      [
        {
          id: "draft",
          phrase,
          section: String(draft?.section ?? "").trim().slice(0, 240),
          currentTranslation: String(draft?.translation ?? "").trim().slice(0, 800),
          examples,
        },
      ],
      lang,
      lang,
    );
    const item = translated.get("draft");
    return {
      translation: item?.translation ?? null,
      examples: item?.examples ?? [],
    };
  } catch (error) {
    console.error("Автоперевод карточки недоступен:", error);
    return {
      translation: null,
      examples: [],
      error: error instanceof Error ? error.message : "Переводчик недоступен",
    };
  }
}

export type PhraseInput = {
  section: string | null;
  icon: string | null;
  phrase: string;
  transcription: string | null;
  translation: string;
  examples: { en: string; tr: string }[];
};

export type VocabularyEditInput = PhraseInput & {
  kind: "PHRASE" | "NOTE";
  imageUrl?: string | null;
};

function cleanPhrase(p: PhraseInput): PhraseInput | null {
  const phrase = String(p?.phrase ?? "").trim().slice(0, 300);
  if (!phrase) return null;
  return {
    section: p.section ? String(p.section).trim().slice(0, 200) || null : null,
    icon: p.icon ? String(p.icon).slice(0, 64) : null,
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

function cleanVocabularyEditItem(p: VocabularyEditInput): VocabularyEditInput | null {
  const clean = cleanPhrase(p);
  if (!clean) return null;
  return {
    ...clean,
    kind: p?.kind === "NOTE" ? "NOTE" : "PHRASE",
    imageUrl: p?.imageUrl ? String(p.imageUrl).slice(0, 2_000) : null,
  };
}

/** Не даёт сохранить слово без новой транскрипции из-за быстрого клика по кнопке. */
function ensureTranscription<T extends PhraseInput>(phrase: T): T {
  if (phrase.transcription) return phrase;
  return { ...phrase, transcription: transcribe(phrase.phrase) };
}

/** Заполняет только пустые переводы, не затирая ручную правку учителя. */
async function fillMissingTranslations<T extends PhraseInput & { kind?: "PHRASE" | "NOTE" }>(
  items: T[],
  target: MaterialTranslationLang,
): Promise<T[]> {
  const missing = items.filter(
    (item) =>
      item.kind !== "NOTE" &&
      (!item.translation?.trim() || item.examples.some((example) => example.en && !example.tr)),
  );
  if (missing.length === 0) return items;

  try {
    const translated = await translateVocabulary(
      missing.map((item, index): VocabularyTranslationInput => ({
        id: `save-${index}`,
        phrase: item.phrase,
        section: item.section,
        currentTranslation: item.translation,
        examples: item.examples.map((example) => ({
          en: example.en,
          currentTranslation: example.tr,
        })),
      })),
      target,
      target,
    );
    const resultByPhrase = new Map(
      missing.map((item, index) => [item, translated.get(`save-${index}`)]),
    );

    return items.map((item) => {
      const result = resultByPhrase.get(item);
      if (!result) return item;
      return {
        ...item,
        translation: item.translation?.trim() ? item.translation : result.translation,
        examples: item.examples.map((example, index) => ({
          ...example,
          tr: example.tr?.trim() ? example.tr : (result.examples[index] ?? ""),
        })),
      };
    });
  } catch (error) {
    // Сохранение не блокируем из-за внешнего сервиса: ручные данные важнее.
    console.error("Не удалось дополнить пустые переводы при сохранении:", error);
    return items;
  }
}

type PhraseRow = typeof materialPhrases.$inferSelect;

/** Записи страницы по порядку. */
async function loadPhrases(nodeId: string): Promise<PhraseRow[]> {
  return db
    .select()
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, nodeId))
    .orderBy(asc(materialPhrases.sortOrder));
}

/** Проставляет порядок подряд, трогая только то, что сдвинулось. */
async function renumber(rows: PhraseRow[]) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sortOrder === i + 1) continue;
    await db
      .update(materialPhrases)
      .set({ sortOrder: i + 1 })
      .where(eq(materialPhrases.id, rows[i].id));
  }
}

const byWord = (a: string, b: string) =>
  a.localeCompare(b, "en", { sensitivity: "base" });

/**
 * Ставит новые записи на своё место по алфавиту, не пересобирая раздел.
 * Порядок, выставленный вручную перетаскиванием, так не ломается:
 * новое слово встаёт перед первым, которое идёт после него.
 */
async function placeNewPhrases(nodeId: string, newIds: Set<string>) {
  const rows = await loadPhrases(nodeId);
  const fresh = rows.filter((r) => newIds.has(r.id));
  const rest = rows.filter((r) => !newIds.has(r.id));

  for (const item of fresh) {
    const section = item.section ?? null;
    let at = rest.findIndex(
      (r) =>
        (r.section ?? null) === section &&
        r.kind !== "NOTE" &&
        byWord(r.phrase, item.phrase) > 0,
    );

    if (at === -1) {
      // Раздела ещё нет или слово последнее по алфавиту — в конец раздела.
      const last = rest.map((r) => (r.section ?? null) === section).lastIndexOf(true);
      at = last === -1 ? rest.length : last + 1;
    }
    rest.splice(at, 0, item);
  }

  await renumber(rest);
}

/** Добавить слова на страницу, не трогая уже существующие. */
export async function addPhrasesAction(
  nodeId: string,
  items: PhraseInput[],
): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбрана страница" };

  let clean = (items ?? [])
    .map(cleanPhrase)
    .filter((p): p is PhraseInput => !!p)
    .map(ensureTranscription);
  if (clean.length === 0) return { error: "Нечего добавлять: пустое слово" };

  const [node] = await db
    .select({ translationLang: materialNodes.translationLang })
    .from(materialNodes)
    .where(eq(materialNodes.id, nodeId))
    .limit(1);
  if (!node) return { error: "Страница не найдена" };
  clean = await fillMissingTranslations(clean, node.translationLang);

  const [{ value: last } = { value: 0 }] = await db
    .select({ value: max(materialPhrases.sortOrder) })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, nodeId));

  const added = await db
    .insert(materialPhrases)
    .values(clean.map((p, i) => ({ nodeId, sortOrder: (last ?? 0) + i + 1, ...p })))
    .returning({ id: materialPhrases.id });

  await placeNewPhrases(nodeId, new Set(added.map((a) => a.id)));
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

  const prepared = cleanPhrase(data);
  let clean = prepared ? ensureTranscription(prepared) : null;
  if (!clean) return { error: "Слово не может быть пустым" };

  const [before] = await db
    .select({ section: materialPhrases.section, nodeId: materialPhrases.nodeId })
    .from(materialPhrases)
    .where(eq(materialPhrases.id, phraseId))
    .limit(1);
  if (!before) return { error: "Запись не найдена" };

  const [node] = await db
    .select({ translationLang: materialNodes.translationLang })
    .from(materialNodes)
    .where(eq(materialNodes.id, before.nodeId))
    .limit(1);
  clean = (await fillMissingTranslations([clean], node?.translationLang ?? "UK"))[0];

  const [row] = await db
    .update(materialPhrases)
    .set(clean)
    .where(eq(materialPhrases.id, phraseId))
    .returning({ nodeId: materialPhrases.nodeId });

  // Раздел сменился — слово переезжает и встаёт по алфавиту на новом месте.
  if (row && (before?.section ?? null) !== clean.section) {
    await placeNewPhrases(row.nodeId, new Set([phraseId]));
  }

  revalidateMaterials();
  return { ok: true, message: "Сохранено" };
}

/** Полностью сохранить словарь после комплексной ручной правки. */
export async function saveVocabularyEditAction(
  nodeId: string,
  items: unknown,
  sourceText: string,
): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбрана страница" };
  if (!Array.isArray(items)) return { error: "Некорректный список записей" };

  const [node] = await db
    .select({
      type: materialNodes.type,
      pageKind: materialNodes.pageKind,
      translationLang: materialNodes.translationLang,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, nodeId))
    .limit(1);
  if (!node || node.type !== "FILE") return { error: "Файл словаря не найден" };

  let clean = (items as VocabularyEditInput[])
    .slice(0, 2_000)
    .map(cleanVocabularyEditItem)
    .filter((item): item is VocabularyEditInput => !!item)
    .map((item) => (item.kind === "PHRASE" ? ensureTranscription(item) : item));
  if (clean.length === 0) return { error: "Пустой словарь — нечего сохранять" };
  clean = await fillMissingTranslations(clean, node.translationLang);

  await db.transaction(async (tx) => {
    await tx.delete(materialBlocks).where(eq(materialBlocks.nodeId, nodeId));
    await tx.delete(materialPhrases).where(eq(materialPhrases.nodeId, nodeId));
    await tx.insert(materialPhrases).values(
      clean.map((item, index) => ({
        nodeId,
        sortOrder: index + 1,
        icon: item.icon,
        imageUrl: item.imageUrl,
        phrase: item.phrase,
        transcription: item.transcription,
        translation: item.translation,
        section: item.section,
        kind: item.kind,
        examples: item.examples,
      })),
    );
    await tx
      .update(materialNodes)
      .set({
        pageKind: node.pageKind === "MISTAKE" ? "MISTAKE" : "VOCAB",
        sourceText: String(sourceText ?? "").slice(0, 200_000),
      })
      .where(eq(materialNodes.id, nodeId));
  });

  const notes = clean.filter((item) => item.kind === "NOTE").length;
  revalidateMaterials();
  return {
    ok: true,
    message: `Сохранено: ${clean.length - notes} записей${notes ? `, ${notes} заметок` : ""}`,
  };
}

/**
 * Заново подобрать смысловую иконку каждой записи одного словаря.
 * Анализируются слово/фраза, перевод, категория и примеры. Заметки не трогаем,
 * а записи без достаточно уверенного совпадения сохраняют прежнюю иконку.
 */
export async function repairPhraseIconsAction(nodeId: string): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбран словарь" };

  const [node] = await db
    .select({ id: materialNodes.id, type: materialNodes.type })
    .from(materialNodes)
    .where(eq(materialNodes.id, nodeId))
    .limit(1);
  if (!node || node.type !== "FILE") return { error: "Файл словаря не найден" };

  const rows = await loadPhrases(nodeId);
  const words = rows.filter((row) => row.kind !== "NOTE");
  if (words.length === 0) return { error: "В словаре пока нет слов или фраз" };

  const aiIcons = await suggestVocabularyIconsWithAi(
    words.map((row) => ({
      id: row.id,
      phrase: row.phrase,
      translation: row.translation,
      section: row.section,
      examples: row.examples ?? [],
    })),
  );

  let recognized = 0;
  const proposals: { id: string; icon: string }[] = [];
  for (const row of words) {
    const icon =
      aiIcons.get(row.id) ??
      suggestVocabularyIcon(
        row.phrase,
        row.translation,
        row.section,
        row.examples ?? [],
      );
    if (icon) {
      recognized++;
      if (icon !== row.icon) proposals.push({ id: row.id, icon });
      continue;
    }

    // Старое массовое исправление могло сохранить новый emoji, которого нет
    // в системном шрифте. Если точного образа нет, хотя бы убираем квадрат.
    if (!isSafeAutomaticIcon(row.icon)) {
      proposals.push({ id: row.id, icon: vocabularyFallbackIcon(row.section) });
    }
  }

  if (proposals.length > 0) {
    await db.transaction(async (tx) => {
      for (const proposal of proposals) {
        await tx
          .update(materialPhrases)
          .set({ icon: proposal.icon.slice(0, 64) })
          .where(eq(materialPhrases.id, proposal.id));
      }
    });
  }

  const kept = words.length - recognized;

  revalidateMaterials();
  return {
    ok: true,
    message:
      proposals.length > 0
        ? `Иконки исправлены: ${proposals.length}${kept ? ` · без точного совпадения: ${kept}` : ""}`
        : kept
          ? `Точных новых совпадений нет · сохранены прежние: ${kept}`
          : "Все иконки уже подобраны правильно",
  };
}

/** Подобрать и заменить иконку ровно у одной словарной записи. */
export async function repairPhraseIconAction(phraseId: string): Promise<BulkState> {
  await requireTeacher();
  const id = String(phraseId ?? "");
  if (!id) return { error: "Не выбрана запись" };

  const [row] = await db
    .select()
    .from(materialPhrases)
    .where(eq(materialPhrases.id, id))
    .limit(1);
  if (!row || row.kind === "NOTE") return { error: "Словарная запись не найдена" };

  const input = {
    id: row.id,
    phrase: row.phrase,
    translation: row.translation,
    section: row.section,
    examples: row.examples ?? [],
  };
  const aiIcons = await suggestVocabularyIconsWithAi([input]);
  const icon =
    aiIcons.get(row.id) ??
    suggestVocabularyIcon(
      row.phrase,
      row.translation,
      row.section,
      row.examples ?? [],
    );

  if (!icon) return { error: "Не удалось подобрать подходящую иконку" };

  await db
    .update(materialPhrases)
    .set({ icon: icon.slice(0, 64) })
    .where(eq(materialPhrases.id, row.id));

  revalidateMaterials();
  return { ok: true, message: `Иконка исправлена: ${icon}` };
}

/**
 * Снять снимок содержимого перед тем, как его перестроят.
 *
 * Перепарсинг берёт текст из sourceText, а слова, добавленные, удалённые или
 * переставленные руками после импорта, туда не попадают — без снимка они
 * исчезали бы молча. Вызывается внутри той же транзакции, что и замена.
 */
async function snapshotContent(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  nodeId: string,
  pageKind: string | null,
) {
  const [phrases, blocks] = await Promise.all([
    tx
      .select()
      .from(materialPhrases)
      .where(eq(materialPhrases.nodeId, nodeId))
      .orderBy(asc(materialPhrases.sortOrder)),
    tx
      .select()
      .from(materialBlocks)
      .where(eq(materialBlocks.nodeId, nodeId))
      .orderBy(asc(materialBlocks.sortOrder)),
  ]);

  // Пустую страницу сохранять незачем — и затирать прошлый снимок тоже.
  if (phrases.length === 0 && blocks.length === 0) return;

  const backup: ContentBackup = {
    savedAt: new Date().toISOString(),
    pageKind,
    phrases: phrases.map((p) => ({
      sortOrder: p.sortOrder,
      icon: p.icon,
      imageUrl: p.imageUrl,
      phrase: p.phrase,
      transcription: p.transcription,
      translation: p.translation,
      section: p.section,
      kind: p.kind,
      examples: p.examples ?? [],
    })),
    blocks: blocks.map((b) => ({ sortOrder: b.sortOrder, type: b.type, data: b.data })),
  };

  await tx
    .update(materialNodes)
    .set({ contentBackup: backup })
    .where(eq(materialNodes.id, nodeId));
}

/**
 * Наполнить страницу содержимым другой страницы.
 *
 * Источником может быть любое дерево: общая база, личные материалы
 * учителя или материалы любого ученика. Копия самостоятельная — правки
 * в источнике до неё не доходят, как и при обычном «Поделиться».
 *
 * Дописываем, а не заменяем: то, что уже есть на странице, остаётся, а
 * точные повторы пропускаются — так одну и ту же страницу можно собрать
 * из нескольких источников.
 */
export async function fillPageFromAction(
  targetId: string,
  sourceId: string,
): Promise<BulkState> {
  await requireTeacher();

  const target = String(targetId ?? "");
  const source = String(sourceId ?? "");
  if (!target || !source) return { error: "Не выбрана страница" };
  if (target === source) return { error: "Это одна и та же страница" };

  const [to] = await db
    .select({
      id: materialNodes.id,
      type: materialNodes.type,
      pageKind: materialNodes.pageKind,
      sourceText: materialNodes.sourceText,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, target))
    .limit(1);
  if (!to || to.type !== "FILE") return { error: "Страница не найдена" };

  const [from] = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      type: materialNodes.type,
      pageKind: materialNodes.pageKind,
      sourceText: materialNodes.sourceText,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, source))
    .limit(1);
  if (!from || from.type !== "FILE") return { error: "Источник не найден" };

  const [srcPhrases, srcBlocks, ownPhrases, ownBlocks] = await Promise.all([
    db.select().from(materialPhrases).where(eq(materialPhrases.nodeId, source))
      .orderBy(asc(materialPhrases.sortOrder)),
    db.select().from(materialBlocks).where(eq(materialBlocks.nodeId, source))
      .orderBy(asc(materialBlocks.sortOrder)),
    db.select().from(materialPhrases).where(eq(materialPhrases.nodeId, target)),
    db.select().from(materialBlocks).where(eq(materialBlocks.nodeId, target)),
  ]);

  if (srcPhrases.length === 0 && srcBlocks.length === 0) {
    return { error: `Страница «${from.name}» пустая — копировать нечего` };
  }

  const phraseKey = (p: { phrase: string; transcription: string | null; translation: string | null; section: string | null; kind: string }) =>
    [p.phrase, p.transcription, p.translation, p.section, p.kind]
      .map((v) => (v ?? "").trim().toLowerCase())
      .join("\u0000");

  const knownPhrases = new Set(ownPhrases.map(phraseKey));
  const knownBlocks = new Set(ownBlocks.map((b) => JSON.stringify(b.data)));

  const freshPhrases = srcPhrases.filter((p) => !knownPhrases.has(phraseKey(p)));
  const freshBlocks = srcBlocks.filter((b) => !knownBlocks.has(JSON.stringify(b.data)));

  if (freshPhrases.length === 0 && freshBlocks.length === 0) {
    return { error: "Всё это на странице уже есть" };
  }

  const lastPhrase = ownPhrases.reduce((max, p) => Math.max(max, p.sortOrder), 0);
  const lastBlock = ownBlocks.reduce((max, b) => Math.max(max, b.sortOrder), 0);

  await db.transaction(async (tx) => {
    if (freshPhrases.length > 0) {
      await tx.insert(materialPhrases).values(
        freshPhrases.map((p, index) => ({
          nodeId: target,
          sortOrder: lastPhrase + index + 1,
          icon: p.icon,
          imageUrl: p.imageUrl,
          phrase: p.phrase,
          transcription: p.transcription,
          translation: p.translation,
          section: p.section,
          kind: p.kind,
          examples: p.examples ?? [],
        })),
      );
    }

    if (freshBlocks.length > 0) {
      await tx.insert(materialBlocks).values(
        freshBlocks.map((b, index) => ({
          nodeId: target,
          sortOrder: lastBlock + index + 1,
          type: b.type,
          data: b.data,
        })),
      );
    }

    // Пустая страница перенимает у источника вид и исходник: иначе
    // «Переформатировать» ей потом не из чего собирать.
    const patch: Record<string, string | null> = {};
    if (!to.pageKind && from.pageKind) patch.pageKind = from.pageKind;
    if (!to.sourceText?.trim() && from.sourceText?.trim()) {
      patch.sourceText = from.sourceText;
    }
    if (Object.keys(patch).length > 0) {
      await tx.update(materialNodes).set(patch).where(eq(materialNodes.id, target));
    }
  });

  revalidateMaterials();
  const added = freshPhrases.length + freshBlocks.length;
  const skipped =
    srcPhrases.length + srcBlocks.length - added;
  return {
    ok: true,
    message:
      `Добавлено из «${from.name}»: ${added}` +
      (skipped > 0 ? `, пропущено повторов: ${skipped}` : ""),
  };
}

/**
 * Вернуть содержимое, каким оно было до последней перестройки.
 * Снимок после восстановления снимается — второй отмены не будет.
 */
export async function restoreMaterialContentAction(nodeId: string): Promise<BulkState> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return { error: "Не выбран файл" };

  const [node] = await db
    .select({ contentBackup: materialNodes.contentBackup })
    .from(materialNodes)
    .where(eq(materialNodes.id, id))
    .limit(1);

  const backup = node?.contentBackup;
  if (!backup) return { error: "Для этого файла нет сохранённого снимка" };

  await db.transaction(async (tx) => {
    await tx.delete(materialPhrases).where(eq(materialPhrases.nodeId, id));
    await tx.delete(materialBlocks).where(eq(materialBlocks.nodeId, id));

    if (backup.phrases.length > 0) {
      await tx.insert(materialPhrases).values(
        backup.phrases.map((p) => ({ ...p, nodeId: id })),
      );
    }
    if (backup.blocks.length > 0) {
      await tx.insert(materialBlocks).values(
        backup.blocks.map((b) => ({ ...b, nodeId: id })),
      );
    }

    await tx
      .update(materialNodes)
      .set({ pageKind: backup.pageKind, contentBackup: null })
      .where(eq(materialNodes.id, id));
  });

  revalidateMaterials();
  const count = backup.phrases.length || backup.blocks.length;
  return { ok: true, message: `Содержимое возвращено: ${count}` };
}

/**
 * Меняет тип страницы. Если выбран повторный разбор, старое разобранное
 * содержимое заменяется только после успешного разбора сохранённого исходника.
 */
export async function changeMaterialPageKindAction(
  nodeId: string,
  nextKind: "VOCAB" | "RULE",
  reparse: boolean,
): Promise<BulkState> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  const kind = nextKind === "RULE" ? "RULE" : "VOCAB";
  if (!id) return { error: "Не выбран файл" };

  const [node] = await db
    .select({
      type: materialNodes.type,
      pageKind: materialNodes.pageKind,
      sourceText: materialNodes.sourceText,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, id))
    .limit(1);
  if (!node || node.type !== "FILE") return { error: "Файл не найден" };

  if (!reparse) {
    const [[phrase], [block]] = await Promise.all([
      db
        .select({ id: materialPhrases.id })
        .from(materialPhrases)
        .where(eq(materialPhrases.nodeId, id))
        .limit(1),
      db
        .select({ id: materialBlocks.id })
        .from(materialBlocks)
        .where(eq(materialBlocks.nodeId, id))
        .limit(1),
    ]);
    if (phrase || block) {
      return {
        error:
          "Заполненный файл нельзя просто переименовать в другой тип. " +
          "Перепарси сохранённый исходник или вставь содержимое заново.",
      };
    }
    await db.update(materialNodes).set({ pageKind: kind }).where(eq(materialNodes.id, id));
    revalidateMaterials();
    return { ok: true, message: `Тип файла: ${kind === "RULE" ? "Правило" : "Словарь"}` };
  }

  const source = node.sourceText?.trim() ?? "";
  if (!source) return { error: "У файла не сохранён исходный текст для перепарсинга" };

  if (kind === "RULE") {
    const parsed = parseRuleText(source);
    const blocks = sanitizeBlocks(parsed.blocks);
    if (blocks.length === 0) {
      return { error: parsed.warnings[0] ?? "Исходник не удалось разобрать как правило" };
    }
    await db.transaction(async (tx) => {
      await snapshotContent(tx, id, node.pageKind);
      await tx.delete(materialPhrases).where(eq(materialPhrases.nodeId, id));
      await tx.delete(materialBlocks).where(eq(materialBlocks.nodeId, id));
      await tx.insert(materialBlocks).values(
        blocks.map((block, index) => ({
          nodeId: id,
          sortOrder: index + 1,
          type: block.type,
          data: block,
        })),
      );
      await tx
        .update(materialNodes)
        .set({ pageKind: "RULE", formattingIssue: parsed.warnings.length > 0 })
        .where(eq(materialNodes.id, id));
    });
    revalidateMaterials();
    return { ok: true, message: `Тип изменён на «Правило»: ${blocks.length} блоков` };
  }

  const parsed = parseMaterial(source, "vocabulary");
  if (parsed.phrases.length === 0) {
    return { error: parsed.warnings[0] ?? "Исходник не удалось разобрать как словарь" };
  }
  await db.transaction(async (tx) => {
    await snapshotContent(tx, id, node.pageKind);
    await tx.delete(materialBlocks).where(eq(materialBlocks.nodeId, id));
    await tx.delete(materialPhrases).where(eq(materialPhrases.nodeId, id));
    await tx.insert(materialPhrases).values(
      parsed.phrases.map((phrase, index) => ({
        nodeId: id,
        sortOrder: index + 1,
        icon: phrase.icon,
        phrase: phrase.phrase,
        transcription: phrase.transcription,
        translation: phrase.translation,
        section: phrase.section,
        kind: phrase.kind,
        examples: phrase.examples,
      })),
    );
    await tx
      .update(materialNodes)
      .set({ pageKind: "VOCAB", formattingIssue: parsed.warnings.length > 0 })
      .where(eq(materialNodes.id, id));
  });
  revalidateMaterials();
  const words = parsed.phrases.filter((phrase) => phrase.kind === "PHRASE").length;
  return { ok: true, message: `Тип изменён на «Словарь»: ${words} записей` };
}

/**
 * Заново разобрать сохранённый исходник страницы актуальным парсером.
 * Существующие строки обновляются на месте, поэтому их id и картинки остаются.
 * Автоматически уменьшать число записей нельзя: это могло бы скрыть данные.
 */
export async function reformatMaterialPageAction(nodeId: string): Promise<BulkState> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return { error: "Не выбрана страница" };

  const [node] = await db
    .select({
      id: materialNodes.id,
      type: materialNodes.type,
      pageKind: materialNodes.pageKind,
      sourceText: materialNodes.sourceText,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, id))
    .limit(1);
  if (!node || node.type !== "FILE") return { error: "Файл не найден" };

  const source = node.sourceText?.trim() ?? "";
  if (!source) return { error: "У файла не сохранён исходный текст" };

  let kind = node.pageKind;
  if (kind !== "RULE" && kind !== "VOCAB") {
    const [firstBlock] = await db
      .select({ id: materialBlocks.id })
      .from(materialBlocks)
      .where(eq(materialBlocks.nodeId, id))
      .limit(1);
    const [firstPhrase] = firstBlock
      ? []
      : await db
          .select({ id: materialPhrases.id })
          .from(materialPhrases)
          .where(eq(materialPhrases.nodeId, id))
          .limit(1);
    kind = firstBlock ? "RULE" : firstPhrase ? "VOCAB" : kind;
  }

  if (kind === "RULE") {
    const parsed = parseRuleText(source);
    const blocks = sanitizeBlocks(parsed.blocks);
    if (blocks.length === 0) {
      return { error: parsed.warnings[0] ?? "Не удалось заново разобрать правило" };
    }

    const current = await db
      .select({ id: materialBlocks.id })
      .from(materialBlocks)
      .where(eq(materialBlocks.nodeId, id))
      .orderBy(asc(materialBlocks.sortOrder));
    if (blocks.length < current.length) {
      return {
        error:
          `Новый разбор нашёл меньше блоков: ${blocks.length} вместо ${current.length}. ` +
          "Автоматическая замена остановлена — открой редактирование и проверь результат.",
      };
    }

    await db.transaction(async (tx) => {
      for (let index = 0; index < current.length; index++) {
        const block = blocks[index];
        await tx
          .update(materialBlocks)
          .set({ sortOrder: index + 1, type: block.type, data: block })
          .where(eq(materialBlocks.id, current[index].id));
      }
      if (blocks.length > current.length) {
        await tx.insert(materialBlocks).values(
          blocks.slice(current.length).map((block, offset) => ({
            nodeId: id,
            sortOrder: current.length + offset + 1,
            type: block.type,
            data: block,
          })),
        );
      }
    });

    revalidateMaterials();
    return {
      ok: true,
      message: `Правило переформатировано: ${blocks.length} блоков`,
    };
  }

  if (kind !== "VOCAB") {
    return { error: "Сначала выбери тип содержимого: словарь или правило" };
  }

  const parsed = parseMaterial(source, "vocabulary");
  if (parsed.phrases.length === 0) {
    return { error: parsed.warnings[0] ?? "Не удалось заново разобрать словарь" };
  }

  const current = await loadPhrases(id);
  if (parsed.phrases.length < current.length) {
    return {
      error:
        `Новый разбор нашёл меньше записей: ${parsed.phrases.length} вместо ${current.length}. ` +
        "Автоматическая замена остановлена — открой редактирование и проверь результат.",
    };
  }

  await db.transaction(async (tx) => {
    for (let index = 0; index < current.length; index++) {
      const phrase = parsed.phrases[index];
      await tx
        .update(materialPhrases)
        .set({
          sortOrder: index + 1,
          icon: phrase.icon,
          phrase: phrase.phrase,
          transcription: phrase.transcription,
          translation: phrase.translation,
          section: phrase.section,
          kind: phrase.kind,
          examples: phrase.examples,
        })
        .where(eq(materialPhrases.id, current[index].id));
    }
    if (parsed.phrases.length > current.length) {
      await tx.insert(materialPhrases).values(
        parsed.phrases.slice(current.length).map((phrase, offset) => ({
          nodeId: id,
          sortOrder: current.length + offset + 1,
          icon: phrase.icon,
          phrase: phrase.phrase,
          transcription: phrase.transcription,
          translation: phrase.translation,
          section: phrase.section,
          kind: phrase.kind,
          examples: phrase.examples,
        })),
      );
    }
  });

  const words = parsed.phrases.filter((phrase) => phrase.kind === "PHRASE").length;
  const notes = parsed.phrases.length - words;
  revalidateMaterials();
  return {
    ok: true,
    message: `Словарь переформатирован: ${words} записей${notes ? `, ${notes} заметок` : ""}`,
  };
}

/** Перевести целиком открытую страницу словаря или правила. */
export async function translateMaterialPageAction(
  nodeId: string,
  target: MaterialTranslationLang,
): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбрана страница" };
  const lang: MaterialTranslationLang = target === "RU" ? "RU" : "UK";

  const [node] = await db
    .select({
      id: materialNodes.id,
      type: materialNodes.type,
      description: materialNodes.description,
      translationLang: materialNodes.translationLang,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, nodeId))
    .limit(1);
  if (!node || node.type !== "FILE") return { error: "Страница не найдена" };

  if (node.translationLang === lang) {
    return {
      ok: true,
      message: `На странице уже выбран ${lang === "UK" ? "украинский" : "русский"} язык`,
    };
  }

  const [phrases, blockRows] = await Promise.all([
    loadPhrases(nodeId),
    db
      .select()
      .from(materialBlocks)
      .where(eq(materialBlocks.nodeId, nodeId))
      .orderBy(asc(materialBlocks.sortOrder)),
  ]);
  if (phrases.length === 0 && blockRows.length === 0) {
    await db
      .update(materialNodes)
      .set({ translationLang: lang })
      .where(eq(materialNodes.id, nodeId));
    revalidateMaterials();
    return {
      ok: true,
      message: `Язык будущих переводов: ${lang === "UK" ? "украинский" : "русский"}`,
    };
  }

  try {
    const [phraseTranslations, translatedBlocks, description] = await Promise.all([
      phrases.length
        ? translateVocabulary(
            phrases.map((phrase) => ({
              id: phrase.id,
              kind: phrase.kind === "NOTE" ? "NOTE" : "PHRASE",
              phrase: phrase.phrase,
              section: phrase.section,
              currentTranslation: phrase.translation,
              examples: (phrase.examples ?? []).map((example) => ({
                en: example.en,
                currentTranslation: example.tr,
              })),
            })),
            lang,
            node.translationLang,
          )
        : Promise.resolve(new Map()),
      blockRows.length
        ? translateRuleBlocks(
            blockRows.map((row) => row.data as RuleBlock),
            lang,
            node.translationLang,
          )
        : Promise.resolve([] as RuleBlock[]),
      node.description
        ? translateMaterialText(node.description, lang, node.translationLang)
        : Promise.resolve(node.description),
    ]);

    await db.transaction(async (tx) => {
      for (const phrase of phrases) {
        const translated = phraseTranslations.get(phrase.id);
        if (!translated) continue;
        const examples = (phrase.examples ?? []).map((example, index) => ({
          ...example,
          tr: translated.examples[index] ?? example.tr,
        }));
        await tx
          .update(materialPhrases)
          .set({
            phrase: phrase.kind === "NOTE" ? translated.phrase : phrase.phrase,
            translation: translated.translation,
            examples,
          })
          .where(eq(materialPhrases.id, phrase.id));
      }

      for (let index = 0; index < blockRows.length; index++) {
        const block = translatedBlocks[index];
        if (!block) continue;
        await tx
          .update(materialBlocks)
          .set({ type: block.type, data: block })
          .where(eq(materialBlocks.id, blockRows[index].id));
      }

      await tx
        .update(materialNodes)
        .set({ translationLang: lang, description })
        .where(eq(materialNodes.id, nodeId));
    });
  } catch (error) {
    console.error("Не удалось перевести страницу:", error);
    return {
      error: error instanceof Error ? error.message : "Переводчик временно недоступен",
    };
  }

  revalidateMaterials();
  const label = lang === "UK" ? "украинский" : "русский";
  return {
    ok: true,
    message: `Страница переведена на ${label}: ${phrases.length || blockRows.length} элементов`,
  };
}

/**
 * Переставить слово: рядом с другим словом или в конец раздела.
 * Раздел берётся у цели, поэтому одним действием и меняем порядок,
 * и переносим слово в другую категорию.
 */
export async function movePhraseAction(
  phraseId: string,
  target: { phraseId?: string; section?: string | null; where?: "before" | "after" },
): Promise<BulkState> {
  await requireTeacher();
  if (!phraseId) return { error: "Не выбрана запись" };

  const [moved] = await db
    .select()
    .from(materialPhrases)
    .where(eq(materialPhrases.id, phraseId))
    .limit(1);
  if (!moved) return { error: "Запись не найдена" };

  const rows = await loadPhrases(moved.nodeId);
  const rest = rows.filter((r) => r.id !== phraseId);

  let section: string | null;
  let at: number;

  if (target.phraseId) {
    const anchor = rest.find((r) => r.id === target.phraseId);
    if (!anchor) return { error: "Не нашлось, куда ставить" };
    section = anchor.section ?? null;
    at = rest.indexOf(anchor) + (target.where === "after" ? 1 : 0);
  } else {
    // Бросили на заголовок раздела — в конец этого раздела.
    section = target.section ?? null;
    const last = rest.map((r) => (r.section ?? null) === section).lastIndexOf(true);
    at = last === -1 ? rest.length : last + 1;
  }

  if ((moved.section ?? null) !== section) {
    await db
      .update(materialPhrases)
      .set({ section })
      .where(eq(materialPhrases.id, phraseId));
  }

  rest.splice(at, 0, { ...moved, section });
  await renumber(rest);

  revalidateMaterials();
  return { ok: true };
}

/** Переименовать категорию: меняется у всех её слов сразу. */
export async function renameSectionAction(
  nodeId: string,
  from: string | null,
  to: string,
): Promise<BulkState> {
  await requireTeacher();
  const name = String(to ?? "").trim().slice(0, 200);
  if (!nodeId || !name) return { error: "Введи название категории" };

  await db
    .update(materialPhrases)
    .set({ section: name })
    .where(
      and(
        eq(materialPhrases.nodeId, nodeId),
        from === null ? isNull(materialPhrases.section) : eq(materialPhrases.section, from),
      ),
    );

  revalidateMaterials();
  return { ok: true, message: "Категория переименована" };
}

/**
 * Убрать категорию. Слова по умолчанию остаются на странице без категории —
 * удалять их вместе с заголовком надо просить отдельно.
 */
export async function deleteSectionAction(
  nodeId: string,
  section: string | null,
  withWords = false,
): Promise<BulkState> {
  await requireTeacher();
  if (!nodeId) return { error: "Не выбрана страница" };

  const where = and(
    eq(materialPhrases.nodeId, nodeId),
    section === null ? isNull(materialPhrases.section) : eq(materialPhrases.section, section),
  );

  if (withWords) await db.delete(materialPhrases).where(where);
  else await db.update(materialPhrases).set({ section: null }).where(where);

  await renumber(await loadPhrases(nodeId));

  revalidateMaterials();
  return { ok: true, message: withWords ? "Категория и слова удалены" : "Категория убрана" };
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
      .set({ icon: e.icon.slice(0, 64) || null })
      .where(eq(materialNodes.id, e.id));
  }

  revalidateMaterials();
  return { ok: true, message: `Иконок обновлено: ${clean.length}` };
}

export type MoveState = { ok?: boolean; error?: string };

/**
 * Перенести папку или страницу в другую папку либо в корень.
 * Выданный ученику раздел остаётся выданным при любом переносе.
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

  revalidateMaterials();
  return { ok: true };
}

export type ParseState = {
  ok?: boolean;
  error?: string;
  message?: string;
  warnings?: string[];
};

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function hasValidImageSignature(bytes: Buffer, mime: string) {
  if (mime === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

async function storeVocabularyCover(file: File, nodeId: string) {
  const ext = COVER_EXTENSIONS[file.type];
  if (!ext) return { error: "Поддерживаются только PNG, JPEG и WebP" } as const;
  if (file.size > MAX_COVER_BYTES) return { error: "Картинка больше 5 МБ" } as const;

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(bytes, file.type)) {
    return { error: "Файл не похож на настоящую картинку" } as const;
  }

  const dir = path.join(process.cwd(), "public", "uploads", "materials");
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${nodeId}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), bytes);
  return { imageUrl: `/uploads/materials/${fileName}` } as const;
}

/** Удаляем только файлы, которые сами создали в своей папке обложек. */
async function removeLocalVocabularyCover(imageUrl: string | null) {
  const prefix = "/uploads/materials/";
  if (!imageUrl?.startsWith(prefix)) return;

  const fileName = imageUrl.slice(prefix.length);
  if (!fileName || fileName !== path.basename(fileName)) return;

  const dir = path.resolve(process.cwd(), "public", "uploads", "materials");
  const target = path.resolve(dir, fileName);
  if (path.dirname(target) !== dir) return;

  try {
    await fs.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Не удалось удалить старую обложку словаря", error);
    }
  }
}

export type CoverState = {
  ok?: boolean;
  error?: string;
  message?: string;
  imageUrl?: string | null;
};

/** Поставить или заменить обложку уже готового словаря. */
export async function updateVocabularyCoverAction(
  nodeId: string,
  _prev: CoverState,
  formData: FormData,
): Promise<CoverState> {
  await requireTeacher();

  const [node] = await db
    .select({
      id: materialNodes.id,
      type: materialNodes.type,
      pageKind: materialNodes.pageKind,
      imageUrl: materialNodes.imageUrl,
    })
    .from(materialNodes)
    .where(eq(materialNodes.id, nodeId))
    .limit(1);

  if (!node || node.type !== "FILE") return { error: "Страница словаря не найдена" };
  if (node.pageKind && node.pageKind !== "VOCAB") {
    return { error: "Обложку словаря нельзя поставить на другой тип материала" };
  }

  if (formData.get("removeCover") === "on") {
    await db
      .update(materialNodes)
      .set({ imageUrl: null })
      .where(eq(materialNodes.id, nodeId));
    await removeLocalVocabularyCover(node.imageUrl);
    revalidateMaterials();
    return { ok: true, message: "Картинка удалена", imageUrl: null };
  }

  const file = formData.get("coverImage");
  if (!(file instanceof File) || file.size === 0) return { error: "Выбери картинку" };

  const stored = await storeVocabularyCover(file, nodeId);
  if ("error" in stored) return { error: stored.error };

  await db
    .update(materialNodes)
    .set({ imageUrl: stored.imageUrl })
    .where(eq(materialNodes.id, nodeId));
  if (node.imageUrl !== stored.imageUrl) {
    await removeLocalVocabularyCover(node.imageUrl);
  }

  revalidateMaterials();
  return {
    ok: true,
    message: "Картинка сохранена в шапке словаря",
    imageUrl: stored.imageUrl,
  };
}

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
  const requestedMode = String(formData.get("mode") || "vocabulary");
  const mode: ParserMode = requestedMode === "mistake" ? "mistake" : "vocabulary";
  const raw = String(formData.get("raw") || "");
  const applyTitle = formData.get("applyTitle") === "on";

  if (!nodeId) return { error: "Не выбрана страница" };

  const result = parseMaterial(raw, mode);
  if (result.phrases.length === 0) {
    return { error: result.warnings[0] ?? "Не удалось разобрать текст" };
  }

  let coverImageUrl: string | undefined;
  const coverFile = formData.get("coverImage");
  if (mode === "vocabulary" && coverFile instanceof File && coverFile.size > 0) {
    const stored = await storeVocabularyCover(coverFile, nodeId);
    if ("error" in stored) return { error: stored.error };
    coverImageUrl = stored.imageUrl;
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
      pageKind: mode === "mistake" ? "MISTAKE" : "VOCAB",
      sourceText: raw.slice(0, 200_000),
      ...(coverImageUrl ? { imageUrl: coverImageUrl } : {}),
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
const RULE_BLOCK_VARIANTS: RuleBlockVariant[] = [
  "sheet-text",
  "sheet-lead",
  "sheet-section",
  "sheet-formula",
  "sheet-formula-grid",
  "sheet-table",
  "sheet-mistake",
  "sheet-quiz",
  "sheet-answers",
];

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
    const variant = RULE_BLOCK_VARIANTS.includes(String(b.variant) as RuleBlockVariant)
      ? (String(b.variant) as RuleBlockVariant)
      : undefined;
    const styled = variant ? { variant } : {};

    switch (b.type) {
      case "heading":
      case "formula":
      case "text": {
        const text = str(b.text);
        if (text) out.push({ type: b.type, text, ...styled });
        break;
      }
      case "callout": {
        const text = str(b.text);
        if (!text) break;
        const tone = ["key", "warn", "tip", "info"].includes(String(b.tone))
          ? (b.tone as "key" | "warn" | "tip" | "info")
          : "info";
        const label = str(b.label);
        out.push({ type: "callout", text, tone, ...(label ? { label } : {}), ...styled });
        break;
      }
      case "example": {
        const en = str(b.en);
        if (!en) break;
        const tr = str(b.tr);
        out.push({ type: "example", en, ...(tr ? { tr } : {}), ...styled });
        break;
      }
      case "list": {
        const items = Array.isArray(b.items)
          ? b.items.map(str).filter(Boolean).slice(0, 100)
          : [];
        if (items.length) out.push({ type: "list", items, ...styled });
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
        if (headers.length || rows.length) {
          out.push({ type: "table", headers, rows, ...styled });
        }
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

// ---------------------------------------------------------------- отчёт

export type ReportPayload = {
  studentName: string;
  meta: string[];
  entries: {
    path: string[];
    page: {
      title: string;
      description: string | null;
      phrases: MaterialPhrase[];
      blocks: RuleBlock[];
    };
  }[];
};

/**
 * Всё пройденное учеником одним куском: личные материалы, открытые
 * разделы общей базы и разбор ошибок. Нужен и как отчёт человеку,
 * и как выжимка для модели — отсюда шапка с уровнем и числом уроков.
 */
export async function buildStudentReportAction(
  studentId: string,
): Promise<ReportPayload> {
  await requireTeacher();

  const [student] = await db
    .select({
      name: users.name,
      level: users.level,
      lessonsBefore: users.lessonsBefore,
      startedAt: users.startedAt,
      approximate: users.statsApproximate,
    })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!student) return { studentName: "", meta: [], entries: [] };

  const [own, shared, mistakes] = await Promise.all([
    getOwnedTree("STUDENT", studentId),
    getMaterialsTree(studentId),
    getOwnedTree("MISTAKE", studentId),
  ]);

  const [{ done } = { done: 0 }] = await db
    .select({ done: sql<number>`count(*)::int` })
    .from(lessons)
    .where(and(eq(lessons.studentId, studentId), eq(lessons.status, "COMPLETED")));

  const [{ firstAt } = { firstAt: null }] = await db
    .select({ firstAt: sql<Date | null>`min(${lessons.startTime})` })
    .from(lessons)
    .where(and(eq(lessons.studentId, studentId), eq(lessons.status, "COMPLETED")));

  const total = done + student.lessonsBefore;
  const since = student.startedAt ?? firstAt;
  const about = student.approximate ? "≈ " : "";

  const meta = [
    student.level ? `Уровень: ${student.level}` : null,
    `Проведено уроков: ${about}${Math.max(0, total)}`,
    since ? `Занимаемся с: ${since.toLocaleDateString("ru-RU")}` : null,
    `Отчёт составлен: ${new Date().toLocaleDateString("ru-RU")}`,
  ].filter((s): s is string => !!s);

  // Обходим дерево вглубь, запоминая путь — он идёт заголовком в отчёте.
  const entries: ReportPayload["entries"] = [];
  const walk = (nodes: MaterialNode[], path: string[]) => {
    for (const n of nodes) {
      const here = [...path, n.name];
      if (n.phrases.length > 0 || n.blocks.length > 0) {
        entries.push({
          path: here,
          page: {
            title: n.name,
            description: n.description,
            phrases: n.phrases,
            blocks: n.blocks,
          },
        });
      }
      if (n.children.length) walk(n.children, here);
    }
  };

  walk(own, ["Личные материалы"]);
  walk(shared, ["Общая база"]);
  walk(mistakes, ["Ошибки"]);

  return { studentName: student.name, meta, entries };
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
  scope: NodeScope;
  ownerId: string | null;
  nodes: CopyNode[];
};

/** Все деревья, доступные как место назначения. */
export async function listCopyTargetsAction(): Promise<CopyTree[]> {
  const session = await requireTeacher();

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

  const [teacher] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return [
    {
      key: "material",
      label: "Общая библиотека",
      scope: "MATERIAL" as const,
      ownerId: null,
      nodes: pick("MATERIAL", null),
    },
    {
      key: "personal",
      label: `Мои материалы — ${teacher?.name ?? "учитель"}`,
      scope: "PERSONAL" as const,
      ownerId: session.userId,
      nodes: pick("PERSONAL", session.userId),
    },
    ...students.flatMap((s) => [
      {
        key: `student-${s.id}`,
        label: `Материалы — ${s.name}`,
        scope: "STUDENT" as const,
        ownerId: s.id,
        nodes: pick("STUDENT", s.id),
      },
      {
        key: `mistake-${s.id}`,
        label: `Ошибки — ${s.name}`,
        scope: "MISTAKE" as const,
        ownerId: s.id,
        nodes: pick("MISTAKE", s.id),
      },
    ]),
  ];
}

export type CopyInput = {
  /** Что копируем — выбранные узлы верхнего уровня. */
  ids: string[];
  /** Какие вложенные узлы взять с собой. Пусто — только сами выбранные. */
  includeIds: string[];
  targetParentId: string | null;
  targetScope: NodeScope;
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

  const scope = asScope(input.targetScope);
  const ownerId = isOwned(scope) ? input.targetOwnerId || null : null;
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
        translationLang: src.translationLang,
        mergeCount: src.mergeCount,
        sourceText: src.sourceText,
        sortOrder: await nextOrder(parentId),
      })
      .returning();

    pairs.push({ srcId, newId: row.id });

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

/**
 * Задать, какие разделы общей базы видит ученик.
 * Список приходит целиком: чего в нём нет — то у ученика снимается.
 */
export async function setAssignmentsAction(
  studentId: string,
  nodeIds: string[],
): Promise<BulkState> {
  await requireTeacher();
  if (!studentId) return { error: "Не выбран ученик" };

  const wanted = new Set((nodeIds ?? []).filter(Boolean));

  // Новую выдачу можно создать для корневого раздела. Уже выданный раздел
  // остаётся управляемым и после переноса внутрь другой папки.
  const roots = await db
    .select({ id: materialNodes.id })
    .from(materialNodes)
    .where(
      and(
        eq(materialNodes.scope, "MATERIAL"),
        isNull(materialNodes.parentId),
        isNull(materialNodes.ownerId),
      ),
    );
  const current = await db
    .select({ nodeId: studentMaterials.materialNodeId })
    .from(studentMaterials)
    .where(eq(studentMaterials.studentId, studentId));
  const have = new Set(current.map((c) => c.nodeId));
  const allowed = new Set([...roots.map((r) => r.id), ...have]);

  const toAdd = [...wanted].filter((id) => allowed.has(id) && !have.has(id));
  const toDrop = [...have].filter((id) => allowed.has(id) && !wanted.has(id));

  if (toAdd.length) {
    await db
      .insert(studentMaterials)
      .values(toAdd.map((materialNodeId) => ({ studentId, materialNodeId })));
  }
  if (toDrop.length) {
    await db
      .delete(studentMaterials)
      .where(
        and(
          eq(studentMaterials.studentId, studentId),
          inArray(studentMaterials.materialNodeId, toDrop),
        ),
      );
  }

  revalidateMaterials();
  return { ok: true, message: `Открыто разделов: ${wanted.size}` };
}
