"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityGames,
  classLessonNotes,
  homework,
  lessons,
  lessonUnits,
  materialNodes,
  materialPhrases,
  wordDeckActivities,
  users,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  DEFAULT_WORD_DECK_SETTINGS,
  minimumWordDeckWords,
  nextWordDeckHomeworkTracking,
  normalizeWordDeckLiveState,
  normalizeWordDeckSettings,
  playableWordDeckCards,
  resetWordDeckHomeworkTracking,
  type WordDeckLiveState,
  type WordDeckHomeworkAttempt,
  type WordDeckSettings,
  type WordDeckSourceCard,
} from "@/lib/word-deck";
import { scheduleNow } from "@/lib/schedule-time";
import { enrichSpellingMistake } from "@/lib/spelling-mistake";
import { queueStudentNotification } from "@/lib/notifications";
import {
  removeStoredImage,
  storeUploadedImage,
  type StoreFailure,
} from "@/lib/image-store";

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

export type WordDeckVocab = {
  id: string;
  name: string;
  icon: string | null;
  words: number;
  personal: boolean;
};

export type WordDeckWord = WordDeckSourceCard;

export type WordDeckActivity = {
  id: string;
  title: string;
  nodeId: string | null;
  cards: WordDeckSourceCard[];
  settings: WordDeckSettings;
  backgroundImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const activityOf = (row: typeof wordDeckActivities.$inferSelect): WordDeckActivity => ({
  id: row.id,
  title: row.title,
  nodeId: row.nodeId,
  cards: row.cards ?? [],
  settings: normalizeWordDeckSettings(row.settings),
  backgroundImageUrl: row.backgroundImageUrl,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Словники общей базы и личных материалов учителя. */
export async function listWordDeckVocabsAction(): Promise<WordDeckVocab[]> {
  const session = await requireTeacher();
  const nodes = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      icon: materialNodes.icon,
      scope: materialNodes.scope,
    })
    .from(materialNodes)
    .where(
      and(
        eq(materialNodes.pageKind, "VOCAB"),
        or(
          and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)),
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
    .select({ nodeId: materialPhrases.nodeId, kind: materialPhrases.kind })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, nodes.map((node) => node.id)));
  const count = new Map<string, number>();
  for (const row of rows) {
    if (row.kind === "NOTE") continue;
    count.set(row.nodeId, (count.get(row.nodeId) ?? 0) + 1);
  }

  return nodes
    .map((node) => ({
      id: node.id,
      name: node.name,
      icon: node.icon,
      words: count.get(node.id) ?? 0,
      personal: node.scope === "PERSONAL",
    }))
    .filter((node) => node.words > 0);
}

export type WordDeckVocabGroup = {
  id: string;
  name: string;
  icon: string | null;
  words: WordDeckWord[];
};

async function wordDeckGroups(
  teacherId: string,
  requestedIds: string[],
): Promise<WordDeckVocabGroup[]> {
  const ids = [...new Set(requestedIds.map(String).filter(Boolean))];
  if (ids.length === 0) return [];
  const nodes = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      icon: materialNodes.icon,
    })
    .from(materialNodes)
    .where(
      and(
        inArray(materialNodes.id, ids),
        eq(materialNodes.pageKind, "VOCAB"),
        or(
          and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)),
          and(
            eq(materialNodes.scope, "PERSONAL"),
            eq(materialNodes.ownerId, teacherId),
          ),
          // Учитель может собирать активность из личного дерева ученика.
          eq(materialNodes.scope, "STUDENT"),
        ),
      ),
    );
  if (nodes.length === 0) return [];

  const rows = await db
    .select({
      nodeId: materialPhrases.nodeId,
      phraseId: materialPhrases.id,
      word: materialPhrases.phrase,
      icon: materialPhrases.icon,
      description: materialPhrases.description,
      translation: materialPhrases.translation,
      transcriptionUs: materialPhrases.transcriptionUs,
      transcriptionUk: materialPhrases.transcriptionUk,
      tip: materialPhrases.note,
      examples: materialPhrases.examples,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, nodes.map((node) => node.id)))
    .orderBy(asc(materialPhrases.sortOrder));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const wordsByNode = new Map<string, WordDeckWord[]>();
  for (const row of rows) {
    if (row.kind === "NOTE" || !row.word.trim()) continue;
    const node = nodeById.get(row.nodeId);
    if (!node) continue;
    const words = wordsByNode.get(row.nodeId) ?? [];
    words.push({
      phraseId: row.phraseId,
      word: row.word,
      icon: row.icon,
      description: row.description,
      translation: row.translation,
      transcriptionUs: row.transcriptionUs,
      transcriptionUk: row.transcriptionUk,
      tip: row.tip,
      examples: row.examples,
      nodeId: node.id,
      vocabName: node.name,
      vocabIcon: node.icon,
    });
    wordsByNode.set(row.nodeId, words);
  }

  // База не обязана вернуть строки в порядке входного списка — редактор обязан.
  return ids.flatMap((id) => {
    const node = nodeById.get(id);
    return node ? [{ id, name: node.name, icon: node.icon, words: wordsByNode.get(id) ?? [] }] : [];
  });
}

