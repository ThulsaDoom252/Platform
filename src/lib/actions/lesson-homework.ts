"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessons, lessonUnits, notifications, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { scheduleNow } from "@/lib/schedule-time";
import { translateShortTexts, type MaterialTranslationLang } from "@/lib/material-translation";
import { managedUploadPath, removePublicFile } from "@/lib/public-file-store";
import { queueStudentNotification } from "@/lib/notifications";
import { publishClassRealtime, publishUserRealtime } from "@/lib/realtime-server";
import { regularVoiceRecording, regularVoiceRecordingKey } from "@/lib/regular-lesson";
import { homeworkReactionPatchSql, homeworkReactionsResetSql } from "@/lib/homework-reaction-persistence";
import { lessonHomeworkFeedback, type HomeworkFeedbackSettings } from "@/lib/homework-feedback";
import { homeworkStateWithCurrentResultSql } from "@/lib/homework-feedback-persistence";
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
  homeworkExerciseCommentKey,
  homeworkExerciseScoreKey,
  homeworkExerciseProgress,
  homeworkFocusTarget,
  homeworkNoteKey,
  homeworkNoteVisibleKey,
  homeworkProgress,
  homeworkReaction,
  homeworkReactionKey,
  homeworkExerciseReactionKeys,
  homeworkRemovedAt,
  homeworkRemovedAtKey,
  homeworkPlanForAssignment,
  homeworkPlanEditIssue,
  homeworkPlanOverrideKey,
  homeworkReviewedAt,
  homeworkReviewedAtKey,
  homeworkRevisionRequestedAtKey,
  homeworkStatus,
  homeworkStatusKey,
  homeworkStateAfterTeacherAutoAnswerEdit,
  homeworkSubmittedAt,
  homeworkSubmittedAtKey,
  homeworkTextSourceValue,
  homeworkTextTokens,
  homeworkTeacherVoiceMessages,
  homeworkTeacherVoiceMessagesKey,
  homeworkTranslationLanguage,
  homeworkVoiceRecordingTarget,
  homeworkStarted,
  homeworkValueKey,
  interactiveHomeworkFromEntries,
  legacyHomeworkFromEntries,
  isHomeworkAutoKind,
  normalizeInteractiveHomework,
  toggleHomeworkHighlight,
  toggleHomeworkTextHighlight,
  toggleHomeworkTextHighlightRange,
  withoutAssignedHomeworkState,
  withoutHomeworkExerciseState,
  withoutHomeworkProgressState,
  type HomeworkHighlightColor,
  type HomeworkReaction,
  type HomeworkReactionTarget,
  type HomeworkTextHighlightSource,
  type InteractiveHomeworkPlan,
  type HomeworkExerciseKind,
  type HomeworkStoredState,
  type HomeworkTeacherVoiceMessage,
} from "@/lib/lesson-homework";

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти");
  return session;
}

function publishHomeworkReviewRealtime(studentId: string) {
  return Promise.all([
    publishClassRealtime(studentId, "homework-review"),
    publishUserRealtime(studentId, "homework-review"),
  ]).then(() => undefined);
}

async function assignmentWithOptionalPlan(id: string) {
  const [row] = await db
    .select({
      assignment: lessonAssignments,
      authorId: lessonUnits.authorId,
      unitId: lessonUnits.id,
      title: lessonUnits.title,
      homework: lessonUnits.homework,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.id, id))
    .limit(1);
  if (!row) return null;
  const overriddenPlan = row.assignment.contentOverride &&
    typeof row.assignment.contentOverride === "object"
      ? normalizeInteractiveHomework(row.assignment.contentOverride.interactiveHomework, {
          allowEmpty: true,
        })
      : null;
  const plan = homeworkPlanForAssignment(
    overriddenPlan ?? interactiveHomeworkFromEntries(row.homework),
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
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return {};
}

/** Highlight any selected text fragment, including several words or a full sentence. */
export async function highlightHomeworkTextRangeAction(
  assignmentId: string,
  itemId: string,
  source: HomeworkTextHighlightSource,
  start: number,
  end: number,
  color: HomeworkHighlightColor,
): Promise<{ error?: string; state?: HomeworkStoredState }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  if (color !== "yellow" && color !== "green" && color !== "red") {
    return { error: "Неизвестный цвет" };
  }
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const found = findHomeworkItem(row.plan, String(itemId ?? ""));
  if (!found) return { error: "Предложение не найдено" };
  const current = row.assignment.answers ?? {};
  const text = homeworkTextSourceValue(found.item, current, source);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > text.length ||
    !text.slice(start, end).trim()
  ) return { error: "Выдели текст в предложении" };

  const state = toggleHomeworkTextHighlightRange(
    current,
    found.item,
    source,
    start,
    end,
    color,
  );
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return { state };
}

