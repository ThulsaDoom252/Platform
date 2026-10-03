"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, notifications, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { translateShortTexts, type MaterialTranslationLang } from "@/lib/material-translation";
import {
  findHomeworkItem,
  assignedInteractiveHomework,
  clearHomeworkTextHighlights,
  homeworkAnswerMatches,
  homeworkAssignedAt,
  homeworkAssignedAtKey,
  homeworkAssignedExerciseIds,
  homeworkAssignedExercisesKey,
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkExerciseHiddenKey,
  homeworkExerciseProgress,
  homeworkFocusTarget,
  homeworkNoteKey,
  homeworkNoteVisibleKey,
  homeworkProgress,
  homeworkPlanForAssignment,
  homeworkPlanEditIssue,
  homeworkPlanOverrideKey,
  homeworkReviewedAt,
  homeworkReviewedAtKey,
  homeworkStatus,
  homeworkStatusKey,
  homeworkSubmittedAt,
  homeworkSubmittedAtKey,
  homeworkTextSourceValue,
  homeworkTextTokens,
  homeworkStarted,
  homeworkValueKey,
  interactiveHomeworkFromEntries,
  legacyHomeworkFromEntries,
  isHomeworkAutoKind,
  normalizeInteractiveHomework,
  toggleHomeworkHighlight,
  toggleHomeworkTextHighlight,
  type HomeworkHighlightColor,
  type HomeworkTextHighlightSource,
  type InteractiveHomeworkPlan,
  type HomeworkExerciseKind,
  type HomeworkStoredState,
} from "@/lib/lesson-homework";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти");
  return session;
}

async function assignmentWithOptionalPlan(id: string) {
  const [row] = await db
    .select({
      assignment: lessonAssignments,
      authorId: lessonUnits.authorId,
      title: lessonUnits.title,
      homework: lessonUnits.homework,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.id, id))
    .limit(1);
  if (!row) return null;
  const plan = homeworkPlanForAssignment(
    interactiveHomeworkFromEntries(row.homework),
    row.assignment.answers ?? {},
  );
  return { ...row, plan };
}

async function assignmentWithPlan(id: string) {
  const row = await assignmentWithOptionalPlan(id);
  return row?.plan ? { ...row, plan: row.plan } : null;
}

function publicItemState(state: HomeworkStoredState, itemId: string) {
  return {
    value: state[homeworkValueKey(itemId)] ?? "",
    status: homeworkStatus(state, itemId),
    attempts: homeworkAttempts(state, itemId),
  };
}

/** Persist a teacher's coloured mark on one exercise or homework sentence. */
export async function highlightHomeworkElementAction(
  assignmentId: string,
  elementId: string,
  color: HomeworkHighlightColor,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  if (color !== "yellow" && color !== "green" && color !== "red") {
    return { error: "Неизвестный цвет" };
  }
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const focusId = String(elementId ?? "").trim();
  if (!homeworkFocusTarget(row.plan, focusId)) return { error: "Элемент домашки не найден" };

  const state = toggleHomeworkHighlight(row.assignment.answers ?? {}, focusId, color);
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath("/student/class");
  return {};
}

