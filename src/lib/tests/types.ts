import type { Locale } from "@/lib/i18n";
import type { TestCategoryId, TestLevelId } from "@/lib/test-library";

export type TestText = Record<Locale, string>;
export type TestQuestion = { id: string; before: string; after: string; options: string[] };
export type TestExercise = { id: string; number: number; instruction: string; questions: TestQuestion[] };
/** Public content only. Answer keys never cross the server/client boundary. */
export type TestDefinition = {
  id: string; version: number; title: string; subtitle: string;
  level: TestLevelId; category: TestCategoryId; exercises: TestExercise[];
};
export type TestQuestionKey = { answer: string; rule: TestText; reasons: Record<string, TestText> };
export type TestAnswerKey = Record<string, Record<string, TestQuestionKey>>;
export type TestAnswers = Record<string, string | null>;
export type TestQuestionResult = {
  id: string; selected: string | null; answer: string; correct: boolean; explanation: TestText;
};
export type TestExerciseResult = { exerciseId: string; correct: number; total: number; percent: number; questions: TestQuestionResult[] };
export type TestResults = Record<string, TestExerciseResult>;
export type TestAttemptSummary = {
  id: string; createdAt: string; completedAt: string | null;
  correct: number; total: number; percent: number; checkedExerciseIds: string[];
};
export type TestAttempt = TestAttemptSummary & { results: TestResults };
export type TestAssignmentDetail = {
  id: string; studentId: string; studentName: string; definition: TestDefinition;
  exerciseIds: string[]; assignedAt: string; attempts: TestAttemptSummary[]; latestAttempt: TestAttempt | null;
};
export type TestHomeworkCard = {
  id: string; kind: "TEST"; activityType: "TEST"; title: string;
  studentId: string; studentName: string; studentAvatarUrl: string | null;
  assignedAt: string; submittedAt: string | null; reviewedAt: string | null;
  nextLessonAt: string | null; started: boolean; exerciseIds: string[];
  latestPercent: number | null; attemptCount: number;
};
export type TestActionError = "invalid" | "forbidden" | "failed";
export type TestReply<T> = { ok: true; value: T } | { ok: false; error: TestActionError };

export function readyTestExercises(test: TestDefinition) {
  return test.exercises.filter((exercise) => exercise.questions.length > 0);
}

/** Freeze the available exercises at assignment time, never silently add new homework. */
export function selectedTestExerciseIds(test: TestDefinition, selection: string[] | null): string[] {
  const ready = readyTestExercises(test);
  if (selection === null) return ready.map((exercise) => exercise.id);
  if (!Array.isArray(selection) || !selection.length || selection.length > test.exercises.length) return [];
  const unique = new Set(selection);
  if ([...unique].some((id) => !ready.some((exercise) => exercise.id === id))) return [];
  return ready.filter((exercise) => unique.has(exercise.id)).map((exercise) => exercise.id);
}

export function testResultsScore(results: TestResults, exerciseIds: string[]) {
  const checked = exerciseIds.flatMap((id) => results[id] ? [results[id]] : []);
  const correct = checked.reduce((sum, result) => sum + result.correct, 0);
  const total = checked.reduce((sum, result) => sum + result.total, 0);
  return { correct, total, percent: total ? Math.round(correct * 100 / total) : 0,
    checkedExerciseIds: checked.map((result) => result.exerciseId),
    complete: exerciseIds.length > 0 && checked.length === exerciseIds.length };
}
