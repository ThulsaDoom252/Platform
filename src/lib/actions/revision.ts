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
import { and, asc, desc, eq, gte, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materialNodes,
  materialPhrases,
  notifications,
  phraseImages,
  lessons,
  users,
  wordRevisionAttempts,
  wordRevisionPresets,
  wordRevisions,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { buildRevision, type RevisionSection } from "@/lib/revision-build";
import {
  readShow,
  REVISION_MODES,
  type RevisionMode,
  type RevisionShow,
  type RevisionWord,
} from "@/lib/revision-modes";
import { scoreRevision, type RevisionAnswer } from "@/lib/revision-score";
import { scheduleNow } from "@/lib/schedule-time";
import { queueStudentNotification } from "@/lib/notifications";

export type RevisionState = { ok?: boolean; error?: string; id?: string };

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

/** Слова словника вместе с тем, что нужно режимам. */
export type RevisionWordGroup = { nodeId: string; words: RevisionWord[] };

/** Слова нескольких словников одним запросом, сгруппированные для формы выбора. */
export async function revisionWordGroupsAction(nodeIds: string[]): Promise<RevisionWordGroup[]> {
  await requireTeacher();
  const ids = [...new Set((nodeIds ?? []).map(String).filter(Boolean))].slice(0, 30);
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      nodeId: materialPhrases.nodeId,
      phraseId: materialPhrases.id,
      word: materialPhrases.phrase,
      icon: materialPhrases.icon,
      translation: materialPhrases.translation,
      description: materialPhrases.description,
      directImageUrl: materialPhrases.imageUrl,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, ids))
    .orderBy(asc(materialPhrases.sortOrder));

  // Заметки 💡 словами не считаются: повторять в них нечего.
  const words = rows.filter((r) => r.kind !== "NOTE");
  if (words.length === 0) return ids.map((nodeId) => ({ nodeId, words: [] }));

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

  return ids.map((nodeId) => ({
    nodeId,
    words: words
      .filter((word) => word.nodeId === nodeId)
      .map((word) => ({
        phraseId: word.phraseId,
        word: word.word,
        icon: word.icon,
        translation: word.translation,
        description: word.description,
        imageUrl: imageOf.get(word.phraseId) ?? word.directImageUrl ?? null,
      })),
  }));
}

/** Обратная совместимость: назначение из одного словника в Materials. */
export async function revisionWordsAction(nodeId: string): Promise<RevisionWord[]> {
  return (await revisionWordGroupsAction([nodeId]))[0]?.words ?? [];
}

export type RevisionSetup = {
  studentId: string;
  nodeId: string;
  title: string;
  phraseIds: string[];
  modes: string[];
  /** Слова по режимам: пустой режим берёт всё, что ему подходит. */
  modeWords: Record<string, string[]>;
  /** Что показывать рядом с заданием: картинка, перевод, описание. */
  show: Record<string, boolean>;
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
      assignedByTeacherId: session.userId,
      nodeId,
      title,
      phraseIds,
      modes,
      modeWords,
      show: setup?.show ?? {},
      answerSeconds: setup?.answerSeconds ?? null,
      totalSeconds: setup?.totalSeconds ?? null,
      dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
    })
    .returning({ id: wordRevisions.id });

  await queueStudentNotification({
    teacherId: session.userId,
    studentId,
    event: "revisionAssigned",
    title,
    href: `/student/homework/revision/${created?.id ?? ""}`,
  });
  revalidatePath("/teacher/materials");
  revalidatePath("/student/homework");
  return { ok: true, id: created?.id };
}