/** Учитель отмечает конкретное слово в условии или ответе, а не всю карточку. */
export async function highlightHomeworkTextAction(
  assignmentId: string,
  itemId: string,
  source: HomeworkTextHighlightSource,
  tokenIndex: number,
  color: HomeworkHighlightColor,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  if (color !== "yellow" && color !== "green" && color !== "red") {
    return { error: "Неизвестный цвет" };
  }
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const found = findHomeworkItem(row.plan, String(itemId ?? ""));
  if (!found) return { error: "Предложение не найдено" };
  const state = row.assignment.answers ?? {};
  const token = homeworkTextTokens(homeworkTextSourceValue(found.item, state, source))[tokenIndex];
  if (!token?.highlightable) return { error: "Выбери слово в предложении" };

  const next = toggleHomeworkTextHighlight(state, found.item, source, tokenIndex, color);
  await db
    .update(lessonAssignments)
    .set({ answers: next, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  return {};
}

/** Учитель назначает выбранные упражнения; ответы, уже сделанные в классе, остаются. */
export async function assignInteractiveHomeworkAction(
  assignmentId: string,
  exerciseIds: string[],
): Promise<{ error?: string; assignedAt?: string; exerciseIds?: string[] }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const wanted = new Set((Array.isArray(exerciseIds) ? exerciseIds : []).map(String));
  const selected = row.plan.exercises
    .map((exercise) => exercise.id)
    .filter((id) => wanted.has(id));
  if (selected.length === 0) return { error: "Выбери хотя бы одно упражнение" };

  const state = { ...(row.assignment.answers ?? {}) };
  const assignedAt = new Date().toISOString();
  state[homeworkPlanOverrideKey()] = JSON.stringify(row.plan);
  state[homeworkAssignedAtKey()] = assignedAt;
  state[homeworkAssignedExercisesKey()] = JSON.stringify(selected);
  delete state[homeworkSubmittedAtKey()];
  delete state[homeworkReviewedAtKey()];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath("/teacher/homeworks");
  return { assignedAt, exerciseIds: selected };
}

/** Сохранить отдельную версию домашки только для этого закрепления ученика. */
export async function saveStudentHomeworkPlanAction(
  assignmentId: string,
  candidate: InteractiveHomeworkPlan,
): Promise<{ error?: string; plan?: InteractiveHomeworkPlan; state?: HomeworkStoredState }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithOptionalPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Урок ученика не найден" };

  const plan = normalizeInteractiveHomework(candidate);
  if (!plan) return { error: "Добавь хотя бы одно заполненное упражнение" };
  const previousPlan: InteractiveHomeworkPlan = row.plan ?? {
    kind: "INTERACTIVE_HOMEWORK_V1",
    title: plan.title || `${row.title} · Homework`,
    exercises: [],
  };
  const editIssue = homeworkPlanEditIssue(previousPlan, plan);
  if (editIssue === "empty-exercise") {
    return { error: "В изменённом упражнении должно быть хотя бы одно задание" };
  }
  if (editIssue === "invalid-fill") {
    return { error: "В предложении для вставки отметь ответ двойными звёздочками" };
  }
  if (editIssue === "missing-translation") {
    return { error: "Добавь правильный перевод к каждому изменённому предложению" };
  }

  const state = { ...(row.assignment.answers ?? {}) };
  const oldExercises = new Map(previousPlan.exercises.map((exercise) => [exercise.id, exercise]));
  const oldItems = new Map(
    previousPlan.exercises.flatMap((exercise) =>
      exercise.items.map((item) => [item.id, { exerciseKind: exercise.kind, item }] as const),
    ),
  );
  const nextItems = new Map(
    plan.exercises.flatMap((exercise) =>
      exercise.items.map((item) => [item.id, { exerciseKind: exercise.kind, item }] as const),
    ),
  );

  for (const [itemId, oldItem] of oldItems) {
    const nextItem = nextItems.get(itemId);
    if (nextItem && JSON.stringify(nextItem) === JSON.stringify(oldItem)) continue;
    delete state[homeworkValueKey(itemId)];
    delete state[homeworkStatusKey(itemId)];
    delete state[homeworkAttemptsKey(itemId)];
    delete state[homeworkNoteKey(itemId)];
    delete state[homeworkNoteVisibleKey(itemId)];
  }

  state[homeworkPlanOverrideKey()] = JSON.stringify(plan);
  if (homeworkAssignedAt(state)) {
    const previouslySelected = new Set(homeworkAssignedExerciseIds(previousPlan, state));
    const selected = plan.exercises
      .filter((exercise) => previouslySelected.has(exercise.id) || !oldExercises.has(exercise.id))
      .map((exercise) => exercise.id);
    state[homeworkAssignedExercisesKey()] = JSON.stringify(selected);
  }
  delete state[homeworkSubmittedAtKey()];
  delete state[homeworkReviewedAtKey()];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath("/teacher/homeworks");
  return { plan, state };
}

type HomeworkTranslationDirection = "to-english" | "from-english";
type HomeworkTranslationRow = { id: string; primary: string; answer: string };

