/** A teacher-owned display name for one student's assignment, not the lesson template. */
export const HOMEWORK_TITLE_KEY = "hw:display-title";
export const HOMEWORK_TITLE_MAX_LENGTH = 240;

export function normalizeHomeworkTitle(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) return null;
  const title = value.replace(/\s+/gu, " ").trim();
  return title && title.length <= HOMEWORK_TITLE_MAX_LENGTH ? title : null;
}

export function assignedHomeworkTitle(state: Record<string, string>, fallback: string): string {
  return normalizeHomeworkTitle(state[HOMEWORK_TITLE_KEY]) ?? fallback;
}

/** Update the name without replacing a student's unsaved answer or other metadata. */
export function mergeHomeworkTitle(local: Record<string, string>, saved: Record<string, string>) {
  if (local[HOMEWORK_TITLE_KEY] === saved[HOMEWORK_TITLE_KEY]) return local;
  const next = { ...local };
  if (saved[HOMEWORK_TITLE_KEY]) next[HOMEWORK_TITLE_KEY] = saved[HOMEWORK_TITLE_KEY];
  else delete next[HOMEWORK_TITLE_KEY];
  return next;
}

export type HomeworkTitleSaveResult = {
  title?: string | null;
  error?: "forbidden" | "unavailable" | "invalid" | "failed";
};
