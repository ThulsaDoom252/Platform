import { fmt, type Dict } from "./i18n";
import {
  assignedInteractiveHomework, homeworkExerciseHidden, homeworkPlanForAssignment, homeworkRemovedAt,
  interactiveHomeworkFromEntries, legacyHomeworkFromEntries, normalizeInteractiveHomework,
  homeworkExerciseFocusId, type HomeworkStoredState,
} from "./lesson-homework";

export type HomeworkReminderTarget = {
  kind: "LESSON" | "ACTIVITY" | "REVISION";
  id: string;
  exerciseId?: string;
  legacyIndex?: number;
};
export type HomeworkReminderDescription = HomeworkReminderTarget & { title: string; exerciseTitle?: string };
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function validHomeworkReminderTarget(value: unknown): value is HomeworkReminderTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  if (!["LESSON", "ACTIVITY", "REVISION"].includes(String(target.kind)) || typeof target.id !== "string" || !UUID.test(target.id)) return false;
  if (target.exerciseId !== undefined && (typeof target.exerciseId !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(target.exerciseId))) return false;
  if (target.legacyIndex !== undefined && (!Number.isInteger(target.legacyIndex) || Number(target.legacyIndex) < 0 || Number(target.legacyIndex) > 199)) return false;
  if (target.exerciseId !== undefined && target.legacyIndex !== undefined) return false;
  return target.kind === "LESSON" || (target.exerciseId === undefined && target.legacyIndex === undefined);
}

export function readHomeworkReminderTarget(value: unknown): HomeworkReminderTarget | null {
  if (!validHomeworkReminderTarget(value)) return null;
  return { kind: value.kind, id: value.id,
    ...(value.exerciseId !== undefined ? { exerciseId: value.exerciseId } : {}),
    ...(value.legacyIndex !== undefined ? { legacyIndex: value.legacyIndex } : {}) };
}

/** Resolve only assigned, student-visible work from its effective personal copy. */
export function lessonHomeworkReminderDescription(target: HomeworkReminderTarget, lesson: {
  title: string; homework: unknown; contentOverride?: Record<string, unknown> | null; answers: HomeworkStoredState;
}, t: Dict): HomeworkReminderDescription | null {
  const reference = readHomeworkReminderTarget(target);
  if (!reference || reference.kind !== "LESSON" || homeworkRemovedAt(lesson.answers)) return null;
  target = reference;
  const override = lesson.contentOverride;
  const plan = homeworkPlanForAssignment(
    normalizeInteractiveHomework(override?.interactiveHomework, { allowEmpty: true }) ?? interactiveHomeworkFromEntries(lesson.homework),
    lesson.answers,
  );
  const assigned = plan ? assignedInteractiveHomework(plan, lesson.answers) : null;
  const legacy = legacyHomeworkFromEntries(override?.homework ?? lesson.homework);
  if (plan && !assigned) return null;
  if (!assigned && !legacy.length) return null;
  const title = typeof override?.title === "string" && override.title.trim() ? override.title.trim().slice(0, 240) : lesson.title;
  if (target.exerciseId !== undefined) {
    const exercise = assigned?.exercises.find((entry) => entry.id === target.exerciseId);
    if (!exercise || homeworkExerciseHidden(lesson.answers, exercise.id)) return null;
    return { ...target, title, exerciseTitle: exercise.title };
  }
  if (target.legacyIndex !== undefined) {
    const task = legacy[target.legacyIndex];
    if (!task) return null;
    return { ...target, title, exerciseTitle: task.title || fmt(t.notifications.reminderExerciseNumber, { n: target.legacyIndex + 1 }) };
  }
  return { ...target, title };
}

export function homeworkReminderMessage(t: Dict, description: HomeworkReminderDescription) {
  return description.exerciseTitle
    ? fmt(t.notifications.exerciseReminder, { title: description.title, exercise: description.exerciseTitle })
    : fmt(t.notifications.homeworkReminder, { title: description.title });
}

/** The token makes repeated reminders reopen/scroll even on the same lesson page. */
export function homeworkReminderHref(target: HomeworkReminderTarget, notificationId: string) {
  if (!validHomeworkReminderTarget(target) || !UUID.test(notificationId)) return null;
  if (target.kind === "ACTIVITY") return `/student/homework/games/${target.id}`;
  if (target.kind === "REVISION") return `/student/homework/revision/${target.id}`;
  const params = new URLSearchParams({ section: "homework", reminder: notificationId });
  if (target.exerciseId !== undefined) params.set("exercise", target.exerciseId);
  if (target.legacyIndex !== undefined) params.set("task", String(target.legacyIndex));
  return `/student/lessons/${target.id}?${params}`;
}

export const legacyHomeworkFocusId = (index: number) => `homework:legacy:${index}`;

/** Validate the navigation against the already authorized student-visible lesson. */
export function homeworkReminderNavigation(params: { section?: string; reminder?: string; exercise?: string; task?: string },
  visible: { exerciseIds: string[]; legacyCount: number; homeworkOpen: boolean }) {
  if (params.section !== "homework" || !params.reminder || !UUID.test(params.reminder) || !visible.homeworkOpen) return null;
  if (params.exercise && !visible.exerciseIds.includes(params.exercise)) return null;
  const task = params.task !== undefined ? Number(params.task) : null;
  if (task !== null && (!/^\d+$/.test(params.task!) || !Number.isInteger(task) || task < 0 || task >= visible.legacyCount)) return null;
  if (params.exercise && task !== null) return null;
  return { section: "homework" as const,
    elementId: params.exercise ? homeworkExerciseFocusId(params.exercise) : task !== null ? legacyHomeworkFocusId(task) : null,
    at: params.reminder };
}
