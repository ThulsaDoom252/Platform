"use server";

/**
 * Уроки: заготовки учителя и их копии у учеников.
 *
 * Заготовка (lesson_units) не меняется никогда: что бы ни происходило на
 * занятии, правится только закрепление за учеником
 * (lesson_assignments). Поэтому один урок раздаётся скольким угодно
 * ученикам, у каждого своя история, а исходник остаётся исходником.
 *
 * Словник урока наполняется разовой копией из материалов. Поэтому его
 * можно перестроить под занятие, не меняя исходный словник ученика.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonAssignments,
  lessonUnits,
  lessonWords,
  materialBlocks,
  materialNodes,
  materialPhrases,
  notifications,
  phraseImages,
  users,
  wordDeckActivities,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { parseLexisDocuments } from "@/lib/keyed-parser";
import { sanitizeBlocks, type RuleBlock } from "@/lib/rule-blocks";
import {
  BRITISH_OPTION,
  isLessonVocabularyRevealOption,
  isDialogueHighlightKey,
  isWordFocusKey,
  isSection,
  normalizeLessonHighlights,
  normalizeLessonVocabularyReveal,
  openSections,
  lessonVocabularyReveal,
  lessonVocabularyRevealOptions,
  parseKey,
  parseTranscript,
  selectLexisGroup,
  toggleWordFocus,
  toggleDialogueHighlight,
  type LessonSection,
  type LessonVocabularyReveal,
  type LessonWord,
  type TranscriptLine,
} from "@/lib/lesson-unit";
import { normalizeWordDeckSettings, type WordDeckSettings, type WordDeckSourceCard } from "@/lib/word-deck";
import {
  expectedClassVideoTime,
  normalizeClassVideoState,
  type ClassVideoState,
} from "@/lib/class-video";

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти");
  return session;
}

/* ------------------------------------------------------------------ */
/* Заготовки                                                           */
/* ------------------------------------------------------------------ */

export type LessonKind = "REGULAR" | "ACTIVITY";

export type LessonLexisGroup = {
  id: string;
  source: string;
  title: string;
  intro: string | null;
  blocks: RuleBlock[];
  warnings: string[];
  sourceNodeId: string | null;
};

/** Старый одиночный объект читается как массив из одной группы. */
function lessonLexisGroups(value: unknown): LessonLexisGroup[] {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return source.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const blocks = sanitizeBlocks(Array.isArray(item.blocks) ? item.blocks : []);
    if (!blocks.some((block) => block.type === "word")) return [];
    return [{
      id:
        typeof item.id === "string" && item.id && !item.id.includes(":")
          ? item.id
          : `legacy-${index}`,
      source: typeof item.source === "string" ? item.source : "",
      title: typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "Lexis",
      intro: typeof item.intro === "string" && item.intro.trim()
        ? item.intro.trim()
        : null,
      blocks,
      warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
      sourceNodeId: typeof item.sourceNodeId === "string" ? item.sourceNodeId : null,
    }];
  });
}

export type LessonCard = {
  id: string;
  kind: LessonKind;
  title: string;
  description: string | null;
  /** Чем урок наполнен — по этому видно, что ещё не сделано. */
  vocabName: string | null;
  words: number;
  hasLexis: boolean;
  hasVideo: boolean;
  lines: number;
  questions: number;
  tasks: number;
  /** Скольким ученикам выдан. */
  assigned: number;
  createdAt: string;
};

