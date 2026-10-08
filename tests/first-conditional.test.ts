import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_CONDITIONAL, TEST_CATALOG, findLibraryTest } from "../src/lib/tests/catalog";
import { FIRST_CONDITIONAL_KEY, gradeTestExercise } from "../src/lib/tests/grading";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { selectedTestExerciseIds, testResultsScore } from "../src/lib/tests/types";
import { TestExerciseQuestions } from "../src/components/tests/test-exercise-form";
import { TestExerciseReview, TestScore } from "../src/components/tests/test-result-view";
import { groupTeacherHomeworkContent, groupTeacherHomeworkDates } from "../src/lib/teacher-homework-groups";

const definition = FIRST_CONDITIONAL;
const exercise = definition.exercises[0];
const key = FIRST_CONDITIONAL_KEY;
const correct = Object.fromEntries(Object.entries(key[exercise.id]).map(([id, item]) => [id, item.answer]));

test("First conditional is in B1 Grammar with three distinct exercise slots", () => {
  assert.equal(findLibraryTest("first-conditional"), definition);
  assert.equal(findLibraryTest("unknown"), null);
  assert.equal(TEST_CATALOG.filter((item) => item.level === "b1" && item.category === "grammar").length, 1);
  assert.deepEqual(definition.exercises.map((item) => item.number), [1, 2, 3]);
  assert.equal(new Set(definition.exercises.map((item) => item.id)).size, 3);
  assert.equal(exercise.questions.length, 10);
});

test("all ten supplied sentences and choices are kept, with the expected answer key", () => {
  assert.deepEqual(exercise.questions.map((item) => item.before + "___" + item.after), [
    "I ___ you an answer when I have one.", "I'll call you as soon as I ___.",
    "When you read this email, I ___ on a plane to Germany.", "I won't stay unless you ___.",
    "If you don't find him, you ___.", "He won't stop until he ___ what he wants.",
    "___ if I give you the address?", "If he knows that you are here, he ___ to contact you.",
    "When I ___ old enough, I'll travel around the world.", "I'll sort this problem once I ___ back.",
  ]);
  assert.deepEqual(Object.values(correct), ["will give", "arrive", "will be", "stay", "should call", "gets", "will you go", "might try", "am", "am"]);
  assert.deepEqual(exercise.questions.map((item) => item.options), [
    ["will give", "would give", "give"], ["will arrive", "I'm arriving", "arrive"], ["am", "will be", "would be"],
    ["should stay", "will stay", "stay"], ["should call", "would call", "call"], ["gets", "does get", "will get"],
    ["do you go", "you will go", "will you go"], ["tries", "does try", "might try"], ["am", "will be", "would be"], ["would be", "will be", "am"],
  ]);
});

test("ten correct answers score 100%; all omissions score 0% and remain ten errors", () => {
  const full = gradeTestExercise(definition, key, exercise.id, correct);
  assert.equal(full.percent, 100); assert.equal(full.correct, 10); assert.equal(full.total, 10);
  const none = gradeTestExercise(definition, key, exercise.id, {});
  assert.equal(none.percent, 0); assert.equal(none.total, 10);
  assert.ok(none.questions.every((item) => !item.correct && item.selected === null));
  for (const item of none.questions) for (const locale of ["en", "ru", "uk"] as const) assert.ok(item.explanation[locale].length > 40);
});

test("every score from zero to 100 is calculated from correct answers, not answered questions", () => {
  for (let count = 0; count <= 10; count++) {
    const answers = Object.fromEntries(Object.entries(correct).slice(0, count));
    const result = gradeTestExercise(definition, key, exercise.id, answers);
    assert.equal(result.percent, count * 10);
    assert.equal(result.questions.filter((item) => !item.correct).length, 10 - count);
  }
  assert.equal(gradeTestExercise(definition, key, exercise.id, { q1: "", q2: null }).percent, 0);
});

test("every distractor gets its own grammatical explanation in all three interface languages", () => {
  for (const question of exercise.questions) for (const option of question.options) {
    const result = gradeTestExercise(definition, key, exercise.id, { ...correct, [question.id]: option });
    const row = result.questions.find((item) => item.id === question.id)!;
    assert.equal(row.correct, option === correct[question.id]);
    assert.equal(row.selected, option); assert.equal(row.answer, correct[question.id]);
    for (const locale of ["en", "ru", "uk"] as const) assert.ok(row.explanation[locale].trim().length > 30);
  }
  const emphatic = gradeTestExercise(definition, key, exercise.id, { ...correct, q6: "does get" }).questions[5];
  assert.ok(emphatic.explanation.en.includes("can add emphasis"));
});