export async function listWordDeckVocabGroupsAction(
  nodeIds: string[],
): Promise<WordDeckVocabGroup[]> {
  const session = await requireTeacher();
  return wordDeckGroups(session.userId, nodeIds);
}

export async function listWordDeckWordsAction(nodeId: string): Promise<WordDeckWord[]> {
  const groups = await listWordDeckVocabGroupsAction([String(nodeId ?? "")]);
  return groups[0]?.words ?? [];
}

export async function listWordDeckActivitiesAction(): Promise<WordDeckActivity[]> {
  const session = await requireTeacher();
  const rows = await db
    .select()
    .from(wordDeckActivities)
    .where(eq(wordDeckActivities.authorId, session.userId))
    .orderBy(desc(wordDeckActivities.updatedAt));
  return rows
    .map(activityOf)
    .filter((activity) => activity.settings.gameType !== "GUESS_PICTURE");
}

export async function wordDeckActivityAction(id: string): Promise<WordDeckActivity | null> {
  const session = await requireTeacher();
  const [row] = await db
    .select()
    .from(wordDeckActivities)
    .where(
      and(
        eq(wordDeckActivities.id, String(id ?? "")),
        eq(wordDeckActivities.authorId, session.userId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const activity = activityOf(row);
  return activity.settings.gameType === "GUESS_PICTURE" ? null : activity;
}

export type WordDeckStudent = { id: string; name: string };

/** Ученики для явного назначения сохранённой колоды в класс. */
export async function listWordDeckStudentsAction(): Promise<WordDeckStudent[]> {
  await requireTeacher();
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));
}

export type ClassWordDeckActivity = {
  id: string;
  templateId: string | null;
  title: string;
  cards: WordDeckSourceCard[];
  settings: WordDeckSettings;
  backgroundImageUrl: string | null;
  liveState: WordDeckLiveState | null;
  createdAt: string;
};

const classWordDeckOf = (
  row: typeof activityGames.$inferSelect,
): ClassWordDeckActivity | null => {
  if (!row.wordDeck) return null;
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title ?? "Word deck",
    cards: row.wordDeck.cards ?? [],
    settings: normalizeWordDeckSettings(row.wordDeck.settings),
    backgroundImageUrl: row.wordDeck.backgroundImageUrl ?? null,
    liveState: normalizeWordDeckLiveState(
      row.wordDeck.cards ?? [],
      row.wordDeck.settings,
      row.wordDeck.liveState,
    ),
    createdAt: row.createdAt.toISOString(),
  };
};

/**
 * Добавить снимок колоды в Activities ученика. Повторное нажатие не
 * плодит копии: одна сохранённая колода у одного ученика стоит один раз.
 */
export async function addWordDeckToClassAction(
  activityId: string,
  studentId: string,
): Promise<{ id?: string; error?: string; existed?: boolean }> {
  const session = await requireTeacher();
  const templateId = String(activityId ?? "");
  const targetStudent = String(studentId ?? "");
  if (!templateId || !targetStudent) return { error: "Выбери ученика" };

  const [[activity], [student]] = await Promise.all([
    db
      .select()
      .from(wordDeckActivities)
      .where(
        and(
          eq(wordDeckActivities.id, templateId),
          eq(wordDeckActivities.authorId, session.userId),
        ),
      )
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, targetStudent), eq(users.role, "STUDENT")))
      .limit(1),
  ]);
  if (!activity) return { error: "Колода не найдена" };
  if (normalizeWordDeckSettings(activity.settings).gameType === "GUESS_PICTURE") {
    return { error: "Это пресет другой игры" };
  }
  if (!student) return { error: "Ученик не найден" };
  const settings = normalizeWordDeckSettings(activity.settings);
  const minimum = minimumWordDeckWords(settings);
  if (activity.cards.length < minimum) {
    return { error: `Для этой игры нужно минимум ${minimum} ${minimum === 1 ? "слово" : "слова"}` };
  }

  const [existing] = await db
    .select({ id: activityGames.id })
    .from(activityGames)
    .where(
      and(
        eq(activityGames.studentId, targetStudent),
        eq(activityGames.kind, "WORD_DECK"),
        eq(activityGames.templateId, templateId),
      ),
    )
    .limit(1);
  if (existing) return { id: existing.id, existed: true };

  const [created] = await db
    .insert(activityGames)
    .values({
      studentId: targetStudent,
      kind: "WORD_DECK",
      templateId,
      wordDeck: {
        settings,
        backgroundImageUrl: activity.backgroundImageUrl,
        cards: activity.cards,
      },
      mode: "WORD_DECK",
      title: activity.title,
      status: "LOBBY",
      cards: [],
      verdicts: [],
      timings: [],
      paused: true,
      pausedLeftMs: 0,
      deadline: null,
    })
    .returning({ id: activityGames.id });

  await queueStudentNotification({
    teacherId: session.userId,
    studentId: targetStudent,
    event: "activityAssigned",
    title: activity.title,
    href: "/student/class",
  });

  revalidatePath("/teacher/class");
  return { id: created?.id };
}

