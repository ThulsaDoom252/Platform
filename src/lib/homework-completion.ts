import { homeworkReviewedAtKey, homeworkRevisionRequestedAtKey, homeworkSubmittedAtKey, type HomeworkStoredState } from "./lesson-homework";

export type HomeworkDoneResult = { reviewedAt?: string; error?: "forbidden" | "unavailable" | "failed" };

/** Refresh lifecycle metadata without replacing an answer currently being typed. */
export function mergeHomeworkCompletion(local: HomeworkStoredState, saved: HomeworkStoredState): HomeworkStoredState {
  const keys = [homeworkReviewedAtKey(), homeworkRevisionRequestedAtKey(), homeworkSubmittedAtKey()];
  if (keys.every(key => local[key] === saved[key])) return local;
  const next = { ...local };
  for (const key of keys) {
    if (saved[key]) next[key] = saved[key]; else delete next[key];
  }
  return next;
}
