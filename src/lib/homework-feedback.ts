/** Result reactions are independent of answers, attempt history and numeric grades. */
export const HOMEWORK_RESULT_REACTIONS = [
  { id: "excellent", emoji: "🤩", caption: "Excellent", tone: "green", strength: 3 },
  { id: "good", emoji: "✅", caption: "Good", tone: "green", strength: 2 },
  { id: "not-bad", emoji: "👍", caption: "Not bad", tone: "green", strength: 1 },
  { id: "need-practice", emoji: "🙃", caption: "Need more practice", tone: "yellow", strength: 1 },
  { id: "could-be-better", emoji: "⚠️", caption: "Could be better", tone: "yellow", strength: 2 },
  { id: "bad", emoji: "👎", caption: "Bad", tone: "red", strength: 1 },
  { id: "kidding", emoji: "🫠", caption: "Are you kidding me?", tone: "red", strength: 2 },
  { id: "ridiculous", emoji: "😡", caption: "This is ridiculous", tone: "red", strength: 3 },
] as const;

export type HomeworkResultReaction = typeof HOMEWORK_RESULT_REACTIONS[number]["id"];
export type HomeworkFeedbackSettings = {
  autoEnabled: boolean;
  manualReaction: HomeworkResultReaction | null;
};
export type HomeworkFeedbackKind = "LESSON" | "ACTIVITY" | "REVISION";
export type HomeworkResultScore = { right: number; total: number };
// Part of the existing reaction namespace: whole-homework Reset also clears this.
export const HOMEWORK_OVERALL_REACTION_KEY = "hw:reaction:overall";

export function isHomeworkResultReaction(value: unknown): value is HomeworkResultReaction {
  return HOMEWORK_RESULT_REACTIONS.some((reaction) => reaction.id === value);
}

export function readHomeworkFeedback(value: unknown): HomeworkFeedbackSettings {
  const stored = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    autoEnabled: stored.autoEnabled !== false,
    manualReaction: isHomeworkResultReaction(stored.manualReaction) ? stored.manualReaction : null,
  };
}

export function lessonHomeworkFeedback(state: Record<string, string>): HomeworkFeedbackSettings {
  return { autoEnabled: false, manualReaction: isHomeworkResultReaction(state[HOMEWORK_OVERALL_REACTION_KEY])
    ? state[HOMEWORK_OVERALL_REACTION_KEY] : null };
}

export function homeworkResultReaction(score: HomeworkResultScore | null | undefined): HomeworkResultReaction | null {
  if (!score || !Number.isFinite(score.right) || !Number.isFinite(score.total) ||
    score.total <= 0 || score.right < 0 || score.right > score.total) return null;
  // Compare the original fraction: a rounded 99.5% must not become Excellent.
  if (score.right === score.total) return "excellent";
  const percentage = score.right / score.total * 100;
  if (percentage >= 90) return "good";
  if (percentage >= 80) return "not-bad";
  // The requested scale omitted 70–79%; keep those in the practice band.
  if (percentage >= 60) return "need-practice";
  if (percentage >= 50) return "could-be-better";
  if (percentage >= 40) return "bad";
  if (percentage >= 20) return "kidding";
  return "ridiculous";
}

export function resolveHomeworkFeedback(
  settings: HomeworkFeedbackSettings | null | undefined,
  completedScore?: HomeworkResultScore | null,
  canAuto = true,
): HomeworkResultReaction | null {
  const feedback = readHomeworkFeedback(settings);
  return canAuto && feedback.autoEnabled
    ? homeworkResultReaction(completedScore)
    : feedback.manualReaction;
}

export function latestCompletedHomeworkScore<T extends {
  finishedAt: string | null; result: HomeworkResultScore;
}>(attempts: T[]): HomeworkResultScore | null {
  const latest = attempts.filter((attempt) => attempt.finishedAt)
    .sort((left, right) => Date.parse(right.finishedAt!) - Date.parse(left.finishedAt!))[0];
  return latest?.result ?? null;
}