/** Учитель отправляет одну реакцию на всё упражнение или конкретное предложение. */
export async function setHomeworkReactionAction(
  assignmentId: string,
  target: HomeworkReactionTarget,
  targetId: string,
  reaction: HomeworkReaction | null,
): Promise<{ error?: string; reaction?: HomeworkReaction | null }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const id = String(targetId ?? "").trim();
  const exists = target === "exercise"
    ? row.plan.exercises.some((exercise) => exercise.id === id)
    : target === "item"
      ? Boolean(findHomeworkItem(row.plan, id))
      : false;
  if (!exists) return { error: "Элемент домашки не найден" };

  const allowed: HomeworkReaction[] = [
    "thumbs-up",
    "happy",
    "angry",
    "check",
    "warning",
    "cross",
  ];
  if (reaction !== null && !allowed.includes(reaction)) return { error: "Неизвестная реакция" };

  const current = row.assignment.answers ?? {};
  const nextReaction = homeworkReaction(current, target, id) === reaction ? null : reaction;
  await db
    .update(lessonAssignments)
    .set({
      answers: homeworkReactionPatchSql(lessonAssignments.answers, homeworkReactionKey(target, id), nextReaction),
      updatedAt: new Date(),
    })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return { reaction: nextReaction };
}

/** Clear all reactions, or one exercise and its sentences, at any review status. */
export async function clearHomeworkReactionsAction(
  assignmentId: string,
  exerciseId: string | null = null,
): Promise<{ error?: string; cleared?: boolean }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  if (typeof assignmentId !== "string" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(assignmentId)) {
    return { error: "Домашняя работа не найдена" };
  }
  const row = await assignmentWithPlan(assignmentId);
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const exercise = exerciseId === null
    ? undefined
    : row.plan.exercises.find((entry) => entry.id === exerciseId);
  if (exerciseId !== null && !exercise) return { error: "Упражнение не найдено" };

  await db.update(lessonAssignments).set({
    answers: homeworkReactionsResetSql(
      lessonAssignments.answers,
      exercise ? homeworkExerciseReactionKeys(exercise) : undefined,
    ),
    updatedAt: new Date(),
  }).where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return { cleared: true };
}

/** Teacher score and public feedback for one exercise. */
export async function saveHomeworkExerciseGradeAction(
  assignmentId: string,
  exerciseId: string,
  suppliedScore: number,
  suppliedComment: string,
): Promise<{ error?: string; state?: HomeworkStoredState }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const exercise = row.plan.exercises.find((item) => item.id === String(exerciseId ?? ""));
  if (!exercise) return { error: "Упражнение не найдено" };
  const score = Math.round(Number(suppliedScore));
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return { error: "Оценка должна быть от 0 до 100" };
  }
  const comment = String(suppliedComment ?? "").trim().slice(0, 4_000);
  const state = { ...(row.assignment.answers ?? {}) };
  state[homeworkExerciseScoreKey(exercise.id)] = String(score);
  if (comment) state[homeworkExerciseCommentKey(exercise.id)] = comment;
  else delete state[homeworkExerciseCommentKey(exercise.id)];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return { state };
}