/** Уроки учителя, новые сверху. */
export async function listLessonsAction(): Promise<LessonCard[]> {
  const session = await requireTeacher();

  const rows = await db
    .select({ unit: lessonUnits, vocabName: materialNodes.name })
    .from(lessonUnits)
    .leftJoin(materialNodes, eq(materialNodes.id, lessonUnits.vocabNodeId))
    .where(eq(lessonUnits.authorId, session.userId))
    .orderBy(desc(lessonUnits.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.unit.id);

  // Сколько слов в словнике и скольким ученикам выдан — двумя выборками
  // на всё, а не по запросу на карточку.
  const nodeIds = rows.map((r) => r.unit.vocabNodeId).filter((id): id is string => !!id);
  const words = nodeIds.length
    ? await db
        .select({ nodeId: materialPhrases.nodeId })
        .from(materialPhrases)
        .where(inArray(materialPhrases.nodeId, nodeIds))
    : [];
  const given = await db
    .select({ unitId: lessonAssignments.unitId })
    .from(lessonAssignments)
    .where(inArray(lessonAssignments.unitId, ids));

  const countBy = <T extends string>(list: { [k: string]: T | null }[], key: string) => {
    const map = new Map<string, number>();
    for (const row of list) {
      const id = row[key];
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };
  const wordsOf = countBy(words, "nodeId");
  const givenOf = countBy(given, "unitId");

  return rows.map(({ unit, vocabName }) => {
    const questions = unit.questions ?? { afterVideo: [], afterReading: [] };
    return {
      id: unit.id,
      kind: (unit.kind === "REGULAR" ? "REGULAR" : "ACTIVITY") as LessonKind,
      title: unit.title,
      description: unit.description,
      vocabName,
      words: unit.vocabNodeId ? (wordsOf.get(unit.vocabNodeId) ?? 0) : 0,
      hasLexis: lessonLexisGroups(unit.lexis).length > 0,
      hasVideo: !!unit.videoUrl,
      lines: (unit.transcript ?? []).length,
      questions:
        (questions.afterVideo ?? []).length + (questions.afterReading ?? []).length,
      tasks: (unit.homework ?? []).length,
      assigned: givenOf.get(unit.id) ?? 0,
      createdAt: unit.createdAt.toISOString(),
    };
  });
}

export async function createLessonAction(
  title: string,
  kind: string,
): Promise<{ id?: string; error?: string }> {
  const session = await requireTeacher();
  const name = String(title ?? "").trim().slice(0, 160);
  if (!name) return { error: "Дай уроку название" };

  const [created] = await db
    .insert(lessonUnits)
    .values({
      authorId: session.userId,
      kind: kind === "REGULAR" ? "REGULAR" : "ACTIVITY",
      title: name,
    })
    .returning({ id: lessonUnits.id });

  revalidatePath("/teacher/lessons");
  return { id: created?.id };
}

export async function deleteLessonAction(id: string): Promise<{ error?: string }> {
  const session = await requireTeacher();
  await db
    .delete(lessonUnits)
    .where(
      and(eq(lessonUnits.id, String(id ?? "")), eq(lessonUnits.authorId, session.userId)),
    );
  revalidatePath("/teacher/lessons");
  return {};
}

/** Что правится в заготовке. Пустые поля не трогаются. */
export type LessonEdit = {
  title?: string;
  description?: string | null;
  vocabNodeId?: string | null;
  videoUrl?: string | null;
  videoTitle?: string | null;
  /** Расшифровка приходит текстом и разбирается здесь. */
  transcriptText?: string;
  afterVideo?: string[];
  afterReading?: string[];
  homework?: { title: string; text: string }[];
  activityIds?: string[];
};

export async function saveLessonAction(
  id: string,
  edit: LessonEdit,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const unitId = String(id ?? "");

  const [mine] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, unitId), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!mine) return { error: "Урок не найден" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const lines = (list: string[] | undefined) =>
    (list ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);

  if (edit.title !== undefined) {
    const name = String(edit.title).trim().slice(0, 160);
    if (!name) return { error: "Дай уроку название" };
    patch.title = name;
  }
  if (edit.description !== undefined) {
    patch.description = String(edit.description ?? "").trim() || null;
  }
  if (edit.vocabNodeId !== undefined) {
    patch.vocabNodeId = edit.vocabNodeId ? String(edit.vocabNodeId) : null;
  }
  if (edit.videoUrl !== undefined) {
    patch.videoUrl = String(edit.videoUrl ?? "").trim() || null;
  }
  if (edit.videoTitle !== undefined) {
    patch.videoTitle = String(edit.videoTitle ?? "").trim() || null;
  }
  if (edit.transcriptText !== undefined) {
    patch.transcript = parseTranscript(edit.transcriptText);
  }
  if (edit.afterVideo !== undefined || edit.afterReading !== undefined) {
    const [current] = await db
      .select({ questions: lessonUnits.questions })
      .from(lessonUnits)
      .where(eq(lessonUnits.id, unitId))
      .limit(1);
    const kept = current?.questions ?? { afterVideo: [], afterReading: [] };
    patch.questions = {
      afterVideo:
        edit.afterVideo !== undefined ? lines(edit.afterVideo) : kept.afterVideo,
      afterReading:
        edit.afterReading !== undefined ? lines(edit.afterReading) : kept.afterReading,
    };
  }
  if (edit.homework !== undefined) {
    patch.homework = (edit.homework ?? [])
      .map((task) => ({
        title: String(task?.title ?? "").trim(),
        text: String(task?.text ?? "").trim(),
      }))
      .filter((task) => task.title || task.text);
  }
  if (edit.activityIds !== undefined) {
    const requested = [...new Set((edit.activityIds ?? []).map(String).filter(Boolean))];
    if (requested.length === 0) {
      patch.activityIds = [];
    } else {
      const owned = await db
        .select({ id: wordDeckActivities.id })
        .from(wordDeckActivities)
        .where(
          and(
            eq(wordDeckActivities.authorId, session.userId),
            inArray(wordDeckActivities.id, requested),
          ),
        );
      patch.activityIds = requested.filter((id) => owned.some((row) => row.id === id));
    }
  }

  await db.update(lessonUnits).set(patch).where(eq(lessonUnits.id, unitId));
  revalidatePath("/teacher/lessons");
  return {};
}

/* ------------------------------------------------------------------ */
/* Урок целиком                                                        */
/* ------------------------------------------------------------------ */

export type LessonView = {
  id: string;
  kind: LessonKind;
  title: string;
  description: string | null;
  vocabNodeId: string | null;
  vocabName: string | null;
  words: LessonWord[];
  lexis: LessonLexisGroup[];
  videoUrl: string | null;
  videoTitle: string | null;
  transcript: TranscriptLine[];
  questions: { afterVideo: string[]; afterReading: string[] };
  homework: { title: string; text: string }[];
  activities: {
    id: string;
    title: string;
    cards: WordDeckSourceCard[];
    settings: WordDeckSettings;
    backgroundImageUrl: string | null;
  }[];
};

/** Словник урока — свой, не ссылка на материалы. */
async function wordsOfUnit(unitId: string): Promise<LessonWord[]> {
  const rows = await db
    .select()
    .from(lessonWords)
    .where(eq(lessonWords.unitId, unitId))
    .orderBy(asc(lessonWords.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    category: r.category ?? "",
    icon: r.icon,
    word: r.word,
    ipaUs: r.ipaUs,
    ipaUk: r.ipaUk,
    translation: r.translation,
    description: r.description,
    imageUrl: r.imageUrl,
  }));
}