export type RevisionPreset = {
  id: string;
  title: string;
  nodeId: string | null;
  nodeName: string | null;
  phraseIds: string[];
  modes: string[];
  modeWords: Record<string, string[]>;
  show: Record<string, boolean>;
  answerSeconds: number | null;
  totalSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

type RevisionPresetSetup = Omit<RevisionSetup, "studentId" | "dueAt">;

/** Сохранить отдельный пресет в Activities. */
export async function saveRevisionPresetAction(
  setup: RevisionPresetSetup,
): Promise<RevisionState> {
  const session = await requireTeacher();
  const nodeId = String(setup?.nodeId ?? "");
  const title = String(setup?.title ?? "").trim().slice(0, 120);
  const phraseIds = [...new Set((setup?.phraseIds ?? []).map(String).filter(Boolean))];
  const modes = (setup?.modes ?? []).filter((mode): mode is RevisionMode =>
    REVISION_MODES.includes(mode as RevisionMode),
  );
  const inTask = new Set(phraseIds);
  const modeWords: Record<string, string[]> = {};
  for (const mode of modes) {
    const own = (setup?.modeWords?.[mode] ?? [])
      .map(String)
      .filter((id) => inTask.has(id));
    if (own.length > 0) modeWords[mode] = own;
  }

  if (!nodeId) return { error: "Не выбран словник" };
  if (!title) return { error: "Дай игре название" };
  if (phraseIds.length === 0) return { error: "Не выбрано ни одного слова" };
  if (modes.length === 0) return { error: "Не выбран ни один режим" };

  const [created] = await db
    .insert(wordRevisionPresets)
    .values({
      authorId: session.userId,
      nodeId,
      title,
      phraseIds,
      modes,
      modeWords,
      show: setup?.show ?? {},
      answerSeconds: setup?.answerSeconds ?? null,
      totalSeconds: setup?.totalSeconds ?? null,
      updatedAt: new Date(),
    })
    .returning({ id: wordRevisionPresets.id });

  revalidatePath("/teacher/activities");
  return { ok: true, id: created?.id };
}

/** Пресеты текущего учителя. */
export async function listRevisionPresetsAction(): Promise<RevisionPreset[]> {
  const session = await requireTeacher();
  const rows = await db
    .select({ preset: wordRevisionPresets, nodeName: materialNodes.name })
    .from(wordRevisionPresets)
    .leftJoin(materialNodes, eq(materialNodes.id, wordRevisionPresets.nodeId))
    .where(eq(wordRevisionPresets.authorId, session.userId))
    .orderBy(desc(wordRevisionPresets.createdAt));

  return rows.map(({ preset, nodeName }) => ({
    id: preset.id,
    title: preset.title,
    nodeId: preset.nodeId,
    nodeName,
    phraseIds: preset.phraseIds ?? [],
    modes: preset.modes ?? [],
    modeWords: preset.modeWords ?? {},
    show: preset.show ?? {},
    answerSeconds: preset.answerSeconds,
    totalSeconds: preset.totalSeconds,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  }));
}

/**
 * Собрать одноразовый прогон пресета для учителя.
 *
 * Никакая попытка в базу не пишется: это ровно та же случайная колода,
 * которую получит ученик, но только для проверки и игры в Activities.
 */
export async function previewRevisionPresetAction(
  id: string,
): Promise<AttemptView | null> {
  const session = await requireTeacher();
  const [preset] = await db
    .select()
    .from(wordRevisionPresets)
    .where(
      and(
        eq(wordRevisionPresets.id, String(id ?? "")),
        eq(wordRevisionPresets.authorId, session.userId),
      ),
    )
    .limit(1);

  if (!preset) return null;
  const words = await wordsOf(preset.phraseIds ?? []);
  const plan = buildRevision(words, (preset.modes ?? []) as RevisionMode[], {
    byMode: preset.modeWords ?? undefined,
  });
  if (plan.length === 0) return null;

  return {
    id: `preview-${preset.id}`,
    revisionId: preset.id,
    title: preset.title,
    plan,
    answers: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    answerSeconds: preset.answerSeconds,
    totalSeconds: preset.totalSeconds,
    show: readShow(preset.show),
  };
}

export async function deleteRevisionPresetAction(id: string): Promise<RevisionState> {
  const session = await requireTeacher();
  await db
    .delete(wordRevisionPresets)
    .where(
      and(
        eq(wordRevisionPresets.id, String(id ?? "")),
        eq(wordRevisionPresets.authorId, session.userId),
      ),
    );
  revalidatePath("/teacher/activities");
  return { ok: true };
}

/** Копия пресета для конкретного ученика: в урок или в самостоятельную домашку. */
export async function assignRevisionPresetAction(
  presetId: string,
  studentId: string,
  placement: "CLASS" | "HOMEWORK",
): Promise<RevisionState & { existed?: boolean }> {
  const session = await requireTeacher();
  const targetId = String(studentId ?? "");
  const targetPlacement = placement === "CLASS" ? "CLASS" : "HOMEWORK";

  const [[preset], [student]] = await Promise.all([
    db
      .select()
      .from(wordRevisionPresets)
      .where(
        and(
          eq(wordRevisionPresets.id, String(presetId ?? "")),
          eq(wordRevisionPresets.authorId, session.userId),
        ),
      )
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.role, "STUDENT")))
      .limit(1),
  ]);
  if (!preset) return { error: "Пресет не найден" };
  if (!student) return { error: "Ученик не найден" };

  const [created] = await db
    .insert(wordRevisions)
    .values({
      studentId: targetId,
      assignedByTeacherId: session.userId,
      nodeId: preset.nodeId,
      title: preset.title,
      phraseIds: preset.phraseIds ?? [],
      modes: preset.modes ?? [],
      modeWords: preset.modeWords ?? {},
      show: preset.show ?? {},
      answerSeconds: preset.answerSeconds,
      totalSeconds: preset.totalSeconds,
      placement: targetPlacement,
    })
    .returning({ id: wordRevisions.id });

  await queueStudentNotification({
    teacherId: session.userId,
    studentId: targetId,
    event: targetPlacement === "HOMEWORK" ? "revisionAssigned" : "activityAssigned",
    title: preset.title,
    href: targetPlacement === "HOMEWORK"
      ? `/student/homework/revision/${created?.id ?? ""}`
      : "/student/class",
  });

  revalidatePath("/teacher/activities");
  revalidatePath("/student/homework");
  revalidatePath("/teacher/class");
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
  placement: "CLASS" | "HOMEWORK";
};