/** Lightweight state refresh for review marks in an active class. */
export async function homeworkReviewStateAction(
  assignmentId: string,
): Promise<HomeworkStoredState | null> {
  const session = await requireUser();
  const row = await assignmentWithOptionalPlan(String(assignmentId ?? ""));
  if (!row) return null;
  const allowed = session.role === "STUDENT"
    ? row.assignment.studentId === session.userId
    : row.authorId === session.userId;
  return allowed ? (row.assignment.answers ?? {}) : null;
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
  const updating = Boolean(homeworkAssignedAt(state));
  const assignedAt = new Date().toISOString();
  state[homeworkPlanOverrideKey()] = JSON.stringify(row.plan);
  state[homeworkAssignedAtKey()] = assignedAt;
  state[homeworkAssignedExercisesKey()] = JSON.stringify(selected);
  delete state[homeworkRemovedAtKey()];
  delete state[homeworkSubmittedAtKey()];
  delete state[homeworkReviewedAtKey()];
  delete state[homeworkRevisionRequestedAtKey()];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  await queueStudentNotification({
    teacherId: session.userId,
    studentId: row.assignment.studentId,
    event: updating ? "homeworkUpdated" : "homeworkAssigned",
    title: row.title,
    href: `/student/lessons/${row.assignment.id}?section=homework`,
  });

  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath("/teacher/homeworks");
  return { assignedAt, exerciseIds: selected };
}

export type HomeworkLessonSource = {
  id: string;
  title: string;
  homeworkTitle: string;
  assignmentId: string | null;
  exercises: Array<{
    id: string;
    title: string;
    kind: HomeworkExerciseKind;
    optional: boolean;
    items: number;
  }>;
};

/** Lesson templates that can provide selectable homework for one student. */
export async function listHomeworkLessonSourcesAction(
  studentId: string,
): Promise<HomeworkLessonSource[]> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return [];
  const target = String(studentId ?? "");
  if (!target) return [];

  const [units, assignments] = await Promise.all([
    db
      .select({ id: lessonUnits.id, title: lessonUnits.title, homework: lessonUnits.homework })
      .from(lessonUnits)
      .where(eq(lessonUnits.authorId, session.userId))
      .orderBy(asc(lessonUnits.title)),
    db
      .select({
        id: lessonAssignments.id,
        unitId: lessonAssignments.unitId,
        answers: lessonAssignments.answers,
      })
      .from(lessonAssignments)
      .where(eq(lessonAssignments.studentId, target)),
  ]);
  const assignmentOf = new Map(assignments.map((assignment) => [assignment.unitId, assignment]));

  return units.flatMap((unit): HomeworkLessonSource[] => {
    const base = interactiveHomeworkFromEntries(unit.homework);
    if (!base) return [];
    const assignment = assignmentOf.get(unit.id);
    const plan = assignment
      ? homeworkPlanForAssignment(base, assignment.answers ?? {}) ?? base
      : base;
    if (plan.exercises.length === 0) return [];
    return [{
      id: unit.id,
      title: unit.title,
      homeworkTitle: plan.title,
      assignmentId: assignment?.id ?? null,
      exercises: plan.exercises.map((exercise) => ({
        id: exercise.id,
        title: exercise.title,
        kind: exercise.kind,
        optional: exercise.optional === true,
        items: exercise.items.length,
      })),
    }];
  });
}

