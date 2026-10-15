import assert from "node:assert/strict";
import test from "node:test";
import {
  VAGUE_LANGUAGE_GRAMMAR_PRACTICE,
  VAGUE_LANGUAGE_HOMEWORK,
  VAGUE_LANGUAGE_HOMEWORK_REFERENCE,
  VAGUE_LANGUAGE_LEXICAL_PRACTICE,
  VAGUE_LANGUAGE_SPEAKING,
} from "../src/lib/bundled-lessons/c1-vague-language-activities";
import {
  homeworkAnswerMatches,
  isHomeworkAutoKind,
  normalizeHomeworkAnswer,
  normalizeInteractiveHomework,
} from "../src/lib/lesson-homework";
import { organizeVocabularyHomework } from "../src/lib/vocabulary-homework";

const groups = [...VAGUE_LANGUAGE_LEXICAL_PRACTICE, ...VAGUE_LANGUAGE_GRAMMAR_PRACTICE];

test("Vague language contains six distinct practice blocks and exactly forty-eight individually keyed gaps", () => {
  assert.equal(VAGUE_LANGUAGE_LEXICAL_PRACTICE.length, 3);
  assert.equal(VAGUE_LANGUAGE_GRAMMAR_PRACTICE.length, 3);
  assert.equal(new Set(groups.map(group => group.id)).size, groups.length);
  for (const group of groups) {
    assert(group.id && group.title && group.instruction);
    assert.equal(group.items.length, 8, group.id);
    for (const [index, item] of group.items.entries()) {
      assert.equal((item.prompt.match(/___/g) ?? []).length, 1, `${group.id}/${index}`);
      assert(item.answer && item.explanation);
      const answerItem = { ...item, id: `${group.id}-${index}` };
      for (const accepted of [item.answer, ...(item.accepted ?? [])]) {
        assert(homeworkAnswerMatches(answerItem, accepted), `${group.id}/${index}: ${accepted}`);
      }
      assert(!homeworkAnswerMatches(answerItem, "an intentionally incorrect response"));
      if (item.choices) {
        assert(item.choices.length >= 3);
        assert(item.choices.some(choice => normalizeHomeworkAnswer(choice) === normalizeHomeworkAnswer(item.answer)));
        assert.equal(new Set(item.choices.map(normalizeHomeworkAnswer)).size, item.choices.length);
        for (const choice of item.choices.filter(choice => choice !== item.answer)) {
          assert(!homeworkAnswerMatches(answerItem, choice), `Distractor accidentally accepted: ${group.id}/${index}: ${choice}`);
        }
      }
      assert(!/correct answer\s*:|accepted answers\s*:|teacher(?:'s)? key/i.test(item.prompt));
      assert(!item.prompt.includes(item.explanation), "Private explanation must not be embedded in a learner prompt");
    }
  }
});

test("All twenty requested vague expressions or families are genuinely practised, including minimums versus estimates", () => {
  const lexical = VAGUE_LANGUAGE_LEXICAL_PRACTICE.flatMap(group => group.items);
  const answers = lexical.flatMap(item => [item.answer.toLowerCase(), ...(item.accepted ?? []).map(answer => answer.toLowerCase())]);
  for (const target of [
    "roughly", "somewhere around", "in the region of", "on the order of", "a ballpark figure", "or so", "or thereabouts", "give or take",
    "thirty-odd", "forty-something", "just over", "in excess of", "at least", "no less than", "at most", "no more than", "in the low", "broadly speaking", "to some extent", "kind of", "sort of",
  ]) assert(answers.includes(target), target);
  assert(answers.includes("to an extent"));
  const odd = lexical.find(item => item.answer === "thirty-odd")!;
  assert(odd.prompt.includes("specifically means 'thirty and a few more'"));
  assert(odd.prompt.includes("not just an unspecified number in the thirties"));
  assert(VAGUE_LANGUAGE_LEXICAL_PRACTICE[1].items.every(item => item.choices));
  const all = JSON.stringify(VAGUE_LANGUAGE_LEXICAL_PRACTICE);
  assert(all.includes("inclusive upper limit"));
  assert(all.includes("inclusive minimum"));
  assert(all.includes("medication dose"));
});

test("Perfect practice supplies both timelines, negatives, questions, irregular participles and future time clauses", () => {
  const perfects = VAGUE_LANGUAGE_GRAMMAR_PRACTICE.slice(0, 2).flatMap(group => group.items);
  assert.equal(perfects.length, 16);
  assert.equal(perfects.filter(item => /^(?:had|'d)\b/i.test(item.answer)).length, 8);
  assert.equal(perfects.filter(item => /^will\b/i.test(item.answer)).length, 7);
  const timeClause = perfects.find(item => item.answer === "arrives")!;
  assert(timeClause.prompt.includes("Present Simple in a future time clause"));
  assert(timeClause.explanation.includes("arrives"));
  const negativePast = perfects.find(item => item.answer === "had not checked")!;
  assert(negativePast.accepted?.includes("hadn't checked"));
  const negativeFuture = perfects.find(item => item.answer === "will not have processed")!;
  assert(negativeFuture.accepted?.includes("won't have processed"));
  assert(perfects.some(item => item.answer === "Had you sent"));
  assert(perfects.some(item => item.answer === "Will she have recovered"));
  for (const participle of ["left", "lost", "gone", "written", "been", "read"]) {
    assert(perfects.some(item => item.answer.split(" ").includes(participle)), participle);
  }
  assert(VAGUE_LANGUAGE_GRAMMAR_PRACTICE[0].instruction.includes("a different tense may also be possible"));
  assert(VAGUE_LANGUAGE_GRAMMAR_PRACTICE[2].items[5].explanation.includes("Before alone does not force"));
});

test("Feelings review covers the actual first lesson grammar without accepting the typical errors", () => {
  const review = VAGUE_LANGUAGE_GRAMMAR_PRACTICE[2].items;
  assert.deepEqual(review.map(item => item.answer), [
    "are you being", "believe", "is always interrupting", "working", "will have finished", "had explained", "go", "to take",
  ]);
  for (const [index, mistake] of [[0, "are you"], [1, "am believing"], [2, "always interrupts"], [3, "work"], [6, "to go"], [7, "take"]] as const) {
    assert(!homeworkAnswerMatches({ ...review[index], id: `review-${index}` }, mistake));
  }
  assert(review[3].explanation.includes("also grammatical generally"));
  assert(review[6].explanation.includes("event in progress"));
  assert(review[6].prompt.includes("whole change"));
});

test("Eight open speaking tasks integrate approximation, Feelings and perfect viewpoints without fake automatic keys", () => {
  assert.equal(VAGUE_LANGUAGE_SPEAKING.length, 8);
  assert.equal(new Set(VAGUE_LANGUAGE_SPEAKING).size, 8);
  assert(VAGUE_LANGUAGE_SPEAKING.every(prompt => prompt.length >= 160 && !prompt.includes("___")));
  const text = VAGUE_LANGUAGE_SPEAKING.join(" ");
  for (const theme of ["had", "will have", "on edge", "overwhelmed", "ballpark figure", "maximum", "minimum", "always", "bare infinitive"]) {
    assert(text.includes(theme), theme);
  }
});

test("Homework is genuinely light: sixteen automatic items plus one short production task, with no expansion", () => {
  const plan = VAGUE_LANGUAGE_HOMEWORK;
  assert(plan.intro?.includes("15–20 minutes"));
  assert.equal(plan.exercises.length, 5);
  assert.deepEqual(plan.exercises.map(exercise => exercise.items.length), [4, 4, 4, 4, 1]);
  assert.equal(plan.exercises.flatMap(exercise => exercise.items).length, 17);
  assert.equal(plan.exercises.filter(exercise => isHomeworkAutoKind(exercise.kind)).flatMap(exercise => exercise.items).length, 16);
  assert.equal(plan.exercises.filter(exercise => !isHomeworkAutoKind(exercise.kind)).length, 1);
  assert.equal(plan.exercises.at(-1)?.kind, "question-text");
  assert(plan.exercises.at(-1)?.instruction.includes("90–110 words"));
  assert(plan.exercises.at(-1)?.instruction.includes("No recording"));
  assert(plan.exercises.every(exercise => !exercise.optional));
  const items = plan.exercises.flatMap(exercise => exercise.items);
  assert.equal(new Set(items.map(item => item.id)).size, 17);
  assert.equal(new Set(plan.exercises.map(exercise => exercise.id)).size, 5);
  assert(items.every(item => !item.vocabularyWord));
  assert.strictEqual(organizeVocabularyHomework(plan), plan, "Grammar/lexis recap must not turn into a large vocabulary homework");
  const normalized = normalizeInteractiveHomework(plan)!;
  assert.equal(normalized.exercises.length, 5);
  assert.deepEqual(normalized.exercises.flatMap(exercise => exercise.items.map(item => item.id)), items.map(item => item.id));
  assert.deepEqual(normalized.exercises.map(exercise => exercise.items.length), [4, 4, 4, 4, 1]);
  for (const item of items.filter(item => item.answer)) {
    assert.equal((item.prompt.match(/___/g) ?? []).length, 1);
    for (const answer of [item.answer!, ...(item.accepted ?? [])]) assert(homeworkAnswerMatches(item, answer));
    assert(!homeworkAnswerMatches(item, "deliberately wrong"));
    assert(!/correct answer\s*:|accepted answers\s*:|teacher(?:'s)? key/i.test(item.prompt));
    for (const choice of item.choices ?? []) {
      assert.equal(homeworkAnswerMatches(item, choice), choice === item.answer);
    }
  }
  assert(!plan.exercises.at(-1)?.items[0].answer);
});

test("The homework reading is complete, short and sufficient for all four comprehension answers", () => {
  const reference = VAGUE_LANGUAGE_HOMEWORK_REFERENCE;
  const words = reference.split(/\s+/).length;
  assert(words >= 110 && words <= 140, `Expected a short complete reading, got ${words} words`);
  assert(reference.startsWith("At six on Friday"));
  assert(reference.endsWith("Nothing has been approved yet."));
  const reading = VAGUE_LANGUAGE_HOMEWORK.exercises[3];
  assert.equal(reading.referenceText, reference);
  assert(reading.referenceTitle);
  assert.deepEqual(reading.items.map(item => item.answer), ["before", "an estimate", "maximum", "checked every cost"]);
  for (const evidence of ["had sent the outline before her manager called", "in the region of £3,000", "no more than £500 for travel", "By Tuesday lunchtime, they will have checked every cost"]) assert(reference.includes(evidence), evidence);
});