async function cardsFor(
  studentId: string,
  placement?: "CLASS" | "HOMEWORK",
): Promise<RevisionCard[]> {
  const rows = await db
    .select({
      revision: wordRevisions,
      nodeName: materialNodes.name,
    })
    .from(wordRevisions)
    .leftJoin(materialNodes, eq(materialNodes.id, wordRevisions.nodeId))
    .where(
      placement
        ? and(
            eq(wordRevisions.studentId, studentId),
            eq(wordRevisions.placement, placement),
          )
        : eq(wordRevisions.studentId, studentId),
    )
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
      placement: revision.placement === "CLASS" ? "CLASS" : "HOMEWORK",
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
  return cardsFor(session.userId, "HOMEWORK");
}

export async function myRevisionAction(id: string): Promise<RevisionCard | null> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return null;
  const cards = await cardsFor(session.userId, "HOMEWORK");
  return cards.find((card) => card.id === String(id ?? "")) ?? null;
}

/** Активности, которые учитель положил в текущую очередь урока ученика. */
export async function listClassRevisionsAction(studentId: string): Promise<RevisionCard[]> {
  await requireTeacher();
  const id = String(studentId ?? "");
  return id ? cardsFor(id, "CLASS") : [];
}

/** Одна классная практика для экрана ученика. */
export async function myClassRevisionAction(id: string): Promise<RevisionCard | null> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return null;
  const cards = await cardsFor(session.userId, "CLASS");
  return cards.find((card) => card.id === String(id ?? "")) ?? null;
}

/** Показать выбранную практику ученику поверх текущего урока. */
export async function showRevisionToStudentAction(
  revisionId: string,
): Promise<RevisionState> {
  const session = await requireTeacher();
  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!teacher?.studentId) return { error: "Класс не начат" };

  const [revision] = await db
    .select({ id: wordRevisions.id })
    .from(wordRevisions)
    .where(
      and(
        eq(wordRevisions.id, String(revisionId ?? "")),
        eq(wordRevisions.studentId, teacher.studentId),
        eq(wordRevisions.placement, "CLASS"),
      ),
    )
    .limit(1);
  if (!revision) return { error: "Практика не добавлена выбранному ученику" };

  const [student] = await db
    .select({ classFocus: users.classFocus })
    .from(users)
    .where(eq(users.id, teacher.studentId))
    .limit(1);

  await db
    .update(users)
    .set({
      classFocus: {
        at: new Date().toISOString(),
        view: "GAME",
        revisionId: revision.id,
        ...(student?.classFocus?.lessonAssignmentId
          ? { lessonAssignmentId: student.classFocus.lessonAssignmentId }
          : {}),
      },
    })
    .where(eq(users.id, teacher.studentId));

  return { ok: true };
}