/** Assign a saved game as an independent student-controlled homework snapshot. */
export async function assignWordDeckHomeworkAction(
  activityId: string,
  studentId: string,
): Promise<{ id?: string; error?: string }> {
  const session = await requireTeacher();
  const templateId = String(activityId ?? "");
  const targetStudent = String(studentId ?? "");
  const [[activity], [student]] = await Promise.all([
    db.select().from(wordDeckActivities).where(and(
      eq(wordDeckActivities.id, templateId),
      eq(wordDeckActivities.authorId, session.userId),
    )).limit(1),
    db.select({ id: users.id }).from(users).where(and(
      eq(users.id, targetStudent),
      eq(users.role, "STUDENT"),
    )).limit(1),
  ]);
  if (!activity) return { error: "Игра не найдена" };
  if (!student) return { error: "Ученик не найден" };
  const settings = normalizeWordDeckSettings(activity.settings);
  if (settings.gameType === "GUESS_PICTURE") return { error: "Это пресет другой игры" };
  if (activity.cards.length < minimumWordDeckWords(settings)) return { error: "В игре недостаточно слов" };

  const [created] = await db.insert(activityGames).values({
    studentId: targetStudent,
    kind: "WORD_DECK_HOMEWORK",
    templateId,
    wordDeck: {
      settings,
      backgroundImageUrl: activity.backgroundImageUrl,
      cards: activity.cards,
      assignedByTeacherId: session.userId,
      attempts: [],
    },
    mode: "WORD_DECK",
    title: activity.title,
    status: "LOBBY",
    cards: [],
    verdicts: [],
    timings: [],
    paused: true,
    pausedLeftMs: 0,
    deadline: null,
  }).returning({ id: activityGames.id });
  await queueStudentNotification({
    teacherId: session.userId,
    studentId: targetStudent,
    event: "activityAssigned",
    title: activity.title,
    href: `/student/homework/games/${created?.id ?? ""}`,
  });
  revalidatePath("/student/homework");
  revalidatePath("/teacher/homeworks");
  return { id: created?.id };
}

export type WordDeckHomework = ClassWordDeckActivity & {
  status: "LOBBY" | "RUNNING" | "DONE";
  assignedAt: string;
  attempts: WordDeckHomeworkAttempt[];
};

export type TeacherWordDeckHomeworkCard = {
  kind: "ACTIVITY";
  id: string;
  title: string;
  homeworkTitle: string;
  activityType: WordDeckSettings["gameType"];
  status: "LOBBY" | "RUNNING" | "DONE";
  attempts: WordDeckHomeworkAttempt[];
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  started: boolean;
  assignedAt: string;
  nextLessonAt: string | null;
};

export type TeacherWordDeckHomeworkDetail = WordDeckHomework & {
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
};

function homeworkWordDeckOf(row: typeof activityGames.$inferSelect): WordDeckHomework | null {
  const activity = classWordDeckOf(row);
  if (!activity) return null;
  return {
    ...activity,
    status: row.status === "DONE" ? "DONE" : row.status === "RUNNING" ? "RUNNING" : "LOBBY",
    assignedAt: row.createdAt.toISOString(),
    attempts: row.wordDeck?.attempts ?? [],
  };
}

export async function myWordDeckHomeworkAction(): Promise<WordDeckHomework[]> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return [];
  const rows = await db.select().from(activityGames).where(and(
    eq(activityGames.studentId, session.userId),
    eq(activityGames.kind, "WORD_DECK_HOMEWORK"),
  )).orderBy(desc(activityGames.createdAt));
  return rows.flatMap((row) => {
    const item = homeworkWordDeckOf(row);
    return item ? [item] : [];
  });
}

export async function wordDeckHomeworkAction(id: string): Promise<WordDeckHomework | null> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return null;
  const [row] = await db.select().from(activityGames).where(and(
    eq(activityGames.id, String(id ?? "")),
    eq(activityGames.studentId, session.userId),
    eq(activityGames.kind, "WORD_DECK_HOMEWORK"),
  )).limit(1);
  return row ? homeworkWordDeckOf(row) : null;
}

