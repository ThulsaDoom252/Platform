"use server";

/**
 * Уроки: заготовки учителя и их копии у учеников.
 *
 * Во время занятия учитель может сохранить личную версию в закреплении
 * ученика либо осознанно обновить исходный шаблон и все выданные копии.
 * Ответы, прогресс и подсветки при этом остаются в lesson_assignments.
 *
 * Словник урока наполняется разовой копией из материалов. Поэтому его
 * можно перестроить под занятие, не меняя исходный словник ученика.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, max, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonAssignments,
  lessonFolders,
  lessonUnits,
  lessonWords,
  materialBlocks,
  materialNodes,
  materialPhrases,
  phraseImages,
  users,
  wordDeckActivities,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { queueStudentNotification } from "@/lib/notifications";
import { parseLexisDocuments } from "@/lib/keyed-parser";
import { sanitizeBlocks, type RuleBlock } from "@/lib/rule-blocks";
import {
  BRITISH_OPTION,
  FOCUS_SLOT,
  HIDDEN_VOCAB_OPTION,
  isLessonVocabularyRevealOption,
  isLessonHighlightKey,
  isWordFocusKey,
  isSection,
  normalizeLessonHighlights,
  normalizeLessonVocabularyReveal,
  openSections,
  lessonSectionsForKind,
  lessonVocabularyReveal,
  lessonVocabularyRevealOptions,
  parseKey,
  parseTranscript,
  replaceLessonHighlights,
  selectLexisGroup,
  toggleLessonHighlight,
  isHighlightColor,
  type HighlightColor,
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
import {
  defaultRegularOpenSections,
  isRegularTranslationExercise,
  isRegularLessonFocusId,
  normalizeRegularLessonSections,
  publicRegularLessonSections,
  regularAnswerMap,
  regularAttempts,
  regularAttemptsKey,
  regularExerciseDeletedKey,
  regularExerciseOverride,
  regularExerciseOverrideKey,
  regularHomeworkExerciseId,
  regularResponseKey,
  regularLessonSection,
  regularStatus,
  regularStatusKey,
  regularVoiceRecording,
  regularVoiceRecordingKey,
  type RegularExerciseOverride,
  type RegularLessonSection,
} from "@/lib/regular-lesson";
import {
  assignedInteractiveHomework,
  findHomeworkItem,
  homeworkExerciseHidden,
  homeworkAssignedAt,
  homeworkAssignedExerciseIds,
  homeworkAssignedExercisesKey,
  homeworkFocusTarget,
  homeworkPlanForAssignment,
  homeworkPlanOverrideKey,
  homeworkRemovedAt,
  homeworkReviewedAtKey,
  homeworkSubmittedAtKey,
  homeworkValueKey,
  homeworkVoiceRecordingItemId,
  interactiveHomeworkFromEntries,
  legacyHomeworkFromEntries,
  normalizeHomeworkAnswer,
  normalizeInteractiveHomework,
  withoutHomeworkExerciseState,
  type InteractiveHomeworkPlan,
  type LessonHomeworkEntry,
} from "@/lib/lesson-homework";
import { installNewDerekLesson } from "@/lib/bundled-lessons/new-derek";
import { installGrammarCheckLesson } from "@/lib/bundled-lessons/grammar-check";
import { installA1AppearanceLesson } from "@/lib/bundled-lessons/a1-appearance";
import {
  translateShortTexts,
  translateVocabulary,
  type MaterialTranslationLang,
} from "@/lib/material-translation";
import { managedUploadPath, removePublicFile } from "@/lib/public-file-store";

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

export type LessonKind = "REGULAR" | "ACTIVITY" | "SHORTS";

function normalizeLessonKind(value: unknown): LessonKind {
  if (value === "REGULAR" || value === "SHORTS") return value;
  return "ACTIVITY";
}

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
  folderId: string | null;
  sortOrder: number;
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
  sections: number;
  /** Скольким ученикам выдан. */
  assigned: number;
  createdAt: string;
};

export type LessonFolderCard = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export async function listLessonFoldersAction(): Promise<LessonFolderCard[]> {
  const session = await requireTeacher();
  const rows = await db
    .select()
    .from(lessonFolders)
    .where(eq(lessonFolders.authorId, session.userId))
    .orderBy(asc(lessonFolders.sortOrder), asc(lessonFolders.name));
  return rows.map((folder) => ({
    id: folder.id,
    name: folder.name,
    sortOrder: folder.sortOrder,
    createdAt: folder.createdAt.toISOString(),
  }));
}

/** Уроки учителя, новые сверху. */
export async function listLessonsAction(): Promise<LessonCard[]> {
  const session = await requireTeacher();

  const rows = await db
    .select({ unit: lessonUnits, vocabName: materialNodes.name })
    .from(lessonUnits)
    .leftJoin(materialNodes, eq(materialNodes.id, lessonUnits.vocabNodeId))
    .where(eq(lessonUnits.authorId, session.userId))
    .orderBy(asc(lessonUnits.sortOrder), asc(lessonUnits.title));

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
      folderId: unit.folderId,
      sortOrder: unit.sortOrder,
      kind: normalizeLessonKind(unit.kind),
      title: unit.title,
      description: unit.description,
      vocabName,
      words: unit.vocabNodeId ? (wordsOf.get(unit.vocabNodeId) ?? 0) : 0,
      hasLexis: lessonLexisGroups(unit.lexis).length > 0,
      hasVideo: !!unit.videoUrl,
      lines: (unit.transcript ?? []).length,
      questions:
        (questions.afterVideo ?? []).length + (questions.afterReading ?? []).length,
      tasks:
        legacyHomeworkFromEntries(unit.homework).length +
        (interactiveHomeworkFromEntries(unit.homework)?.exercises.length ?? 0),
      sections: normalizeRegularLessonSections(unit.sections).filter((section) => !section.teacherOnly).length,
      assigned: givenOf.get(unit.id) ?? 0,
      createdAt: unit.createdAt.toISOString(),
    };
  });
}

/** One-time, authenticated import that runs against the app's current database. */
export async function installNewDerekLessonAction() {
  const session = await requireTeacher();
  const id = await installNewDerekLesson(session.userId);
  return { id };
}

/** One-time, authenticated import that runs against the app's current database. */
export async function installGrammarCheckLessonAction() {
  const session = await requireTeacher();
  const id = await installGrammarCheckLesson(session.userId);
  return { id };
}

/** One-time, authenticated import that runs against the app's current database. */
export async function installA1AppearanceLessonAction() {
  const session = await requireTeacher();
  const id = await installA1AppearanceLesson(session.userId);
  return { id };
}

export async function createLessonAction(
  title: string,
  kind: string,
  folderId?: string | null,
): Promise<{ id?: string; error?: string }> {
  const session = await requireTeacher();
  const name = String(title ?? "").trim().slice(0, 160);
  if (!name) return { error: "Дай уроку название" };
  const targetFolderId = folderId ? String(folderId) : null;
  if (targetFolderId) {
    const [folder] = await db
      .select({ id: lessonFolders.id })
      .from(lessonFolders)
      .where(and(eq(lessonFolders.id, targetFolderId), eq(lessonFolders.authorId, session.userId)))
      .limit(1);
    if (!folder) return { error: "Папка не найдена" };
  }
  const [last] = await db
    .select({ value: max(lessonUnits.sortOrder) })
    .from(lessonUnits)
    .where(and(
      eq(lessonUnits.authorId, session.userId),
      targetFolderId ? eq(lessonUnits.folderId, targetFolderId) : isNull(lessonUnits.folderId),
    ));

  const [created] = await db
    .insert(lessonUnits)
    .values({
      authorId: session.userId,
      kind: normalizeLessonKind(kind),
      title: name,
      folderId: targetFolderId,
      sortOrder: (last?.value ?? 0) + 10,
    })
    .returning({ id: lessonUnits.id });

  revalidatePath("/teacher/lessons");
  return { id: created?.id };
}