/** Убрать задание вместе с попытками. */
export async function deleteRevisionAction(id: string): Promise<RevisionState> {
  await requireTeacher();
  const revisionId = String(id ?? "");
  if (!revisionId) return { error: "Не выбрано задание" };

  await db.delete(wordRevisions).where(eq(wordRevisions.id, revisionId));
  revalidatePath("/teacher/materials");
  revalidatePath("/teacher/homeworks");
  revalidatePath("/teacher/class");
  revalidatePath("/student/homework");
  return { ok: true };
}

/** Remove all attempts so the assigned homework becomes Not started again. */
export async function resetRevisionHomeworkAction(id: string): Promise<RevisionState> {
  const session = await requireTeacher();
  const revisionId = String(id ?? "");
  if (!revisionId) return { error: "Не выбрано задание" };

  const [revision] = await db
    .select({
      id: wordRevisions.id,
      studentId: wordRevisions.studentId,
      title: wordRevisions.title,
    })
    .from(wordRevisions)
    .where(and(
      eq(wordRevisions.id, revisionId),
      eq(wordRevisions.placement, "HOMEWORK"),
      or(
        eq(wordRevisions.assignedByTeacherId, session.userId),
        isNull(wordRevisions.assignedByTeacherId),
      ),
    ))
    .limit(1);
  if (!revision) return { error: "Домашняя практика не найдена" };

  await db.transaction(async (tx) => {
    await tx.delete(wordRevisionAttempts).where(eq(wordRevisionAttempts.revisionId, revision.id));
    await tx.update(wordRevisions).set({ reopened: false }).where(eq(wordRevisions.id, revision.id));
  });
  await queueStudentNotification({
    teacherId: session.userId,
    studentId: revision.studentId,
    event: "homeworkUpdated",
    title: revision.title,
    href: `/student/homework/revision/${revision.id}`,
  });

  revalidatePath("/teacher/materials");
  revalidatePath("/teacher/homeworks");
  revalidatePath(`/teacher/homeworks/revisions/${revision.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/student/homework/revision/${revision.id}`);
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
  revalidatePath("/teacher/homeworks");
  revalidatePath("/teacher/class");
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
      icon: materialPhrases.icon,
      translation: materialPhrases.translation,
      description: materialPhrases.description,
      directImageUrl: materialPhrases.imageUrl,
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

  return rows.map(({ directImageUrl, ...r }) => ({
    ...r,
    imageUrl: imageOf.get(r.phraseId) ?? directImageUrl ?? null,
  }));
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
  /** Что показывать рядом с заданием. */
  show: RevisionShow;
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
    show: readShow(row.revision.show),
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

  if (finished && row.revision.reopened) {
    await db
      .update(wordRevisions)
      .set({ reopened: false })
      .where(eq(wordRevisions.id, row.revision.id));
  }

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
  revalidatePath("/teacher/homeworks");
  revalidatePath("/teacher/class");
  return { ok: true };
}

export type AttemptSummary = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  result: ReturnType<typeof scoreRevision>;
  mistakes: {
    word: string;
    mode: RevisionMode;
    reason: "wrong" | "timeout";
    ms: number;
  }[];
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

  return rows.map((row) => {
    const answers = (row.answers ?? []) as RevisionAnswer[];
    return {
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      result: scoreRevision(answers),
      mistakes: answers
        .filter((answer) => !answer.correct)
        .map((answer) => ({
          word: answer.word,
          mode: answer.mode,
          reason: answer.reason === "timeout" ? "timeout" as const : "wrong" as const,
          ms: answer.ms,
        })),
    };
  });
}