/** Перестроить обе стороны упражнения перевода через DeepL, не сохраняя его без учителя. */
export async function translateHomeworkRowsAction(
  assignmentId: string,
  input: {
    sourceDirection: HomeworkTranslationDirection;
    targetDirection: HomeworkTranslationDirection;
    language: MaterialTranslationLang;
    rows: HomeworkTranslationRow[];
  },
): Promise<{ rows?: HomeworkTranslationRow[]; error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const rows = (Array.isArray(input?.rows) ? input.rows : [])
    .slice(0, 100)
    .flatMap((item): HomeworkTranslationRow[] => {
      if (!item || typeof item !== "object") return [];
      return [{
        id: String(item.id ?? "").slice(0, 120),
        primary: String(item.primary ?? "").trim().slice(0, 1_500),
        answer: String(item.answer ?? "").trim().slice(0, 1_500),
      }];
    });
  const sourceDirection = input?.sourceDirection === "from-english" ? "from-english" : "to-english";
  const targetDirection = input?.targetDirection === "from-english" ? "from-english" : "to-english";
  const language: MaterialTranslationLang = input?.language === "UK" ? "UK" : "RU";
  const english = rows.map((item) =>
    sourceDirection === "to-english" ? item.answer : item.primary,
  );
  if (rows.length === 0 || english.some((value) => !value)) {
    return { error: "Сначала заполни английскую сторону каждого предложения" };
  }

  try {
    const translated = await translateShortTexts(
      english,
      language,
      "EN",
      "Simple real sentences for English homework",
    );
    return {
      rows: rows.map((item, index) => ({
        id: String(item.id),
        primary: targetDirection === "to-english" ? translated[index] : english[index],
        answer: targetDirection === "to-english" ? english[index] : translated[index],
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "DeepL не смог перевести предложения" };
  }
}

/** Проверить один автоматически оцениваемый ответ и сохранить все попытки. */
export async function submitHomeworkAutoAnswerAction(
  assignmentId: string,
  itemId: string,
  supplied: string,
) {
  const session = await requireUser();
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  const isStudent = session.role === "STUDENT" && row?.assignment.studentId === session.userId;
  const isTeacher = session.role === "TEACHER" && row?.authorId === session.userId;
  if (!row || (!isStudent && !isTeacher)) {
    return { error: "Домашняя работа не найдена" };
  }

  const found = findHomeworkItem(row.plan, String(itemId ?? ""));
  if (!found || !isHomeworkAutoKind(found.exercise.kind) || !found.item.answer) {
    return { error: "Задание не найдено" };
  }

  let state = { ...(row.assignment.answers ?? {}) };
  if (homeworkStatus(state, found.item.id)) {
    return publicItemState(state, found.item.id);
  }

  const answer = String(supplied ?? "").trim().slice(0, 300);
  if (!answer) return { error: "Введи ответ" };
  if ((state[homeworkValueKey(found.item.id)] ?? "").trim() === answer) {
    return publicItemState(state, found.item.id);
  }

  const attempts = homeworkAttempts(state, found.item.id);
  if (homeworkAnswerMatches(found.item, answer)) {
    state[homeworkValueKey(found.item.id)] = answer;
    state[homeworkStatusKey(found.item.id)] = "correct";
  } else {
    const nextAttempts = [...attempts, answer].slice(0, 3);
    state[homeworkValueKey(found.item.id)] = answer;
    state[homeworkAttemptsKey(found.item.id)] = JSON.stringify(nextAttempts);
    if (nextAttempts.length >= 3) {
      state[homeworkValueKey(found.item.id)] = found.item.answer;
      state[homeworkStatusKey(found.item.id)] = "locked";
    }
  }
  if (isStudent) {
    state = clearHomeworkTextHighlights(state, found.item.id, "answer");
    delete state[homeworkSubmittedAtKey()];
    delete state[homeworkReviewedAtKey()];
  }

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/student/homework`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return publicItemState(state, found.item.id);
}

/** Сбросить все ответы упражнения, не затрагивая заметки учителя. */
export async function resetHomeworkExerciseAnswersAction(
  assignmentId: string,
  exerciseId: string,
): Promise<{ error?: string }> {
  const session = await requireUser();
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  const isStudent = session.role === "STUDENT" && row?.assignment.studentId === session.userId;
  const isTeacher = session.role === "TEACHER" && row?.authorId === session.userId;
  if (!row || (!isStudent && !isTeacher)) return { error: "Домашняя работа не найдена" };
  const exercise = row.plan.exercises.find((item) => item.id === String(exerciseId ?? ""));
  if (!exercise) return { error: "Упражнение не найдено" };

  let state = { ...(row.assignment.answers ?? {}) };
  for (const item of exercise.items) {
    state = clearHomeworkTextHighlights(state, item.id, "answer");
    delete state[homeworkValueKey(item.id)];
    delete state[homeworkStatusKey(item.id)];
    delete state[homeworkAttemptsKey(item.id)];
  }
  if (isStudent) {
    delete state[homeworkSubmittedAtKey()];
    delete state[homeworkReviewedAtKey()];
  }
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/student/homework`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return {};
}

/** Сохранить свободный письменный ответ или перевод. */
export async function saveHomeworkResponseAction(
  assignmentId: string,
  itemId: string,
  supplied: string,
): Promise<{ error?: string }> {
  const session = await requireUser();
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  const isStudent = session.role === "STUDENT" && row?.assignment.studentId === session.userId;
  const isTeacher = session.role === "TEACHER" && row?.authorId === session.userId;
  if (!row || (!isStudent && !isTeacher)) {
    return { error: "Домашняя работа не найдена" };
  }
  const found = findHomeworkItem(row.plan, String(itemId ?? ""));
  if (!found || isHomeworkAutoKind(found.exercise.kind)) {
    return { error: "Задание не найдено" };
  }

  const value = String(supplied ?? "").trim().slice(0, 8_000);
  let state = { ...(row.assignment.answers ?? {}) };
  state[homeworkValueKey(found.item.id)] = value;
  if (isStudent) {
    state = clearHomeworkTextHighlights(state, found.item.id, "answer");
    delete state[homeworkSubmittedAtKey()];
    delete state[homeworkReviewedAtKey()];
  }
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/student/homework`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return {};
}

/** Учитель может убрать целое упражнение только у выбранного ученика. */
export async function setHomeworkExerciseHiddenAction(
  assignmentId: string,
  exerciseId: string,
  hidden: boolean,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const exercise = row.plan.exercises.find((item) => item.id === String(exerciseId ?? ""));
  if (!exercise) return { error: "Упражнение не найдено" };

  const state = { ...(row.assignment.answers ?? {}) };
  const key = homeworkExerciseHiddenKey(exercise.id);
  if (hidden) state[key] = "1";
  else delete state[key];
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/student/homework`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return {};
}

/** Ученик отправляет интерактивную домашку учителю на проверку. */
export async function submitInteractiveHomeworkForReviewAction(
  assignmentId: string,
): Promise<{ error?: string; submittedAt?: string }> {
  const session = await requireUser();
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || session.role !== "STUDENT" || row.assignment.studentId !== session.userId) {
    return { error: "Домашняя работа не найдена" };
  }

  const state = { ...(row.assignment.answers ?? {}) };
  if (!homeworkAssignedAt(state)) return { error: "Учитель ещё не назначил эту домашнюю работу" };
  const alreadySubmitted = homeworkSubmittedAt(state);
  if (alreadySubmitted) return { submittedAt: alreadySubmitted };
  const submittedAt = new Date().toISOString();
  state[homeworkSubmittedAtKey()] = submittedAt;

  await db.transaction(async (tx) => {
    await tx
      .update(lessonAssignments)
      .set({ answers: state, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, row.assignment.id));
    await tx.insert(notifications).values({
      recipientId: row.authorId,
      type: "HOMEWORK_SUBMITTED",
      relatedStudentId: session.userId,
      message: `${session.name} отправил(а) домашнюю работу на проверку: «${row.title}»`,
    });
  });

  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/student/homework`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/teacher`);
  return { submittedAt };
}

/** Учитель завершает проверку; ученик сразу получает уведомление. */
export async function reviewInteractiveHomeworkAction(
  assignmentId: string,
): Promise<{ error?: string; reviewedAt?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const state = { ...(row.assignment.answers ?? {}) };
  if (!homeworkSubmittedAt(state)) return { error: "Ученик ещё не отправил домашнюю работу" };
  const alreadyReviewed = homeworkReviewedAt(state);
  if (alreadyReviewed) return { reviewedAt: alreadyReviewed };
  const reviewedAt = new Date().toISOString();
  state[homeworkReviewedAtKey()] = reviewedAt;

  await db.transaction(async (tx) => {
    await tx
      .update(lessonAssignments)
      .set({ answers: state, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, row.assignment.id));
    await tx.insert(notifications).values({
      recipientId: row.assignment.studentId,
      type: "HOMEWORK_SUBMITTED",
      relatedStudentId: row.assignment.studentId,
      message: `Домашняя работа «${row.title}» проверена учителем.`,
    });
  });

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath("/student");
  return { reviewedAt };
}

/** Заметка учителя к конкретному предложению и её видимость ученику. */
export async function saveHomeworkTeacherNoteAction(
  assignmentId: string,
  itemId: string,
  note: string,
  visible: boolean,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Заметку пишет учитель" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const found = findHomeworkItem(row.plan, String(itemId ?? ""));
  if (!found) return { error: "Задание не найдено" };

  const state = { ...(row.assignment.answers ?? {}) };
  const text = String(note ?? "").trim().slice(0, 4_000);
  if (text) state[homeworkNoteKey(found.item.id)] = text;
  else delete state[homeworkNoteKey(found.item.id)];
  if (text && visible) state[homeworkNoteVisibleKey(found.item.id)] = "1";
  else delete state[homeworkNoteVisibleKey(found.item.id)];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  return {};
}

async function teacherPlan(unitId: string) {
  const session = await requireUser();
  if (session.role !== "TEACHER") return null;
  const [unit] = await db
    .select({ id: lessonUnits.id, homework: lessonUnits.homework })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, unitId), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  if (!unit) return null;
  const plan = interactiveHomeworkFromEntries(unit.homework);
  return plan ? { unit, plan } : null;
}