test("invalid exercises and forged option values cannot produce scores", () => {
  for (const id of ["exercise-2", "exercise-3", "missing"]) assert.throws(() => gradeTestExercise(definition, key, id, {}));
  assert.throws(() => gradeTestExercise(definition, key, exercise.id, { q1: "<script>fake</script>" }));
  assert.throws(() => gradeTestExercise(definition, {}, exercise.id, correct));
});

test("whole or selected assignment includes only published exercises and never duplicates them", () => {
  assert.deepEqual(selectedTestExerciseIds(definition, null), ["exercise-1"]);
  assert.deepEqual(selectedTestExerciseIds(definition, ["exercise-1", "exercise-1"]), ["exercise-1"]);
  for (const selection of [[], ["exercise-2"], ["exercise-1", "unknown"]]) assert.deepEqual(selectedTestExerciseIds(definition, selection), []);
  const published = { ...definition, exercises: definition.exercises.map((item) => ({ ...item, questions: exercise.questions })) };
  assert.deepEqual(selectedTestExerciseIds(published, null), ["exercise-1", "exercise-2", "exercise-3"]);
  assert.deepEqual(selectedTestExerciseIds(published, ["exercise-3", "exercise-1"]), ["exercise-1", "exercise-3"]);
});

test("overall score is weighted by question counts, excludes unassigned exercises and completes only after all checks", () => {
  const first = gradeTestExercise(definition, key, exercise.id, correct);
  const second = { ...first, exerciseId: "exercise-2", total: 5, correct: 0, percent: 0 };
  const partial = testResultsScore({ "exercise-1": first }, ["exercise-1", "exercise-2"]);
  assert.equal(partial.complete, false); assert.equal(partial.percent, 100);
  const full = testResultsScore({ "exercise-1": first, "exercise-2": second }, ["exercise-1", "exercise-2"]);
  assert.equal(full.complete, true); assert.equal(full.percent, 67); assert.equal(full.total, 15);
  assert.equal(testResultsScore({ "exercise-1": first, "exercise-2": second }, ["exercise-2"]).percent, 0);
  assert.equal(testResultsScore({}, []).complete, false);
});

test("exercise renders blank accessible dropdowns that only offer the original three answers", () => {
  const html = renderToStaticMarkup(createElement(TestExerciseQuestions, { testId: definition.id, exercise,
    answers: {}, busy: false, onAnswer: () => {} }));
  assert.equal((html.match(/<select /g) ?? []).length, 10);
  assert.equal((html.match(/<option /g) ?? []).length, 40);
  assert.equal((html.match(/<option value="" hidden="" selected=""><\/option>/g) ?? []).length, 10);
  assert.equal((html.match(/aria-label=/g) ?? []).length, 10);
  assert.equal((html.match(/min-w-28/g) ?? []).length, 10);
  assert.ok(!html.includes("required="));
  assert.ok(!html.includes("disabled="));
  for (const labels of Object.values(TEST_LABELS)) {
    assert.ok(!html.includes(labels.choose));
  }
  const selectedHtml = renderToStaticMarkup(createElement(TestExerciseQuestions, { testId: definition.id, exercise,
    answers: correct, busy: true, onAnswer: () => {} }));
  assert.equal((selectedHtml.match(/disabled=""/g) ?? []).length, 10);
  assert.equal((selectedHtml.match(/ selected=""/g) ?? []).length, 10);
  assert.equal((selectedHtml.match(/<option value="" hidden=""><\/option>/g) ?? []).length, 10);
});

test("results show every unanswered sentence, correct answer and reason, and a large zero percent", () => {
  const result = gradeTestExercise(definition, key, exercise.id, {});
  for (const locale of ["en", "ru", "uk"] as const) {
    const labels = TEST_LABELS[locale];
    const html = renderToStaticMarkup(createElement(TestExerciseReview, { exercise, result, locale, labels }));
    assert.equal((html.match(/data-test-question-result="no-answer"/g) ?? []).length, 10);
    assert.equal((html.match(/No answer/g) ?? []).length >= 10, true);
    assert.equal(html.split(labels.correctAnswer).length - 1, 10);
    const score = renderToStaticMarkup(createElement(TestScore, { percent: 0, correct: 0, total: 10, title: labels.completed, labels }));
    assert.ok(score.includes("0%")); assert.ok(score.includes("0/10")); assert.ok(score.includes("text-5xl"));
  }
});