/** Create/reuse a lesson assignment and hand out only the selected exercises. */
export async function assignHomeworkFromLessonSourceAction(input: {
  studentId: string;
  lessonId: string;
  exerciseIds: string[];
}): Promise<{ assignmentId?: string; assignedAt?: string; error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const studentId = String(input?.studentId ?? "");
  const lessonId = String(input?.lessonId ?? "");
  const [[unit], [student]] = await Promise.all([
    db
      .select({ id: lessonUnits.id, title: lessonUnits.title, homework: lessonUnits.homework })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.id, lessonId), eq(lessonUnits.authorId, session.userId)))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
      .limit(1),
  ]);
  if (!unit) return { error: "Урок не найден" };
  if (!student) return { error: "Ученик не найден" };
  const base = interactiveHomeworkFromEntries(unit.homework);
  if (!base) return { error: "В этом уроке нет интерактивной домашки" };

  const [existing] = await db
    .select()
    .from(lessonAssignments)
    .where(and(
      eq(lessonAssignments.unitId, lessonId),
      eq(lessonAssignments.studentId, studentId),
    ))
    .limit(1);
  const current = existing?.answers ?? {};
  const plan = existing ? homeworkPlanForAssignment(base, current) ?? base : base;
  const wanted = new Set((input.exerciseIds ?? []).map(String));
  const selected = plan.exercises.map((exercise) => exercise.id).filter((id) => wanted.has(id));
  if (selected.length === 0) return { error: "Выбери хотя бы одно упражнение" };

  const updating = Boolean(homeworkAssignedAt(current));
  const assignedAt = new Date().toISOString();
  const state = { ...current };
  state[homeworkPlanOverrideKey()] = JSON.stringify(plan);
  state[homeworkAssignedAtKey()] = assignedAt;
  state[homeworkAssignedExercisesKey()] = JSON.stringify(selected);
  delete state[homeworkRemovedAtKey()];
  delete state[homeworkSubmittedAtKey()];
  delete state[homeworkReviewedAtKey()];
  delete state[homeworkRevisionRequestedAtKey()];

  let assignmentId = existing?.id ?? null;
  if (existing) {
    const openSections = [...new Set([...(existing.openSections ?? []), "homework"])];
    await db
      .update(lessonAssignments)
      .set({ answers: state, openSections, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, existing.id));
  } else {
    const [created] = await db
      .insert(lessonAssignments)
      .values({
        unitId: lessonId,
        studentId,
        openSections: ["homework"],
        answers: state,
      })
      .returning({ id: lessonAssignments.id });
    assignmentId = created?.id ?? null;
  }
  if (!assignmentId) return { error: "Не удалось назначить домашку" };

  await queueStudentNotification({
    teacherId: session.userId,
    studentId,
    event: updating ? "homeworkUpdated" : "homeworkAssigned",
    title: unit.title,
    href: `/student/lessons/${assignmentId}?section=homework`,
  });
  revalidatePath("/teacher/homeworks");
  revalidatePath("/student/homework");
  revalidatePath(`/student/lessons/${assignmentId}`);
  revalidatePath(`/teacher/lessons/given/${assignmentId}`);
  return { assignmentId, assignedAt };
}

/** Remove one student's assigned homework without touching the lesson template. */
export async function deleteStudentHomeworkAssignmentAction(
  assignmentId: string,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithOptionalPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const current = row.assignment.answers ?? {};
  const recordingUrls: string[] = [];
  const recordingKeys: string[] = [];
  for (const exercise of row.plan?.exercises ?? []) {
    if (exercise.kind !== "question-audio") continue;
    for (const item of exercise.items) {
      const target = homeworkVoiceRecordingTarget(item.id);
      const recording = regularVoiceRecording(current, target);
      if (recording?.url) recordingUrls.push(recording.url);
      recordingKeys.push(regularVoiceRecordingKey(target));
    }
  }

  const state = withoutAssignedHomeworkState(current);
  for (const key of recordingKeys) delete state[key];
  state[homeworkRemovedAtKey()] = new Date().toISOString();

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  await Promise.all(
    recordingUrls.map((url) => removePublicFile(url, "lesson-audio").catch(() => undefined)),
  );
  revalidatePath("/teacher/homeworks");
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return {};
}

/** Return one student's lesson homework to Not started without changing it. */
export async function resetStudentHomeworkAssignmentAction(
  assignmentId: string,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithOptionalPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId || !row.plan) {
    return { error: "Домашняя работа не найдена" };
  }

  const current = row.assignment.answers ?? {};
  const recordingUrls: string[] = [];
  const recordingKeys: string[] = [];
  for (const exercise of row.plan.exercises) {
    if (exercise.kind !== "question-audio") continue;
    for (const item of exercise.items) {
      const target = homeworkVoiceRecordingTarget(item.id);
      const recording = regularVoiceRecording(current, target);
      if (recording?.url) recordingUrls.push(recording.url);
      recordingKeys.push(regularVoiceRecordingKey(target));
    }
  }

  const state = withoutHomeworkProgressState(current, row.plan);
  for (const key of recordingKeys) delete state[key];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  await Promise.all(
    recordingUrls.map((url) => removePublicFile(url, "lesson-audio").catch(() => undefined)),
  );
  await queueStudentNotification({
    teacherId: session.userId,
    studentId: row.assignment.studentId,
    event: "homeworkUpdated",
    title: row.title,
    href: `/student/lessons/${row.assignment.id}?section=homework`,
  });

  revalidatePath("/teacher/homeworks");
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return {};
}