/** Вопросы намеренно добавляются позже прямо в подготовленную секцию. */
export async function addHomeworkQuestionAction(
  unitId: string,
  kind: Extract<HomeworkExerciseKind, "question-text" | "question-audio">,
  prompt: string,
): Promise<{ error?: string }> {
  const row = await teacherPlan(String(unitId ?? ""));
  if (!row) return { error: "Домашняя работа не найдена" };
  if (kind !== "question-text" && kind !== "question-audio") return { error: "Неизвестный тип вопроса" };
  const text = String(prompt ?? "").trim().slice(0, 1_500);
  if (!text) return { error: "Напиши вопрос" };
  const exercise = row.plan.exercises.find((item) => item.kind === kind);
  if (!exercise) return { error: "Секция вопросов не найдена" };
  exercise.items.push({ id: `q-${randomUUID()}`, prompt: text });
  await db
    .update(lessonUnits)
    .set({ homework: [row.plan], updatedAt: new Date() })
    .where(eq(lessonUnits.id, row.unit.id));
  revalidatePath(`/teacher/lessons/${row.unit.id}`);
  return {};
}

export async function removeHomeworkQuestionAction(
  unitId: string,
  itemId: string,
): Promise<{ error?: string }> {
  const row = await teacherPlan(String(unitId ?? ""));
  if (!row) return { error: "Домашняя работа не найдена" };
  let changed = false;
  for (const exercise of row.plan.exercises) {
    if (exercise.kind !== "question-text" && exercise.kind !== "question-audio") continue;
    const next = exercise.items.filter((item) => item.id !== itemId);
    if (next.length !== exercise.items.length) {
      exercise.items = next;
      changed = true;
    }
  }
  if (!changed) return { error: "Вопрос не найден" };
  await db
    .update(lessonUnits)
    .set({ homework: [row.plan], updatedAt: new Date() })
    .where(eq(lessonUnits.id, row.unit.id));
  revalidatePath(`/teacher/lessons/${row.unit.id}`);
  return {};
}

