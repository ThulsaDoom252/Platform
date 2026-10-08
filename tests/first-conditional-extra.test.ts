import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_CONDITIONAL } from "../src/lib/tests/catalog";
import { FIRST_CONDITIONAL_KEY, gradeTestExercise } from "../src/lib/tests/grading";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { testAnswerText, testResultsScore, type TestAnswers } from "../src/lib/tests/types";
import { TestExerciseQuestions, toggleTestChoice } from "../src/components/tests/test-exercise-form";
import { TestExerciseReview } from "../src/components/tests/test-result-view";

const [first, second, third] = FIRST_CONDITIONAL.exercises;
const answersFor = (exerciseId: string): TestAnswers => Object.fromEntries(Object.entries(FIRST_CONDITIONAL_KEY[exerciseId]).map(([id, key]) => [id, key.answer]));
const grade = (exerciseId: string, answers: TestAnswers) => gradeTestExercise(FIRST_CONDITIONAL, FIRST_CONDITIONAL_KEY, exerciseId, answers);

test("exercise 2 preserves all ten supplied sentences, choices and four double-answer questions", () => {
  assert.deepEqual(second.questions.map((row) => row.before + "___" + row.after), [
    "If you aren't careful, you ___ hurt.", "What will happen if the parachute ___?",
    "I won't sign up for the dancing competition unless Jack ___ my partner.",
    "When you ___ Tom, tell him I want to see him.", "If they make a good offer, I ___ the house.",
    "If the people don't come, we ___ to cancel the party.", "Please, can you close the windows before you ___.",
    "He'll try to get money from you if he ___ you've won the lottery.", "Before you say anything, ___.",
    "He won't ask for help unless it ___ absolutely necessary.",
  ]);
  assert.deepEqual(second.questions.map((row) => row.options), [
    ["might get", "get", "will get"], ["doesn't open", "won't open", "might not open"], ["is", "must be", "will be"],
    ["will see", "see", "might see"], ["should buy", "buy", "will buy"], ["might have", "have", "'ll have"],
    ["must leave", "leave", "will leave"], ["knows", "will know", "would know"],
    ["let me explain", "you must listen to me", "you listen to me"], ["is", "will be", "might be"],
  ]);
  assert.deepEqual(second.questions.filter((row) => row.kind === "multiple").map((row) => [row.id, row.selectionCount]), [["q1", 2], ["q5", 2], ["q6", 2], ["q9", 2]]);
  assert.deepEqual(Object.values(answersFor(second.id)), [
    ["might get", "will get"], "doesn't open", "is", "see", ["should buy", "will buy"], ["might have", "'ll have"],
    "leave", "knows", ["let me explain", "you must listen to me"], "is",
  ]);
});

test("double answers are order-independent and award one point only for the complete correct pair", () => {
  const correct = answersFor(second.id);
  assert.equal(grade(second.id, correct).percent, 100);
  assert.equal(grade(second.id, { ...correct, q1: ["will get", "might get"] }).percent, 100);
  for (const value of [["might get"], ["might get", "get"], [], null]) {
    const result = grade(second.id, { ...correct, q1: value });
    assert.equal(result.percent, 90); assert.equal(result.total, 10); assert.equal(result.questions[0].correct, false);
  }
  for (const value of [["might get", "might get"], ["might get", "get", "will get"], ["fake"], "might get"]) {
    assert.throws(() => grade(second.id, { ...correct, q1: value }));
  }
  assert.throws(() => grade(second.id, { ...correct, q2: ["doesn't open"] }));
});

test("checkbox toggling supports deselection, limits selections and keeps selected controls available", () => {
  const question = second.questions[0];
  const one = toggleTestChoice(question, null, "might get");
  const two = toggleTestChoice(question, one, "will get");
  assert.deepEqual(two, ["might get", "will get"]);
  assert.deepEqual(toggleTestChoice(question, two, "get"), two);
  assert.deepEqual(toggleTestChoice(question, two, "will get"), one);
  assert.equal(toggleTestChoice(question, one, "might get"), null);
  assert.deepEqual(toggleTestChoice(question, one, "fake"), one);
  const html = renderToStaticMarkup(createElement(TestExerciseQuestions, {
    testId: FIRST_CONDITIONAL.id, exercise: second, answers: { q1: two }, busy: false, onAnswer: () => {},
  }));
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 12);
  assert.equal((html.match(/<select /g) ?? []).length, 6);
  assert.equal((html.match(/<fieldset /g) ?? []).length, 4);
  assert.equal((html.match(/checked=""/g) ?? []).length, 2);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 1);
  assert.equal((html.match(/Choose TWO correct options/g) ?? []).length, 4);
});