test("all correct results have no error explanations and use the success theme token", () => {
  const result = gradeTestExercise(definition, key, exercise.id, correct);
  const html = renderToStaticMarkup(createElement(TestExerciseReview, { exercise, result, locale: "en", labels: TEST_LABELS.en }));
  assert.equal((html.match(/data-test-question-result="correct"/g) ?? []).length, 10);
  assert.ok(html.includes(TEST_LABELS.en.noErrors));
  assert.ok(html.includes("var(--t-green)"));
  assert.ok(!html.includes("color-mix(in srgb, var(--t-rose)"));
});

test("tests participate in teacher date and type grouping without dropping other homework", () => {
  const rows = [{ id: "t", kind: "TEST" as const, activityType: "TEST", assignedAt: "2026-10-09T10:00:00Z" },
    { id: "l", kind: "LESSON" as const, assignedAt: "2026-10-09T10:00:00Z" }];
  const groups = groupTeacherHomeworkContent(groupTeacherHomeworkDates(rows)[0].items);
  assert.equal(groups[0].items[0].id, "l");
  assert.equal(groups[1].activityGroups[0].type, "TEST");
  assert.equal(groups[1].activityGroups[0].items[0].id, "t");
});

test("server boundaries keep keys private and authorize every assigned test and attempt", () => {
  const actions = readFileSync("src/lib/actions/tests.ts", "utf8");
  const reader = actions.slice(actions.indexOf("export async function assignedTestDetailAction"));
  assert.ok(actions.startsWith('"use server"'));
  assert.ok(actions.includes('session?.role !== "STUDENT"'));
  assert.ok(actions.includes('session?.role !== "TEACHER"'));
  assert.ok(actions.includes("eq(testAssignments.studentId, session.userId)"));
  assert.ok(actions.includes("eq(testAssignments.teacherId, session.userId)"));
  assert.ok(actions.includes('eq(users.role, "STUDENT")'));
  assert.ok(!reader.includes("grading:"));
  for (const file of ["test-runner.tsx", "test-practice.tsx", "test-assigner.tsx", "assigned-test-view.tsx", "tests-library-view.tsx"]) {
    const source = readFileSync(`src/components/tests/${file}`, "utf8");
    assert.ok(!source.includes("tests/grading")); assert.ok(!source.includes("FIRST_CONDITIONAL_KEY"));
  }
});

test("persistence is additive, first checks are immutable, concurrent exercises merge, and retries are idempotent", () => {
  const schema = readFileSync("src/lib/db/tests-storage-schema.ts", "utf8");
  assert.equal((schema.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length, 2);
  assert.ok(!/^\s*(DROP |TRUNCATE |DELETE FROM |UPDATE )/im.test(schema));
  const actions = readFileSync("src/lib/actions/tests.ts", "utf8");
  const persistence = readFileSync("src/lib/tests/persistence.ts", "utf8");
  assert.ok(persistence.includes('for("update")'));
  assert.ok(persistence.includes("if (current.results[result.exerciseId]) return serialTestAttempt(current)"));
  assert.ok(persistence.includes("{ ...current.results, [result.exerciseId]: result }"));
  assert.ok(actions.includes("db.transaction((tx) => saveTestExerciseCheck"));
  assert.ok(actions.includes("onConflictDoNothing()"));
  const practice = actions.slice(actions.indexOf("export async function checkPracticeTestAction"), actions.indexOf("export async function checkAssignedTestAction"));
  assert.ok(!practice.includes("db.")); assert.ok(!practice.includes("revalidatePath"));
  const runner = readFileSync("src/components/tests/test-runner.tsx", "utf8");
  assert.ok(runner.includes("attemptId.current ??= crypto.randomUUID()"));
  assert.ok(runner.includes("setActiveId(exercise.id)")); assert.ok(!runner.includes("router.push"));
  assert.ok(runner.indexOf("TestExerciseQuestions testId") < runner.indexOf('type="submit"'));
});
