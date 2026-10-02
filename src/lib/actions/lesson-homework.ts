"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, notifications } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  findHomeworkItem,
  homeworkAnswerMatches,
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkExerciseHiddenKey,
  homeworkExerciseProgress,
  homeworkNoteKey,
  homeworkNoteVisibleKey,
  homeworkProgress,
  homeworkStatus,
  homeworkStatusKey,
  homeworkSubmittedAt,
  homeworkSubmittedAtKey,
  homeworkValueKey,
  interactiveHomeworkFromEntries,
  legacyHomeworkFromEntries,
  isHomeworkAutoKind,
  type HomeworkExerciseKind,
  type HomeworkStoredState,
} from "@/lib/lesson-homework";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти");
  return session;
}

async function assignmentWithPlan(id: string) {
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
  const plan = interactiveHomeworkFromEntries(row.homework);
  return plan ? { ...row, plan } : null;
}

function publicItemState(state: HomeworkStoredState, itemId: string) {
  return {
    value: state[homeworkValueKey(itemId)] ?? "",
    status: homeworkStatus(state, itemId),
    attempts: homeworkAttempts(state, itemId),
  };
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

  const state = { ...(row.assignment.answers ?? {}) };
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
  if (isStudent) delete state[homeworkSubmittedAtKey()];

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

  const state = { ...(row.assignment.answers ?? {}) };
  for (const item of exercise.items) {
    delete state[homeworkValueKey(item.id)];
    delete state[homeworkStatusKey(item.id)];
    delete state[homeworkAttemptsKey(item.id)];
  }
  if (isStudent) delete state[homeworkSubmittedAtKey()];
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath(`/student/homework`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  return {};
}

/** Сохранить свободный ответ, перевод или ссылку на запись. */
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
  if (found.exercise.kind === "question-audio" && value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLocaleLowerCase();
      if (url.protocol !== "https:" || (host !== "vocaroo.com" && host !== "www.vocaroo.com" && host !== "voca.ro")) {
        return { error: "Нужна ссылка Vocaroo" };
      }
    } catch {
      return { error: "Нужна корректная ссылка Vocaroo" };
    }
  }

  const state = { ...(row.assignment.answers ?? {}) };
  state[homeworkValueKey(found.item.id)] = value;
  if (isStudent) delete state[homeworkSubmittedAtKey()];
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
    const plan = interactiveHomeworkFromEntries(row.homework);
    const legacy = legacyHomeworkFromEntries(row.homework);
    if (!plan && legacy.length === 0) return [];
    const progress = plan
      ? homeworkProgress(plan, row.assignment.answers ?? {})
      : { done: 0, total: 0 };
    const exerciseProgress = plan
      ? homeworkExerciseProgress(plan, row.assignment.answers ?? {})
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