function teacherOwnsWordDeckHomework(
  teacherId: string,
  row: { game: typeof activityGames.$inferSelect; templateAuthorId: string | null },
  soleTeacherId: string | null,
) {
  const explicitOwner = row.game.wordDeck?.assignedByTeacherId;
  return explicitOwner === teacherId || row.templateAuthorId === teacherId || (
    !explicitOwner && !row.templateAuthorId && soleTeacherId === teacherId
  );
}

/** Legacy note-based assignments predate assignedByTeacherId. In a single-teacher
 * school they still unambiguously belong to that teacher; never guess if there
 * is more than one teacher account. */
async function soleTeacherId() {
  const teachers = await db.select({ id: users.id }).from(users)
    .where(eq(users.role, "TEACHER"))
    .limit(2);
  return teachers.length === 1 ? teachers[0].id : null;
}

/** Homework activities shown alongside ordinary lesson homework in teacher folders. */
export async function teacherWordDeckHomeworkAssignmentsAction(): Promise<TeacherWordDeckHomeworkCard[]> {
  const session = await requireTeacher();
  const [rows, legacyOwnerId] = await Promise.all([
    db.select({
      game: activityGames,
      studentName: users.name,
      studentAvatarUrl: users.avatarUrl,
      templateAuthorId: wordDeckActivities.authorId,
    }).from(activityGames)
      .innerJoin(users, eq(users.id, activityGames.studentId))
      .leftJoin(wordDeckActivities, eq(wordDeckActivities.id, activityGames.templateId))
      .where(eq(activityGames.kind, "WORD_DECK_HOMEWORK"))
      .orderBy(desc(activityGames.createdAt)),
    soleTeacherId(),
  ]);
  const mine = rows.filter((row) => teacherOwnsWordDeckHomework(session.userId, row, legacyOwnerId));
  const studentIds = [...new Set(mine.map((row) => row.game.studentId))];
  const upcomingLessons = studentIds.length > 0
    ? await db.select({ studentId: lessons.studentId, startTime: lessons.startTime })
      .from(lessons)
      .where(and(
        inArray(lessons.studentId, studentIds),
        eq(lessons.status, "SCHEDULED"),
        gte(lessons.startTime, scheduleNow()),
      ))
      .orderBy(asc(lessons.startTime))
    : [];
  const nextLessonByStudent = new Map<string, string>();
  for (const lesson of upcomingLessons) {
    if (!nextLessonByStudent.has(lesson.studentId)) {
      nextLessonByStudent.set(lesson.studentId, lesson.startTime.toISOString());
    }
  }
  return mine.flatMap((row) => {
    const item = homeworkWordDeckOf(row.game);
    if (!item) return [];
    const latest = item.attempts.at(-1)?.finishedAt ?? (item.status === "DONE" ? row.game.updatedAt.toISOString() : null);
    return [{
      kind: "ACTIVITY" as const,
      id: item.id,
      title: item.title,
      homeworkTitle: "Activity",
      activityType: item.settings.gameType,
      status: item.status,
      attempts: item.attempts,
      studentId: row.game.studentId,
      studentName: row.studentName,
      studentAvatarUrl: row.studentAvatarUrl,
      submittedAt: latest,
      reviewedAt: latest,
      started: item.status !== "LOBBY" || item.attempts.length > 0,
      assignedAt: item.assignedAt,
      nextLessonAt: nextLessonByStudent.get(row.game.studentId) ?? null,
    }];
  });
}

export async function teacherWordDeckHomeworkAction(id: string): Promise<TeacherWordDeckHomeworkDetail | null> {
  const session = await requireTeacher();
  const [[row], legacyOwnerId] = await Promise.all([
    db.select({
      game: activityGames,
      studentName: users.name,
      studentAvatarUrl: users.avatarUrl,
      templateAuthorId: wordDeckActivities.authorId,
    }).from(activityGames)
      .innerJoin(users, eq(users.id, activityGames.studentId))
      .leftJoin(wordDeckActivities, eq(wordDeckActivities.id, activityGames.templateId))
      .where(and(
        eq(activityGames.id, String(id ?? "")),
        eq(activityGames.kind, "WORD_DECK_HOMEWORK"),
      ))
      .limit(1),
    soleTeacherId(),
  ]);
  if (!row || !teacherOwnsWordDeckHomework(session.userId, row, legacyOwnerId)) return null;
  const item = homeworkWordDeckOf(row.game);
  return item ? {
    ...item,
    studentId: row.game.studentId,
    studentName: row.studentName,
    studentAvatarUrl: row.studentAvatarUrl,
  } : null;
}

