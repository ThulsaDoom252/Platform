import { isHomeworkResultReaction, type HomeworkResultReaction } from "../homework-feedback";

/** Optional feedback belongs to one attempt, never determines its completion. */
export type TestTeacherFeedback = {
  manualReaction: HomeworkResultReaction | null;
  teacherNote: string;
  updatedAt: string;
};

export function readTestTeacherFeedback(value: unknown): TestTeacherFeedback | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as Record<string, unknown>;
  const manualReaction = isHomeworkResultReaction(stored.manualReaction) ? stored.manualReaction : null;
  const teacherNote = typeof stored.teacherNote === "string" ? stored.teacherNote.trim().slice(0, 4_000) : "";
  if (!manualReaction && !teacherNote) return null;
  return { manualReaction, teacherNote, updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : "" };
}