function homeworkStateAfterPlanEdit(
  previousPlan: InteractiveHomeworkPlan,
  plan: InteractiveHomeworkPlan,
  source: HomeworkStoredState,
  keepOverride: boolean,
): HomeworkStoredState {
  const needsRevision = Boolean(homeworkSubmittedAt(source) || homeworkReviewedAt(source));
  let state = { ...source };
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

  for (const exercise of previousPlan.exercises) {
    if (!plan.exercises.some((candidateExercise) => candidateExercise.id === exercise.id)) {
      state = withoutHomeworkExerciseState(state, exercise);
    }
  }

  if (keepOverride) state[homeworkPlanOverrideKey()] = JSON.stringify(plan);
  else delete state[homeworkPlanOverrideKey()];
  if (homeworkAssignedAt(state)) {
    const previouslySelected = new Set(homeworkAssignedExerciseIds(previousPlan, state));
    const selected = plan.exercises
      .filter((exercise) => previouslySelected.has(exercise.id) || !oldExercises.has(exercise.id))
      .map((exercise) => exercise.id);
    state[homeworkAssignedExercisesKey()] = JSON.stringify(selected);
  }
  delete state[homeworkSubmittedAtKey()];
  delete state[homeworkReviewedAtKey()];
  if (needsRevision) state[homeworkRevisionRequestedAtKey()] = new Date().toISOString();
  return state;
}

/** Сохранить отдельную версию домашки или обновить шаблон и все копии. */
export async function saveStudentHomeworkPlanAction(
  assignmentId: string,
  candidate: InteractiveHomeworkPlan,
  scope: "STUDENT" | "GLOBAL" = "STUDENT",
): Promise<{ error?: string; plan?: InteractiveHomeworkPlan; state?: HomeworkStoredState }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithOptionalPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Урок ученика не найден" };

  const plan = normalizeInteractiveHomework(candidate, { allowEmpty: true });
  if (!plan) return { error: "Не удалось прочитать домашку" };
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

  let state = homeworkStateAfterPlanEdit(
    previousPlan,
    plan,
    row.assignment.answers ?? {},
    scope !== "GLOBAL",
  );

  if (scope === "GLOBAL") {
    const basePlan = interactiveHomeworkFromEntries(row.homework) ?? {
      kind: "INTERACTIVE_HOMEWORK_V1" as const,
      title: plan.title || `${row.title} · Homework`,
      exercises: [],
    };
    const assignments = await db
      .select()
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, row.unitId));
    await db.transaction(async (tx) => {
      await tx
        .update(lessonUnits)
        .set({
          homework: [...legacyHomeworkFromEntries(row.homework), plan],
          updatedAt: new Date(),
        })
        .where(eq(lessonUnits.id, row.unitId));

      for (const assignment of assignments) {
        const privatePlan = assignment.contentOverride &&
          typeof assignment.contentOverride === "object"
            ? normalizeInteractiveHomework(assignment.contentOverride.interactiveHomework, {
                allowEmpty: true,
              })
            : null;
        const prior = homeworkPlanForAssignment(
          privatePlan ?? basePlan,
          assignment.answers ?? {},
        ) ?? basePlan;
        const nextState = homeworkStateAfterPlanEdit(
          prior,
          plan,
          assignment.answers ?? {},
          false,
        );
        const contentOverride = assignment.contentOverride &&
          typeof assignment.contentOverride === "object"
            ? { ...assignment.contentOverride, interactiveHomework: plan }
            : null;
        await tx
          .update(lessonAssignments)
          .set({ answers: nextState, contentOverride, updatedAt: new Date() })
          .where(eq(lessonAssignments.id, assignment.id));
        if (assignment.id === row.assignment.id) state = nextState;
      }
    });
  } else {
    await db
      .update(lessonAssignments)
      .set({ answers: state, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, row.assignment.id));
  }

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