export async function createLessonFolderAction(
  rawName: string,
): Promise<{ folder?: LessonFolderCard; error?: string }> {
  const session = await requireTeacher();
  const name = String(rawName ?? "").trim().slice(0, 100);
  if (!name) return { error: "Дай папке название" };
  const [last] = await db
    .select({ value: max(lessonFolders.sortOrder) })
    .from(lessonFolders)
    .where(eq(lessonFolders.authorId, session.userId));
  const [created] = await db
    .insert(lessonFolders)
    .values({ authorId: session.userId, name, sortOrder: (last?.value ?? 0) + 10 })
    .returning();
  revalidatePath("/teacher/lessons");
  return created
    ? { folder: { id: created.id, name: created.name, sortOrder: created.sortOrder, createdAt: created.createdAt.toISOString() } }
    : { error: "Не удалось создать папку" };
}

export async function renameLessonFolderAction(
  folderId: string,
  rawName: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const name = String(rawName ?? "").trim().slice(0, 100);
  if (!name) return { error: "Дай папке название" };
  const updated = await db
    .update(lessonFolders)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(lessonFolders.id, String(folderId ?? "")), eq(lessonFolders.authorId, session.userId)))
    .returning({ id: lessonFolders.id });
  if (!updated[0]) return { error: "Папка не найдена" };
  revalidatePath("/teacher/lessons");
  return {};
}

export async function deleteLessonFolderAction(folderId: string): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(folderId ?? "");
  const [folder] = await db
    .select({ id: lessonFolders.id })
    .from(lessonFolders)
    .where(and(eq(lessonFolders.id, id), eq(lessonFolders.authorId, session.userId)))
    .limit(1);
  if (!folder) return { error: "Папка не найдена" };
  await db.transaction(async (tx) => {
    const [last] = await tx
      .select({ value: max(lessonUnits.sortOrder) })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, session.userId), isNull(lessonUnits.folderId)));
    const moved = await tx
      .select({ id: lessonUnits.id })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, session.userId), eq(lessonUnits.folderId, id)))
      .orderBy(asc(lessonUnits.sortOrder), asc(lessonUnits.title));
    for (const [index, lesson] of moved.entries()) {
      await tx.update(lessonUnits).set({
        folderId: null,
        sortOrder: (last?.value ?? 0) + (index + 1) * 10,
        updatedAt: new Date(),
      }).where(eq(lessonUnits.id, lesson.id));
    }
    await tx.delete(lessonFolders).where(eq(lessonFolders.id, id));
  });
  revalidatePath("/teacher/lessons");
  return {};
}

export async function moveLessonInLibraryAction(input: {
  lessonId: string;
  folderId: string | null;
  beforeLessonId?: string | null;
}): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const lessonId = String(input?.lessonId ?? "");
  const folderId = input?.folderId ? String(input.folderId) : null;
  const beforeLessonId = input?.beforeLessonId ? String(input.beforeLessonId) : null;
  const [lesson] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, lessonId), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!lesson) return { error: "Урок не найден" };
  if (folderId) {
    const [folder] = await db
      .select({ id: lessonFolders.id })
      .from(lessonFolders)
      .where(and(eq(lessonFolders.id, folderId), eq(lessonFolders.authorId, session.userId)))
      .limit(1);
    if (!folder) return { error: "Папка не найдена" };
  }
  const siblings = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(
      eq(lessonUnits.authorId, session.userId),
      folderId ? eq(lessonUnits.folderId, folderId) : isNull(lessonUnits.folderId),
    ))
    .orderBy(asc(lessonUnits.sortOrder), asc(lessonUnits.title));
  const ordered = siblings.map((row) => row.id).filter((id) => id !== lessonId);
  const beforeIndex = beforeLessonId ? ordered.indexOf(beforeLessonId) : -1;
  ordered.splice(beforeIndex >= 0 ? beforeIndex : ordered.length, 0, lessonId);
  await db.transaction(async (tx) => {
    for (const [index, id] of ordered.entries()) {
      await tx.update(lessonUnits).set({
        ...(id === lessonId ? { folderId } : {}),
        sortOrder: (index + 1) * 10,
        updatedAt: new Date(),
      }).where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)));
    }
  });
  revalidatePath("/teacher/lessons");
  return {};
}

export async function reorderLessonFoldersAction(
  folderId: string,
  beforeFolderId?: string | null,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(folderId ?? "");
  const rows = await db
    .select({ id: lessonFolders.id })
    .from(lessonFolders)
    .where(eq(lessonFolders.authorId, session.userId))
    .orderBy(asc(lessonFolders.sortOrder), asc(lessonFolders.name));
  if (!rows.some((row) => row.id === id)) return { error: "Папка не найдена" };
  const ordered = rows.map((row) => row.id).filter((value) => value !== id);
  const before = beforeFolderId ? ordered.indexOf(String(beforeFolderId)) : -1;
  ordered.splice(before >= 0 ? before : ordered.length, 0, id);
  await db.transaction(async (tx) => {
    for (const [index, value] of ordered.entries()) {
      await tx.update(lessonFolders).set({ sortOrder: (index + 1) * 10, updatedAt: new Date() })
        .where(and(eq(lessonFolders.id, value), eq(lessonFolders.authorId, session.userId)));
    }
  });
  revalidatePath("/teacher/lessons");
  return {};
}

export async function sortLessonFilesAlphabeticallyAction(
  rawFolderId?: string | null,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const folderId = rawFolderId ? String(rawFolderId) : null;
  if (folderId) {
    const [folder] = await db.select({ id: lessonFolders.id }).from(lessonFolders)
      .where(and(eq(lessonFolders.id, folderId), eq(lessonFolders.authorId, session.userId))).limit(1);
    if (!folder) return { error: "Папка не найдена" };
  }
  const rows = await db.select({ id: lessonUnits.id }).from(lessonUnits)
    .where(and(
      eq(lessonUnits.authorId, session.userId),
      folderId ? eq(lessonUnits.folderId, folderId) : isNull(lessonUnits.folderId),
    ))
    .orderBy(asc(lessonUnits.title), asc(lessonUnits.createdAt));
  await db.transaction(async (tx) => {
    for (const [index, row] of rows.entries()) {
      await tx.update(lessonUnits).set({ sortOrder: (index + 1) * 10 })
        .where(and(eq(lessonUnits.id, row.id), eq(lessonUnits.authorId, session.userId)));
    }
  });
  revalidatePath("/teacher/lessons");
  return {};
}

export async function sortLessonFoldersAlphabeticallyAction(): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const rows = await db.select({ id: lessonFolders.id }).from(lessonFolders)
    .where(eq(lessonFolders.authorId, session.userId))
    .orderBy(asc(lessonFolders.name), asc(lessonFolders.createdAt));
  await db.transaction(async (tx) => {
    for (const [index, row] of rows.entries()) {
      await tx.update(lessonFolders).set({ sortOrder: (index + 1) * 10 })
        .where(and(eq(lessonFolders.id, row.id), eq(lessonFolders.authorId, session.userId)));
    }
  });
  revalidatePath("/teacher/lessons");
  return {};
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
    .select({ id: lessonUnits.id, homework: lessonUnits.homework })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, unitId), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!mine) return { error: "Урок не найден" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  let homeworkAvailable: boolean | null = null;
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
    const legacy = (edit.homework ?? [])
      .map((task) => ({
        title: String(task?.title ?? "").trim(),
        text: String(task?.text ?? "").trim(),
      }))
      .filter((task) => task.title || task.text);
    const interactive = interactiveHomeworkFromEntries(mine.homework);
    patch.homework = [...legacy, ...(interactive ? [interactive] : [])];
    homeworkAvailable = legacy.length > 0 || Boolean(interactive);
  }
  if (edit.activityIds !== undefined) {
    const requested = [...new Set((edit.activityIds ?? []).map(String).filter(Boolean))];
    if (requested.length === 0) {
      patch.activityIds = [];
    } else {
      const owned = await db
        .select({ id: wordDeckActivities.id, settings: wordDeckActivities.settings })
        .from(wordDeckActivities)
        .where(
          and(
            eq(wordDeckActivities.authorId, session.userId),
            inArray(wordDeckActivities.id, requested),
          ),
        );
      patch.activityIds = requested.filter((id) => owned.some((row) =>
        row.id === id && normalizeWordDeckSettings(row.settings).gameType !== "GUESS_PICTURE"));
    }
  }

  await db.update(lessonUnits).set(patch).where(eq(lessonUnits.id, unitId));
  if (homeworkAvailable !== null) {
    const assignments = await db
      .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, unitId));
    for (const assignment of assignments) {
      const open = new Set(assignment.openSections ?? []);
      if (homeworkAvailable) open.add("homework");
      else open.delete("homework");
      await db
        .update(lessonAssignments)
        .set({ openSections: [...open], updatedAt: new Date() })
        .where(eq(lessonAssignments.id, assignment.id));
    }
  }
  revalidatePath("/teacher/lessons");
  revalidatePath(`/teacher/lessons/${unitId}`);
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  revalidatePath("/student/homework");
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
  interactiveHomework: InteractiveHomeworkPlan | null;
  activities: {
    id: string;
    title: string;
    cards: WordDeckSourceCard[];
    settings: WordDeckSettings;
    backgroundImageUrl: string | null;
  }[];
  regularSections: RegularLessonSection[];
};

