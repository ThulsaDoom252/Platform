import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SECOND_CONDITIONAL, TEST_CATALOG, findLibraryTest } from "../src/lib/tests/catalog";
import { gradeTestExercise, libraryTestKey } from "../src/lib/tests/grading";
import { SECOND_CONDITIONAL_KEY } from "../src/lib/tests/second-conditional-key";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { selectedTestExerciseIds, testResultsScore, type TestAnswers } from "../src/lib/tests/types";
import { TestExerciseQuestions } from "../src/components/tests/test-exercise-form";
import { TestExerciseReview } from "../src/components/tests/test-result-view";

const definition = SECOND_CONDITIONAL;
const [first, second, third] = definition.exercises;
const key = SECOND_CONDITIONAL_KEY;
const answersFor = (id: string): TestAnswers => Object.fromEntries(Object.entries(key[id]).map(([questionId, item]) => [questionId, item.answer]));
const grade = (id: string, answers: TestAnswers) => gradeTestExercise(definition, key, id, answers);

test("Second conditional is a separate B1 Grammar test with three assignable exercises and a private versioned key", () => {
  assert.equal(findLibraryTest(definition.id), definition);
  assert.equal(TEST_CATALOG.filter((item) => item.id === definition.id && item.level === "b1" && item.category === "grammar").length, 1);
  assert.deepEqual(definition.exercises.map((row) => [row.number, row.questions.length]), [[1, 10], [2, 10], [3, 20]]);
  assert.equal(libraryTestKey(definition.id, 1), key);
  assert.equal(libraryTestKey(definition.id, 2), null);
  assert.equal(libraryTestKey(definition.id, 0), null);
  assert.deepEqual(selectedTestExerciseIds(definition, null), ["exercise-1", "exercise-2", "exercise-3"]);
  assert.deepEqual(selectedTestExerciseIds(definition, ["exercise-3", "exercise-1"]), ["exercise-1", "exercise-3"]);
  assert.deepEqual(selectedTestExerciseIds(definition, ["exercise-2"]), ["exercise-2"]);
  for (const file of ["src/lib/tests/catalog.ts", "src/lib/tests/second-conditional.ts", "src/components/tests/test-exercise-form.tsx", "src/components/tests/test-result-view.tsx"]) {
    assert.ok(!readFileSync(file, "utf8").includes("second-conditional-key"));
  }
});

test("exercise 1 preserves all ten source sentences, choice order and correct answers", () => {
  assert.deepEqual(first.questions.map((row) => row.before + "___" + row.after), [
    "I'd give you her number if I ___ it.", "If I won the lottery, I think I ___ my job.",
    "Who ___ date if you could date anyone in the world?", "If everybody in the world ___ one dollar, we'd finish the world's problems.",
    "If you ___ my wife, I'd make you the happiest woman on earth.", "I ___ about that if I were you.",
    "If you told grandpa the truth, he ___ a heart attack.", "I wouldn't call unless I ___ a real emergency.",
    "You ___ to spend so much time tidying your house if you didn't have so much stuff.", "If you ___ so much noise, I could concentrate.",
  ]);
  assert.deepEqual(first.questions.map((row) => row.options), [
    ["would have", "had", "have"], ["didn't give up", "wouldn't give up", "hadn't given up"], ["had you", "would you", "did you"],
    ["would donate", "donated", "donate"], ["were", "did", "would be"], ["didn't worry", "wouldn't worry", "hadn't worried"],
    ["might have", "will have", "had"], ["will have", "would have", "had"], ["hadn't had", "didn't have", "wouldn't have"],
    ["won't make", "didn't make", "wouldn't make"],
  ]);
  assert.deepEqual(Object.values(answersFor(first.id)), ["had", "wouldn't give up", "would you", "donated", "were", "wouldn't worry", "might have", "had", "wouldn't have", "didn't make"]);
});