export async function deleteWordDeckHomeworkAction(id: string): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const [[row], legacyOwnerId] = await Promise.all([
    db.select({
      game: activityGames,
      templateAuthorId: wordDeckActivities.authorId,
    }).from(activityGames)
      .leftJoin(wordDeckActivities, eq(wordDeckActivities.id, activityGames.templateId))
      .where(and(
        eq(activityGames.id, String(id ?? "")),
        eq(activityGames.kind, "WORD_DECK_HOMEWORK"),
      ))
      .limit(1),
    soleTeacherId(),
  ]);
  if (!row || !teacherOwnsWordDeckHomework(session.userId, row, legacyOwnerId)) {
    return { error: "Домашняя активность не найдена" };
  }
  await db.delete(activityGames).where(eq(activityGames.id, row.game.id));
  revalidatePath("/teacher/homeworks");
  revalidatePath("/student/homework");
  return {};
}

/** Clear a homework game's progress and completed attempts, keeping the assignment. */
export async function resetWordDeckHomeworkAction(id: string): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const [[row], legacyOwnerId] = await Promise.all([
    db.select({
      game: activityGames,
      templateAuthorId: wordDeckActivities.authorId,
    }).from(activityGames)
      .leftJoin(wordDeckActivities, eq(wordDeckActivities.id, activityGames.templateId))
      .where(and(
        eq(activityGames.id, String(id ?? "")),
        eq(activityGames.kind, "WORD_DECK_HOMEWORK"),
      ))
      .limit(1),
    soleTeacherId(),
  ]);
  if (!row || !row.game.wordDeck || !teacherOwnsWordDeckHomework(session.userId, row, legacyOwnerId)) {
    return { error: "Домашняя активность не найдена" };
  }

  await db.update(activityGames).set({
    wordDeck: {
      ...row.game.wordDeck,
      ...resetWordDeckHomeworkTracking(row.game.wordDeck),
      liveState: undefined,
    },
    status: "LOBBY",
    cards: [],
    verdicts: [],
    timings: [],
    at: 0,
    revealed: false,
    paused: true,
    pausedLeftMs: 0,
    deadline: null,
    updatedAt: new Date(),
  }).where(eq(activityGames.id, row.game.id));

  await queueStudentNotification({
    teacherId: session.userId,
    studentId: row.game.studentId,
    event: "homeworkUpdated",
    title: row.game.title || "Activity",
    href: `/student/homework/games/${row.game.id}`,
  });
  revalidatePath("/teacher/homeworks");
  revalidatePath(`/teacher/homeworks/activities/${row.game.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/student/homework/games/${row.game.id}`);
  return {};
}

/** Students can only update the order/progress of their own assigned snapshot. */
export async function saveWordDeckHomeworkStateAction(
  gameId: string,
  input: WordDeckLiveState,
): Promise<{ state?: WordDeckLiveState; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return { error: "Войди как ученик" };
  const [row] = await db.select().from(activityGames).where(and(
    eq(activityGames.id, String(gameId ?? "")),
    eq(activityGames.studentId, session.userId),
    eq(activityGames.kind, "WORD_DECK_HOMEWORK"),
  )).limit(1);
  if (!row?.wordDeck) return { error: "Домашняя игра не найдена" };
  const normalized = normalizeWordDeckLiveState(row.wordDeck.cards, row.wordDeck.settings, input);
  if (!normalized) return { error: "Состояние игры повреждено" };
  const now = new Date();
  const state = { ...normalized, updatedAt: now.toISOString() };
  const settings = normalizeWordDeckSettings(row.wordDeck.settings);
  const needsReveal = settings.gameType === "GUESS_DESCRIPTION" || settings.gameType === "GUESS_PICTURE";
  const finished = state.at >= state.deck.length - 1 && state.at >= 0 && (!needsReveal || state.faceUp);
  const tracking = nextWordDeckHomeworkTracking(row.wordDeck, {
    started: state.at >= 0,
    finished,
    wasFinished: row.status === "DONE",
  }, now);
  await db.update(activityGames).set({
    wordDeck: {
      ...row.wordDeck,
      liveState: state,
      attemptStartedAt: tracking.attemptStartedAt,
      lastCompletedAttemptStartedAt: tracking.lastCompletedAttemptStartedAt,
      attempts: tracking.attempts,
    },
    status: finished ? "DONE" : state.at >= 0 ? "RUNNING" : "LOBBY",
    updatedAt: now,
  }).where(eq(activityGames.id, row.id));
  revalidatePath("/student/homework");
  revalidatePath("/teacher/homeworks");
  return { state };
}

export type AssignSpellingNotesHomeworkInput = {
  noteIds: string[];
  additionalWords?: string[];
  title?: string;
  settings?: Partial<WordDeckSettings>;
};