export type LessonEditScope = "STUDENT" | "GLOBAL";

/**
 * Editable lesson payload used by the in-class editor.
 *
 * Games are referenced by id: their own cards/settings keep living in the
 * activity tables. Everything else is a self-contained lesson snapshot, so a
 * single student's version cannot leak into the reusable template.
 */
export type AssignedLessonContentDraft = {
  title: string;
  description: string | null;
  words: LessonWord[];
  lexis: LessonLexisGroup[];
  videoUrl: string | null;
  videoTitle: string | null;
  transcript: TranscriptLine[];
  questions: { afterVideo: string[]; afterReading: string[] };
  homework: { title: string; text: string }[];
  interactiveHomework: InteractiveHomeworkPlan | null;
  activityIds: string[];
  regularSections: RegularLessonSection[];
};

const MAX_INLINE_WORDS = 600;
const MAX_INLINE_TRANSCRIPT_LINES = 2_000;
const MAX_INLINE_QUESTIONS = 500;

function cleanNullable(value: unknown, limit: number): string | null {
  const text = String(value ?? "").trim().slice(0, limit);
  return text || null;
}

function cleanLines(value: unknown, limit = MAX_INLINE_QUESTIONS): string[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry ?? "").trim().slice(0, 2_000))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeAssignedWords(value: unknown): LessonWord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_INLINE_WORDS).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const word = String(item.word ?? "").trim().slice(0, 500);
    if (!word) return [];
    const examples = (Array.isArray(item.examples) ? item.examples : [])
      .slice(0, 20)
      .flatMap((example) => {
        if (!example || typeof example !== "object") return [];
        const row = example as Record<string, unknown>;
        const en = String(row.en ?? "").trim().slice(0, 1_000);
        const tr = String(row.tr ?? "").trim().slice(0, 1_000);
        return en || tr ? [{ en, tr }] : [];
      });
    const id = String(item.id ?? "").trim().slice(0, 100) || `local-word-${index + 1}`;
    return [{
      id,
      category: String(item.category ?? "").trim().slice(0, 180),
      icon: cleanNullable(item.icon, 40),
      word,
      ipaUs: cleanNullable(item.ipaUs, 180),
      ipaUk: cleanNullable(item.ipaUk, 180),
      translation: cleanNullable(item.translation, 1_500),
      description: cleanNullable(item.description, 3_000),
      note: cleanNullable(item.note, 3_000),
      examples,
      sectionColor: cleanNullable(item.sectionColor, 80),
      imageUrl: cleanNullable(item.imageUrl, 2_000),
    }];
  });
}

function normalizeAssignedLexis(value: unknown): LessonLexisGroup[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const source = String(item.source ?? "").trim().slice(0, 200_000);
    const parsed = source ? parseLexisDocuments(source)[0] : null;
    const blocks = parsed?.blocks ?? (Array.isArray(item.blocks) ? item.blocks : []);
    const safeBlocks = sanitizeBlocks(blocks);
    if (!safeBlocks.some((block) => block.type === "word")) return [];
    return [{
      id: String(item.id ?? "").trim().slice(0, 100) || `local-lexis-${index + 1}`,
      source: parsed?.source ?? source,
      title:
        cleanNullable(item.title, 180) ??
        cleanNullable(parsed?.title, 180) ??
        "Lexis",
      intro:
        cleanNullable(item.intro, 2_000) ?? cleanNullable(parsed?.subtitle, 2_000),
      blocks: safeBlocks,
      warnings: parsed?.warnings ?? (Array.isArray(item.warnings)
        ? item.warnings.map(String).slice(0, 100)
        : []),
      sourceNodeId: cleanNullable(item.sourceNodeId, 100),
    }];
  });
}

function normalizeAssignedLessonDraft(
  value: unknown,
  fallbackTitle: string,
): AssignedLessonContentDraft | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = String(item.title ?? fallbackTitle).trim().slice(0, 160);
  if (!title) return null;
  const rawTranscript = Array.isArray(item.transcript) ? item.transcript : [];
  const transcript = rawTranscript.slice(0, MAX_INLINE_TRANSCRIPT_LINES).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const speaker = String(row.speaker ?? "").trim().slice(0, 180);
    const text = String(row.text ?? "").trim().slice(0, 12_000);
    return text ? [{ speaker, text }] : [];
  });
  const rawQuestions = item.questions && typeof item.questions === "object"
    ? item.questions as Record<string, unknown>
    : {};
  const legacyHomework = (Array.isArray(item.homework) ? item.homework : [])
    .slice(0, 200)
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const taskTitle = String(row.title ?? "").trim().slice(0, 500);
      const text = String(row.text ?? "").trim().slice(0, 12_000);
      return taskTitle || text ? [{ title: taskTitle, text }] : [];
    });
  const interactiveHomework = item.interactiveHomework
    ? normalizeInteractiveHomework(item.interactiveHomework, { allowEmpty: true })
    : null;
  return {
    title,
    description: cleanNullable(item.description, 5_000),
    words: normalizeAssignedWords(item.words),
    lexis: normalizeAssignedLexis(item.lexis),
    videoUrl: cleanNullable(item.videoUrl, 4_000),
    videoTitle: cleanNullable(item.videoTitle, 500),
    transcript,
    questions: {
      afterVideo: cleanLines(rawQuestions.afterVideo),
      afterReading: cleanLines(rawQuestions.afterReading),
    },
    homework: legacyHomework,
    interactiveHomework,
    activityIds: [...new Set((Array.isArray(item.activityIds) ? item.activityIds : [])
      .map(String)
      .map((id) => id.trim())
      .filter(Boolean))].slice(0, 100),
    regularSections: normalizeRegularLessonSections(item.regularSections),
  };
}

function assignmentRegularSections(
  template: unknown,
  override: unknown,
): RegularLessonSection[] {
  const draft = normalizeAssignedLessonDraft(override, "Lesson");
  return draft ? draft.regularSections : normalizeRegularLessonSections(template);
}

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
    note: r.note,
    examples: r.examples ?? [],
    sectionColor: r.sectionColor,
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
      note: materialPhrases.note,
      examples: materialPhrases.examples,
      sectionColor: materialPhrases.sectionColor,
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
      note: r.note,
      examples: r.examples ?? [],
      sectionColor: r.sectionColor,
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
  edit: Partial<Pick<LessonWord, "word" | "translation" | "description" | "category" | "icon" | "note" | "examples" | "sectionColor">>,
): Promise<{ error?: string }> {
  await requireTeacher();
  const patch: Record<string, unknown> = {};
  for (const key of ["word", "translation", "description", "category", "icon", "note", "sectionColor"] as const) {
    const value = edit[key];
    if (value === undefined) continue;
    patch[key] = key === "word" || key === "category"
      ? String(value ?? "").trim()
      : (String(value ?? "").trim() || null);
  }
  if (edit.examples !== undefined) {
    patch.examples = (Array.isArray(edit.examples) ? edit.examples : [])
      .slice(0, 20)
      .map((example) => ({
        en: String(example?.en ?? "").trim().slice(0, 1_000),
        tr: String(example?.tr ?? "").trim().slice(0, 1_000),
      }))
      .filter((example) => example.en);
  }
  if (Object.keys(patch).length === 0) return {};

  await db.update(lessonWords).set(patch).where(eq(lessonWords.id, String(wordId ?? "")));
  return {};
}

