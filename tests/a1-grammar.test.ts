import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { A1_GRAMMAR_TESTS } from "../src/lib/tests/a1-grammar-tests";
import { A1_GRAMMAR_KEYS } from "../src/lib/tests/a1-grammar-keys";
import { FOLDER_TESTS } from "../src/lib/tests/folder-tests";
import { FOLDER_TEST_KEYS } from "../src/lib/tests/folder-test-keys";
import { TEST_CATALOG, findLibraryTest } from "../src/lib/tests/catalog";
import { gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import { selectedTestExerciseIds } from "../src/lib/tests/types";
import { TestExerciseQuestions } from "../src/components/tests/test-exercise-form";
import { TestExerciseReview } from "../src/components/tests/test-result-view";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { parseTestEnglishExercise } from "../scripts/lib/test-english-html";

test("A1 has all 36 unique topics, 111 exercises and 1238 answer fields", () => {
  assert.equal(A1_GRAMMAR_TESTS.length, 36);
  assert.equal(A1_GRAMMAR_TESTS.flatMap(t => t.exercises).length, 111);
  assert.equal(A1_GRAMMAR_TESTS.flatMap(t => t.exercises.flatMap(e => e.questions)).length, 1238);
  assert.equal(new Set(TEST_CATALOG.map(t => t.id)).size, TEST_CATALOG.length);
  assert.equal(TEST_CATALOG.filter(t => t.level === "a1" && t.category === "grammar").length, 36);
});
test("existing IDs and answer keys are compatible; historical adjectives v1 stays at two exercises", () => {
  for (const old of FOLDER_TESTS.filter(t => t.level === "a1")) {
    const current = findLibraryTest(old.id)!;
    assert.equal(current.title, old.title);
    assert.deepEqual(current.cover, old.cover);
    assert.equal(libraryTestKey(old.id, 1), FOLDER_TEST_KEYS[old.id]);
    for (const exercise of old.exercises) assert.deepEqual(A1_GRAMMAR_KEYS[old.id][exercise.id], FOLDER_TEST_KEYS[old.id][exercise.id]);
  }
  assert.equal(findLibraryTest("a1-adjectives")!.version, 2);
  assert.equal(Object.keys(libraryTestKey("a1-adjectives", 1)!).length, 2);
  assert.equal(Object.keys(libraryTestKey("a1-adjectives", 2)!).length, 3);
  assert.deepEqual(selectedTestExerciseIds(findLibraryTest("a1-adjectives")!, ["exercise-1", "exercise-2"]), ["exercise-1", "exercise-2"]);
});
for (const definition of A1_GRAMMAR_TESTS) {
  test(definition.id + ": complete keys, assignment and local cover", () => {
    assert.ok(existsSync("public" + definition.cover.src));
    assert.equal(libraryTestKey(definition.id, definition.version), A1_GRAMMAR_KEYS[definition.id]);
    assert.deepEqual(selectedTestExerciseIds(definition, null), definition.exercises.map(e => e.id));
    assert.deepEqual(Object.keys(A1_GRAMMAR_KEYS[definition.id]), definition.exercises.map(e => e.id));
  });
  for (const exercise of definition.exercises) {
    test(definition.id + "/" + exercise.id + ": full/empty/partial scoring, alternatives and explanation", () => {
      const key = A1_GRAMMAR_KEYS[definition.id][exercise.id];
      assert.deepEqual(Object.keys(key), exercise.questions.map(q => q.id));
      const answers = Object.fromEntries(exercise.questions.map(q => [q.id, key[q.id].answer]));
      assert.equal(gradeTestExercise(definition, A1_GRAMMAR_KEYS[definition.id], exercise.id, answers).percent, 100);
      assert.equal(gradeTestExercise(definition, A1_GRAMMAR_KEYS[definition.id], exercise.id, {}).percent, 0);
      assert.equal(gradeTestExercise(definition, A1_GRAMMAR_KEYS[definition.id], exercise.id, { [exercise.questions[0].id]: key[exercise.questions[0].id].answer }).correct, 1);
      for (const question of exercise.questions) {
        const item = key[question.id];
        for (const locale of ["en", "ru", "uk"] as const) assert.ok(item.rule[locale].length > 30);
        for (const accepted of item.acceptedAnswers ?? []) assert.equal(gradeTestExercise(definition, A1_GRAMMAR_KEYS[definition.id], exercise.id, { ...answers, [question.id]: accepted }).questions.find(q => q.id === question.id)!.correct, true);
      }
    });
    test(definition.id + "/" + exercise.id + ": every field, word bank, underlined clue and image renders", () => {
      const html = renderToStaticMarkup(createElement(TestExerciseQuestions, { testId: definition.id, exercise, answers: {}, busy: false, onAnswer() {} }));
      for (const q of exercise.questions) {
        if (q.prompt) assert.ok(html.includes("<fieldset"));
        else assert.equal(html.split('id="test-' + definition.id + "-" + exercise.id + "-" + q.id + '"').length - 1, 1);
      }
      if (exercise.context) assert.ok(html.includes("data-test-exercise-context"));
      if (exercise.instruction.includes("⟦")) assert.ok(html.includes("⟦") && html.includes("⟧"));
      const images = [...exercise.images ?? [], ...exercise.questions.flatMap(q => q.images ?? [])];
      for (const image of images) {
        assert.ok(image.src.startsWith("/images/tests/"));
        assert.ok(existsSync("public" + image.src), image.src);
        assert.ok(html.includes(image.src));
      }
      const result = gradeTestExercise(definition, A1_GRAMMAR_KEYS[definition.id], exercise.id, {});
      const review = renderToStaticMarkup(createElement(TestExerciseReview, { exercise, result, locale: "ru", labels: TEST_LABELS.ru }));
      assert.equal((review.match(/data-test-question-result="no-answer"/g) ?? []).length, exercise.questions.length);
      assert.ok(!review.includes("<script"));
    });
  }
}
test("public A1 definitions never include answer keys or original scripts/session fields", () => {
  const source = readFileSync("src/lib/tests/a1-grammar-tests.ts", "utf8");
  for (const token of ["a1-grammar-key", '"answer":', '"acceptedAnswers":', "<script", "onclick", "start_timestamp", "quiz_id"]) assert.ok(!source.includes(token));
  assert.equal(libraryTestKey("__proto__", 1), null);
  assert.equal(libraryTestKey("a1-questions", 2), null);
});
test("parser preserves underlines and context while normalizing identical radio choices", () => {
  const html = '<h5>Choose.</h5><p>Word bank: read / write</p><div id="watupro_quiz"><form class="quiz-form"><div class="watu-question"><div class="question-content"><p>I read <u>books</u>. What do you <input type="text" />?</p></div></div></form></div>';
  const exercise = parseTestEnglishExercise(html, 1, true);
  assert.ok(exercise.context?.includes("Word bank"));
  assert.ok(exercise.questions[0].before.includes("⟦books⟧"));
});
const sourceRoot = process.env.TEST_ENGLISH_A1_SOURCE;
test("all 111 original page hashes still match; local sources were never rewritten", { skip: !sourceRoot }, () => {
  const manifest = JSON.parse(readFileSync("docs/assets/a1-grammar-import.json", "utf8"));
  for (const topic of manifest.tests) for (const page of topic.pages) {
    const html = readFileSync(join(sourceRoot!, page.file), "utf8");
    assert.equal(createHash("sha256").update(html).digest("hex"), page.sha256);
  }
});