/**
 * Switch the non-English side of one student's translation exercise and save
 * the result in that assignment's private homework copy. The lesson template
 * and every other student's homework stay untouched.
 */
export async function translateHomeworkExerciseLanguageAction(
  assignmentId: string,
  exerciseId: string,
  targetLanguage: MaterialTranslationLang,
): Promise<{
  plan?: InteractiveHomeworkPlan;
  state?: HomeworkStoredState;
  error?: string;
}> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const id = String(exerciseId ?? "");
  const exercise = row.plan.exercises.find((item) => item.id === id);
  if (!exercise || exercise.kind !== "translate") {
    return { error: "Упражнение на перевод не найдено" };
  }
  const language: MaterialTranslationLang = targetLanguage === "RU" ? "RU" : "UK";
  const direction = exercise.translationDirection === "from-english"
    ? "from-english"
    : "to-english";
  const sourceTexts = exercise.items.map((item) => item.prompt);
  if (sourceTexts.length === 0) {
    return { error: "В упражнении нет предложений для перевода" };
  }

  try {
    const translated = await translateShortTexts(
      sourceTexts,
      language,
      direction === "from-english" ? "EN" : homeworkTranslationLanguage(exercise),
      "Simple real sentences for an English lesson translation exercise",
    );
    const nextExercise = {
      ...exercise,
      translationLanguage: language,
      items: exercise.items.map((item, index) => ({
        ...item,
        prompt: direction === "to-english" ? translated[index] : sourceTexts[index],
        ...(direction === "from-english" ? { answer: translated[index] } : {}),
      })),
    };
    const plan: InteractiveHomeworkPlan = {
      ...row.plan,
      exercises: row.plan.exercises.map((item) => item.id === id ? nextExercise : item),
    };
    let state: HomeworkStoredState = {
      ...(row.assignment.answers ?? {}),
      [homeworkPlanOverrideKey()]: JSON.stringify(plan),
    };

    for (const item of exercise.items) {
      // The displayed foreign sentence changed, so old token positions no
      // longer describe the same words.
      state = clearHomeworkTextHighlights(state, item.id, "prompt");
      if (direction === "from-english") {
        // Here the expected/student answer itself changes from RU to UK or
        // back. Keep notes and reactions, but discard the now invalid answer.
        state = clearHomeworkTextHighlights(state, item.id, "answer");
        delete state[homeworkValueKey(item.id)];
        delete state[homeworkStatusKey(item.id)];
        delete state[homeworkAttemptsKey(item.id)];
      }
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
    revalidatePath("/teacher/class");
    revalidatePath("/student/class");
    return { plan, state };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "DeepL не смог перевести предложения",
    };
  }
}

function shuffleIntoNewOrder<T extends { id: string }>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapWith = randomInt(index + 1);
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
  }
  if (next.length > 1 && next.every((item, index) => item.id === items[index]?.id)) {
    next.push(next.shift()!);
  }
  return next;
}