/** Одной кнопкой переключить весь словник урока между RU и UA. */
export async function translateLessonVocabularyAction(
  unitId: string,
  target: MaterialTranslationLang,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(unitId ?? "");
  if (target !== "RU" && target !== "UK") return { error: "Неизвестный язык" };

  const [unit] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!unit) return { error: "Урок не найден" };

  const words = await db
    .select()
    .from(lessonWords)
    .where(eq(lessonWords.unitId, id))
    .orderBy(asc(lessonWords.sortOrder));
  if (words.length === 0) return { error: "В уроке пока нет слов" };

  try {
    const translated = await translateVocabulary(
      words.map((word) => ({
        id: word.id,
        phrase: word.word,
        section: word.category,
        currentTranslation: word.translation,
        note: word.note,
        examples: (word.examples ?? []).map((example) => ({
          en: example.en,
          currentTranslation: example.tr,
        })),
      })),
      target,
      target === "UK" ? "RU" : "UK",
    );

    await db.transaction(async (tx) => {
      for (const word of words) {
        const next = translated.get(word.id);
        if (!next) continue;
        await tx
          .update(lessonWords)
          .set({
            translation: next.translation || null,
            note: next.note || null,
            examples: (word.examples ?? []).map((example, index) => ({
              en: example.en,
              tr: next.examples[index] ?? example.tr,
            })),
          })
          .where(eq(lessonWords.id, word.id));
      }
    });

    revalidatePath(`/teacher/lessons/${id}`);
    revalidatePath("/student/class");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "DeepL не смог перевести словарь",
    };
  }
}

export type LessonVocabularyMaterialTarget = {
  id: string;
  name: string;
  folders: { id: string; parentId: string | null; name: string }[];
};

/** Ученики и их личные папки для окна «Добавить в материалы». */
export async function lessonVocabularyMaterialTargetsAction(): Promise<
  LessonVocabularyMaterialTarget[]
> {
  await requireTeacher();
  const [students, folders] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "STUDENT"))
      .orderBy(asc(users.name)),
    db
      .select({
        id: materialNodes.id,
        parentId: materialNodes.parentId,
        ownerId: materialNodes.ownerId,
        name: materialNodes.name,
      })
      .from(materialNodes)
      .where(and(eq(materialNodes.scope, "STUDENT"), eq(materialNodes.type, "FOLDER")))
      .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name)),
  ]);

  return students.map((student) => ({
    ...student,
    folders: folders
      .filter((folder) => folder.ownerId === student.id)
      .map(({ id, parentId, name }) => ({ id, parentId, name })),
  }));
}

/**
 * Снять со словника урока полноценную копию в личное дерево ученика.
 * В материалах примеры и подсказки уже обычное содержимое: ученик видит их
 * без классных ограничений и может вернуться к ним после урока.
 */
export async function addLessonVocabularyToMaterialsAction(
  unitId: string,
  input: { studentId: string; parentId?: string | null; name: string },
): Promise<{ nodeId?: string; error?: string }> {
  const session = await requireTeacher();
  const id = String(unitId ?? "");
  const studentId = String(input?.studentId ?? "");
  const parentId = input?.parentId ? String(input.parentId) : null;
  const name = String(input?.name ?? "").trim().slice(0, 200);
  if (!name) return { error: "Введи название словаря" };

  const [[unit], [student], words] = await Promise.all([
    db
      .select({ id: lessonUnits.id, kind: lessonUnits.kind })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.id, id), eq(lessonUnits.authorId, session.userId)))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
      .limit(1),
    db
      .select()
      .from(lessonWords)
      .where(eq(lessonWords.unitId, id))
      .orderBy(asc(lessonWords.sortOrder)),
  ]);
  if (!unit) return { error: "Урок не найден" };
  if (!student) return { error: "Ученик не найден" };
  if (words.length === 0) return { error: "В уроке пока нет слов" };

  if (parentId) {
    const [parent] = await db
      .select({ id: materialNodes.id })
      .from(materialNodes)
      .where(
        and(
          eq(materialNodes.id, parentId),
          eq(materialNodes.type, "FOLDER"),
          eq(materialNodes.scope, "STUDENT"),
          eq(materialNodes.ownerId, studentId),
        ),
      )
      .limit(1);
    if (!parent) return { error: "Папка ученика не найдена" };
  }

  const [{ value: lastOrder } = { value: 0 }] = await db
    .select({ value: max(materialNodes.sortOrder) })
    .from(materialNodes)
    .where(
      parentId
        ? eq(materialNodes.parentId, parentId)
        : and(
            isNull(materialNodes.parentId),
            eq(materialNodes.scope, "STUDENT"),
            eq(materialNodes.ownerId, studentId),
          ),
    );

  const nodeId = await db.transaction(async (tx) => {
    const [node] = await tx
      .insert(materialNodes)
      .values({
        parentId,
        scope: "STUDENT",
        ownerId: studentId,
        name,
        icon: "📚",
        type: "FILE",
        pageKind: "VOCAB",
        sortOrder: (lastOrder ?? 0) + 1,
      })
      .returning({ id: materialNodes.id });

    const phraseIds = words.map(() => randomUUID());
    await tx
      .insert(materialPhrases)
      .values(
        words.map((word, index) => ({
          id: phraseIds[index],
          nodeId: node.id,
          sortOrder: index + 1,
          icon: word.icon,
          imageUrl: word.imageUrl,
          phrase: word.word,
          transcription: word.ipaUs ?? word.ipaUk,
          transcriptionUs: word.ipaUs,
          transcriptionUk: word.ipaUk,
          translation: word.translation,
          description: word.description,
          note: word.note,
          examples: word.examples ?? [],
          section: word.category || null,
          sectionColor: word.sectionColor,
          kind: "PHRASE",
        })),
      );

    const images = phraseIds.flatMap((phraseId, index) =>
      words[index]?.imageUrl
        ? [{
            phraseId,
            url: words[index].imageUrl!,
            origin: "manual",
            sortOrder: 0,
            picked: true,
          }]
        : [],
    );
    if (images.length > 0) await tx.insert(phraseImages).values(images);
    return node.id;
  });

  revalidatePath(`/teacher/students/${studentId}/materials`);
  revalidatePath("/student/materials");
  return { nodeId };
}

export async function deleteWordAction(wordId: string): Promise<{ error?: string }> {
  await requireTeacher();
  await db.delete(lessonWords).where(eq(lessonWords.id, String(wordId ?? "")));
  return {};
}

async function lessonActivitiesByIds(ids: string[]): Promise<LessonView["activities"]> {
  const activityIds = [...new Set(ids.map(String).filter(Boolean))];
  if (activityIds.length === 0) return [];
  const rows = await db
    .select()
    .from(wordDeckActivities)
    .where(inArray(wordDeckActivities.id, activityIds));
  const activityOf = new Map(rows
    .filter((activity) => normalizeWordDeckSettings(activity.settings).gameType !== "GUESS_PICTURE")
    .map((activity) => [activity.id, activity]));
  return activityIds.flatMap((id) => {
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
  });
}

