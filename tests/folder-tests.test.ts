import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FOLDER_TESTS } from "../src/lib/tests/folder-tests";
import { FOLDER_TEST_KEYS } from "../src/lib/tests/folder-test-keys";
import { gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import { selectedTestExerciseIds, testResultsScore, type TestAnswers, type TestResults } from "../src/lib/tests/types";
import { TestExerciseQuestions } from "../src/components/tests/test-exercise-form";
import { TestExerciseReview } from "../src/components/tests/test-result-view";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { parseTestEnglishExercise } from "../scripts/lib/test-english-html";

test("the six source tests have exactly 18 ready exercises and all 234 questions/gaps", () => {
  assert.deepEqual(FOLDER_TESTS.map((item) => [item.id, item.exercises.map((exercise) => exercise.questions.length)]), [
    ["a1-to-be", [20, 10, 20, 20]], ["a1-a-an-plurals", [10, 10, 20]], ["a1-demonstratives", [10, 10, 10]],
    ["a1-possessives", [14, 10, 10]], ["a1-adjectives", [10, 10]], ["third-conditional", [10, 10, 20]],
  ]);
  assert.equal(FOLDER_TESTS.flatMap((item) => item.exercises).length, 18);
  assert.equal(FOLDER_TESTS.flatMap((item) => item.exercises.flatMap((exercise) => exercise.questions)).length, 234);
});
for (const definition of FOLDER_TESTS) {
  test(`${definition.id}: stable catalog version, all/individual exercise assignment and server-only keys`, () => {
    const key = libraryTestKey(definition.id, 1);
    assert.equal(key, FOLDER_TEST_KEYS[definition.id]);
    if (definition.id === "a1-adjectives") assert.ok(libraryTestKey(definition.id, 2)?.["exercise-3"]);
    else assert.equal(libraryTestKey(definition.id, 2), null);
    assert.deepEqual(selectedTestExerciseIds(definition, null), definition.exercises.map((exercise) => exercise.id));
    for (const exercise of definition.exercises) assert.deepEqual(selectedTestExerciseIds(definition, [exercise.id]), [exercise.id]);
    assert.deepEqual(selectedTestExerciseIds(definition, ["unknown"]), []);
    assert.equal(Object.keys(key!).length, definition.exercises.length);
  });
  for (const exercise of definition.exercises) {
    test(`${definition.id}/${exercise.id}: 0%, 100%, partial answers, alternatives and explanations in all languages`, () => {
      const key = FOLDER_TEST_KEYS[definition.id];
      assert.deepEqual(Object.keys(key[exercise.id]), exercise.questions.map((question) => question.id));
      const answers = Object.fromEntries(exercise.questions.map((question) => [question.id, key[exercise.id][question.id].answer]));
      assert.equal(gradeTestExercise(definition, key, exercise.id, answers).percent, 100);
      const empty = gradeTestExercise(definition, key, exercise.id, {});
      assert.equal(empty.percent, 0); assert.equal(empty.total, exercise.questions.length);
      assert.ok(empty.questions.every((question) => !question.correct && question.selected === null));
      const partial: TestAnswers = { [exercise.questions[0].id]: answers[exercise.questions[0].id] };
      assert.equal(gradeTestExercise(definition, key, exercise.id, partial).percent, Math.round(100 / exercise.questions.length));
      for (const question of exercise.questions) {
        const item = key[exercise.id][question.id];
        for (const locale of ["en", "ru", "uk"] as const) assert.ok(item.rule[locale].trim().length > 30);
        for (const alternative of item.acceptedAnswers ?? []) assert.equal(gradeTestExercise(definition, key, exercise.id, { ...answers, [question.id]: alternative }).questions.find((row) => row.id === question.id)!.correct, true);
        const wrong = question.kind === "text" ? "definitely wrong" : question.options.find((option) => ![item.answer, ...(item.acceptedAnswers ?? [])].flat().includes(option));
        if (wrong) assert.equal(gradeTestExercise(definition, key, exercise.id, { ...answers, [question.id]: question.kind === "multiple" ? [wrong] : wrong }).questions.find((row) => row.id === question.id)!.correct, false);
      }
    });
    test(`${definition.id}/${exercise.id}: every gap or radio group renders once; No answer has no removed warning`, () => {
      const html = renderToStaticMarkup(createElement(TestExerciseQuestions, { testId: definition.id, exercise, answers: {}, busy: false, onAnswer() {} }));
      for (const question of exercise.questions) {
        const id = `test-${definition.id}-${exercise.id}-${question.id}`;
        if (question.kind === "multiple" || question.prompt) assert.ok(html.includes("<fieldset"));
        else assert.equal(html.split(`id="${id}"`).length - 1, 1);
      }
      assert.ok(!html.includes("Choose an answer"));
      const result = gradeTestExercise(definition, FOLDER_TEST_KEYS[definition.id], exercise.id, {});
      const review = renderToStaticMarkup(createElement(TestExerciseReview, { exercise, result, locale: "ru", labels: TEST_LABELS.ru }));
      assert.equal((review.match(/data-test-question-result="no-answer"/g) ?? []).length, exercise.questions.length);
      assert.ok(review.includes("No answer"));
      assert.ok(!review.includes("No answer was selected") && !review.includes("Это считается ошибкой"));
    });
  }
}
test("to be preserves the whole dialogue, and its final positive short answer cannot contract", () => {
  const definition = FOLDER_TESTS[0], exercise = definition.exercises[3], key = FOLDER_TEST_KEYS[definition.id];
  assert.ok(JSON.stringify(exercise.passage).includes("Very nice"));
  const answers = Object.fromEntries(exercise.questions.map((question) => [question.id, key[exercise.id][question.id].answer]));
  assert.equal(gradeTestExercise(definition, key, exercise.id, { ...answers, q19: "'s" }).questions[18].correct, false);
});
test("four exercises combine into one final 0–100% result and selected exercises stay frozen", () => {
  const definition = FOLDER_TESTS[0], key = FOLDER_TEST_KEYS[definition.id], results: TestResults = {};
  for (const exercise of definition.exercises) {
    results[exercise.id] = gradeTestExercise(definition, key, exercise.id, Object.fromEntries(exercise.questions.map((question) => [question.id, key[exercise.id][question.id].answer])));
  }
  assert.deepEqual(testResultsScore(results, selectedTestExerciseIds(definition, null)), { correct: 70, total: 70, percent: 100, checkedExerciseIds: definition.exercises.map((exercise) => exercise.id), complete: true });
  assert.equal(testResultsScore(results, ["exercise-4"]).total, 20);
});
test("text answers tolerate case, typographic apostrophes, whitespace and optional terminal punctuation", () => {
  const definition = FOLDER_TESTS[0], key = FOLDER_TEST_KEYS[definition.id];
  for (const value of ["SHES NOT", "amn't"]) assert.equal(gradeTestExercise(definition, key, "exercise-3", { q1: value }).questions[0].correct, false);
  assert.equal(gradeTestExercise(definition, key, "exercise-3", { q1: "  SHE’S  NOT. " }).questions[0].correct, true);
  assert.equal(gradeTestExercise(definition, key, "exercise-3", { q2: "Is she?" }).questions[1].correct, true);
  assert.equal(gradeTestExercise(definition, key, "exercise-2", { q1: "She is" }).questions[0].correct, false);
});
test("keys cannot leak into the public definitions and invalid submitted choices are still rejected", () => {
  const source = readFileSync("src/lib/tests/folder-tests.ts", "utf8");
  for (const forbidden of ["folder-test-keys", '"answer":', '"acceptedAnswers":', "<script", "onclick", "start_timestamp", "quiz_id"]) assert.ok(!source.includes(forbidden));
  const definition = FOLDER_TESTS[0];
  assert.throws(() => gradeTestExercise(definition, FOLDER_TEST_KEYS[definition.id], "exercise-1", { q1: "not an option" }), /Invalid answer/);
  assert.equal(libraryTestKey("__proto__", 1), null);
});
test("inert source parser preserves paired gaps, drops counters/hidden fields and never executes scripts", () => {
  const html = `<h5>Choose a form.</h5><div id="watupro_quiz"><form class="quiz-form"><div class="watu-question"><div class="question-content"><p><span class="watupro_num">1 </span>I <select><option></option><option>am</option><option>is</option></select> happy &amp; you <input type="text"/> too.</p><input type="hidden" name="secret" value="never-copy"/><script>throw new Error('never-execute')</script></div></div></form></div>`;
  const exercise = parseTestEnglishExercise(html, 4);
  assert.equal(exercise.number, 4); assert.equal(exercise.questions.length, 2);
  assert.deepEqual(exercise.questions[0].options, ["am", "is"]);
  assert.ok(JSON.stringify(exercise.passage).includes("happy & you"));
  assert.ok(!JSON.stringify(exercise).includes("secret") && !JSON.stringify(exercise).includes("never-execute"));
  assert.throws(() => parseTestEnglishExercise(html.replace("I <select>", 'I <img src="unknown.png"/><select>'), 1), /image requires explicit import/);
});
const sourceRoot = process.env.TEST_ENGLISH_SOURCE;
test("all source-page hashes and extracted definitions match the supplied folder", { skip: !sourceRoot }, () => {
  const manifest = JSON.parse(readFileSync("docs/assets/test-english-folder-import.json", "utf8"));
  for (const source of manifest.tests) {
    const definition = FOLDER_TESTS.find((item) => item.id === source.id)!;
    for (const page of source.pages) {
      const html = readFileSync(join(sourceRoot!, page.file), "utf8");
      assert.equal(createHash("sha256").update(html).digest("hex"), page.sha256);
      assert.deepEqual(parseTestEnglishExercise(html, page.exercise), definition.exercises.find((exercise) => exercise.number === page.exercise));
    }
  }
});
