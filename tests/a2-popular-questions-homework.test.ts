import assert from "node:assert/strict";
import test from "node:test";
import { buildPopularQuestionsHomework } from "../src/lib/bundled-lessons/a2-popular-questions-homework";
import {
  assignedInteractiveHomework, homeworkAnswerMatches, homeworkAssignedAt,
  homeworkAssignedAtKey, homeworkAssignedExercisesKey, homeworkPlanForAssignment,
  homeworkProgress, homeworkValueKey, isHomeworkAutoKind, normalizeInteractiveHomework,
} from "../src/lib/lesson-homework";

test("Popular questions homework is compact, varied, complete and JSON portable", () => {
  const plan = buildPopularQuestionsHomework();
  assert.equal(plan.kind, "INTERACTIVE_HOMEWORK_V1");
  assert.equal(plan.exercises.length, 7);
  assert.equal(plan.exercises.flatMap(exercise => exercise.items).length, 20);
  assert.deepEqual(plan.exercises.map(exercise => exercise.items.length), [3, 3, 6, 3, 3, 1, 1]);
  assert.deepEqual(plan.exercises.map(exercise => exercise.kind), ["definition", "fill", "fill", "translate", "question-text", "question-text", "question-audio"]);
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeInteractiveHomework(plan))), plan);
  assert(plan.intro?.includes("15–20 minutes"));
  const ids = plan.exercises.flatMap(exercise => [exercise.id, ...exercise.items.map(item => item.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert(plan.exercises.every(exercise => exercise.instruction && exercise.items.length && !exercise.optional));
});

test("all nine popular questions appear in recall, correction or translation, without vocabulary reorganisation expanding the plan", () => {
  const plan = buildPopularQuestionsHomework();
  const questions = plan.exercises.flatMap(exercise => exercise.items.map(item => item.answer)).filter(Boolean);
  for (const expected of ["Where are you from?", "What languages do you speak?", "What is your phone number?", "What are your hobbies?", "Where do you live?", "What is your favourite food?", "Do you have a job?"]) {
    assert(questions.includes(expected), expected);
  }
  assert(questions.includes("I am twenty-nine years old."));
  assert(questions.includes("I would like to work as a chef."));
  assert.equal(plan.exercises.filter(exercise => exercise.kind === "definition").length, 1);
  assert(!plan.exercises.some(exercise => exercise.wordBank?.length));
});

test("automatic answers accept standard contractions, British/American spelling and valid variants but not incorrect grammar", () => {
  const plan = buildPopularQuestionsHomework();
  const item = (id: string) => plan.exercises.flatMap(exercise => exercise.items).find(current => current.id === id)!;
  for (const exercise of plan.exercises) for (const current of exercise.items) {
    if (isHomeworkAutoKind(exercise.kind) || exercise.kind === "translate") {
      assert(current.answer, current.id);
      for (const answer of [current.answer, ...(current.accepted ?? [])]) assert(homeworkAnswerMatches(current, answer), `${current.id}: ${answer}`);
      assert(!homeworkAnswerMatches(current, "obviously incorrect"));
      assert(!current.word && !current.hint && !current.choices);
    } else assert(!current.answer && !current.accepted);
  }
  assert(homeworkAnswerMatches(item("pq-repair-01"), "I'm 29."));
  assert(!homeworkAnswerMatches(item("pq-repair-01"), "I have 29 years."));
  assert(!homeworkAnswerMatches(item("pq-repair-02"), "What is your hobbies?"));
  assert(!homeworkAnswerMatches(item("pq-repair-03"), "Where you live?"));
  assert(homeworkAnswerMatches(item("pq-translate-01"), "What's your favorite food?"));
  assert(homeworkAnswerMatches(item("pq-translate-02"), "Have you got a job?"));
  assert(homeworkAnswerMatches(item("pq-translate-03"), "I'd like to be a chef."));
  assert(homeworkAnswerMatches(item("pq-grammar-06"), "was"));
  assert(!homeworkAnswerMatches(item("pq-grammar-06"), "would be"));
});

test("modal and all three conditional structures are reviewed with clear targets", () => {
  const grammar = buildPopularQuestionsHomework().exercises.find(exercise => exercise.id === "pq-grammar-mix")!;
  assert.deepEqual(grammar.items.map(item => item.answer), ["can", "should", "had better", "learn", "will call", "were"]);
  for (const [index, expression] of ["can", "should", "had better"].entries()) assert(grammar.items[index].prompt.includes(`use ${expression}`));
  assert(grammar.items[3].prompt.includes("General habit"));
  assert(grammar.items[4].prompt.includes("tomorrow"));
  assert(grammar.items[5].prompt.includes("imaginary"));
});

test("reading is self-contained, writing asks original questions and voice has a short, privacy-safe prompt", () => {
  const plan = buildPopularQuestionsHomework();
  const reading = plan.exercises.find(exercise => exercise.id === "pq-read-mini-dialogue")!;
  assert(reading.referenceTitle && reading.referenceText);
  assert(reading.referenceText.includes("I'm from Poland, but now I live here in Lviv."));
  assert(reading.referenceText.includes("I work in a café, but I'd like to be a chef."));
  assert(reading.referenceText.includes("we'll make dinner together"));
  assert.equal((reading.referenceText.match(/^(Mia|Alex):/gm) ?? []).length, 8);
  assert(reading.items.every(item => !item.answer));
  const writing = plan.exercises.find(exercise => exercise.id === "pq-write-questions")!;
  assert(writing.instruction.includes("two different questions"));
  assert(writing.items[0].prompt.includes("past form after if"));
  const voice = plan.exercises.find(exercise => exercise.kind === "question-audio")!;
  assert(voice.instruction.includes("30–45-second"));
  assert(voice.items[0].prompt.includes("Do not include your phone number or exact address"));
  const translation = plan.exercises.find(exercise => exercise.kind === "translate")!;
  assert.equal(translation.translationLanguage, "UK");
  assert.equal(translation.translationDirection, "to-english");
  assert(translation.items.every(item => /[ієїґ]/i.test(item.prompt)));
});

test("building and viewing a plan neither assigns it nor changes saved work; selecting exercises remains supported", () => {
  const plan = buildPopularQuestionsHomework();
  const state = { "lesson:existing": "keep", [homeworkValueKey("pq-write-01")]: "My draft" };
  const before = structuredClone(state);
  assert.equal(homeworkAssignedAt(state), null);
  assert.equal(assignedInteractiveHomework(plan, state), null);
  assert.equal(homeworkPlanForAssignment(plan, state)?.exercises.length, 7);
  assert.deepEqual(state, before);
  const selected = assignedInteractiveHomework(plan, {
    ...state, [homeworkAssignedAtKey()]: "2026-10-15T10:00:00.000Z",
    [homeworkAssignedExercisesKey()]: JSON.stringify(["pq-write-questions", "pq-speak-about-you"]),
  });
  assert.deepEqual(selected?.exercises.map(exercise => exercise.id), ["pq-write-questions", "pq-speak-about-you"]);
  assert.deepEqual(homeworkProgress(plan, {}), { done: 0, total: 20 });
  plan.exercises[0].items[0].prompt = "Mutated local copy";
  assert.notEqual(buildPopularQuestionsHomework().exercises[0].items[0].prompt, "Mutated local copy");
});