/**
 * Наполнить словник урока из материалов.
 *
 * Разовое копирование, а не ссылка: в уроке словник чистят и
 * перекладывают под конкретное занятие, и материалы от этого меняться
 * не должны. Прежний список заменяется целиком — «наполнить» значит
 * наполнить, а не подмешать.
 */
export async function fillVocabAction(
  unitId: string,
  nodeId: string,
): Promise<{ added?: number; error?: string }> {
  const session = await requireTeacher();
  const id = String(unitId ?? "");

  const [mine] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!mine) return { error: "Урок не найден" };

  const rows = await db
    .select({
      phraseId: materialPhrases.id,
      icon: materialPhrases.icon,
      word: materialPhrases.phrase,
      ipaUs: materialPhrases.transcriptionUs,
      ipaUk: materialPhrases.transcriptionUk,
      translation: materialPhrases.translation,
      description: materialPhrases.description,
      category: materialPhrases.section,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, String(nodeId ?? "")))
    .orderBy(asc(materialPhrases.sortOrder));

  // Заметки 💡 — не слова: в словнике урока им места нет.
  const words = rows.filter((r) => r.kind !== "NOTE");
  if (words.length === 0) return { error: "В словнике нет слов" };

  const ids = words.map((r) => r.phraseId);
  const images = await db
    .select({ phraseId: phraseImages.phraseId, url: phraseImages.url })
    .from(phraseImages)
    .where(and(inArray(phraseImages.phraseId, ids), eq(phraseImages.picked, true)));
  const imageOf = new Map(images.map((i) => [i.phraseId, i.url]));

  await db.delete(lessonWords).where(eq(lessonWords.unitId, id));
  await db.insert(lessonWords).values(
    words.map((r, at) => ({
      unitId: id,
      category: r.category ?? "",
      icon: r.icon,
      word: r.word,
      ipaUs: r.ipaUs,
      ipaUk: r.ipaUk,
      translation: r.translation,
      description: r.description,
      imageUrl: imageOf.get(r.phraseId) ?? null,
      sortOrder: at + 1,
    })),
  );

  await db
    .update(lessonUnits)
    .set({ vocabNodeId: String(nodeId ?? ""), updatedAt: new Date() })
    .where(eq(lessonUnits.id, id));

  revalidatePath("/teacher/lessons");
  return { added: words.length };
}

/** Правка одного слова словника: перевод, описание, категория. */
export async function saveWordAction(
  wordId: string,
  edit: Partial<Pick<LessonWord, "word" | "translation" | "description" | "category" | "icon">>,
): Promise<{ error?: string }> {
  await requireTeacher();
  const patch: Record<string, unknown> = {};
  for (const key of ["word", "translation", "description", "category", "icon"] as const) {
    const value = edit[key];
    if (value === undefined) continue;
    patch[key] = key === "word" || key === "category"
      ? String(value ?? "").trim()
      : (String(value ?? "").trim() || null);
  }
  if (Object.keys(patch).length === 0) return {};

  await db.update(lessonWords).set(patch).where(eq(lessonWords.id, String(wordId ?? "")));
  return {};
}

export async function deleteWordAction(wordId: string): Promise<{ error?: string }> {
  await requireTeacher();
  await db.delete(lessonWords).where(eq(lessonWords.id, String(wordId ?? "")));
  return {};
}

async function loadUnit(unitId: string): Promise<LessonView | null> {
  const [row] = await db
    .select({ unit: lessonUnits, vocabName: materialNodes.name })
    .from(lessonUnits)
    .leftJoin(materialNodes, eq(materialNodes.id, lessonUnits.vocabNodeId))
    .where(eq(lessonUnits.id, unitId))
    .limit(1);

  if (!row) return null;
  const { unit } = row;
  const questions = unit.questions ?? { afterVideo: [], afterReading: [] };
  const activityIds = unit.activityIds ?? [];
  const activityRows = activityIds.length
    ? await db
        .select()
        .from(wordDeckActivities)
        .where(inArray(wordDeckActivities.id, activityIds))
    : [];
  const activityOf = new Map(activityRows.map((activity) => [activity.id, activity]));

  return {
    id: unit.id,
    kind: (unit.kind === "REGULAR" ? "REGULAR" : "ACTIVITY") as LessonKind,
    title: unit.title,
    description: unit.description,
    vocabNodeId: unit.vocabNodeId,
    vocabName: row.vocabName,
    words: await wordsOfUnit(unit.id),
    lexis: lessonLexisGroups(unit.lexis),
    videoUrl: unit.videoUrl,
    videoTitle: unit.videoTitle,
    transcript: unit.transcript ?? [],
    questions: {
      afterVideo: questions.afterVideo ?? [],
      afterReading: questions.afterReading ?? [],
    },
    homework: unit.homework ?? [],
    activities: activityIds.flatMap((id) => {
      const activity = activityOf.get(id);
      return activity
        ? [{
            id: activity.id,
            title: activity.title,
            cards: activity.cards ?? [],
            settings: normalizeWordDeckSettings(activity.settings),
            backgroundImageUrl: activity.backgroundImageUrl,
          }]
        : [];
    }),
  };
}

/** Урок как есть — учителю, для правки и для показа. */
export async function lessonAction(id: string): Promise<LessonView | null> {
  await requireTeacher();
  return loadUnit(String(id ?? ""));
}