test("exercise 2 preserves paired choices and both double-selection questions", () => {
  assert.deepEqual(second.questions.map((row) => row.prompt ?? row.before + "___" + row.after), [
    "If I ___ you, I wouldn't trust him.", "If we didn't take precautions, we ___ hurt.",
    "You ___ healthier if you ___ a bit of weight.", "If we sold the house, we ___ much right now.",
    "Would you mind if I ___ the window?", "I ___ him if he ___ me to help him.",
    "If you painted the walls white, the living room ___ bigger.", "If I was healthier, we ___ more often.",
    "What kind of job ___ to have if you ___ a teacher?", "If drugs ___ legal, the world ___ safer.",
  ]);
  assert.deepEqual(second.questions.map((row) => row.options), [
    ["was", "were", "did"], ["can get", "might get", "would get"], ["felt / would lose", "would feel / would lose", "would feel / lost"],
    ["didn't get", "wouldn't get", "won't get"], ["open", "would open", "opened"], ["helped / 'd allow", "'d help / allowed", "'d help / allow"],
    ["would look", "looked", "had looked"], ["could travel", "travelled", "might travel"],
    ["would you like / weren't", "would you like / wasn't", "did you like / wouldn't be"], ["'d be / were", "'d be / would be", "were / would be"],
  ]);
  assert.deepEqual(second.questions.filter((row) => row.kind === "multiple").map((row) => row.id), ["q2", "q8"]);
  assert.deepEqual(Object.values(answersFor(second.id)), ["were", ["might get", "would get"], "would feel / lost", "wouldn't get", "opened", "'d help / allowed", "would look", ["could travel", "might travel"], "would you like / weren't", "were / would be"]);
  assert.equal(grade(second.id, { ...answersFor(second.id), q2: ["would get", "might get"], q8: ["might travel", "could travel"] }).percent, 100);
  for (const answer of [["might get"], ["might get", "can get"], [], null]) assert.equal(grade(second.id, { ...answersFor(second.id), q2: answer }).percent, 90);
  for (const answer of ["might get", ["might get", "might get"], ["might get", "can get", "would get"], ["fake"]]) assert.throws(() => grade(second.id, { q2: answer }));
});

test("exercise 3 preserves ten complete two-gap sentences and grades all twenty verb forms", () => {
  assert.ok(third.questions.every((row) => row.kind === "text" && !row.options.length));
  assert.equal(third.passage!.length, 10);
  assert.deepEqual(third.passage!.map((paragraph) => paragraph.map((part) => "text" in part ? part.text : "___").join("")), [
    "Where ___ (you/travel) to if you ___ (can) go anywhere?", "What ___ (you/do) if you ___ (be) in my situation?",
    "If she ___ (know), she ___ (tell) you.", "I ___ (have) a better job if I ___ (speak) English better.",
    "I ___ (never/forgive) you if I ___ (not be) your friend.", "I ___ (be) happier if I ___ (have) more time.",
    "If you ___ (find) a wallet with a lot of money in it, what ___ (you/do)?",
    "If she ___ (not criticise) people so often, she ___ (have) more friends.",
    "If you ___ (get) lost, I ___ (go) to the end of the world to find you.",
    "He ___ (not travel) alone if he ___ (not have) his parents' permission.",
  ]);
  assert.deepEqual(third.passage!.flatMap((paragraph) => paragraph.flatMap((part) => "questionId" in part ? [part.questionId] : [])), third.questions.map((row) => row.id));
  assert.deepEqual(Object.values(answersFor(third.id)), ["would you travel", "could", "would you do", "were", "knew", "would tell", "would have", "spoke", "would never forgive", "were not", "would be", "had", "found", "would you do", "did not criticise", "would have", "got", "would go", "would not travel", "did not have"]);
  for (const [id, item] of Object.entries(key[third.id])) for (const accepted of [item.answer as string, ...(item.acceptedAnswers ?? [])]) {
    assert.equal(grade(third.id, { ...answersFor(third.id), [id]: `  ${accepted.toUpperCase().replace(/'/g, "’").replace(/ /g, "   ")}  ` }).percent, 100);
  }
  for (const [id, wrong] of [["q4", "was"], ["q5", "would know"], ["q15", "didn't criticised"], ["q19", "didn't travel"]]) assert.equal(grade(third.id, { ...answersFor(third.id), [id]: wrong }).percent, 95);
  assert.throws(() => grade(third.id, { q1: ["would you travel"] }));
  assert.throws(() => grade(third.id, { q1: "x".repeat(201) }));
});