export type TeacherRevisionHomeworkCard = {
  kind: "REVISION";
  id: string;
  title: string;
  homeworkTitle: string;
  status: "LOBBY" | "RUNNING" | "DONE";
  attempts: AttemptSummary[];
  words: number;
  modes: string[];
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  started: boolean;
  assignedAt: string;
  nextLessonAt: string | null;
};

/** Практика слов в общих папках домашек учителя. */
export async function teacherRevisionHomeworkAssignmentsAction(): Promise<TeacherRevisionHomeworkCard[]> {
  const session = await requireTeacher();
  const rows = await db
    .select({ revision: wordRevisions, studentName: users.name, studentAvatarUrl: users.avatarUrl })
    .from(wordRevisions)
    .innerJoin(users, eq(users.id, wordRevisions.studentId))
    .where(
      and(
        eq(wordRevisions.placement, "HOMEWORK"),
        or(
          eq(wordRevisions.assignedByTeacherId, session.userId),
          isNull(wordRevisions.assignedByTeacherId),
        ),
      ),
    )
    .orderBy(desc(wordRevisions.createdAt));
  if (rows.length === 0) return [];

  const revisionIds = rows.map((row) => row.revision.id);
  const studentIds = [...new Set(rows.map((row) => row.revision.studentId))];
  const [attemptRows, upcomingLessons] = await Promise.all([
    db
      .select()
      .from(wordRevisionAttempts)
      .where(inArray(wordRevisionAttempts.revisionId, revisionIds))
      .orderBy(asc(wordRevisionAttempts.startedAt)),
    db
      .select({ studentId: lessons.studentId, startTime: lessons.startTime })
      .from(lessons)
      .where(
        and(
          inArray(lessons.studentId, studentIds),
          eq(lessons.status, "SCHEDULED"),
          gte(lessons.startTime, scheduleNow()),
        ),
      )
      .orderBy(asc(lessons.startTime)),
  ]);
  const nextLessonByStudent = new Map<string, string>();
  for (const lesson of upcomingLessons) {
    if (!nextLessonByStudent.has(lesson.studentId)) {
      nextLessonByStudent.set(lesson.studentId, lesson.startTime.toISOString());
    }
  }

  return rows.map(({ revision, studentName, studentAvatarUrl }) => {
    const mine = attemptRows.filter((attempt) => attempt.revisionId === revision.id);
    const attempts = mine.map((attempt) => attemptSummary(attempt));
    const finished = mine.filter((attempt) => attempt.finishedAt);
    const latest = finished
      .map((attempt) => attempt.finishedAt!)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const running = mine.some((attempt) => !attempt.finishedAt);
    return {
      kind: "REVISION" as const,
      id: revision.id,
      title: revision.title,
      homeworkTitle: "Words practice",
      status: running ? "RUNNING" as const : latest ? "DONE" as const : "LOBBY" as const,
      attempts,
      words: (revision.phraseIds ?? []).length,
      modes: revision.modes ?? [],
      studentId: revision.studentId,
      studentName,
      studentAvatarUrl,
      submittedAt: latest?.toISOString() ?? null,
      reviewedAt: latest?.toISOString() ?? null,
      started: mine.length > 0,
      assignedAt: revision.createdAt.toISOString(),
      nextLessonAt: nextLessonByStudent.get(revision.studentId) ?? null,
    };
  });
}

export async function teacherRevisionHomeworkAction(
  id: string,
): Promise<TeacherRevisionHomeworkCard | null> {
  const rows = await teacherRevisionHomeworkAssignmentsAction();
  return rows.find((row) => row.id === String(id ?? "")) ?? null;
}

function attemptSummary(
  row: typeof wordRevisionAttempts.$inferSelect,
): AttemptSummary {
  const answers = (row.answers ?? []) as RevisionAnswer[];
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    result: scoreRevision(answers),
    mistakes: answers
      .filter((answer) => !answer.correct)
      .map((answer) => ({
        word: answer.word,
        mode: answer.mode,
        reason: answer.reason === "timeout" ? "timeout" : "wrong",
        ms: answer.ms,
      })),
  };
}