/** Словники из материалов — на выбор для секции Vocabulary. */
export async function vocabNodesAction(): Promise<
  { id: string; name: string; scope: string; words: number }[]
> {
  const session = await requireTeacher();

  /*
   * Только общая база и личное дерево учителя. Личные копии учеников
   * сюда не идут: один и тот же словник разошёлся бы по списку в
   * десяти экземплярах с одинаковыми именами, и выбрать нужный было бы
   * нельзя.
   */
  const nodes = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      scope: materialNodes.scope,
    })
    .from(materialNodes)
    .where(
      and(
        eq(materialNodes.pageKind, "VOCAB"),
        or(
          eq(materialNodes.scope, "MATERIAL"),
          and(
            eq(materialNodes.scope, "PERSONAL"),
            eq(materialNodes.ownerId, session.userId),
          ),
        ),
      ),
    )
    .orderBy(asc(materialNodes.name));

  if (nodes.length === 0) return [];

  const rows = await db
    .select({ nodeId: materialPhrases.nodeId })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, nodes.map((n) => n.id)));

  const count = new Map<string, number>();
  for (const r of rows) count.set(r.nodeId, (count.get(r.nodeId) ?? 0) + 1);

  return nodes.map((n) => ({ ...n, words: count.get(n.id) ?? 0 }));
}

/** Страницы LEXIS из общей базы и личных материалов учителя. */
export async function lexisNodesAction(): Promise<
  { id: string; name: string; scope: string; blocks: number }[]
> {
  const session = await requireTeacher();
  const nodes = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      scope: materialNodes.scope,
    })
    .from(materialNodes)
    .where(
      and(
        eq(materialNodes.pageKind, "LEXIS"),
        or(
          eq(materialNodes.scope, "MATERIAL"),
          and(
            eq(materialNodes.scope, "PERSONAL"),
            eq(materialNodes.ownerId, session.userId),
          ),
        ),
      ),
    )
    .orderBy(asc(materialNodes.name));

  if (nodes.length === 0) return [];
  const rows = await db
    .select({ nodeId: materialBlocks.nodeId })
    .from(materialBlocks)
    .where(inArray(materialBlocks.nodeId, nodes.map((node) => node.id)));
  const count = new Map<string, number>();
  for (const row of rows) count.set(row.nodeId, (count.get(row.nodeId) ?? 0) + 1);

  return nodes.map((node) => ({ ...node, blocks: count.get(node.id) ?? 0 }));
}

/** Разобрать одну или несколько TYPE: LEXIS-групп и добавить их в урок. */
export async function saveLessonLexisAction(
  unitId: string,
  source: string,
): Promise<{ lexis?: LessonLexisGroup[]; error?: string }> {
  const session = await requireTeacher();
  const id = String(unitId ?? "");
  const [mine] = await db
    .select({ id: lessonUnits.id, lexis: lessonUnits.lexis })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!mine) return { error: "Урок не найден" };

  const raw = String(source ?? "").trim();
  if (!raw) return { error: "Вставь хотя бы одну группу TYPE: LEXIS" };

  const parsed = parseLexisDocuments(raw);
  if (parsed.length === 0) {
    return { error: "Не нашлось ни одной группы TYPE: LEXIS" };
  }
  if (parsed.some((group) => !group.blocks.some((block) => block.type === "word"))) {
    return { error: "В каждой группе должна быть хотя бы одна запись ITEM" };
  }

  const lexis = lessonLexisGroups(mine.lexis);
  for (const group of parsed) {
    const title = group.title?.trim() || "Lexis";
    const existing = lexis.findIndex(
      (item) => item.title.toLocaleLowerCase() === title.toLocaleLowerCase(),
    );
    const next: LessonLexisGroup = {
      id: existing >= 0 ? lexis[existing].id : randomUUID(),
      source: group.source,
      title,
      intro: group.subtitle?.trim() || null,
      blocks: sanitizeBlocks(group.blocks),
      warnings: group.warnings,
      sourceNodeId: null,
    };
    if (existing >= 0) lexis[existing] = next;
    else lexis.push(next);
  }
  await db
    .update(lessonUnits)
    .set({ lexis, updatedAt: new Date() })
    .where(eq(lessonUnits.id, id));

  revalidatePath("/teacher/lessons");
  revalidatePath("/student/class");
  return { lexis };
}

/** Разово скопировать уже разобранную LEXIS-страницу из материалов. */
export async function fillLessonLexisAction(
  unitId: string,
  nodeId: string,
): Promise<{ lexis?: LessonLexisGroup[]; error?: string }> {
  const session = await requireTeacher();
  const id = String(unitId ?? "");
  const sourceId = String(nodeId ?? "");

  const [[mine], [node]] = await Promise.all([
    db
      .select({ id: lessonUnits.id, lexis: lessonUnits.lexis })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)))
      .limit(1),
    db
      .select({
        id: materialNodes.id,
        name: materialNodes.name,
        description: materialNodes.description,
        sourceText: materialNodes.sourceText,
      })
      .from(materialNodes)
      .where(
        and(
          eq(materialNodes.id, sourceId),
          eq(materialNodes.pageKind, "LEXIS"),
          or(
            eq(materialNodes.scope, "MATERIAL"),
            and(
              eq(materialNodes.scope, "PERSONAL"),
              eq(materialNodes.ownerId, session.userId),
            ),
          ),
        ),
      )
      .limit(1),
  ]);
  if (!mine) return { error: "Урок не найден" };
  if (!node) return { error: "Лексика не найдена" };

  const rows = await db
    .select({ data: materialBlocks.data })
    .from(materialBlocks)
    .where(eq(materialBlocks.nodeId, sourceId))
    .orderBy(asc(materialBlocks.sortOrder));
  const blocks = sanitizeBlocks(rows.map((row) => row.data));
  if (!blocks.some((block) => block.type === "word")) {
    return { error: "В материале нет разобранной лексики" };
  }

  const lexis = lessonLexisGroups(mine.lexis);
  const found = lexis.findIndex((group) => group.sourceNodeId === node.id);
  const group: LessonLexisGroup = {
    id: found >= 0 ? lexis[found].id : randomUUID(),
    source: node.sourceText?.trim() ?? "",
    title: node.name,
    intro: node.description?.trim() || null,
    blocks,
    warnings: [],
    sourceNodeId: node.id,
  };
  if (found >= 0) lexis[found] = group;
  else lexis.push(group);
  await db
    .update(lessonUnits)
    .set({ lexis, updatedAt: new Date() })
    .where(eq(lessonUnits.id, id));

  revalidatePath("/teacher/lessons");
  revalidatePath("/student/class");
  return { lexis };
}

