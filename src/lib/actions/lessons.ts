"use server";

/**
 * Уроки: заготовки учителя и их копии у учеников.
 *
 * Заготовка (lesson_units) не меняется никогда: что бы ни происходило на
 * занятии, правится только закрепление за учеником
 * (lesson_assignments). Поэтому один урок раздаётся скольким угодно
 * ученикам, у каждого своя история, а исходник остаётся исходником.
 *
 * Словник урока живёт ссылкой на материалы: слова с описаниями,
 * транскрипциями и картинками уже собраны там, и вторая копия разошлась
 * бы с первой на первой же правке.
 */
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonAssignments,
  lessonUnits,
  materialNodes,
  materialPhrases,
  notifications,
  phraseImages,
  users,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  isHighlight,
  isSection,
  openSections,
  parseTranscript,
  toggleHighlight,
  type LessonSection,
  type TranscriptLine,
} from "@/lib/lesson-unit";

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

export type LessonCard = {
  id: string;
  kind: LessonKind;
  title: string;
  description: string | null;
  /** Чем урок наполнен — по этому видно, что ещё не сделано. */
  vocabName: string | null;
  words: number;
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

  await db.update(lessonUnits).set(patch).where(eq(lessonUnits.id, unitId));
  revalidatePath("/teacher/lessons");
  return {};
}

/* ------------------------------------------------------------------ */
/* Урок целиком                                                        */
/* ------------------------------------------------------------------ */

export type LessonWord = {
  phraseId: string;
  icon: string | null;
  word: string;
  transcriptionUs: string | null;
  transcriptionUk: string | null;
  translation: string | null;
  description: string | null;
  imageUrl: string | null;
  /** Категория из словника: Nouns, Adjectives, Idioms… */
  category: string | null;
};

export type LessonView = {
  id: string;
  kind: LessonKind;
  title: string;
  description: string | null;
  vocabNodeId: string | null;
  vocabName: string | null;
  words: LessonWord[];
  videoUrl: string | null;
  videoTitle: string | null;
  transcript: TranscriptLine[];
  questions: { afterVideo: string[]; afterReading: string[] };
  homework: { title: string; text: string }[];
};

/** Слова словника в том виде, в каком их показывает урок. */
async function wordsOfNode(nodeId: string | null): Promise<LessonWord[]> {
  if (!nodeId) return [];

  const rows = await db
    .select({
      phraseId: materialPhrases.id,
      icon: materialPhrases.icon,
      word: materialPhrases.phrase,
      transcriptionUs: materialPhrases.transcriptionUs,
      transcriptionUk: materialPhrases.transcriptionUk,
      translation: materialPhrases.translation,
      description: materialPhrases.description,
      category: materialPhrases.section,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, nodeId))
    .orderBy(asc(materialPhrases.sortOrder));

  const ids = rows.map((r) => r.phraseId);
  const images = ids.length
    ? await db
        .select({ phraseId: phraseImages.phraseId, url: phraseImages.url })
        .from(phraseImages)
        .where(and(inArray(phraseImages.phraseId, ids), eq(phraseImages.picked, true)))
    : [];
  const imageOf = new Map(images.map((i) => [i.phraseId, i.url]));

  // Заметки 💡 — не слова: в словнике урока им места нет.
  return rows
    .filter((r) => r.kind !== "NOTE")
    .map(({ kind: _kind, ...r }) => ({ ...r, imageUrl: imageOf.get(r.phraseId) ?? null }));
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

  return {
    id: unit.id,
    kind: (unit.kind === "REGULAR" ? "REGULAR" : "ACTIVITY") as LessonKind,
    title: unit.title,
    description: unit.description,
    vocabNodeId: unit.vocabNodeId,
    vocabName: row.vocabName,
    words: await wordsOfNode(unit.vocabNodeId),
    videoUrl: unit.videoUrl,
    videoTitle: unit.videoTitle,
    transcript: unit.transcript ?? [],
    questions: {
      afterVideo: questions.afterVideo ?? [],
      afterReading: questions.afterReading ?? [],
    },
    homework: unit.homework ?? [],
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
    openSections: a.openSections ?? [],
    highlights: a.highlights ?? {},
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
 * Подсветить место в уроке у конкретного ученика.
 *
 * Правится закрепление, а не урок: у каждого ученика подчёркнуто своё,
 * и заготовка от этого не меняется.
 */
export async function highlightAction(
  assignmentId: string,
  key: string,
  color: string,
): Promise<{ error?: string }> {
  await requireTeacher();
  if (!isHighlight(color)) return { error: "Неизвестный цвет" };

  const id = String(assignmentId ?? "");
  const [row] = await db
    .select({ highlights: lessonAssignments.highlights })
    .from(lessonAssignments)
    .where(eq(lessonAssignments.id, id))
    .limit(1);
  if (!row) return { error: "Урок не закреплён" };

  await db
    .update(lessonAssignments)
    .set({
      highlights: toggleHighlight(row.highlights ?? {}, String(key ?? ""), color),
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
      openSections: stored,
      highlights: row.a.highlights ?? {},
      finishedAt: row.a.finishedAt?.toISOString() ?? null,
      createdAt: row.a.createdAt.toISOString(),
    },
    lesson,
    answers: row.a.answers ?? {},
    open: openSections(stored),
  };
}
