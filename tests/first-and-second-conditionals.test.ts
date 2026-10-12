import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_AND_SECOND_CONDITIONALS, TEST_CATALOG, findLibraryTest } from "../src/lib/tests/catalog";
import { FIRST_AND_SECOND_CONDITIONALS_KEY } from "../src/lib/tests/first-and-second-conditionals-key";
import { gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { selectedTestExerciseIds, testResultsScore, type TestAnswers } from "../src/lib/tests/types";
import { TestExerciseQuestions, toggleTestChoice } from "../src/components/tests/test-exercise-form";
import { TestExerciseReview } from "../src/components/tests/test-result-view";

const definition = FIRST_AND_SECOND_CONDITIONALS;
const key = FIRST_AND_SECOND_CONDITIONALS_KEY;
const [first, second, third] = definition.exercises;
const answersFor = (id: string): TestAnswers => Object.fromEntries(Object.entries(key[id]).map(([questionId, item]) => [questionId, item.answer]));
const grade = (id: string, answers: TestAnswers) => gradeTestExercise(definition, key, id, answers);

test("First and second conditionals is a distinct B1 Grammar test with three assignable exercises and private versioned keys", () => {
  assert.equal(findLibraryTest(definition.id), definition);
  assert.equal(TEST_CATALOG.filter((row) => row.id === definition.id && row.level === "b1" && row.category === "grammar").length, 1);
  assert.deepEqual(definition.exercises.map((row) => [row.number, row.questions.length]), [[1, 10], [2, 10], [3, 10]]);
  assert.equal(libraryTestKey(definition.id, 1), key);
  for (const version of [0, 2, -1]) assert.equal(libraryTestKey(definition.id, version), null);
  assert.deepEqual(selectedTestExerciseIds(definition, null), ["exercise-1", "exercise-2", "exercise-3"]);
  assert.deepEqual(selectedTestExerciseIds(definition, ["exercise-3", "exercise-2"]), ["exercise-2", "exercise-3"]);
  assert.deepEqual(selectedTestExerciseIds(definition, ["exercise-2"]), ["exercise-2"]);
  for (const file of ["src/lib/tests/catalog.ts", "src/lib/tests/first-and-second-conditionals.ts", "src/components/tests/test-exercise-form.tsx", "src/components/tests/test-result-view.tsx"]) assert.ok(!readFileSync(file, "utf8").includes("first-and-second-conditionals-key"));
});

test("exercise 1 preserves the ten supplied sentences, options and expected first/second-conditional answers", () => {
  assert.deepEqual(first.questions.map((row) => row.before + "___" + row.after), [
    "If you ___ free tonight, we might go out for a drink, or to the cinema.", "He ___ depressed if he fails the exam.",
    "If I didn't know you, I ___ you were crazy.", "Tell me the truth if you ___.",
    "If you had a bigger salary, you ___ more unnecessary things.", "If it ___ for Tom, I wouldn't be here.",
    "You should call me if you ___ anything unusual.", "If they had this player, they ___ a single match.",
    "Our lives would be much easier if you ___ closer to home.", "If I got a job in France, we ___ crêpes every day.",
  ]);
  assert.deepEqual(first.questions.map((row) => row.options), [
    ["would be", "will be", "are"], ["will be", "is", "would be"], ["will think", "would think", "thought"],
    ["can", "could", "will"], ["would buy", "will buy", "buy"], ["weren't", "won't be", "isn't"],
    ["will see", "see", "saw"], ["wouldn't lose", "didn't lose", "won't lose"], ["worked", "would work", "work"],
    ["will eat", "might eat", "can eat"],
  ]);
  assert.deepEqual(Object.values(answersFor(first.id)), ["are", "will be", "would think", "can", "would buy", "weren't", "see", "wouldn't lose", "worked", "might eat"]);
});

test("exercise 2 preserves all ten source sentences, four double-answer questions and paired forms", () => {
  assert.deepEqual(second.questions.map((row) => row.prompt ?? row.before + "___" + row.after), [
    "If your boss ___, you might lose your job.", "We ___ the keys if we don't look for them.",
    "Shall we go to the beach if the weather ___ OK?", "If we both saved enough money, we ___ go to Japan.",
    "If you ___ the job, you should tell her.", "We couldn't afford the house even if we both ___ double our salaries.",
    "You ___ it more interesting if you paid more attention.", "I ___ you my secret unless you ___ me yours.",
    "Do you think he ___ if we invited him?", "It ___ better if you ___ a bit of salt.",
  ]);
  assert.deepEqual(second.questions.map((row) => row.options), [
    ["finds out", "would find out", "found out"], ["will never find", "'d never find", "never find"], ["is", "were", "was"],
    ["could", "can", "might"], ["didn't want", "don't want", "won't want"], ["earn", "would earn", "earned"],
    ["will find", "might find", "would find"], ["won't tell / tell", "wouldn't tell / tell", "told / would tell"],
    ["will come", "come", "would come"], ["would taste / added", "should taste / would add", "will taste / add"],
  ]);
  assert.deepEqual(second.questions.filter((row) => row.kind === "multiple").map((row) => row.id), ["q1", "q4", "q7", "q10"]);
  assert.deepEqual(Object.values(answersFor(second.id)), [
    ["finds out", "found out"], "will never find", "is", ["could", "might"], "don't want", "earned",
    ["might find", "would find"], "won't tell / tell", "would come", ["would taste / added", "will taste / add"],
  ]);
});

test("double choices include both first and second conditional, require the complete pair, and remain order-independent", () => {
  for (const row of second.questions.filter((question) => question.kind === "multiple")) {
    const correct = key[second.id][row.id].answer as string[];
    assert.equal(grade(second.id, { ...answersFor(second.id), [row.id]: [...correct].reverse() }).percent, 100);
    const wrong = row.options.find((value) => !correct.includes(value))!;
    for (const answer of [[correct[0]], [correct[0], wrong], [], null]) assert.equal(grade(second.id, { ...answersFor(second.id), [row.id]: answer }).percent, 90);
    for (const answer of [[...row.options], [correct[0], correct[0]], ["forged"], correct[0]]) assert.throws(() => grade(second.id, { [row.id]: answer }));
    const selected = toggleTestChoice(row, null, correct[0]);
    assert.deepEqual(toggleTestChoice(row, selected, correct[1]), correct);
    assert.equal(toggleTestChoice(row, selected, correct[0]), null);
  }
});

test("exercise 3 keeps the complete seven-turn dialogue, ten ordered gaps and legitimate contractions", () => {
  assert.equal(third.passage!.length, 7);
  assert.ok(third.questions.every((row) => row.kind === "text" && !row.options.length));
  assert.deepEqual(third.passage!.flatMap((paragraph) => paragraph.flatMap((part) => "questionId" in part ? [part.questionId] : [])), third.questions.map((row) => row.id));
  assert.deepEqual(third.passage!.map((paragraph) => paragraph.map((part) => "text" in part ? part.text : "___").join("")), [
    "TERRY: Hey, RAY. If you ___ (have) time, can you go and pick up Bridget at the station? If she takes the 4 o'clock train, as she said, she ___ (arrive) at 5.15.",
    "RAY: I ___ (pick) her up if I could, but I have a meeting at 4.30.",
    "TERRY: Can't you postpone it? You are the boss after all.",
    "RAY: Yes, but I'm meeting some important clients, and it wouldn't look serious if a few hours before the meeting I ___ (tell) them that I have to put it off. And the meeting is important. I'll make quite a lot of money if everything ___ (go) well. Why don't you pick her up?",
    "TERRY: I would pick her up if my car ___ (not be) at the garage. It's been there for days, and unless there's a miracle, they ___ (not repair) it today. Something is broken and they won't be able to fix it until they ___ (find) the spare part they need.",
    "RAY: That's unlucky. Well, do you think Bridget ___ (get) angry if nobody goes to the station to pick her up?",
    "TERRY: Well, if it were me, I ___ (not get) angry.",
  ]);
  assert.deepEqual(Object.values(answersFor(third.id)), ["have", "will arrive", "would pick", "told", "goes", "were not", "will not repair", "find", "will get", "would not get"]);
  for (const [id, item] of Object.entries(key[third.id])) for (const accepted of [item.answer as string, ...(item.acceptedAnswers ?? [])]) assert.equal(grade(third.id, { ...answersFor(third.id), [id]: accepted.toUpperCase().replace(/'/g, "’").replace(/ /g, "   ") }).percent, 100);
  for (const [id, wrong] of [["q1", "had"], ["q3", "will pick"], ["q4", "would tell"], ["q5", "go"], ["q8", "will find"], ["q10", "will not get"]]) assert.equal(grade(third.id, { ...answersFor(third.id), [id]: wrong }).percent, 90);
});

test("all scores from 0 to 100 count omissions and total all thirty answers by weight", () => {
  for (const exercise of definition.exercises) {
    const entries = Object.entries(answersFor(exercise.id));
    for (let count = 0; count <= 10; count++) {
      const result = grade(exercise.id, Object.fromEntries(entries.slice(0, count)));
      assert.equal(result.percent, count * 10); assert.equal(result.total, 10);
      assert.equal(result.questions.filter((row) => !row.correct).length, 10 - count);
    }
    const empty = grade(exercise.id, {});
    assert.ok(empty.questions.every((row) => row.selected === null));
    for (const row of empty.questions) for (const locale of ["en", "ru", "uk"] as const) assert.ok(row.explanation[locale].length > 50);
  }
  const results = Object.fromEntries(definition.exercises.map((exercise) => [exercise.id, grade(exercise.id, answersFor(exercise.id))]));
  assert.equal(testResultsScore(results, selectedTestExerciseIds(definition, null)).total, 30);
  assert.equal(testResultsScore(results, selectedTestExerciseIds(definition, null)).percent, 100);
  assert.equal(testResultsScore({ ...results, [third.id]: grade(third.id, {}) }, selectedTestExerciseIds(definition, null)).percent, 67);
  assert.equal(testResultsScore(results, [second.id]).total, 10);
});

test("all distractors are rejected with grammatical explanations and invalid values cannot forge a score", () => {
  for (const exercise of [first, second]) for (const row of exercise.questions.filter((question) => question.kind !== "multiple")) for (const option of row.options) {
    const checked = grade(exercise.id, { ...answersFor(exercise.id), [row.id]: option }).questions.find((item) => item.id === row.id)!;
    assert.equal(checked.correct, option === key[exercise.id][row.id].answer);
    for (const locale of ["en", "ru", "uk"] as const) assert.ok(checked.explanation[locale].length > 50);
  }
  assert.throws(() => grade(first.id, { q1: "forged" }));
  assert.throws(() => grade(third.id, { q1: ["have"] }));
  assert.throws(() => grade(third.id, { q1: "x".repeat(201) }));
  assert.throws(() => grade("missing", {}));
});

test("the themed forms show empty selects, both gaps of paired choices, ten dialogue inputs and complete reviews", () => {
  const render = (exercise: typeof first, busy = false) => renderToStaticMarkup(createElement(TestExerciseQuestions, { testId: definition.id, exercise, answers: {}, busy, onAnswer: () => {} }));
  const firstHtml = render(first);
  assert.equal((firstHtml.match(/<select /g) ?? []).length, 10);
  assert.equal((firstHtml.match(/<option value="" hidden=""/g) ?? []).length, 10);
  const secondHtml = render(second);
  assert.equal((secondHtml.match(/type="checkbox"/g) ?? []).length, 12);
  assert.equal((secondHtml.match(/type="radio"/g) ?? []).length, 3);
  assert.equal((secondHtml.match(/<select /g) ?? []).length, 5);
  assert.equal((secondHtml.match(/Choose TWO correct options/g) ?? []).length, 4);
  assert.equal((secondHtml.match(/checked=""/g) ?? []).length, 0);
  assert.ok(secondHtml.includes("It ___ better if you ___ a bit of salt."));
  assert.ok(secondHtml.includes("I ___ you my secret unless you ___ me yours."));
  assert.equal((render(second, true).match(/disabled=""/g) ?? []).length, 20);
  const thirdHtml = render(third);
  assert.equal((thirdHtml.match(/type="text"/g) ?? []).length, 10);
  assert.equal((thirdHtml.match(/aria-label=/g) ?? []).length, 10);
  assert.equal((thirdHtml.match(/value=""/g) ?? []).length, 10);
  for (const html of [firstHtml, secondHtml, thirdHtml]) for (const forbidden of ["Choose an answer", "required=", key[first.id].q1.rule.en]) assert.ok(!html.includes(forbidden));
  for (const locale of ["en", "ru", "uk"] as const) for (const exercise of definition.exercises) {
    const review = renderToStaticMarkup(createElement(TestExerciseReview, { exercise, result: grade(exercise.id, {}), locale, labels: TEST_LABELS[locale] }));
    assert.equal((review.match(/data-test-question-result="no-answer"/g) ?? []).length, 10);
    assert.ok(review.includes(TEST_LABELS[locale].noAnswer));
    assert.ok(!review.includes("This counts as an error"));
    for (const row of exercise.questions) if (row.prompt) assert.ok(review.includes(row.prompt));
    if (exercise.passage) assert.equal((review.match(/data-test-passage-answer=/g) ?? []).length, 10);
  }
});
