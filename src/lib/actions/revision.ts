"use server";

/**
 * Повторение слов: выдача, прохождение и разбор.
 *
 * Слова снимаются при выдаче и хранятся списком: правка словника потом
 * не меняет уже выданное. Карточки собираются при старте попытки — если
 * учитель откроет задание заново, порядок будет другим, и повторение
 * останется повторением, а не заучиванием последовательности.
 */
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materialNodes,
  materialPhrases,
  notifications,
  phraseImages,
  users,
  wordRevisionAttempts,
  wordRevisions,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { buildRevision, type RevisionSection } from "@/lib/revision-build";
import { REVISION_MODES, type RevisionMode, type RevisionWord } from "@/lib/revision-modes";
import { scoreRevision, type RevisionAnswer } from "@/lib/revision-score";

export type RevisionState = { ok?: boolean; error?: string; id?: string };

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

/** Слова словника вместе с тем, что нужно режимам. */
export async function revisionWordsAction(nodeId: string): Promise<RevisionWord[]> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return [];

  const rows = await db
    .select({
      phraseId: materialPhrases.id,
      word: materialPhrases.phrase,
      translation: materialPhrases.translation,
      description: materialPhrases.description,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, id))
    .orderBy(asc(materialPhrases.sortOrder));

  // Заметки 💡 словами не считаются: повторять в них нечего.
  const words = rows.filter((r) => r.kind !== "NOTE");
  if (words.length === 0) return [];

  const images = await db
    .select({ phraseId: phraseImages.phraseId, url: phraseImages.url })
    .from(phraseImages)
    .where(
      and(
        inArray(phraseImages.phraseId, words.map((w) => w.phraseId)),
        eq(phraseImages.picked, true),
      ),
    );
  const imageOf = new Map(images.map((i) => [i.phraseId, i.url]));

  return words.map((w) => ({
    phraseId: w.phraseId,
    word: w.word,
    translation: w.translation,
    description: w.description,
    imageUrl: imageOf.get(w.phraseId) ?? null,
  }));
}

export type RevisionSetup = {
  studentId: string;
  nodeId: string;
  title: string;
  phraseIds: string[];
  modes: string[];
  /** Слова по режимам: пустой режим берёт всё, что ему подходит. */
  modeWords: Record<string, string[]>;
  answerSeconds: number | null;
  totalSeconds: number | null;
  dueAt: string | null;
};

/** Выдать задание ученику. */
export async function createRevisionAction(setup: RevisionSetup): Promise<RevisionState> {
  const session = await requireTeacher();

  const studentId = String(setup?.studentId ?? "");
  const nodeId = String(setup?.nodeId ?? "");
  const title = String(setup?.title ?? "").trim().slice(0, 120);
  const phraseIds = (setup?.phraseIds ?? []).map(String).filter(Boolean);
  const modes = (setup?.modes ?? []).filter((m): m is RevisionMode =>
    REVISION_MODES.includes(m as RevisionMode),
  );

  /*
   * Набор режима чистим по общему списку слов: пришедшие с формы id
   * должны быть из этого же словника, а не откуда придётся.
   */
  const inTask = new Set(phraseIds);
  const modeWords: Record<string, string[]> = {};
  for (const mode of modes) {
    const own = (setup?.modeWords?.[mode] ?? []).map(String).filter((id) => inTask.has(id));
    if (own.length > 0) modeWords[mode] = own;
  }

  if (!studentId || !nodeId) return { error: "Не выбран ученик или словник" };
  if (!title) return { error: "Дай заданию название" };
  if (phraseIds.length === 0) return { error: "Не выбрано ни одного слова" };
  if (modes.length === 0) return { error: "Не выбран ни один режим" };

  const due = setup?.dueAt ? new Date(setup.dueAt) : null;

  const [created] = await db
    .insert(wordRevisions)
    .values({
      studentId,
      nodeId,
      title,
      phraseIds,
      modes,
      modeWords,
      answerSeconds: setup?.answerSeconds ?? null,
      totalSeconds: setup?.totalSeconds ?? null,
      dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
    })
    .returning({ id: wordRevisions.id });

  await db.insert(notifications).values({
    recipientId: studentId,
    type: "HOMEWORK_SUBMITTED",
    message: `Новое повторение слов: ${title}`,
    relatedStudentId: studentId,
  });
  void session;

  revalidatePath("/teacher/materials");
  revalidatePath("/student/homework");
  return { ok: true, id: created?.id };
}

export type RevisionCard = {
  id: string;
  title: string;
  /** Откуда выдано: название словника и ссылка на него. */
  nodeId: string | null;
  nodeName: string | null;
  createdAt: string;
  dueAt: string | null;
  modes: string[];
  words: number;
  /** Сколько раз пройдено и когда в последний. */
  attempts: number;
  lastFinishedAt: string | null;
  /** Можно ли проходить: не сдано или открыто заново. */
  open: boolean;
};