/** Удалить одну группу, не затрагивая остальные группы и материалы. */
export async function deleteLessonLexisAction(
  unitId: string,
  groupId: string,
): Promise<{ lexis?: LessonLexisGroup[]; error?: string }> {
  const session = await requireTeacher();
  const id = String(unitId ?? "");
  const target = String(groupId ?? "");
  const [mine] = await db
    .select({ id: lessonUnits.id, lexis: lessonUnits.lexis })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!mine) return { error: "Урок не найден" };

  const current = lessonLexisGroups(mine.lexis);
  if (!current.some((group) => group.id === target)) {
    return { error: "Группа лексики не найдена" };
  }
  const lexis = current.filter((group) => group.id !== target);
  await db
    .update(lessonUnits)
    .set({ lexis, updatedAt: new Date() })
    .where(eq(lessonUnits.id, id));
  revalidatePath("/teacher/lessons");
  revalidatePath("/student/class");
  return { lexis };
}

/* ------------------------------------------------------------------ */
/* Закрепление за учеником                                             */
/* ------------------------------------------------------------------ */

export type LessonAssignmentCard = {
  id: string;
  unitId: string;
  title: string;
  studentId: string;
  studentName: string;
  openSections: string[];
  highlights: Record<string, string>;
  finishedAt: string | null;
  createdAt: string;
};

/** Закрепить урок за учеником. Второй раз — то же закрепление. */
export async function pinLessonAction(
  unitId: string,
  studentId: string,
): Promise<{ id?: string; error?: string }> {
  await requireTeacher();
  const unit = String(unitId ?? "");
  const student = String(studentId ?? "");
  if (!unit || !student) return { error: "Не выбран урок или ученик" };

  const [already] = await db
    .select({ id: lessonAssignments.id })
    .from(lessonAssignments)
    .where(
      and(
        eq(lessonAssignments.unitId, unit),
        eq(lessonAssignments.studentId, student),
      ),
    )
    .limit(1);

  if (already) return { id: already.id };

  const [created] = await db
    .insert(lessonAssignments)
    .values({ unitId: unit, studentId: student })
    .returning({ id: lessonAssignments.id });

  const [name] = await db
    .select({ title: lessonUnits.title })
    .from(lessonUnits)
    .where(eq(lessonUnits.id, unit))
    .limit(1);

  await db.insert(notifications).values({
    recipientId: student,
    type: "HOMEWORK_SUBMITTED",
    message: `Новый урок: ${name?.title ?? ""}`,
    relatedStudentId: student,
  });

  revalidatePath("/teacher/lessons");
  revalidatePath("/student/class");
  return { id: created?.id };
}

/**
 * Добавить заготовку в текущий класс и сразу сделать её активным уроком.
 *
 * Если урок уже выдавался этому ученику, второй экземпляр не создаётся:
 * класс просто возвращается к прежнему закреплению с его подсветками и
 * открытыми секциями.
 */
export async function addLessonToClassAction(
  unitId: string,
): Promise<{ id?: string; error?: string }> {
  const session = await requireTeacher();
  const unit = String(unitId ?? "");
  if (!unit) return { error: "Не выбран урок" };

  const [[me], [lesson]] = await Promise.all([
    db
      .select({ studentId: users.classWithId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    db
      .select({ id: lessonUnits.id })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.id, unit), eq(lessonUnits.authorId, session.userId)))
      .limit(1),
  ]);

  if (!me?.studentId) return { error: "Сначала войди в класс к ученику" };
  if (!lesson) return { error: "Урок не найден" };

  const [student] = await db
    .select({ classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.id, me.studentId), eq(users.role, "STUDENT")))
    .limit(1);
  if (!student) return { error: "Ученик не найден" };

  const result = await pinLessonAction(unit, me.studentId);
  if (result.error || !result.id) return result;

  const previous = student.classFocus;
  await db
    .update(users)
    .set({
      classFocus: {
        panel: previous?.panel ?? "lesson",
        at: previous?.at ?? new Date().toISOString(),
        lessonAssignmentId: result.id,
      },
    })
    .where(eq(users.id, me.studentId));

  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return { id: result.id };
}

export async function unpinLessonAction(id: string): Promise<{ error?: string }> {
  await requireTeacher();
  await db.delete(lessonAssignments).where(eq(lessonAssignments.id, String(id ?? "")));
  revalidatePath("/teacher/lessons");
  return {};
}