test("all omissions count as errors and scores cover 0–100 with a weighted forty-answer total", () => {
  for (const exercise of definition.exercises) {
    const entries = Object.entries(answersFor(exercise.id));
    for (let count = 0; count <= entries.length; count++) {
      const result = grade(exercise.id, Object.fromEntries(entries.slice(0, count)));
      assert.equal(result.correct, count); assert.equal(result.total, entries.length);
      assert.equal(result.percent, Math.round(count * 100 / entries.length));
      assert.equal(result.questions.filter((row) => !row.correct).length, entries.length - count);
    }
    const empty = grade(exercise.id, {});
    assert.ok(empty.questions.every((row) => row.selected === null && !row.correct));
    for (const row of empty.questions) for (const locale of ["en", "ru", "uk"] as const) assert.ok(row.explanation[locale].length > 50);
  }
  const results = Object.fromEntries(definition.exercises.map((exercise) => [exercise.id, grade(exercise.id, answersFor(exercise.id))]));
  assert.equal(testResultsScore(results, selectedTestExerciseIds(definition, null)).percent, 100);
  assert.equal(testResultsScore(results, selectedTestExerciseIds(definition, null)).total, 40);
  const mixed = { ...results, [third.id]: grade(third.id, {}) };
  assert.equal(testResultsScore(mixed, selectedTestExerciseIds(definition, null)).percent, 50);
  assert.equal(testResultsScore(mixed, [third.id]).percent, 0);
});

test("every original distractor remains wrong and produces a grammatical explanation", () => {
  for (const exercise of [first, second]) for (const row of exercise.questions.filter((item) => item.kind !== "multiple")) for (const option of row.options) {
    const result = grade(exercise.id, { ...answersFor(exercise.id), [row.id]: option }).questions.find((item) => item.id === row.id)!;
    assert.equal(result.correct, option === key[exercise.id][row.id].answer);
    for (const locale of ["en", "ru", "uk"] as const) assert.ok(result.explanation[locale].length > 50);
  }
  assert.throws(() => grade(first.id, { q1: "forged" }));
  assert.throws(() => grade("missing", {}));
});

test("forms retain blank selects, accessible paired radios and twenty empty inline inputs", () => {
  const render = (exercise: typeof first, busy = false) => renderToStaticMarkup(createElement(TestExerciseQuestions, { testId: definition.id, exercise, answers: {}, busy, onAnswer: () => {} }));
  const firstHtml = render(first);
  assert.equal((firstHtml.match(/<select /g) ?? []).length, 10);
  assert.equal((firstHtml.match(/<option value="" hidden=""/g) ?? []).length, 10);
  const secondHtml = render(second);
  assert.equal((secondHtml.match(/type="radio"/g) ?? []).length, 12);
  assert.equal((secondHtml.match(/type="checkbox"/g) ?? []).length, 6);
  assert.equal((secondHtml.match(/<select /g) ?? []).length, 4);
  assert.equal((secondHtml.match(/<legend /g) ?? []).length, 6);
  assert.equal((secondHtml.match(/checked=""/g) ?? []).length, 0);
  assert.ok(secondHtml.includes("You ___ healthier if you ___ a bit of weight."));
  assert.equal((render(second, true).match(/disabled=""/g) ?? []).length, 22);
  const thirdHtml = render(third);
  assert.equal((thirdHtml.match(/type="text"/g) ?? []).length, 20);
  assert.equal((thirdHtml.match(/aria-label=/g) ?? []).length, 20);
  assert.equal((thirdHtml.match(/value=""/g) ?? []).length, 20);
  for (const html of [firstHtml, secondHtml, thirdHtml]) for (const forbidden of ["Choose an answer", "required=", key[first.id].q1.rule.en, key[third.id].q2.rule.en]) assert.ok(!html.includes(forbidden));
});

test("review shows every missing gap, original paired prompts, answers and explanations in all locales", () => {
  for (const locale of ["en", "ru", "uk"] as const) for (const exercise of definition.exercises) {
    const html = renderToStaticMarkup(createElement(TestExerciseReview, { exercise, result: grade(exercise.id, {}), locale, labels: TEST_LABELS[locale] }));
    assert.equal((html.match(/data-test-question-result="no-answer"/g) ?? []).length, exercise.questions.length);
    assert.ok(html.includes(TEST_LABELS[locale].noAnswer));
    assert.ok(!html.includes("This counts as an error"));
    for (const row of exercise.questions) if (row.prompt) assert.ok(html.includes(row.prompt));
    if (exercise.passage) assert.equal((html.match(/data-test-passage-answer=/g) ?? []).length, 20);
  }
});