/** Reorder one exercise in this student's private copy without clearing any answers. */
export async function shuffleHomeworkExerciseItemsAction(
  assignmentId: string,
  exerciseId: string,
): Promise<{
  plan?: InteractiveHomeworkPlan;
  state?: HomeworkStoredState;
  error?: string;
}> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const id = String(exerciseId ?? "");
  const exercise = row.plan.exercises.find((item) => item.id === id);
  if (!exercise) return { error: "Упражнение не найдено" };
  if (exercise.items.length < 2) return { error: "В упражнении недостаточно предложений" };

  const plan: InteractiveHomeworkPlan = {
    ...row.plan,
    exercises: row.plan.exercises.map((item) => item.id === id
      ? { ...item, items: shuffleIntoNewOrder(item.items) }
      : item),
  };
  const state: HomeworkStoredState = {
    ...(row.assignment.answers ?? {}),
    [homeworkPlanOverrideKey()]: JSON.stringify(plan),
  };

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath("/teacher/homeworks");
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return { plan, state };
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
  if (isTeacher) {
    state = homeworkStateAfterTeacherAutoAnswerEdit(state, found.item, supplied);
    await db
      .update(lessonAssignments)
      .set({ answers: state, updatedAt: new Date() })
      .where(eq(lessonAssignments.id, row.assignment.id));
    revalidatePath(`/student/lessons/${row.assignment.id}`);
    revalidatePath("/student/homework");
    revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
    revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
    return publicItemState(state, found.item.id);
  }
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
    .set({ answers: homeworkStateWithCurrentResultSql(lessonAssignments.answers, state), updatedAt: new Date() })
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
    .set({ answers: homeworkStateWithCurrentResultSql(lessonAssignments.answers, state), updatedAt: new Date() })
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
  const state = clearHomeworkTextHighlights(
    { ...(row.assignment.answers ?? {}) },
    found.item.id,
    "answer",
  );
  state[homeworkValueKey(found.item.id)] = value;
  if (isStudent) {
    delete state[homeworkSubmittedAtKey()];
    delete state[homeworkReviewedAtKey()];
  }
  await db
    .update(lessonAssignments)
    .set({ answers: homeworkStateWithCurrentResultSql(lessonAssignments.answers, state), updatedAt: new Date() })
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
  delete state[homeworkReviewedAtKey()];
  delete state[homeworkRevisionRequestedAtKey()];

  await db.transaction(async (tx) => {
    await tx
      .update(lessonAssignments)
      .set({ answers: homeworkStateWithCurrentResultSql(lessonAssignments.answers, state), updatedAt: new Date() })
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
  delete state[homeworkRevisionRequestedAtKey()];

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  await queueStudentNotification({
    teacherId: session.userId,
    studentId: row.assignment.studentId,
    event: "homeworkReviewed",
    title: row.title,
    href: `/student/lessons/${row.assignment.id}?section=homework`,
  });

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  revalidatePath("/student");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return { reviewedAt };
}

/** Вернуть уже отправленную или проверенную домашку ученику на доработку. */
export async function returnInteractiveHomeworkForRevisionAction(
  assignmentId: string,
): Promise<{ error?: string; revisionRequestedAt?: string; state?: HomeworkStoredState }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const state = { ...(row.assignment.answers ?? {}) };
  if (!homeworkSubmittedAt(state) && !homeworkReviewedAt(state)) {
    return { error: "Ученик ещё не отправил эту домашнюю работу" };
  }
  const revisionRequestedAt = new Date().toISOString();
  delete state[homeworkSubmittedAtKey()];
  delete state[homeworkReviewedAtKey()];
  state[homeworkRevisionRequestedAtKey()] = revisionRequestedAt;

  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  await queueStudentNotification({
    teacherId: session.userId,
    studentId: row.assignment.studentId,
    event: "homeworkRevisionRequested",
    title: row.title,
    href: `/student/lessons/${row.assignment.id}?section=homework`,
  });

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/teacher/homeworks");
  revalidatePath("/student/homework");
  revalidatePath("/student");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
  return { revisionRequestedAt, state };
}

/** Сохранить голосовой комментарий учителя к домашней работе. */
export async function saveHomeworkTeacherVoiceMessageAction(
  assignmentId: string,
  raw: {
    id: string;
    url: string;
    durationSeconds: number;
    mimeType: string;
  },
): Promise<{ error?: string; state?: HomeworkStoredState; message?: HomeworkTeacherVoiceMessage }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };

  const id = String(raw?.id ?? "").trim();
  const url = String(raw?.url ?? "").trim();
  const pathname = managedUploadPath(url);
  const durationSeconds = Math.round(Number(raw?.durationSeconds));
  const mimeType = String(raw?.mimeType ?? "audio/webm").trim().slice(0, 80);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(id)) return { error: "Некорректная запись" };
  if (!pathname?.startsWith(`uploads/lesson-audio/${row.assignment.id}-teacher-feedback-${id}`)) {
    return { error: "Некорректная ссылка на запись" };
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
    return { error: "Некорректная длительность записи" };
  }
  if (!/^audio\/(?:webm|ogg|mp4|mpeg|wav|x-m4a)(?:;|$)/i.test(mimeType)) {
    return { error: "Неподдерживаемый формат записи" };
  }

  const state = { ...(row.assignment.answers ?? {}) };
  const messages = homeworkTeacherVoiceMessages(state);
  const message: HomeworkTeacherVoiceMessage = {
    id,
    url,
    durationSeconds,
    mimeType,
    publishedAt: new Date().toISOString(),
  };
  state[homeworkTeacherVoiceMessagesKey()] = JSON.stringify([
    ...messages.filter((item) => item.id !== id),
    message,
  ].slice(-20));
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));

  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  revalidatePath("/student/homework");
  return { state, message };
}