async function applyAssignedLessonContent(
  lesson: LessonView,
  rawOverride: unknown,
  includeTeacher: boolean,
): Promise<LessonView> {
  const draft = normalizeAssignedLessonDraft(rawOverride, lesson.title);
  if (!draft) return lesson;
  const regularSections = includeTeacher
    ? draft.regularSections
    : publicRegularLessonSections(draft.regularSections);
  return {
    ...lesson,
    title: draft.title,
    description: draft.description,
    words: draft.words,
    lexis: draft.lexis,
    videoUrl: draft.videoUrl,
    videoTitle: draft.videoTitle,
    transcript: draft.transcript,
    questions: draft.questions,
    homework: draft.homework,
    interactiveHomework: draft.interactiveHomework,
    activities: await lessonActivitiesByIds(draft.activityIds),
    regularSections,
  };
}

async function loadUnit(unitId: string, includeTeacher = false): Promise<LessonView | null> {
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

  return {
    id: unit.id,
    kind: normalizeLessonKind(unit.kind),
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
    homework: legacyHomeworkFromEntries(unit.homework),
    interactiveHomework: interactiveHomeworkFromEntries(unit.homework),
    activities: await lessonActivitiesByIds(activityIds),
    regularSections: includeTeacher
      ? normalizeRegularLessonSections(unit.sections)
      : publicRegularLessonSections(unit.sections),
  };
}

/** Урок как есть — учителю, для правки и для показа. */
export async function lessonAction(id: string): Promise<LessonView | null> {
  await requireTeacher();
  return loadUnit(String(id ?? ""), true);
}

/**
 * Save an edit made while the assigned lesson is open.
 *
 * STUDENT stores a full private snapshot on that assignment. GLOBAL writes
 * the reusable lesson and deliberately clears every private snapshot so all
 * already assigned copies receive the same new version. Student answers,
 * attempts, notes, highlights and homework progress are never replaced.
 */
export async function saveAssignedLessonContentAction(
  assignmentId: string,
  candidate: AssignedLessonContentDraft,
  scope: LessonEditScope,
): Promise<{ error?: string; scope?: LessonEditScope }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({
      assignment: lessonAssignments,
      unit: lessonUnits,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(
      and(
        eq(lessonAssignments.id, id),
        eq(lessonUnits.authorId, session.userId),
      ),
    )
    .limit(1);
  if (!row) return { error: "Урок ученика не найден" };

  const draft = normalizeAssignedLessonDraft(candidate, row.unit.title);
  if (!draft) return { error: "Добавь название урока" };

  if (draft.activityIds.length > 0) {
    const ownedActivities = await db
      .select({ id: wordDeckActivities.id, settings: wordDeckActivities.settings })
      .from(wordDeckActivities)
      .where(
        and(
          eq(wordDeckActivities.authorId, session.userId),
          inArray(wordDeckActivities.id, draft.activityIds),
        ),
      );
    const allowed = new Set(ownedActivities
      .filter((activity) => normalizeWordDeckSettings(activity.settings).gameType !== "GUESS_PICTURE")
      .map((activity) => activity.id));
    draft.activityIds = draft.activityIds.filter((activityId) => allowed.has(activityId));
  }

  const homeworkAvailable = draft.homework.length > 0 || Boolean(draft.interactiveHomework);
  const now = new Date();
  if (scope === "STUDENT") {
    const open = new Set(row.assignment.openSections ?? []);
    if (homeworkAvailable) open.add("homework");
    else open.delete("homework");
    await db
      .update(lessonAssignments)
      .set({ contentOverride: draft, openSections: [...open], updatedAt: now })
      .where(eq(lessonAssignments.id, id));
  } else {
    const homework: LessonHomeworkEntry[] = [
      ...draft.homework,
      ...(draft.interactiveHomework ? [draft.interactiveHomework] : []),
    ];
    await db.transaction(async (tx) => {
      await tx
        .update(lessonUnits)
        .set({
          title: draft.title,
          description: draft.description,
          lexis: draft.lexis,
          videoUrl: draft.videoUrl,
          videoTitle: draft.videoTitle,
          transcript: draft.transcript,
          questions: draft.questions,
          homework,
          activityIds: draft.activityIds,
          sections: draft.regularSections,
          updatedAt: now,
        })
        .where(eq(lessonUnits.id, row.unit.id));

      const existingWords = await tx
        .select({ id: lessonWords.id })
        .from(lessonWords)
        .where(eq(lessonWords.unitId, row.unit.id));
      const existingIds = new Set(existingWords.map((word) => word.id));
      const keptIds = new Set<string>();
      for (const [sortOrder, word] of draft.words.entries()) {
        const values = {
          category: word.category,
          icon: word.icon,
          word: word.word,
          ipaUs: word.ipaUs,
          ipaUk: word.ipaUk,
          translation: word.translation,
          description: word.description,
          note: word.note,
          examples: word.examples,
          sectionColor: word.sectionColor,
          imageUrl: word.imageUrl,
          sortOrder,
        };
        if (existingIds.has(word.id)) {
          keptIds.add(word.id);
          await tx.update(lessonWords).set(values).where(eq(lessonWords.id, word.id));
        } else {
          const [created] = await tx
            .insert(lessonWords)
            .values({ unitId: row.unit.id, ...values })
            .returning({ id: lessonWords.id });
          if (created) keptIds.add(created.id);
        }
      }
      const removed = existingWords.map((word) => word.id).filter((wordId) => !keptIds.has(wordId));
      if (removed.length > 0) {
        await tx.delete(lessonWords).where(inArray(lessonWords.id, removed));
      }

      const assignments = await tx
        .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
        .from(lessonAssignments)
        .where(eq(lessonAssignments.unitId, row.unit.id));
      for (const assignment of assignments) {
        const open = new Set(assignment.openSections ?? []);
        if (homeworkAvailable) open.add("homework");
        else open.delete("homework");
        await tx
          .update(lessonAssignments)
          .set({ contentOverride: null, openSections: [...open], updatedAt: now })
          .where(eq(lessonAssignments.id, assignment.id));
      }
    });
  }

  revalidatePath("/teacher/lessons");
  revalidatePath(`/teacher/lessons/${row.unit.id}`);
  revalidatePath(`/teacher/lessons/given/${id}`);
  revalidatePath(`/student/lessons/${id}`);
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  revalidatePath("/teacher/homeworks");
  revalidatePath("/student/homework");
  return { scope: scope === "STUDENT" ? "STUDENT" : "GLOBAL" };
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
  const session = await requireTeacher();
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

  const [lesson] = await db
    .select({ kind: lessonUnits.kind, sections: lessonUnits.sections })
    .from(lessonUnits)
    .where(eq(lessonUnits.id, unit))
    .limit(1);
  if (!lesson) return { error: "Урок не найден" };

  const [created] = await db
    .insert(lessonAssignments)
    .values({
      unitId: unit,
      studentId: student,
      openSections:
        lesson.kind === "REGULAR" ? defaultRegularOpenSections(lesson.sections) : [],
    })
    .returning({ id: lessonAssignments.id });

  const [name] = await db
    .select({ title: lessonUnits.title })
    .from(lessonUnits)
    .where(eq(lessonUnits.id, unit))
    .limit(1);

  await queueStudentNotification({
    teacherId: session.userId,
    studentId: student,
    event: "lessonAssigned",
    title: name?.title ?? "",
    href: `/student/lessons/${created?.id ?? ""}`,
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
    title: normalizeAssignedLessonDraft(a.contentOverride, title)?.title ?? title,
    studentId: a.studentId,
    studentName: name,
    openSections: a.openSections ?? [],
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

/** Открыть или закрыть секцию ученику. Словник открыт по умолчанию. */
export async function openSectionAction(
  assignmentId: string,
  section: string,
  open: boolean,
): Promise<{ error?: string }> {
  const session = await requireTeacher();

  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({
      openSections: lessonAssignments.openSections,
      contentOverride: lessonAssignments.contentOverride,
      kind: lessonUnits.kind,
      sections: lessonUnits.sections,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  if (row.kind === "REGULAR") {
    const target = regularLessonSection(
      section,
      assignmentRegularSections(row.sections, row.contentOverride),
    );
    if (!target || target.teacherOnly) return { error: "Неизвестная секция" };
  } else {
    if (!isSection(section)) return { error: "Неизвестная секция" };
    if (!lessonSectionsForKind(row.kind).includes(section)) {
      return { error: "Этой секции нет в формате урока" };
    }
  }

  const current = new Set(row.openSections ?? []);
  if (row.kind !== "REGULAR" && section === "vocab") {
    current.delete("vocab");
    if (open) current.delete(HIDDEN_VOCAB_OPTION);
    else current.add(HIDDEN_VOCAB_OPTION);
  } else if (open) current.add(section);
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
        kind: lessonUnits.kind,
        sections: lessonUnits.sections,
        contentOverride: lessonAssignments.contentOverride,
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
  if (
    target.kind === "REGULAR"
      ? !regularLessonSection(
          section,
          assignmentRegularSections(target.sections, target.contentOverride),
        ) ||
        regularLessonSection(
          section,
          assignmentRegularSections(target.sections, target.contentOverride),
        )?.teacherOnly
      : !isSection(section) || !lessonSectionsForKind(target.kind).includes(section)
  ) {
    return { error: "Неизвестная секция" };
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
        lessonElementId: null,
      },
    })
    .where(and(eq(users.id, target.studentId), eq(users.role, "STUDENT")));

  return {};
}

/** Поставить конкретный элемент обычного урока в центр экрана ученика. */
export async function focusRegularLessonElementAction(
  assignmentId: string,
  section: string,
  elementId: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");
  const focusId = String(elementId ?? "").trim();

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
        kind: lessonUnits.kind,
        sections: lessonUnits.sections,
        contentOverride: lessonAssignments.contentOverride,
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
  const regularSection =
    target.kind === "REGULAR"
      ? regularLessonSection(
          section,
          assignmentRegularSections(target.sections, target.contentOverride),
        )
      : null;
  if (
    !regularSection ||
    regularSection.teacherOnly ||
    !isRegularLessonFocusId(focusId, regularSection)
  ) {
    return { error: "Элемент урока не найден" };
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
        lessonElementId: focusId,
      },
    })
    .where(and(eq(users.id, target.studentId), eq(users.role, "STUDENT")));

  return {};
}

/** Put one homework exercise or sentence in the centre of the student's screen. */
export async function focusHomeworkElementAction(
  assignmentId: string,
  elementId: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");
  const focusId = String(elementId ?? "").trim();

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
        homework: lessonUnits.homework,
        answers: lessonAssignments.answers,
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
  const homework = homeworkPlanForAssignment(
    interactiveHomeworkFromEntries(target.homework),
    target.answers ?? {},
  );
  if (!homework || !homeworkFocusTarget(homework, focusId)) {
    return { error: "Элемент домашки не найден" };
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
        lessonSection: "homework",
        lessonElementId: focusId,
      },
    })
    .where(and(eq(users.id, target.studentId), eq(users.role, "STUDENT")));

  return {};
}

