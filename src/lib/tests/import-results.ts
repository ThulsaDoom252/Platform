/** Offline, teacher-authorised import only. Never import this answer-key module in client code. */
import { z } from "zod";
import { findLibraryTest } from "./catalog";
import { gradeTestExercise, libraryTestKey } from "./grading";
import { testResultsScore, type TestResults } from "./types";

const uuid = z.string().uuid();
const answer = z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(200)).min(1).max(5)]);
const evidence = z.object({
  exerciseId: z.string().min(1), file: z.string().min(1).max(240),
  answers: z.record(z.string(), answer), scoreUnit: z.enum(["answer", "sentence"]),
  correct: z.number().int().nonnegative(), total: z.number().int().positive(),
  wrongQuestionIds: z.array(z.string()),
}).strict();
export const testResultsImportSchema = z.object({
  student: z.object({ id: uuid, name: z.string().min(1) }).strict(),
  teacher: z.object({ id: uuid, name: z.string().min(1) }).strict(),
  importedAt: z.string().datetime(),
  tests: z.array(z.object({
    assignmentId: uuid, testId: z.string().min(1), version: z.number().int().positive(),
    attempts: z.array(z.object({ id: uuid, exercises: z.array(evidence).min(1) }).strict()).min(1),
  }).strict()).min(1),
}).strict();

/** Recompute and verify the screenshots, instead of trusting supplied percentages or filling missing answers. */
export function prepareTestResultsImport(raw: unknown) {
  const manifest = testResultsImportSchema.parse(raw);
  const ids = new Set<string>();
  const testIds = new Set<string>();
  const register = (id: string) => {
    if (ids.has(id)) throw new Error("Duplicate import ID");
    ids.add(id);
  };
  const tests = manifest.tests.map((item) => {
    register(item.assignmentId);
    if (testIds.has(item.testId)) throw new Error("Duplicate test");
    testIds.add(item.testId);
    const definition = findLibraryTest(item.testId);
    if (!definition || definition.version !== item.version) throw new Error("Test version mismatch");
    const grading = libraryTestKey(item.testId, item.version);
    if (!grading) throw new Error("Missing answer key");
    const exerciseIds = definition.exercises.filter((exercise) => exercise.questions.length).map((exercise) => exercise.id);
    const attempts = item.attempts.map((attempt, index) => {
      register(attempt.id);
      const results: TestResults = {};
      for (const input of attempt.exercises) {
        const exercise = definition.exercises.find((value) => value.id === input.exerciseId);
        if (!exercise?.questions.length || results[input.exerciseId]) throw new Error("Invalid or duplicate exercise");
        const knownIds = exercise.questions.map((question) => question.id);
        if (Object.keys(input.answers).length !== knownIds.length || knownIds.some((id) => !Object.hasOwn(input.answers, id))) throw new Error("Missing or extra answers");
        const result = gradeTestExercise(definition, grading, exercise.id, input.answers);
        const wrongIds = result.questions.filter((question) => !question.correct).map((question) => question.id);
        if (JSON.stringify([...wrongIds].sort()) !== JSON.stringify([...input.wrongQuestionIds].sort())) throw new Error(`Mistakes mismatch: ${exercise.id}`);
        if (input.scoreUnit === "sentence") {
          const groups = exercise.passage?.map((line) => line.flatMap((part) => "questionId" in part ? [part.questionId] : []));
          const groupedIds = groups?.flat() ?? [];
          if (!groups?.length || groups.some((group) => group.length !== 2) || new Set(groupedIds).size !== knownIds.length
            || groupedIds.length !== knownIds.length || groupedIds.some((id) => !knownIds.includes(id))) throw new Error("Invalid sentence scoring");
          result.total = groups.length;
          result.correct = groups.filter((group) => group.every((id) => result.questions.find((question) => question.id === id)?.correct)).length;
          result.percent = Math.round(result.correct * 100 / result.total);
        }
        if (result.correct !== input.correct || result.total !== input.total) throw new Error(`Screenshot score mismatch: ${exercise.id}`);
        result.source = { name: "Test-English", file: input.file, importedAt: manifest.importedAt, scoreUnit: input.scoreUnit };
        results[exercise.id] = result;
      }
      if (Object.keys(results).length !== exerciseIds.length || exerciseIds.some((id) => !results[id])) throw new Error("All exercises are required for a completed import");
      const score = testResultsScore(results, exerciseIds);
      const importedAt = new Date(new Date(manifest.importedAt).getTime() + index);
      return { id: attempt.id, assignmentId: item.assignmentId, results, checkedExerciseIds: score.checkedExerciseIds,
        correct: score.correct, total: score.total, percent: score.percent, createdAt: importedAt, completedAt: importedAt };
    });
    return { assignment: { id: item.assignmentId, studentId: manifest.student.id, teacherId: manifest.teacher.id,
      testId: definition.id, definition: structuredClone(definition), grading: structuredClone(grading), exerciseIds, assignedAt: new Date(manifest.importedAt), dueAt: null }, attempts };
  });
  return { manifest, tests };
}