/** Build pronunciation homework directly from the current student's Spelling notes. */
export async function assignSpellingNotesHomeworkAction(
  input: AssignSpellingNotesHomeworkInput,
): Promise<{ id?: string; error?: string }> {
  const session = await requireTeacher();
  const [teacher] = await db.select({ studentId: users.classWithId }).from(users)
    .where(eq(users.id, session.userId)).limit(1);
  if (!teacher?.studentId) return { error: "Сначала выбери ученика в классе" };
  const requested = [...new Set((input.noteIds ?? []).map(String).filter(Boolean))].slice(0, 100);
  const extra = [...new Set((input.additionalWords ?? [])
    .map((word) => String(word ?? "").trim().replace(/\s+/g, " ").slice(0, 300))
    .filter(Boolean))].slice(0, 100);
  const notes = requested.length === 0 ? [] : await db.select().from(classLessonNotes).where(and(
    inArray(classLessonNotes.id, requested),
    eq(classLessonNotes.teacherId, session.userId),
    eq(classLessonNotes.studentId, teacher.studentId),
    eq(classLessonNotes.kind, "SPELLING"),
  ));
  if (notes.length !== requested.length) return { error: "Одна из записей больше недоступна" };
  if (notes.length === 0 && extra.length === 0) return { error: "Выбери хотя бы одно слово" };

  let extraCards: WordDeckSourceCard[] = [];
  try {
    const lang = notes[0]?.translationLang ?? "RU";
    const details = await Promise.all(extra.map((word) => enrichSpellingMistake(word, lang)));
    extraCards = details.map((card) => ({
      phraseId: `manual:${randomUUID()}`,
      word: card.english,
      translation: card.translation,
      icon: card.icon,
      examples: card.examples,
      tip: card.partOfSpeech,
    }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось подготовить слова" };
  }
  const noteCards: WordDeckSourceCard[] = notes.map((note) => ({
    phraseId: `note:${note.id}`,
    word: note.body,
    translation: note.translation,
    icon: note.icon,
    examples: note.examples ?? [],
    tip: note.partOfSpeech,
  }));
  const unique = new Map<string, WordDeckSourceCard>();
  [...noteCards, ...extraCards].forEach((card) => unique.set(card.word.toLocaleLowerCase("en"), card));
  const settings = normalizeWordDeckSettings({
    ...input.settings,
    gameType: "SPELLING",
    repeats: input.settings?.repeats ?? 1,
  });
  const [created] = await db.insert(activityGames).values({
    studentId: teacher.studentId,
    kind: "WORD_DECK_HOMEWORK",
    wordDeck: {
      settings,
      backgroundImageUrl: null,
      cards: [...unique.values()],
      assignedByTeacherId: session.userId,
      attempts: [],
    },
    mode: "WORD_DECK",
    title: String(input.title ?? "Spelling Practice").trim().slice(0, 120) || "Spelling Practice",
    status: "LOBBY",
    cards: [], verdicts: [], timings: [], paused: true, pausedLeftMs: 0, deadline: null,
  }).returning({ id: activityGames.id });
  await queueStudentNotification({
    teacherId: session.userId,
    studentId: teacher.studentId,
    event: "activityAssigned",
    title: String(input.title ?? "Spelling Practice").trim().slice(0, 120) || "Spelling Practice",
    href: `/student/homework/games/${created?.id ?? ""}`,
  });
  revalidatePath("/student/homework");
  revalidatePath("/teacher/homeworks");
  return { id: created?.id };
}

/** Сохранённые колоды в Activities конкретного ученика. */
export async function listClassWordDeckActivitiesAction(
  studentId: string,
): Promise<ClassWordDeckActivity[]> {
  await requireTeacher();
  const target = String(studentId ?? "");
  if (!target) return [];
  const rows = await db
    .select()
    .from(activityGames)
    .where(and(eq(activityGames.studentId, target), eq(activityGames.kind, "WORD_DECK")))
    .orderBy(asc(activityGames.createdAt));

  return rows.flatMap((row) => {
    const activity = classWordDeckOf(row);
    return activity ? [activity] : [];
  });
}

/** Колода показывается ученику только по явной команде учителя. */
export async function focusedClassWordDeckAction(): Promise<ClassWordDeckActivity | null> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return null;

  const [student] = await db
    .select({ classFocus: users.classFocus })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const gameId = student?.classFocus?.view === "GAME"
    ? student.classFocus.gameId
    : null;
  if (!gameId) return null;

  const [row] = await db
    .select()
    .from(activityGames)
    .where(
      and(
        eq(activityGames.id, gameId),
        eq(activityGames.studentId, session.userId),
        eq(activityGames.kind, "WORD_DECK"),
      ),
    )
    .limit(1);
  return row ? classWordDeckOf(row) : null;
}

/** Текущий стол для учителя и наблюдающего ученика выбранного класса. */
export async function classWordDeckLiveStateAction(
  gameId: string,
): Promise<WordDeckLiveState | null> {
  const session = await getSession();
  if (!session) return null;
  let studentId = session.userId;
  if (session.role === "TEACHER") {
    const [teacher] = await db
      .select({ classWithId: users.classWithId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!teacher?.classWithId) return null;
    studentId = teacher.classWithId;
  }

  const [row] = await db
    .select()
    .from(activityGames)
    .where(
      and(
        eq(activityGames.id, String(gameId ?? "")),
        eq(activityGames.studentId, studentId),
        eq(activityGames.kind, "WORD_DECK"),
      ),
    )
    .limit(1);
  return row ? classWordDeckOf(row)?.liveState ?? null : null;
}

/** Учитель публикует стол; ученик не может прислать ни карту, ни ход. */
export async function saveClassWordDeckLiveStateAction(
  gameId: string,
  input: WordDeckLiveState,
): Promise<{ state?: WordDeckLiveState; error?: string }> {
  const session = await requireTeacher();
  const [teacher] = await db
    .select({ classWithId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!teacher?.classWithId) return { error: "Класс не начат" };

  const [row] = await db
    .select()
    .from(activityGames)
    .where(
      and(
        eq(activityGames.id, String(gameId ?? "")),
        eq(activityGames.studentId, teacher.classWithId),
        eq(activityGames.kind, "WORD_DECK"),
      ),
    )
    .limit(1);
  if (!row?.wordDeck) return { error: "Колода в классе не найдена" };

  const normalized = normalizeWordDeckLiveState(
    row.wordDeck.cards ?? [],
    row.wordDeck.settings,
    input,
  );
  if (!normalized) return { error: "Состояние колоды повреждено" };
  const state = { ...normalized, updatedAt: new Date().toISOString() };
  await db
    .update(activityGames)
    .set({ wordDeck: { ...row.wordDeck, liveState: state }, updatedAt: new Date() })
    .where(eq(activityGames.id, row.id));
  return { state };
}

/** Удаляется только назначение из класса; сохранённый шаблон остаётся. */
export async function removeWordDeckFromClassAction(
  id: string,
): Promise<{ error?: string }> {
  await requireTeacher();
  const target = String(id ?? "");
  const [row] = await db
    .select({ id: activityGames.id })
    .from(activityGames)
    .where(and(eq(activityGames.id, target), eq(activityGames.kind, "WORD_DECK")))
    .limit(1);
  if (!row) return { error: "Колода в классе не найдена" };
  await db.delete(activityGames).where(eq(activityGames.id, target));
  revalidatePath("/teacher/class");
  return {};
}

export type SaveWordDeckInput = {
  id?: string;
  title: string;
  /** Несколько словников складываются в одну общую колоду. */
  nodeIds?: string[];
  /** Старые клиенты и сохранённые формы с одним словником. */
  nodeId?: string;
  phraseIds?: string[];
  /** English words typed directly in Spelling Practice. */
  manualWords?: string[];
  /** Interface language used for automatically generated translations. */
  translationLang?: "RU" | "UK";
  settings?: Partial<WordDeckSettings>;
};

/** Создать или обновить шаблон. Слова снимаются копией и больше не зависят от материала. */
export async function saveWordDeckActivityAction(
  input: SaveWordDeckInput,
): Promise<{ id?: string; error?: string }> {
  const session = await requireTeacher();
  const title = String(input?.title ?? "").trim().slice(0, 120);
  const nodeIds = [
    ...new Set(
      (input?.nodeIds?.length ? input.nodeIds : [input?.nodeId])
        .map((id) => String(id ?? ""))
        .filter(Boolean),
    ),
  ];
  const manualWords = [...new Set((input?.manualWords ?? [])
    .map((word) => String(word ?? "").trim().replace(/\s+/g, " ").slice(0, 300))
    .filter(Boolean))].slice(0, 100);
  if (!title) return { error: "Назови игру" };
  if (nodeIds.length === 0 && manualWords.length === 0) {
    return { error: "Выбери словник или добавь слова вручную" };
  }
  const requestedRepeats = input?.settings?.repeats;
  if (!Number.isInteger(requestedRepeats) || Number(requestedRepeats) < 1 || Number(requestedRepeats) > 20) {
    return { error: "Укажи количество повторов от 1 до 20" };
  }

  const sources = await wordDeckGroups(session.userId, nodeIds);
  if (sources.length !== nodeIds.length || sources.some((source) => source.words.length === 0)) {
    return { error: "Один из словников пуст или больше недоступен" };
  }
  const words = sources.flatMap((source) => source.words);
  const picked = Array.isArray(input?.phraseIds)
    ? new Set(input.phraseIds.map(String))
    : null;
  const normalized = normalizeWordDeckSettings(input?.settings ?? DEFAULT_WORD_DECK_SETTINGS);
  const settings = normalized.gameType === "GUESS_PICTURE"
    ? { ...normalized, gameType: "WORDS" as const }
    : normalized;
  if (manualWords.length > 0 && settings.gameType !== "SPELLING") {
    return { error: "Ручной ввод доступен только в Spelling Practice" };
  }
  const selectedCards = picked ? words.filter((word) => picked.has(word.phraseId)) : words;
  let manualCards: WordDeckSourceCard[] = [];
  if (manualWords.length > 0) {
    try {
      const translationLang = input?.translationLang === "UK" ? "UK" : "RU";
      const details = await Promise.all(manualWords.map((word) => enrichSpellingMistake(word, translationLang)));
      manualCards = details.map((card) => ({
        phraseId: `manual:${randomUUID()}`,
        word: card.english,
        icon: card.icon,
        translation: card.translation,
        examples: card.examples,
        tip: card.partOfSpeech,
      }));
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Не удалось подготовить слова" };
    }
  }
  const playableCards = playableWordDeckCards([...selectedCards, ...manualCards], settings);
  const minimum = minimumWordDeckWords(settings);
  if (playableCards.length < minimum) {
    return { error: `Для этой игры нужно минимум ${minimum} ${minimum === 1 ? "слово" : "слова"}` };
  }

  const id = String(input?.id ?? "");
  if (id) {
    const [mine] = await db
      .select({ id: wordDeckActivities.id })
      .from(wordDeckActivities)
      .where(
        and(
          eq(wordDeckActivities.id, id),
          eq(wordDeckActivities.authorId, session.userId),
        ),
      )
      .limit(1);
    if (!mine) return { error: "Игра не найдена" };
    await db
      .update(wordDeckActivities)
      .set({ title, nodeId: nodeIds[0], cards: playableCards, settings, updatedAt: new Date() })
      .where(eq(wordDeckActivities.id, id));
    revalidatePath("/teacher/activities");
    return { id };
  }

  const [created] = await db
    .insert(wordDeckActivities)
    .values({ authorId: session.userId, title, nodeId: nodeIds[0], cards: playableCards, settings })
    .returning({ id: wordDeckActivities.id });
  revalidatePath("/teacher/activities");
  return { id: created?.id };
}

export async function uploadWordDeckBackgroundAction(
  formData: FormData,
): Promise<{ url?: string; error?: string; reason?: StoreFailure }> {
  const session = await requireTeacher();
  const id = String(formData.get("activityId") ?? "");
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { reason: "failed" };
  const [mine] = await db
    .select({
      id: wordDeckActivities.id,
      old: wordDeckActivities.backgroundImageUrl,
      settings: wordDeckActivities.settings,
    })
    .from(wordDeckActivities)
    .where(
      and(eq(wordDeckActivities.id, id), eq(wordDeckActivities.authorId, session.userId)),
    )
    .limit(1);
  if (!mine) return { error: "Игра не найдена" };

  const stored = await storeUploadedImage(file, "activities");
  if ("error" in stored) return { reason: stored.error };
  await db
    .update(wordDeckActivities)
    .set({
      backgroundImageUrl: stored.url,
      settings: {
        ...normalizeWordDeckSettings(mine.settings),
        background: "CUSTOM",
      },
      updatedAt: new Date(),
    })
    .where(eq(wordDeckActivities.id, id));
  if (mine.old) await removeStoredImage(mine.old, "activities");
  revalidatePath("/teacher/activities");
  return { url: stored.url };
}

export async function deleteWordDeckActivityAction(id: string): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const target = String(id ?? "");
  const [mine] = await db
    .select({ id: wordDeckActivities.id, image: wordDeckActivities.backgroundImageUrl })
    .from(wordDeckActivities)
    .where(
      and(
        eq(wordDeckActivities.id, target),
        eq(wordDeckActivities.authorId, session.userId),
      ),
    )
    .limit(1);
  if (!mine) return { error: "Игра не найдена" };

  // Класс хранит полный снимок колоды, включая URL собственного фона.
  // Если такой снимок уже выдан ученику, удаляем только шаблон: сам файл
  // всё ещё нужен классу и не должен исчезнуть вместе с пресетом.
  const [classCopy] = await db
    .select({ id: activityGames.id })
    .from(activityGames)
    .where(
      and(
        eq(activityGames.templateId, target),
        eq(activityGames.kind, "WORD_DECK"),
      ),
    )
    .limit(1);

  const lessons = await db
    .select({ id: lessonUnits.id, activityIds: lessonUnits.activityIds })
    .from(lessonUnits)
    .where(eq(lessonUnits.authorId, session.userId));
  for (const lesson of lessons) {
    if (!(lesson.activityIds ?? []).includes(target)) continue;
    await db
      .update(lessonUnits)
      .set({
        activityIds: (lesson.activityIds ?? []).filter((activityId) => activityId !== target),
        updatedAt: new Date(),
      })
      .where(eq(lessonUnits.id, lesson.id));
  }
  await db.update(homework).set({ activityId: null }).where(eq(homework.activityId, target));
  await db.delete(wordDeckActivities).where(eq(wordDeckActivities.id, target));
  if (mine.image && !classCopy) await removeStoredImage(mine.image, "activities");
  revalidatePath("/teacher/activities");
  return {};
}