export type LessonVideoUpdate = Pick<
  ClassVideoState,
  | "currentTime"
  | "playing"
  | "captions"
  | "muted"
  | "volume"
  | "playbackRate"
  | "captionLanguage"
  | "quality"
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
    captionLanguage: sameVideo?.captionLanguage ?? "en",
    quality: sameVideo?.quality ?? "auto",
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
    : normalizeLessonHighlights(row.highlights);
  delete current[FOCUS_SLOT];
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
      // Navigation focus is an event, not saved lesson content. Clear any
      // legacy persistent focus while preserving coloured transcript marks.
      highlights: current,
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
          lessonElementId: focusKey,
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

/** Добавить или снять цветное выделение любого слова в выданном уроке. */
export async function highlightLessonTextAction(
  assignmentId: string,
  key: string,
  color: HighlightColor = "yellow",
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const highlightKey = String(key ?? "");
  if (!isLessonHighlightKey(highlightKey)) {
    return { error: "Неизвестное слово урока" };
  }
  if (!isHighlightColor(color)) return { error: "Неизвестный цвет выделения" };

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
      highlights: toggleLessonHighlight(row.highlights, highlightKey, color),
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, id));

  revalidatePath("/student/class");
  return {};
}

/** Replace every coloured mark in one assignment, preserving focus controls. */
export async function setLessonHighlightsAction(
  assignmentId: string,
  highlights: Record<string, string>,
): Promise<{ highlights?: Record<string, string>; error?: string }> {
  const session = await requireTeacher();
  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({ highlights: lessonAssignments.highlights })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(and(eq(lessonAssignments.id, id), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  const next = replaceLessonHighlights(row.highlights, highlights);
  await db
    .update(lessonAssignments)
    .set({ highlights: next, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, id));

  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return { highlights: next };
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
    .select({
      studentId: lessonAssignments.studentId,
      answers: lessonAssignments.answers,
      authorId: lessonUnits.authorId,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.id, id))
    .limit(1);

  if (!row) return { error: "Урок не найден" };
  const isStudent = session.role === "STUDENT" && row.studentId === session.userId;
  const isTeacher = session.role === "TEACHER" && row.authorId === session.userId;
  if (!isStudent && !isTeacher) return { error: "Это чужой урок" };

  await db
    .update(lessonAssignments)
    .set({
      answers: {
        ...(row.answers ?? {}),
        [String(key ?? "").slice(0, 240)]: String(text ?? "").slice(0, 8_000),
      },
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, id));

  return {};
}

async function regularAssignmentForUser(id: string) {
  const session = await requireUser();
  const [row] = await db
    .select({
      assignment: lessonAssignments,
      authorId: lessonUnits.authorId,
      sections: lessonUnits.sections,
      homework: lessonUnits.homework,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.id, id))
    .limit(1);
  if (!row) return null;
  const isStudent = session.role === "STUDENT" && row.assignment.studentId === session.userId;
  const isTeacher = session.role === "TEACHER" && row.authorId === session.userId;
  return isStudent || isTeacher
    ? {
        ...row,
        templateSections: row.sections,
        sections: assignmentRegularSections(row.sections, row.assignment.contentOverride),
        session,
      }
    : null;
}

/** Three-attempt checking for exercises inside a regular lesson. */
export async function submitRegularLessonAnswerAction(
  assignmentId: string,
  sectionId: string,
  responseId: string,
  supplied: string,
): Promise<{
  error?: string;
  value?: string;
  status?: "correct" | "locked" | null;
  attempts?: string[];
}> {
  const row = await regularAssignmentForUser(String(assignmentId ?? ""));
  if (!row) return { error: "Урок не найден" };
  const section = normalizeRegularLessonSections(row.sections)
    .find((item) => item.id === String(sectionId ?? ""));
  if (!section) return { error: "Секция не найдена" };

  const state = { ...(row.assignment.answers ?? {}) };
  const spec = regularAnswerMap(section, state).get(String(responseId ?? ""));
  if (!spec) return { error: "Ответ для этого поля не задан" };
  const responseKey = regularResponseKey(section.id, String(responseId ?? ""));
  const currentStatus = regularStatus(state, responseKey);
  if (currentStatus) {
    return {
      value: state[responseKey] ?? "",
      status: currentStatus,
      attempts: regularAttempts(state, responseKey),
    };
  }

  const answer = String(supplied ?? "").trim().slice(0, 300);
  if (!answer) return { error: "Введи ответ" };
  const previousAttempts = regularAttempts(state, responseKey);
  if (
    (state[responseKey] ?? "").trim() === answer &&
    previousAttempts.some(
      (attempt) => normalizeHomeworkAnswer(attempt) === normalizeHomeworkAnswer(answer),
    )
  ) {
    return {
      value: state[responseKey],
      status: currentStatus,
      attempts: previousAttempts,
    };
  }
  const matches = spec.accepted
    .map(normalizeHomeworkAnswer)
    .includes(normalizeHomeworkAnswer(answer));
  let attempts = previousAttempts;
  let status: "correct" | "locked" | null = null;
  let value = answer;

  if (matches) {
    status = "correct";
  } else {
    attempts = [...previousAttempts, answer].slice(0, 3);
    state[regularAttemptsKey(responseKey)] = JSON.stringify(attempts);
    if (spec.kind === "true-false" || attempts.length >= 3) {
      status = "locked";
      value = spec.kind === "true-false" ? answer : spec.answer;
    }
  }
  state[responseKey] = value;
  if (status) state[regularStatusKey(responseKey)] = status;

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return { value, status, attempts };
}

/** Save one native microphone recording for a voice section of a regular lesson. */
export async function saveRegularVoiceRecordingAction(
  assignmentId: string,
  sectionId: string,
  urlValue: string,
  durationValue: number,
  mimeValue: string,
): Promise<{ error?: string; state?: Record<string, string> }> {
  const row = await regularAssignmentForUser(String(assignmentId ?? ""));
  if (!row) return { error: "Урок не найден" };
  const targetId = String(sectionId ?? "");
  const section = normalizeRegularLessonSections(row.sections)
    .find((item) => item.id === String(sectionId ?? ""));
  const homeworkItemId = homeworkVoiceRecordingItemId(targetId);
  const homeworkPlan = homeworkPlanForAssignment(
    interactiveHomeworkFromEntries(row.homework),
    row.assignment.answers ?? {},
  );
  const homeworkItem = homeworkItemId && homeworkPlan
    ? findHomeworkItem(homeworkPlan, homeworkItemId)
    : null;
  const maxSeconds = section?.voiceExercise?.maxSeconds ?? (
    homeworkItem?.exercise.kind === "question-audio" ? 600 : null
  );
  if (!maxSeconds) return { error: "Голосовое упражнение не найдено" };

  const url = String(urlValue ?? "").trim();
  const pathname = managedUploadPath(url);
  if (!pathname?.startsWith(`uploads/lesson-audio/${row.assignment.id}-`)) {
    return { error: "Некорректная ссылка на запись" };
  }
  const durationSeconds = Math.round(Number(durationValue));
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > maxSeconds + 5
  ) {
    return { error: "Некорректная длительность записи" };
  }
  const mimeType = String(mimeValue ?? "audio/webm").trim().slice(0, 80);
  if (!/^audio\/(?:webm|ogg|mp4|mpeg|wav|x-m4a)(?:;|$)/i.test(mimeType)) {
    return { error: "Неподдерживаемый формат записи" };
  }

  const state = { ...(row.assignment.answers ?? {}) };
  const previous = regularVoiceRecording(state, targetId);
  state[regularVoiceRecordingKey(targetId)] = JSON.stringify({
    url,
    durationSeconds,
    mimeType,
    publishedAt: new Date().toISOString(),
  });
  if (homeworkItemId) state[homeworkValueKey(homeworkItemId)] = url;
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  if (previous?.url && previous.url !== url) {
    await removePublicFile(previous.url, "lesson-audio").catch(() => undefined);
  }
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return { state };
}

/** Reset attempts and answers for one exercise while preserving teacher notes. */
export async function resetRegularLessonExerciseAction(
  assignmentId: string,
  sectionId: string,
  listIndex: number,
): Promise<{ error?: string; state?: Record<string, string> }> {
  const row = await regularAssignmentForUser(String(assignmentId ?? ""));
  if (!row || row.session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const section = normalizeRegularLessonSections(row.sections)
    .find((item) => item.id === String(sectionId ?? ""));
  const at = Math.trunc(Number(listIndex));
  if (!section || at < 1 || at > 100) return { error: "Упражнение не найдено" };

  const state = { ...(row.assignment.answers ?? {}) };
  const prefix = regularResponseKey(section.id, `list-${at}-`);
  for (const key of Object.keys(state)) {
    if (
      key.startsWith(prefix) ||
      key.startsWith(`regular-attempts:${prefix}`) ||
      key.startsWith(`regular-status:${prefix}`)
    ) delete state[key];
  }
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return { state };
}

/** Delete one exercise only from this student's assigned lesson and homework copy. */
export async function deleteRegularLessonExerciseAction(
  assignmentId: string,
  sectionId: string,
  listIndex: number,
): Promise<{
  error?: string;
  state?: Record<string, string>;
  homeworkPlan?: InteractiveHomeworkPlan | null;
}> {
  const row = await regularAssignmentForUser(String(assignmentId ?? ""));
  if (!row || row.session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const section = normalizeRegularLessonSections(row.sections)
    .find((item) => item.id === String(sectionId ?? ""));
  const at = Math.trunc(Number(listIndex));
  if (!section || at < 1 || at > 100) return { error: "Упражнение не найдено" };

  let state = { ...(row.assignment.answers ?? {}) };
  const responsePrefix = regularResponseKey(section.id, `list-${at}-`);
  const notePrefix = `regular-note:${section.id}:list-${at}-item-`;
  const noteVisiblePrefix = `regular-note-visible:${section.id}:list-${at}-item-`;
  for (const key of Object.keys(state)) {
    if (
      key.startsWith(responsePrefix) ||
      key.startsWith(`regular-attempts:${responsePrefix}`) ||
      key.startsWith(`regular-status:${responsePrefix}`) ||
      key.startsWith(notePrefix) ||
      key.startsWith(noteVisiblePrefix)
    ) delete state[key];
  }
  delete state[regularExerciseOverrideKey(section.id, at)];
  state[regularExerciseDeletedKey(section.id, at)] = "1";

  const currentPlan = homeworkPlanForAssignment(
    interactiveHomeworkFromEntries(row.homework),
    state,
  );
  const homeworkExerciseId = regularHomeworkExerciseId(section.id, at);
  const homeworkExercise = currentPlan?.exercises.find(
    (exercise) => exercise.id === homeworkExerciseId,
  );
  let homeworkPlan = currentPlan;
  if (currentPlan && homeworkExercise) {
    state = withoutHomeworkExerciseState(state, homeworkExercise);
    homeworkPlan = {
      ...currentPlan,
      exercises: currentPlan.exercises.filter((exercise) => exercise.id !== homeworkExerciseId),
    };
    state[homeworkPlanOverrideKey()] = JSON.stringify(homeworkPlan);
    if (homeworkAssignedAt(state)) {
      const selected = homeworkAssignedExerciseIds(currentPlan, state)
        .filter((exerciseId) => exerciseId !== homeworkExerciseId);
      state[homeworkAssignedExercisesKey()] = JSON.stringify(selected);
    }
    delete state[homeworkSubmittedAtKey()];
    delete state[homeworkReviewedAtKey()];
  }

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath("/teacher/homeworks");
  return { state, homeworkPlan };
}

/** Save a personalized version of a regular-lesson exercise for this student. */
export async function saveRegularLessonExerciseAction(
  assignmentId: string,
  sectionId: string,
  listIndex: number,
  candidate: RegularExerciseOverride,
  scope: LessonEditScope = "STUDENT",
): Promise<{
  error?: string;
  exercise?: RegularExerciseOverride;
  state?: Record<string, string>;
}> {
  const row = await regularAssignmentForUser(String(assignmentId ?? ""));
  if (!row || row.session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const section = normalizeRegularLessonSections(row.sections)
    .find((item) => item.id === String(sectionId ?? ""));
  const at = Math.trunc(Number(listIndex));
  if (!section || at < 1 || at > 100) return { error: "Упражнение не найдено" };
  const overrideKey = regularExerciseOverrideKey(section.id, at);
  const normalized = regularExerciseOverride(
    { [overrideKey]: JSON.stringify(candidate) },
    section.id,
    at,
  );
  if (!normalized) return { error: "Добавь хотя бы одно заполненное задание" };
  if (
    normalized.kind !== "open" &&
    normalized.items.some((item) => item.answers.length === 0)
  ) return { error: "Добавь правильный ответ к каждому заданию" };
  if (
    normalized.kind === "fill" &&
    normalized.items.some(
      (item) => (item.prompt.match(/___/g) ?? []).length !== item.answers.length,
    )
  ) return { error: "Количество пропусков ___ должно совпадать с количеством ответов" };

  let state = { ...(row.assignment.answers ?? {}), [overrideKey]: JSON.stringify(normalized) };
  const prefix = regularResponseKey(section.id, `list-${at}-`);
  for (const key of Object.keys(state)) {
    if (
      key.startsWith(prefix) ||
      key.startsWith(`regular-attempts:${prefix}`) ||
      key.startsWith(`regular-status:${prefix}`)
    ) delete state[key];
  }
  const now = new Date();
  if (scope === "GLOBAL") {
    const applyOverride = (source: unknown) => {
      const sections = normalizeRegularLessonSections(source);
      const atSection = sections.findIndex((item) => item.id === section.id);
      const updated = {
        ...section,
        exerciseOverrides: {
          ...(atSection >= 0 ? sections[atSection].exerciseOverrides : section.exerciseOverrides),
          [String(at)]: normalized,
        },
      } satisfies RegularLessonSection;
      if (atSection >= 0) sections[atSection] = { ...sections[atSection], ...updated };
      else sections.push(updated);
      return sections;
    };
    const templateSections = applyOverride(row.templateSections);
    const assignments = await db
      .select()
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, row.assignment.unitId));

    await db.transaction(async (tx) => {
      await tx
        .update(lessonUnits)
        .set({ sections: templateSections, updatedAt: now })
        .where(eq(lessonUnits.id, row.assignment.unitId));

      for (const assignment of assignments) {
        const nextAnswers = { ...(assignment.answers ?? {}) };
        delete nextAnswers[overrideKey];
        const currentOverride = assignment.contentOverride &&
          typeof assignment.contentOverride === "object"
          ? { ...assignment.contentOverride }
          : null;
        const contentOverride = currentOverride && Array.isArray(currentOverride.regularSections)
          ? { ...currentOverride, regularSections: applyOverride(currentOverride.regularSections) }
          : currentOverride;
        await tx
          .update(lessonAssignments)
          .set({ answers: nextAnswers, contentOverride, updatedAt: now })
          .where(eq(lessonAssignments.id, assignment.id));
        if (assignment.id === row.assignment.id) state = nextAnswers;
      }
    });
  } else {
    await db
      .update(lessonAssignments)
      .set({ answers: state, updatedAt: now })
      .where(eq(lessonAssignments.id, row.assignment.id));
  }
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/${row.assignment.unitId}`);
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return { exercise: normalized, state };
}

/**
 * Rebuild the foreign sentences of one regular-lesson translation exercise.
 * The override lives in lesson_assignments.answers, so this changes only the
 * selected student's assigned lesson and never mutates the reusable template.
 */
export async function translateRegularLessonExerciseLanguageAction(
  assignmentId: string,
  sectionId: string,
  listIndex: number,
  targetLanguage: MaterialTranslationLang,
): Promise<{
  error?: string;
  state?: Record<string, string>;
  language?: MaterialTranslationLang;
}> {
  const row = await regularAssignmentForUser(String(assignmentId ?? ""));
  if (!row || row.session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const section = normalizeRegularLessonSections(row.sections)
    .find((item) => item.id === String(sectionId ?? ""));
  const at = Math.trunc(Number(listIndex));
  if (!section || at < 1 || at > 100 || !isRegularTranslationExercise(section, at)) {
    return { error: "Упражнение на перевод не найдено" };
  }

  const currentState = row.assignment.answers ?? {};
  const grouped = new Map<number, string[]>();
  for (const [responseId, spec] of regularAnswerMap(section, currentState)) {
    const match = responseId.match(new RegExp(`^list-${at}-item-(\\d+)-blank-(\\d+)$`));
    if (!match) continue;
    const item = Number(match[1]);
    grouped.set(item, [...(grouped.get(item) ?? []), spec.answer]);
  }
  const english = [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, answers]) => answers.length === 1 ? answers[0] : "");
  if (english.length === 0 || english.some((sentence) => !sentence.trim())) {
    return { error: "Не удалось найти английский ответ для каждого предложения" };
  }

  const language: MaterialTranslationLang = targetLanguage === "RU" ? "RU" : "UK";
  try {
    const translated = await translateShortTexts(
      english,
      language,
      "EN",
      "Simple real sentences for an English lesson translation exercise",
    );
    const previous = regularExerciseOverride(currentState, section.id, at);
    const exercise: RegularExerciseOverride = {
      title: previous?.title || section.title,
      instruction: previous?.instruction || "Translate each sentence into English.",
      kind: "fill",
      translationLanguage: language,
      items: translated.map((prompt, index) => ({
        prompt: `${prompt} → ___`,
        answers: [english[index]],
      })),
    };
    const state = {
      ...currentState,
      [regularExerciseOverrideKey(section.id, at)]: JSON.stringify(exercise),
    };
    await db
      .update(lessonAssignments)
      .set({ answers: state, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, row.assignment.id));

    revalidatePath(`/student/lessons/${row.assignment.id}`);
    revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
    revalidatePath("/teacher/class");
    revalidatePath("/student/class");
    return { state, language };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "DeepL не смог перевести предложения",
    };
  }
}

/** Урок с состоянием конкретного ученика — и ему, и учителю. */
export async function assignedLessonAction(
  assignmentId: string,
  context?: "class",
): Promise<
  | {
      assignment: LessonAssignmentCard;
      lesson: LessonView;
      answers: Record<string, string>;
      open: string[];
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

  const baseLesson = await loadUnit(row.a.unitId, session.role === "TEACHER");
  const lesson = baseLesson
    ? await applyAssignedLessonContent(
        baseLesson,
        row.a.contentOverride,
        session.role === "TEACHER",
      )
    : null;
  if (!lesson) return null;
  lesson.interactiveHomework = homeworkPlanForAssignment(
    lesson.interactiveHomework,
    row.a.answers ?? {},
  );
  const homeworkWasRemoved = session.role === "STUDENT" &&
    context !== "class" &&
    Boolean(homeworkRemovedAt(row.a.answers ?? {}));
  if (homeworkWasRemoved) {
    lesson.interactiveHomework = null;
    lesson.homework = [];
  } else if (session.role === "STUDENT" && lesson.interactiveHomework) {
    const visiblePlan = {
      ...lesson.interactiveHomework,
      exercises: lesson.interactiveHomework.exercises.filter(
        (exercise) => !homeworkExerciseHidden(row.a.answers ?? {}, exercise.id),
      ),
    };
    lesson.interactiveHomework = context === "class"
      ? visiblePlan
      : assignedInteractiveHomework(visiblePlan, row.a.answers ?? {});
  }

  const stored = row.a.openSections ?? [];
  const homeworkAvailable = lesson.homework.length > 0 || Boolean(lesson.interactiveHomework);
  const storedWithHomework = homeworkAvailable
    ? [...new Set([...stored, "homework"])]
    : stored.filter((section) => section !== "homework");
  return {
    assignment: {
      id: row.a.id,
      unitId: row.a.unitId,
      title: lesson.title,
      studentId: row.a.studentId,
      studentName: row.name,
      openSections: stored,
      highlights: normalizeLessonHighlights(row.a.highlights),
      finishedAt: row.a.finishedAt?.toISOString() ?? null,
      createdAt: row.a.createdAt.toISOString(),
    },
    lesson,
    answers: row.a.answers ?? {},
    open:
      lesson.kind === "REGULAR"
        ? [
            ...stored.filter((key) => !!regularLessonSection(key, lesson.regularSections)),
            ...(homeworkAvailable && context !== "class" ? ["homework"] : []),
          ]
        : openSections(context === "class" ? stored : storedWithHomework),
    showBritish: stored.includes(BRITISH_OPTION),
    vocabularyReveal: lessonVocabularyReveal(stored),
  };
}