export type HomeworkAssignmentCard = {
  id: string;
  title: string;
  homeworkTitle: string;
  done: number;
  total: number;
  requiredDone: number;
  requiredTotal: number;
  bonusDone: number;
  bonusTotal: number;
  updatedAt: string;
};

export type TeacherHomeworkAssignmentCard = HomeworkAssignmentCard & {
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  started: boolean;
};

/** All homework handed out from this teacher's lesson templates. */
export async function teacherHomeworkAssignmentsAction(): Promise<
  TeacherHomeworkAssignmentCard[]
> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return [];

  const rows = await db
    .select({
      assignment: lessonAssignments,
      title: lessonUnits.title,
      homework: lessonUnits.homework,
      studentId: users.id,
      studentName: users.name,
      studentAvatarUrl: users.avatarUrl,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .innerJoin(users, eq(users.id, lessonAssignments.studentId))
    .where(eq(lessonUnits.authorId, session.userId))
    .orderBy(desc(lessonAssignments.updatedAt));

  return rows.flatMap((row): TeacherHomeworkAssignmentCard[] => {
    const state = row.assignment.answers ?? {};
    const plan = homeworkPlanForAssignment(interactiveHomeworkFromEntries(row.homework), state);
    const legacy = legacyHomeworkFromEntries(row.homework);
    if (!plan && legacy.length === 0) return [];
    const assignedPlan = plan ? assignedInteractiveHomework(plan, state) : null;
    if (plan && !assignedPlan) return [];
    const progress = assignedPlan ? homeworkProgress(assignedPlan, state) : { done: 0, total: 0 };
    const exerciseProgress = assignedPlan
      ? homeworkExerciseProgress(assignedPlan, state)
      : { required: { done: 0, total: legacy.length }, bonuses: { done: 0, total: 0 } };
    const submittedAt = homeworkSubmittedAt(state);
    const reviewedAt = homeworkReviewedAt(state);
    const started = homeworkStarted(state);

    return [{
      id: row.assignment.id,
      title: row.title,
      homeworkTitle: plan?.title || legacy[0]?.title || "Homework",
      ...progress,
      requiredDone: exerciseProgress.required.done,
      requiredTotal: exerciseProgress.required.total,
      bonusDone: exerciseProgress.bonuses.done,
      bonusTotal: exerciseProgress.bonuses.total,
      updatedAt: row.assignment.updatedAt.toISOString(),
      studentId: row.studentId,
      studentName: row.studentName,
      studentAvatarUrl: row.studentAvatarUrl,
      submittedAt,
      reviewedAt,
      started,
    }];
  });
}

export async function myInteractiveHomeworkAction(): Promise<HomeworkAssignmentCard[]> {
  const session = await requireUser();
  if (session.role !== "STUDENT") return [];
  const rows = await db
    .select({
      assignment: lessonAssignments,
      title: lessonUnits.title,
      homework: lessonUnits.homework,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.studentId, session.userId))
    .orderBy(desc(lessonAssignments.createdAt));

  return rows.flatMap((row): HomeworkAssignmentCard[] => {
    const state = row.assignment.answers ?? {};
    const plan = homeworkPlanForAssignment(interactiveHomeworkFromEntries(row.homework), state);
    const legacy = legacyHomeworkFromEntries(row.homework);
    if (!plan && legacy.length === 0) return [];
    const assignedPlan = plan ? assignedInteractiveHomework(plan, state) : null;
    if (plan && !assignedPlan) return [];
    const progress = assignedPlan
      ? homeworkProgress(assignedPlan, state)
      : { done: 0, total: 0 };
    const exerciseProgress = assignedPlan
      ? homeworkExerciseProgress(assignedPlan, state)
      : { required: { done: 0, total: 0 }, bonuses: { done: 0, total: 0 } };
    return [{
      id: row.assignment.id,
      title: row.title,
      homeworkTitle: plan?.title || legacy[0]?.title || "Homework",
      ...progress,
      requiredDone: exerciseProgress.required.done,
      requiredTotal: exerciseProgress.required.total,
      bonusDone: exerciseProgress.bonuses.done,
      bonusTotal: exerciseProgress.bonuses.total,
      updatedAt: row.assignment.updatedAt.toISOString(),
    }];
  });
}
