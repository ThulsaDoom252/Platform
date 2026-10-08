import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeworkAnswerChoice } from "../src/components/lessons/homework-answer-choice";
import {
  addPart9Grammar, addPart9GrammarToState, PART9_GRAMMAR_EXERCISES, PART9_GRAMMAR_IDS,
} from "../src/lib/bundled-lessons/tucker-mendel-part-9-grammar";
import {
  assignedInteractiveHomework, homeworkAnswerMatches, homeworkAssignedAtKey,
  homeworkAssignedExercisesKey, homeworkPlanForAssignment, homeworkPlanOverrideKey,
  homeworkRemovedAtKey, normalizeInteractiveHomework, type InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";
import { isVocabularyHomeworkExercise, organizeVocabularyHomework } from "../src/lib/vocabulary-homework";

const existing: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Tucker & Mendel — Part 9 — Homework",
  intro: "Teacher's custom instructions",
  exercises: [
    { id: "tm9-fill-main", title: "Vocabulary — Fill", instruction: "Teacher's wording", kind: "fill", items: [{ id: "old-item", prompt: "This is ___.", answer: "weird", vocabularyWord: "weird" }] },
    { id: "tm9-written-questions", title: "Questions", instruction: "Later", kind: "question-text", items: [] },
  ],
};

test("Part 9 has three required grammar exercises of eight sentences with unique IDs", () => {
  assert.deepEqual(PART9_GRAMMAR_EXERCISES.map((exercise) => [exercise.kind, exercise.items.length]), [["fill", 8], ["translate", 8], ["question-text", 8]]);
  assert(PART9_GRAMMAR_EXERCISES.every((exercise) => !exercise.optional));
  const ids = PART9_GRAMMAR_EXERCISES.flatMap((exercise) => exercise.items.map((item) => item.id));
  assert.equal(new Set(ids).size, 24);
  assert(PART9_GRAMMAR_EXERCISES.every((exercise) => !isVocabularyHomeworkExercise(exercise, existing)));
});

test("who/whom choice mixes subject who and unambiguous fronted-preposition whom", () => {
  const choice = PART9_GRAMMAR_EXERCISES[0];
  for (const item of choice.items) {
    assert.deepEqual(item.choices, ["who", "whom"]);
    assert.equal((item.prompt.match(/___/g) ?? []).length, 1);
    assert.equal(item.answer === "whom", /\b(?:from|with|to) ___/i.test(item.prompt));
    assert(homeworkAnswerMatches(item, item.answer!.toUpperCase()));
    assert(!homeworkAnswerMatches(item, item.answer === "who" ? "whom" : "who"));
  }
  assert.deepEqual(choice.items.map((item) => item.answer), ["whom", "who", "whom", "who", "whom", "who", "who", "whom"]);
  for (const preposition of ["from", "with", "to"]) assert(choice.items.some((item) => new RegExp(`\\b${preposition} ___`, "i").test(item.prompt)));
});

test("translations default to Russian → English, with teacher reference answers", () => {
  const translation = PART9_GRAMMAR_EXERCISES[1];
  assert.equal(translation.translationLanguage, "RU");
  assert.equal(translation.translationDirection, "to-english");
  for (const item of translation.items) {
    assert(/[а-яё]/i.test(item.prompt));
    assert(/\b(?:who|whom)\b/i.test(item.answer!));
    assert(!/[а-яё]/i.test(item.answer!));
  }
  for (const preposition of ["from", "with", "to"]) assert(translation.items.some((item) => new RegExp(`\\b${preposition}\\b`, "i").test(item.answer!)));
});

test("every rewrite changes object whom to who and strands the same preposition", () => {
  for (const item of PART9_GRAMMAR_EXERCISES[2].items) {
    const match = item.prompt.match(/\b(from|with|to) whom\b/i);
    assert(match);
    assert(/\bwho\b/i.test(item.answer!));
    assert(!/\bwhom\b/i.test(item.answer!));
    assert(!/\b(?:from|with|to) who\b/i.test(item.answer!));
    const promptWords = item.prompt.toLowerCase().match(/[a-z]+/g)!.map((word) => word === "whom" ? "who" : word).sort();
    const answerWords = item.answer!.toLowerCase().match(/[a-z]+/g)!.sort();
    assert.deepEqual(answerWords, promptWords, "Only the pronoun and word order should change");
    assert(new RegExp(`\\b${match[1]}\\b`, "i").test(item.answer!));
  }
});