/** Закрепления ученика — и текущие, и пройденные. */
export async function studentLessonsAction(
  studentId: string,
): Promise<LessonAssignmentCard[]> {
  await requireTeacher();
  return cardsFor(String(studentId ?? ""));
}

async function cardsFor(studentId: string): Promise<LessonAssignmentCard[]> {
  if (!studentId) return [];

  const rows = await db
    .select({
      a: lessonAssignments,
      title: lessonUnits.title,
      name: users.name,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .innerJoin(users, eq(users.id, lessonAssignments.studentId))
    .where(eq(lessonAssignments.studentId, studentId))
    .orderBy(desc(lessonAssignments.createdAt));

  return rows.map(({ a, title, name }) => ({
    id: a.id,
    unitId: a.unitId,
    title,
    studentId: a.studentId,
    studentName: name,
    openSections: openSections(a.openSections),
    highlights: normalizeLessonHighlights(a.highlights),
    finishedAt: a.finishedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

/** Свои уроки — ученику. */
export async function myLessonsAction(): Promise<LessonAssignmentCard[]> {
  const session = await requireUser();
  return session.role === "STUDENT" ? cardsFor(session.userId) : [];
}

/** Открыть или закрыть секцию ученику. Словник закрыть нельзя. */
export async function openSectionAction(
  assignmentId: string,
  section: string,
  open: boolean,
): Promise<{ error?: string }> {
  await requireTeacher();
  if (!isSection(section)) return { error: "Неизвестная секция" };
  if (section === "vocab") return { error: "Словник открыт всегда" };

  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({ openSections: lessonAssignments.openSections })
    .from(lessonAssignments)
    .where(eq(lessonAssignments.id, id))
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  const current = new Set(row.openSections ?? []);
  if (open) current.add(section);
  else current.delete(section);

  await db
    .update(lessonAssignments)
    .set({ openSections: [...current], updatedAt: new Date() })
    .where(eq(lessonAssignments.id, id));

  revalidatePath("/student/class");
  return {};
}

/**
 * Показать ученику конкретную секцию один раз, не меняя его постоянный доступ.
 * Закрытая вкладка останется закрытой для самостоятельного выбора.
 */
export async function focusLessonSectionAction(
  assignmentId: string,
  section: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  if (!isSection(section)) return { error: "Неизвестная секция" };
  const id = String(assignmentId ?? "");

  const [[teacher], [target]] = await Promise.all([
    db
      .select({ studentId: users.classWithId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    db
      .select({
        studentId: lessonAssignments.studentId,
        classFocus: users.classFocus,
      })
      .from(lessonAssignments)
      .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
      .innerJoin(users, eq(users.id, lessonAssignments.studentId))
      .where(
        and(
          eq(lessonAssignments.id, id),
          eq(lessonUnits.authorId, session.userId),
          eq(users.role, "STUDENT"),
        ),
      )
      .limit(1),
  ]);

  if (!teacher?.studentId || teacher.studentId !== target?.studentId) {
    return { error: "Этот ученик сейчас не в классе" };
  }

  await db
    .update(users)
    .set({
      classFocus: {
        ...target.classFocus,
        at: new Date().toISOString(),
        view: "LESSON",
        boardObjectId: null,
        lessonAssignmentId: id,
        lessonSection: section,
      },
    })
    .where(and(eq(users.id, target.studentId), eq(users.role, "STUDENT")));

  return {};
}

export type LessonVideoUpdate = Pick<
  ClassVideoState,
  "currentTime" | "playing" | "captions" | "muted" | "volume" | "playbackRate"
>;

/**
 * Передать ученику состояние нативного видеоплеера.
 *
 * Клиент сообщает только положение элементов управления. Принадлежность
 * урока и конкретного ученика заново проверяются по сессии учителя.
 */
export async function syncLessonVideoAction(
  assignmentId: string,
  update: LessonVideoUpdate,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");

  const [[teacher], [target]] = await Promise.all([
    db
      .select({ studentId: users.classWithId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    db
      .select({
        studentId: lessonAssignments.studentId,
        videoUrl: lessonUnits.videoUrl,
        classFocus: users.classFocus,
      })
      .from(lessonAssignments)
      .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
      .innerJoin(users, eq(users.id, lessonAssignments.studentId))
      .where(
        and(
          eq(lessonAssignments.id, id),
          eq(lessonUnits.authorId, session.userId),
          eq(users.role, "STUDENT"),
        ),
      )
      .limit(1),
  ]);

  if (!teacher?.studentId || teacher.studentId !== target?.studentId) {
    return { error: "Этот ученик сейчас не в классе" };
  }
  if (!target.videoUrl) return { error: "В уроке нет видео" };

  const previous = normalizeClassVideoState(target.classFocus?.videoState);
  const now = new Date().toISOString();
  const videoState = normalizeClassVideoState({
    ...update,
    assignmentId: id,
    at: now,
    ...(previous?.assignmentId === id && previous.focusAt
      ? { focusAt: previous.focusAt }
      : {}),
  });
  if (!videoState) return { error: "Некорректное состояние видео" };

  await db
    .update(users)
    .set({
      classFocus: {
        ...target.classFocus,
        at: target.classFocus?.at ?? now,
        videoState,
      },
    })
    .where(and(eq(users.id, target.studentId), eq(users.role, "STUDENT")));

  return {};
}

/** Сфокусировать Video, не открывая ученику постоянный доступ к вкладке. */
export async function focusLessonVideoAction(
  assignmentId: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");

  const [[teacher], [target]] = await Promise.all([
    db
      .select({ studentId: users.classWithId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    db
      .select({
        studentId: lessonAssignments.studentId,
        videoUrl: lessonUnits.videoUrl,
        classFocus: users.classFocus,
      })
      .from(lessonAssignments)
      .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
      .innerJoin(users, eq(users.id, lessonAssignments.studentId))
      .where(
        and(
          eq(lessonAssignments.id, id),
          eq(lessonUnits.authorId, session.userId),
          eq(users.role, "STUDENT"),
        ),
      )
      .limit(1),
  ]);

  if (!teacher?.studentId || teacher.studentId !== target?.studentId) {
    return { error: "Этот ученик сейчас не в классе" };
  }
  if (!target.videoUrl) return { error: "В уроке нет видео" };

  const now = new Date().toISOString();
  const previous = normalizeClassVideoState(target.classFocus?.videoState);
  const sameVideo = previous?.assignmentId === id ? previous : null;
  const videoState = normalizeClassVideoState({
    assignmentId: id,
    currentTime: sameVideo ? expectedClassVideoTime(sameVideo) : 0,
    playing: sameVideo?.playing ?? false,
    captions: sameVideo?.captions ?? true,
    muted: sameVideo?.muted ?? false,
    volume: sameVideo?.volume ?? 1,
    playbackRate: sameVideo?.playbackRate ?? 1,
    at: now,
    focusAt: now,
  });
  if (!videoState) return { error: "Не удалось открыть видео" };

  await db
    .update(users)
    .set({
      classFocus: {
        ...target.classFocus,
        at: now,
        view: "LESSON",
        boardObjectId: null,
        lessonAssignmentId: id,
        lessonSection: "video",
        videoState,
      },
    })
    .where(and(eq(users.id, target.studentId), eq(users.role, "STUDENT")));

  revalidatePath("/student/class");
  return {};
}

/**
 * Сфокусировать конкретного ученика на слове или части лексики.
 *
 * Повторное нажатие снимает фокус, нажатие на другое слово переносит
 * его. Цвет не хранится: каждый видит свой цвет темы.
 */
export async function focusLessonWordAction(
  assignmentId: string,
  key: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const focusKey = String(key ?? "");
  if (!isWordFocusKey(focusKey)) {
    return { error: "Можно сфокусировать только слово или часть лексики" };
  }

  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({
      studentId: lessonAssignments.studentId,
      highlights: lessonAssignments.highlights,
      lexis: lessonUnits.lexis,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(
      and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)),
    )
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  const parsedFocus = parseKey(focusKey);
  if (
    parsedFocus?.kind === "lexisBlock" &&
    !lessonLexisGroups(row.lexis).some((group) => group.id === parsedFocus.groupId)
  ) {
    return { error: "Группа лексики не найдена" };
  }
  const current = parsedFocus?.kind === "lexisBlock"
    ? selectLexisGroup(row.highlights, parsedFocus.groupId)
    : row.highlights;
  const lessonSection: LessonSection =
    parsedFocus?.kind === "lexisBlock"
      ? "lexis"
      : parsedFocus?.kind === "line" || parsedFocus?.kind === "lineWord"
        ? "transcript"
        : "vocab";

  const now = new Date();
  await db
    .update(lessonAssignments)
    .set({
      highlights: toggleWordFocus(current, focusKey),
      updatedAt: now,
    })
    .where(eq(lessonAssignments.id, id));

  const [teacherState] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (teacherState?.studentId === row.studentId) {
    /*
     * Фокус на уроке — явная команда показа. Если ученик сейчас смотрит
     * доску, его доска закроется и сразу откроется этот элемент урока.
     */
    await db
      .update(users)
      .set({
        classFocus: {
          at: now.toISOString(),
          view: "LESSON",
          boardObjectId: null,
          lessonAssignmentId: id,
          lessonSection,
        },
      })
      .where(and(eq(users.id, row.studentId), eq(users.role, "STUDENT")));
  }

  revalidatePath("/student/class");
  return {};
}

/** Переключить ученика на конкретную лексическую группу этого урока. */
export async function selectLessonLexisGroupAction(
  assignmentId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");
  const target = String(groupId ?? "");
  const [row] = await db
    .select({
      studentId: lessonAssignments.studentId,
      highlights: lessonAssignments.highlights,
      lexis: lessonUnits.lexis,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(
      and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)),
    )
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };
  if (!lessonLexisGroups(row.lexis).some((group) => group.id === target)) {
    return { error: "Группа лексики не найдена" };
  }
  await db
    .update(lessonAssignments)
    .set({
      highlights: selectLexisGroup(row.highlights, target),
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, id));

  const [teacherState] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (teacherState?.studentId === row.studentId) {
    await db
      .update(users)
      .set({
        classFocus: {
          at: new Date().toISOString(),
          view: "LESSON",
          boardObjectId: null,
          lessonAssignmentId: id,
          lessonSection: "lexis",
        },
      })
      .where(and(eq(users.id, row.studentId), eq(users.role, "STUDENT")));
  }
  revalidatePath("/student/class");
  return {};
}

/** Добавить или снять одно из независимых жёлтых выделений диалога. */
export async function highlightLessonDialogueAction(
  assignmentId: string,
  key: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const highlightKey = String(key ?? "");
  if (!isDialogueHighlightKey(highlightKey)) {
    return { error: "Можно выделить только слово или реплику диалога" };
  }

  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({ highlights: lessonAssignments.highlights })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(
      and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)),
    )
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  await db
    .update(lessonAssignments)
    .set({
      highlights: toggleDialogueHighlight(row.highlights, highlightKey),
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, id));

  revalidatePath("/student/class");
  return {};
}

/** Показать или скрыть британский вариант в конкретной выдаче урока. */
export async function showBritishAction(
  assignmentId: string,
  show: boolean,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  if (typeof show !== "boolean") return { error: "Неизвестная настройка" };
  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({ openSections: lessonAssignments.openSections })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(
      and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)),
    )
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  const current = new Set(row.openSections ?? []);
  if (show) current.add(BRITISH_OPTION);
  else current.delete(BRITISH_OPTION);

  await db
    .update(lessonAssignments)
    .set({ openSections: [...current], updatedAt: new Date() })
    .where(eq(lessonAssignments.id, id));

  revalidatePath("/student/class");
  return {};
}

/** Текущее раскрытие переводов и описаний — лёгкий опрос живого класса. */
export async function lessonVocabularyRevealAction(
  assignmentId: string,
): Promise<LessonVocabularyReveal | null> {
  const session = await requireUser();
  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({
      studentId: lessonAssignments.studentId,
      authorId: lessonUnits.authorId,
      openSections: lessonAssignments.openSections,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.id, id))
    .limit(1);
  if (!row) return null;
  if (session.role === "STUDENT" && row.studentId !== session.userId) return null;
  if (session.role === "TEACHER" && row.authorId !== session.userId) return null;
  return lessonVocabularyReveal(row.openSections);
}

/** Учитель открывает перевод или описание сразу для ученика в классе. */
export async function setLessonVocabularyRevealAction(
  assignmentId: string,
  raw: Partial<LessonVocabularyReveal>,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");
  const [[teacher], [row]] = await Promise.all([
    db
      .select({ studentId: users.classWithId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    db
      .select({
        studentId: lessonAssignments.studentId,
        unitId: lessonAssignments.unitId,
        openSections: lessonAssignments.openSections,
      })
      .from(lessonAssignments)
      .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
      .where(
        and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)),
      )
      .limit(1),
  ]);
  if (!row) return { error: "Урок не закреплён" };
  if (!teacher?.studentId || teacher.studentId !== row.studentId) {
    return { error: "Этот ученик сейчас не в классе" };
  }

  const wordRows = await db
    .select({ id: lessonWords.id })
    .from(lessonWords)
    .where(eq(lessonWords.unitId, row.unitId));
  const reveal = normalizeLessonVocabularyReveal(
    raw,
    new Set(wordRows.map((word) => word.id)),
  );
  const kept = (row.openSections ?? []).filter(
    (option) => !isLessonVocabularyRevealOption(option),
  );

  await db
    .update(lessonAssignments)
    .set({
      openSections: [...kept, ...lessonVocabularyRevealOptions(reveal)],
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, id));

  revalidatePath("/student/class");
  return {};
}

/** Ответ ученика по заданию урока — его собственная копия. */
export async function answerAction(
  assignmentId: string,
  key: string,
  text: string,
): Promise<{ error?: string }> {
  const session = await requireUser();
  const id = String(assignmentId ?? "");

  const [row] = await db
    .select({ studentId: lessonAssignments.studentId, answers: lessonAssignments.answers })
    .from(lessonAssignments)
    .where(eq(lessonAssignments.id, id))
    .limit(1);

  if (!row) return { error: "Урок не найден" };
  if (row.studentId !== session.userId) return { error: "Это чужой урок" };

  await db
    .update(lessonAssignments)
    .set({
      answers: { ...(row.answers ?? {}), [String(key ?? "")]: String(text ?? "") },
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, id));

  return {};
}

/** Урок с состоянием конкретного ученика — и ему, и учителю. */
export async function assignedLessonAction(assignmentId: string): Promise<
  | {
      assignment: LessonAssignmentCard;
      lesson: LessonView;
      answers: Record<string, string>;
      open: LessonSection[];
      showBritish: boolean;
      vocabularyReveal: LessonVocabularyReveal;
    }
  | null
> {
  const session = await requireUser();
  const id = String(assignmentId ?? "");

  const [row] = await db
    .select({ a: lessonAssignments, title: lessonUnits.title, name: users.name })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .innerJoin(users, eq(users.id, lessonAssignments.studentId))
    .where(eq(lessonAssignments.id, id))
    .limit(1);

  if (!row) return null;
  // Своё закрепление видит ученик, любое — учитель.
  if (session.role !== "TEACHER" && row.a.studentId !== session.userId) return null;

  const lesson = await loadUnit(row.a.unitId);
  if (!lesson) return null;

  const stored = row.a.openSections ?? [];
  return {
    assignment: {
      id: row.a.id,
      unitId: row.a.unitId,
      title: row.title,
      studentId: row.a.studentId,
      studentName: row.name,
      openSections: openSections(stored),
      highlights: normalizeLessonHighlights(row.a.highlights),
      finishedAt: row.a.finishedAt?.toISOString() ?? null,
      createdAt: row.a.createdAt.toISOString(),
    },
    lesson,
    answers: row.a.answers ?? {},
    open: openSections(stored),
    showBritish: stored.includes(BRITISH_OPTION),
    vocabularyReveal: lessonVocabularyReveal(stored),
  };
}