/** Удалить один голосовой комментарий, не затрагивая ответы ученика. */
export async function removeHomeworkTeacherVoiceMessageAction(
  assignmentId: string,
  messageId: string,
): Promise<{ error?: string; state?: HomeworkStoredState }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Доступно только учителю" };
  const row = await assignmentWithPlan(String(assignmentId ?? ""));
  if (!row || row.authorId !== session.userId) return { error: "Домашняя работа не найдена" };
  const id = String(messageId ?? "").trim();
  const state = { ...(row.assignment.answers ?? {}) };
  const messages = homeworkTeacherVoiceMessages(state);
  const removed = messages.find((message) => message.id === id);
  if (!removed) return { state };
  const kept = messages.filter((message) => message.id !== id);
  if (kept.length > 0) state[homeworkTeacherVoiceMessagesKey()] = JSON.stringify(kept);
  else delete state[homeworkTeacherVoiceMessagesKey()];
  await db
    .update(lessonAssignments)
    .set({ answers: state, updatedAt: new Date() })
    .where(eq(lessonAssignments.id, row.assignment.id));
  await removePublicFile(removed.url, "lesson-audio").catch(() => undefined);
  revalidatePath(`/teacher/homeworks/${row.assignment.id}`);
  revalidatePath(`/teacher/lessons/given/${row.assignment.id}`);
  revalidatePath(`/student/lessons/${row.assignment.id}`);
  return { state };
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
  revalidatePath("/student/homework");
  await publishHomeworkReviewRealtime(row.assignment.studentId);
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
  homeworkFeedback?: HomeworkFeedbackSettings;
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
  kind: "LESSON";
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  started: boolean;
  assignedAt: string;
  nextLessonAt: string | null;
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

  const studentIds = [...new Set(rows.map((row) => row.studentId))];
  const upcomingLessons = studentIds.length > 0
    ? await db
      .select({ studentId: lessons.studentId, startTime: lessons.startTime })
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

  return rows.flatMap((row): TeacherHomeworkAssignmentCard[] => {
    const state = row.assignment.answers ?? {};
    if (homeworkRemovedAt(state)) return [];
    const contentPlan = row.assignment.contentOverride && typeof row.assignment.contentOverride === "object"
      ? normalizeInteractiveHomework(row.assignment.contentOverride.interactiveHomework, { allowEmpty: true })
      : null;
    const plan = homeworkPlanForAssignment(contentPlan ?? interactiveHomeworkFromEntries(row.homework), state);
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
      kind: "LESSON" as const,
      id: row.assignment.id,
      title: row.title,
      homeworkTitle: plan?.title || legacy[0]?.title || "Homework",
      homeworkFeedback: lessonHomeworkFeedback(state),
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
      assignedAt: homeworkAssignedAt(state) ?? row.assignment.createdAt.toISOString(),
      nextLessonAt: nextLessonByStudent.get(row.studentId) ?? null,
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
    if (homeworkRemovedAt(state)) return [];
    const contentPlan = row.assignment.contentOverride && typeof row.assignment.contentOverride === "object"
      ? normalizeInteractiveHomework(row.assignment.contentOverride.interactiveHomework, { allowEmpty: true })
      : null;
    const plan = homeworkPlanForAssignment(contentPlan ?? interactiveHomeworkFromEntries(row.homework), state);
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
      homeworkFeedback: lessonHomeworkFeedback(state),
    }];
  });
}