test("adding grammar preserves every existing exercise and is idempotent", () => {
  const snapshot = structuredClone(existing);
  const revised = addPart9Grammar(existing);
  assert.deepEqual(existing, snapshot);
  assert.equal(revised.intro, existing.intro);
  for (const exercise of existing.exercises) assert.deepEqual(revised.exercises.find((item) => item.id === exercise.id), exercise);
  assert.deepEqual(revised.exercises.map((exercise) => exercise.id), ["tm9-fill-main", ...PART9_GRAMMAR_IDS, "tm9-written-questions"]);
  assert.equal(addPart9Grammar(revised), revised);
  revised.exercises.find((exercise) => exercise.id === PART9_GRAMMAR_IDS[0])!.instruction = "Teacher's edited instruction";
  assert.equal(addPart9Grammar(revised).exercises.find((exercise) => exercise.id === PART9_GRAMMAR_IDS[0])!.instruction, "Teacher's edited instruction");
  assert.notEqual(PART9_GRAMMAR_EXERCISES[0].instruction, "Teacher's edited instruction");
});

test("personal assigned copy gains all grammar without changing progress, marks or notes", () => {
  const state = {
    [homeworkAssignedAtKey()]: "2026-10-07T22:40:23.461Z",
    [homeworkAssignedExercisesKey()]: JSON.stringify(["tm9-fill-main"]),
    [homeworkPlanOverrideKey()]: JSON.stringify(existing),
    "hw:value:old-item": "weird",
    "hw:status:old-item": "correct",
    "hw:attempts:old-item": '["strange"]',
    "hw:note:old-item": "Keep this note",
    "hw:reviewed-at": "2026-10-08T10:00:00.000Z",
    "hw:reaction:overall": "excellent",
  };
  const revised = addPart9GrammarToState(state);
  assert.deepEqual(addPart9GrammarToState(revised), revised);
  for (const [key, value] of Object.entries(state)) {
    if (key !== homeworkAssignedExercisesKey() && key !== homeworkPlanOverrideKey()) assert.equal(revised[key], value);
  }
  const activePlan = homeworkPlanForAssignment(addPart9Grammar(existing), revised);
  assert(activePlan);
  assert.deepEqual(assignedInteractiveHomework(activePlan, revised)!.exercises.map((exercise) => exercise.id), ["tm9-fill-main", ...PART9_GRAMMAR_IDS]);
  assert.equal(state[homeworkPlanOverrideKey()], JSON.stringify(existing));
});

test("lesson-only and removed homework copies are not assigned accidentally", () => {
  assert.deepEqual(addPart9GrammarToState({}), {});
  const removed = {
    [homeworkAssignedAtKey()]: "2026-10-07",
    [homeworkRemovedAtKey()]: "2026-10-08",
    [homeworkAssignedExercisesKey()]: '["tm9-fill-main"]',
  };
  assert.deepEqual(addPart9GrammarToState(removed), removed);
  assert.throws(() => addPart9GrammarToState({ [homeworkPlanOverrideKey()]: "invalid JSON" }));
});

test("normalization keeps choices and teacher references without mixing grammar into vocabulary", () => {
  const raw = addPart9Grammar(existing);
  const normalized = normalizeInteractiveHomework(raw)!;
  const organized = organizeVocabularyHomework(normalized);
  for (const grammar of PART9_GRAMMAR_EXERCISES) {
    const result = organized.exercises.find((exercise) => exercise.id === grammar.id)!;
    assert.equal(result.items.length, 8);
    assert.deepEqual(result.items, grammar.items);
    assert.equal(result.wordBank, undefined);
  }
});

test("invalid or single choices fall back to the ordinary text input metadata", () => {
  const normalize = (choices: unknown, answer = "who") => normalizeInteractiveHomework({
    ...existing,
    exercises: [{ ...PART9_GRAMMAR_EXERCISES[0], items: [{ id: "choice-test", prompt: "___ helped?", answer, choices }] }],
  })!.exercises[0].items[0];
  assert.deepEqual(normalize([" who ", "who", "whom", "", null, 12]).choices, ["who", "whom"]);
  assert.equal(normalize(["who", "who"]).choices, undefined);
  assert.equal(normalize(["who", "whom"], "someone").choices, undefined);
  assert.equal(normalize("who / whom").choices, undefined);
});

test("inline choice renders both options, selected state and accessible disabled state", () => {
  const html = renderToStaticMarkup(createElement(HomeworkAnswerChoice, {
    choices: ["who", "whom"], value: "whom", label: "With ___ did you work?",
    placeholder: "Choose", disabled: true, className: "themed-choice", onChoose: () => {},
  }));
  assert.match(html, /<select[^>]+aria-label="With ___ did you work\?"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /<option value="who">who<\/option>/);
  assert.match(html, /<option value="whom" selected="">whom<\/option>/);
  assert(!html.includes("correctAnswer"));
  const legacy = renderToStaticMarkup(createElement(HomeworkAnswerChoice, {
    choices: ["who", "whom"], value: "legacy answer", label: "Question", placeholder: "Choose",
    disabled: false, className: "", onChoose: () => {},
  }));
  assert.match(legacy, /<option value="legacy answer" selected="">legacy answer<\/option>/);
});