test("exercise 3 preserves the complete letter, fifteen ordered gaps and the supplied answer variants", () => {
  assert.equal(third.questions.length, 15);
  assert.ok(third.questions.every((row) => row.kind === "text" && row.options.length === 0));
  assert.deepEqual(third.passage!.flatMap((paragraph) => paragraph.flatMap((part) => "questionId" in part ? [part.questionId] : [])), third.questions.map((row) => row.id));
  const text = third.passage!.flat().map((part) => "text" in part ? part.text : "___").join("");
  for (const snippet of ["Hi brother,", "We're at the station", "Sandy is looking forward to taking surfing lessons.", "a surf instructor.", "try the local food.", "water) the plants", "Take care,\nAndy."]) assert.ok(text.includes(snippet));
  assert.deepEqual(Object.values(answersFor(third.id)), ["does not arrive", "will miss", "will have to", "get", "will text", "check in", "will look for", "do not surf", "is not", "will be", "is", "will have", "check in", "will you water", "promise"]);
  assert.equal(grade(third.id, answersFor(third.id)).percent, 100);
  for (const [id, key] of Object.entries(FIRST_CONDITIONAL_KEY[third.id])) {
    for (const accepted of [key.answer as string, ...(key.acceptedAnswers ?? [])]) {
      const entered = `  ${accepted.toUpperCase().replace(/'/g, "’").replace(/ /g, "   ")}  `;
      assert.equal(grade(third.id, { ...answersFor(third.id), [id]: entered }).percent, 100);
    }
  }
  assert.equal(grade(third.id, { ...answersFor(third.id), q1: "will not arrive" }).percent, 93);
  assert.equal(grade(third.id, { q1: "   " }).questions[0].selected, null);
  assert.throws(() => grade(third.id, { q1: ["does not arrive"] }));
  assert.throws(() => grade(third.id, { q1: "x".repeat(201) }));
});

test("all three exercise scores count every omission and combine all 35 answers by weight", () => {
  for (const exercise of [first, second, third]) {
    const entries = Object.entries(answersFor(exercise.id));
    for (let count = 0; count <= entries.length; count++) {
      const result = grade(exercise.id, Object.fromEntries(entries.slice(0, count)));
      assert.equal(result.correct, count); assert.equal(result.total, entries.length);
      assert.equal(result.percent, Math.round(count * 100 / entries.length));
      assert.equal(result.questions.filter((row) => !row.correct).length, entries.length - count);
    }
  }
  const results = Object.fromEntries(FIRST_CONDITIONAL.exercises.map((exercise) => [exercise.id, grade(exercise.id, answersFor(exercise.id))]));
  assert.deepEqual(testResultsScore(results, FIRST_CONDITIONAL.exercises.map((row) => row.id)), {
    correct: 35, total: 35, percent: 100, checkedExerciseIds: ["exercise-1", "exercise-2", "exercise-3"], complete: true,
  });
  const mixed = { ...results, [second.id]: grade(second.id, {}) };
  assert.equal(testResultsScore(mixed, [second.id, third.id]).percent, 60);
  assert.equal(testResultsScore(mixed, [third.id]).percent, 100);
});

test("the letter renders fifteen empty accessible inputs, no answer hints, and a complete checked passage", () => {
  const html = renderToStaticMarkup(createElement(TestExerciseQuestions, {
    testId: FIRST_CONDITIONAL.id, exercise: third, answers: {}, busy: false, onAnswer: () => {},
  }));
  assert.equal((html.match(/type="text"/g) ?? []).length, 15);
  assert.equal((html.match(/aria-label=/g) ?? []).length, 15);
  assert.equal((html.match(/value=""/g) ?? []).length, 15);
  assert.equal((html.match(/data-test-question=/g) ?? []).length, 15);
  assert.ok(html.includes("data-test-passage"));
  for (const hidden of ["Choose an answer", "does not arrive", "will you water", "required="]) assert.ok(!html.includes(hidden));
  const result = grade(third.id, answersFor(third.id));
  const review = renderToStaticMarkup(createElement(TestExerciseReview, { exercise: third, result, locale: "en", labels: TEST_LABELS.en }));
  assert.equal((review.match(/data-test-passage-answer=/g) ?? []).length, 15);
  assert.equal((review.match(/data-test-question-result="correct"/g) ?? []).length, 15);
  assert.ok(review.includes("Take care,"));
  assert.equal(testAnswerText(["might get", "will get"]), "might get / will get");
  for (const locale of ["en", "ru", "uk"] as const) {
    const wrong = renderToStaticMarkup(createElement(TestExerciseReview, { exercise: second, result: grade(second.id, {}), locale, labels: TEST_LABELS[locale] }));
    assert.ok(wrong.includes("might get / will get"));
    assert.ok(!wrong.includes("This counts as an error"));
  }
});