async function cardsFor(studentId: string): Promise<RevisionCard[]> {
  const rows = await db
    .select({
      revision: wordRevisions,
      nodeName: materialNodes.name,
    })
    .from(wordRevisions)
    .leftJoin(materialNodes, eq(materialNodes.id, wordRevisions.nodeId))
    .where(eq(wordRevisions.studentId, studentId))
    .orderBy(desc(wordRevisions.createdAt));

  if (rows.length === 0) return [];

  const attempts = await db
    .select({
      revisionId: wordRevisionAttempts.revisionId,
      finishedAt: wordRevisionAttempts.finishedAt,
    })
    .from(wordRevisionAttempts)
    .where(
      inArray(wordRevisionAttempts.revisionId, rows.map((r) => r.revision.id)),
    );

  return rows.map(({ revision, nodeName }) => {
    const mine = attempts.filter((a) => a.revisionId === revision.id);
    const done = mine.filter((a) => a.finishedAt);
    const last = done
      .map((a) => a.finishedAt!)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: revision.id,
      title: revision.title,
      nodeId: revision.nodeId,
      nodeName,
      createdAt: revision.createdAt.toISOString(),
      dueAt: revision.dueAt?.toISOString() ?? null,
      modes: revision.modes ?? [],
      words: (revision.phraseIds ?? []).length,
      attempts: done.length,
      lastFinishedAt: last?.toISOString() ?? null,
      // Сдано — закрыто, пока учитель не откроет заново.
      open: done.length === 0 || revision.reopened,
    };
  });
}

/** Задания ученика — для учителя. */
export async function listRevisionsAction(studentId: string): Promise<RevisionCard[]> {
  await requireTeacher();
  const id = String(studentId ?? "");
  return id ? cardsFor(id) : [];
}

/** Свои задания — для ученика. */
export async function myRevisionsAction(): Promise<RevisionCard[]> {
  const session = await getSession();
  if (!session) return [];
  return cardsFor(session.userId);
}

/** Убрать задание вместе с попытками. */
export async function deleteRevisionAction(id: string): Promise<RevisionState> {
  await requireTeacher();
  const revisionId = String(id ?? "");
  if (!revisionId) return { error: "Не выбрано задание" };

  await db.delete(wordRevisions).where(eq(wordRevisions.id, revisionId));
  revalidatePath("/teacher/materials");
  return { ok: true };
}

/** Открыть сданное задание заново — попытки при этом копятся. */
export async function reopenRevisionAction(
  id: string,
  open: boolean,
): Promise<RevisionState> {
  await requireTeacher();
  const revisionId = String(id ?? "");
  if (!revisionId) return { error: "Не выбрано задание" };

  await db
    .update(wordRevisions)
    .set({ reopened: !!open })
    .where(eq(wordRevisions.id, revisionId));

  revalidatePath("/teacher/materials");
  revalidatePath("/student/homework");
  return { ok: true };
}

/**
 * Собрать карточки и начать попытку.
 *
 * Порядок собирается заново на каждую попытку: иначе повторное
 * прохождение превращается в заучивание последовательности.
 */
export async function startRevisionAction(
  id: string,
): Promise<{ ok?: boolean; error?: string; attemptId?: string }> {
  const session = await getSession();
  if (!session) return { error: "Нужно войти" };

  const revisionId = String(id ?? "");
  const [revision] = await db
    .select()
    .from(wordRevisions)
    .where(eq(wordRevisions.id, revisionId))
    .limit(1);

  if (!revision) return { error: "Задание не найдено" };
  if (revision.studentId !== session.userId) return { error: "Это чужое задание" };

  const done = await db
    .select({ id: wordRevisionAttempts.id })
    .from(wordRevisionAttempts)
    .where(
      and(
        eq(wordRevisionAttempts.revisionId, revisionId),
        isNotNull(wordRevisionAttempts.finishedAt),
      ),
    );

  if (done.length > 0 && !revision.reopened) {
    return { error: "Задание уже сдано" };
  }

  // Незаконченная попытка продолжается: остановить задание нельзя.
  const [running] = await db
    .select({ id: wordRevisionAttempts.id })
    .from(wordRevisionAttempts)
    .where(
      and(
        eq(wordRevisionAttempts.revisionId, revisionId),
        isNull(wordRevisionAttempts.finishedAt),
      ),
    )
    .limit(1);
  if (running) return { ok: true, attemptId: running.id };

  const words = await wordsOf(revision.phraseIds ?? []);
  const plan = buildRevision(words, (revision.modes ?? []) as RevisionMode[], {
    byMode: revision.modeWords ?? undefined,
  });
  if (plan.length === 0) return { error: "Для этих слов нечего показать" };

  /*
   * Время старта ставим из приложения, а не default'ом базы: now() в
   * колонке без часового пояса кладёт местное время, а читается оно как
   * UTC. Разница в три часа превращала общий таймер задания в лишние
   * три часа форы.
   */
  const [attempt] = await db
    .insert(wordRevisionAttempts)
    .values({ revisionId, plan, startedAt: new Date() })
    .returning({ id: wordRevisionAttempts.id });

  revalidatePath("/student/homework");
  return { ok: true, attemptId: attempt?.id };
}

