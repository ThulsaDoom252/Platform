import assert from "node:assert/strict";
import test from "node:test";
import { buildWaltMeetsGusHomework } from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus-homework";
import { WALT_MEETS_GUS_VOCABULARY } from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus";
import {
  homeworkAnswerMatches,
  interactiveHomeworkFromEntries,
  isHomeworkAutoKind,
  normalizeHomeworkAnswer,
  normalizeInteractiveHomework,
  type InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";
import { isVocabularyHomeworkExercise } from "../src/lib/vocabulary-homework";

const portable = (plan: unknown) => JSON.parse(JSON.stringify(plan)) as InteractiveHomeworkPlan;

test("Walt homework retains the requested eight blocks and all 39 responses", () => {
  const plan = buildWaltMeetsGusHomework();
  assert.equal(plan.kind, "INTERACTIVE_HOMEWORK_V1");
  assert.equal(plan.title, "Walt meets Gus · Homework");
  assert.deepEqual(plan.exercises.map(exercise => [exercise.kind, exercise.items.length]), [
    ["fill", 7], ["definition", 7], ["describe", 7], ["translate", 6],
    ["question-text", 3], ["question-audio", 3], ["question-text", 3], ["question-audio", 3],
  ]);
  assert.equal(plan.exercises.flatMap(exercise => exercise.items).length, 39);
  assert.ok(plan.exercises.every(exercise => !exercise.optional && exercise.title && exercise.instruction));
});

test("native default normalization never deduplicates the requested impeccable repetition", () => {
  const plan = buildWaltMeetsGusHomework();
  const normalized = normalizeInteractiveHomework(plan);
  assert.ok(normalized);
  assert.deepEqual(portable(normalized), plan);
  assert.deepEqual(portable(interactiveHomeworkFromEntries([plan])), plan);
  assert.equal(normalized.exercises.length, 8);
  assert.equal(normalized.exercises.flatMap(exercise => exercise.items).length, 39);
  assert.ok(plan.exercises.every(exercise => !isVocabularyHomeworkExercise(exercise, plan)));
  for (const exercise of plan.exercises.slice(0, 3)) {
    assert.equal(exercise.items.filter(item => (item.word ?? item.answer) === "impeccable").length, 1);
  }
});

test("all 19 original headwords occur across the three lexical blocks, with only impeccable repeated", () => {
  const firstThree = buildWaltMeetsGusHomework().exercises.slice(0, 3);
  const targets = firstThree.flatMap(exercise => exercise.items.map(item => item.word ?? item.answer!));
  const normalize = (value: string) => normalizeHomeworkAnswer(value);
  const actual = [...new Set(targets.map(normalize))].sort();
  const expected = WALT_MEETS_GUS_VOCABULARY.map(entry => normalize(entry.word)).sort();
  assert.deepEqual(actual, expected);
  assert.equal(targets.length, 21);
  for (const target of actual) {
    assert.equal(targets.filter(value => normalize(value) === target).length, target === "impeccable" ? 3 : 1);
  }
});

test("fill bank is shuffled, complete and contains exactly seven usable answers", () => {
  const fill = buildWaltMeetsGusHomework().exercises[0];
  assert.equal(fill.wordBank?.length, 7);
  assert.deepEqual([...fill.wordBank!].sort(), fill.items.map(item => item.answer!).sort());
  assert.notDeepEqual(fill.wordBank, fill.items.map(item => item.answer));
  assert.ok(fill.items.every(item => (item.prompt.match(/___/g) ?? []).length === 1));
  assert.ok(fill.items.every(item => item.prompt !== item.answer));
});

test("recall task gives definitions without a bank or accidental answer hints", () => {
  const guess = buildWaltMeetsGusHomework().exercises[1];
  assert.equal(guess.wordBank, undefined);
  for (const item of guess.items) {
    assert.ok(item.answer);
    assert.ok(!item.hint && !item.word && !item.choices && !item.vocabularyWord);
    assert.ok(!normalizeHomeworkAnswer(item.prompt).includes(normalizeHomeworkAnswer(item.answer)));
  }
});

test("description task requests original English explanations and examples rather than another recall test", () => {
  const describe = buildWaltMeetsGusHomework().exercises[2];
  assert.match(describe.instruction, /own English/);
  assert.match(describe.instruction, /original example/);
  assert.equal(describe.wordBank, undefined);
  assert.ok(describe.items.every(item => item.word && !item.answer && !item.accepted && !item.hint));
  const addiction = describe.items.find(item => item.word === "a drug addict")!;
  assert.match(addiction.prompt, /person-first/);
  assert.match(addiction.prompt, /do not generalise/);
});

test("six Ukrainian-to-English translations include hands down and impeccable without leaking models in hints", () => {
  const translations = buildWaltMeetsGusHomework().exercises[3];
  assert.equal(translations.kind, "translate");
  assert.equal(translations.translationDirection, "to-english");
  assert.equal(translations.translationLanguage, "UK");
  assert.equal(translations.items.length, 6);
  assert.match(translations.instruction, /hands down and impeccable/);
  assert.match(translations.items[0].answer!, /hands down.*impeccable/);
  assert.ok(translations.items.every(item => /[а-яіїєґ]/iu.test(item.prompt)));
  assert.ok(translations.items.every(item => item.answer && !item.word && !item.hint && !item.choices));
  assert.equal(translations.wordBank, undefined);
});

test("native scoring keeps 14 automatic answers, six teacher-marked translations and 19 other open responses", () => {
  const plan = buildWaltMeetsGusHomework();
  const automatic = plan.exercises.filter(exercise => isHomeworkAutoKind(exercise.kind));
  assert.equal(automatic.flatMap(exercise => exercise.items).length, 14);
  assert.equal(plan.exercises.flatMap(exercise => exercise.items).filter(item => item.answer).length, 20);
  assert.equal(plan.exercises.filter(exercise => !isHomeworkAutoKind(exercise.kind)).flatMap(exercise => exercise.items).length, 25);
  assert.equal(plan.exercises.flatMap(exercise => exercise.items).filter(item => !item.answer).length, 19);
});

test("every canonical response and accepted contraction, spelling or full form matches the native answer helper", () => {
  for (const item of buildWaltMeetsGusHomework().exercises.flatMap(exercise => exercise.items)) {
    if (!item.answer) continue;
    assert.ok(homeworkAnswerMatches(item, item.answer), item.id);
    assert.ok(homeworkAnswerMatches(item, `  ${item.answer.toUpperCase()}  `), item.id);
    for (const accepted of item.accepted ?? []) assert.ok(homeworkAnswerMatches(item, accepted), `${item.id}: ${accepted}`);
    assert.equal(homeworkAnswerMatches(item, "not the right expression"), false, item.id);
  }
  const plan = buildWaltMeetsGusHomework();
  assert.ok(homeworkAnswerMatches(plan.exercises[0].items[3], "I am not following."));
  assert.ok(homeworkAnswerMatches(plan.exercises[0].items[4], "You are confusing me with someone else."));
  assert.ok(homeworkAnswerMatches(plan.exercises[1].items[5], "have poor judgement"));
  assert.ok(homeworkAnswerMatches(plan.exercises[3].items[2], "Everything is ready on my end; we can leave at a moment’s notice."));
  assert.ok(homeworkAnswerMatches(plan.exercises[3].items[4], "She's cautious, but we're alike in many ways."));
});

test("each of the eight exercises includes impeccable and every communication prompt explicitly requires it", () => {
  const plan = buildWaltMeetsGusHomework();
  assert.ok(plan.exercises.every(exercise => /\bimpeccable\b/i.test(JSON.stringify(exercise))));
  for (const exercise of plan.exercises.slice(4)) {
    assert.equal(exercise.items.length, 3);
    assert.ok(exercise.items.every(item => /\bimpeccable\b/i.test(item.prompt)));
    assert.ok(exercise.items.every(item => !item.answer && !item.accepted && !item.hint));
  }
});

test("written and voice answers remain separate from six original questions for the teacher", () => {
  const communication = buildWaltMeetsGusHomework().exercises.slice(4);
  assert.deepEqual(communication.map(exercise => exercise.kind), ["question-text", "question-audio", "question-text", "question-audio"]);
  assert.match(communication[0].instruction, /two or three complete sentences/);
  assert.match(communication[1].instruction, /20–40 seconds/);
  assert.match(communication[2].instruction, /three questions altogether/);
  assert.match(communication[3].instruction, /three separate voice questions/);
  for (const exercise of communication.slice(2)) {
    assert.ok(exercise.items.every(item => /Required expressions: impeccable; .+\./.test(item.prompt)));
    assert.equal(new Set(exercise.items.map(item => item.prompt.split("Required expressions: ")[1])).size, 3);
  }
});

test("scene questions preserve uncertainty about the deal instead of asserting an invented outcome", () => {
  const plan = buildWaltMeetsGusHomework();
  assert.match(plan.intro!, /only on this clip, not on later episodes/);
  assert.match(plan.exercises[4].instruction, /Attribute claims/);
  assert.match(plan.exercises[4].items[0].prompt, /What does he claim/);
  assert.match(plan.exercises[4].items[1].prompt, /Walt's claim/);
  assert.match(plan.exercises[4].items[2].prompt, /Does this clip confirm.*what remains uncertain/);
});

test("IDs stay unique and stable; data fits native limits and survives a JSONB-shaped round trip", () => {
  const first = buildWaltMeetsGusHomework();
  const second = buildWaltMeetsGusHomework();
  assert.deepEqual(first, second);
  assert.deepEqual(first, portable(first));
  const ids = [...first.exercises.map(exercise => exercise.id), ...first.exercises.flatMap(exercise => exercise.items.map(item => item.id))];
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => /^[a-z0-9-]+$/.test(id)));
  for (const exercise of first.exercises) {
    assert.ok(exercise.title.length <= 240 && exercise.instruction.length <= 2_000);
    for (const item of exercise.items) {
      assert.ok(item.prompt.length <= 1_500);
      assert.ok(!item.answer || item.answer.length <= 300);
      assert.ok((item.accepted ?? []).length <= 20);
      assert.ok((item.accepted ?? []).every(value => value.length <= 300));
    }
  }
  first.exercises[0].items[0].prompt = "Changed in one caller";
  assert.notEqual(first.exercises[0].items[0].prompt, second.exercises[0].items[0].prompt);
});