/** Слова по списку — для сборки попытки. Порядок как в словнике. */
async function wordsOf(phraseIds: string[]): Promise<RevisionWord[]> {
  if (phraseIds.length === 0) return [];

  const rows = await db
    .select({
      phraseId: materialPhrases.id,
      word: materialPhrases.phrase,
      translation: materialPhrases.translation,
      description: materialPhrases.description,
    })
    .from(materialPhrases)
    .where(inArray(materialPhrases.id, phraseIds))
    .orderBy(asc(materialPhrases.sortOrder));

  const images = await db
    .select({ phraseId: phraseImages.phraseId, url: phraseImages.url })
    .from(phraseImages)
    .where(
      and(inArray(phraseImages.phraseId, phraseIds), eq(phraseImages.picked, true)),
    );
  const imageOf = new Map(images.map((i) => [i.phraseId, i.url]));

  return rows.map((r) => ({ ...r, imageUrl: imageOf.get(r.phraseId) ?? null }));
}

export type AttemptView = {
  id: string;
  revisionId: string;
  title: string;
  plan: RevisionSection[];
  answers: RevisionAnswer[];
  startedAt: string;
  finishedAt: string | null;
  answerSeconds: number | null;
  totalSeconds: number | null;
};

/** Текущая попытка со всем, что нужно для прохождения. */
export async function attemptAction(attemptId: string): Promise<AttemptView | null> {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({ attempt: wordRevisionAttempts, revision: wordRevisions })
    .from(wordRevisionAttempts)
    .innerJoin(wordRevisions, eq(wordRevisions.id, wordRevisionAttempts.revisionId))
    .where(eq(wordRevisionAttempts.id, String(attemptId ?? "")))
    .limit(1);

  if (!row) return null;
  // Свою попытку видит ученик, любую — учитель.
  if (session.role !== "TEACHER" && row.revision.studentId !== session.userId) {
    return null;
  }

  return {
    id: row.attempt.id,
    revisionId: row.revision.id,
    title: row.revision.title,
    plan: (row.attempt.plan ?? []) as RevisionSection[],
    answers: (row.attempt.answers ?? []) as RevisionAnswer[],
    startedAt: row.attempt.startedAt.toISOString(),
    finishedAt: row.attempt.finishedAt?.toISOString() ?? null,
    answerSeconds: row.revision.answerSeconds,
    totalSeconds: row.revision.totalSeconds,
  };
}

/**
 * Записать ответы и, если задание пройдено, закрыть попытку.
 *
 * Ответы копятся целиком: разбор учителя строится по ним, а из одного
 * итогового числа его уже не собрать.
 */
export async function saveAnswersAction(
  attemptId: string,
  answers: RevisionAnswer[],
  finished: boolean,
): Promise<RevisionState> {
  const session = await getSession();
  if (!session) return { error: "Нужно войти" };

  const id = String(attemptId ?? "");
  const [row] = await db
    .select({ attempt: wordRevisionAttempts, revision: wordRevisions })
    .from(wordRevisionAttempts)
    .innerJoin(wordRevisions, eq(wordRevisions.id, wordRevisionAttempts.revisionId))
    .where(eq(wordRevisionAttempts.id, id))
    .limit(1);

  if (!row) return { error: "Попытка не найдена" };
  if (row.revision.studentId !== session.userId) return { error: "Это чужая попытка" };
  if (row.attempt.finishedAt) return { error: "Попытка уже закрыта" };

  await db
    .update(wordRevisionAttempts)
    .set({
      answers: answers ?? [],
      finishedAt: finished ? new Date() : null,
    })
    .where(eq(wordRevisionAttempts.id, id));

  if (finished) {
    const [student] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const [teacher] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "TEACHER"))
      .limit(1);

    if (teacher) {
      const result = scoreRevision(answers ?? []);
      await db.insert(notifications).values({
        recipientId: teacher.id,
        type: "HOMEWORK_SUBMITTED",
        message: `${student?.name ?? "Ученик"} прошёл «${row.revision.title}» — ${result.accuracy}%`,
        relatedStudentId: session.userId,
      });
    }
  }

  revalidatePath("/student/homework");
  revalidatePath("/teacher/materials");
  return { ok: true };
}

export type AttemptSummary = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  result: ReturnType<typeof scoreRevision>;
};

/** Все попытки задания с разбором — для учителя. */
export async function attemptsAction(revisionId: string): Promise<AttemptSummary[]> {
  await requireTeacher();
  const id = String(revisionId ?? "");
  if (!id) return [];

  const rows = await db
    .select()
    .from(wordRevisionAttempts)
    .where(eq(wordRevisionAttempts.revisionId, id))
    .orderBy(asc(wordRevisionAttempts.startedAt));

  return rows.map((row) => ({
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    result: scoreRevision((row.answers ?? []) as RevisionAnswer[]),
  }));
}
