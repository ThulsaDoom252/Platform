import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_ROUTINES_CREATIVE,
  DAILY_ROUTINES_GRAMMAR_GROUPS,
  DAILY_ROUTINES_GUESSING,
  DAILY_ROUTINES_HOMEWORK,
  DAILY_ROUTINES_PERSONAL_QUESTIONS,
  DAILY_ROUTINES_WORDS,
} from "../src/lib/bundled-lessons/b1-more-daily-routines-activities";
import { homeworkAnswerMatches, homeworkProgress, isHomeworkAutoKind, normalizeInteractiveHomework } from "../src/lib/lesson-homework";

const expectedHeadwords = [
  "to hit the snooze button", "to have a shave", "to commute", "to make one's own dinner",
  "to run errands", "to set one's alarm", "to make one's own lunch", "to have an early night",
  "to feed the dog", "to chill on the sofa", "to walk the dog", "to check one's messages",
  "to check one's phone", "to have a nap", "to stay up late", "to feed the cat",
  "to make one's own breakfast", "to sleep in", "to grab a coffee",
];

test("daily routine cards cover all nineteen distinct targets in infinitive form with full original support", () => {
  assert.deepEqual(DAILY_ROUTINES_WORDS.map(word => word.word), expectedHeadwords);
  assert.equal(new Set(DAILY_ROUTINES_WORDS.map(word => word.word)).size, 19);
  for (const word of DAILY_ROUTINES_WORDS) {
    assert(word.word.startsWith("to "));
    assert.equal(word.translationLang, "UK");
    assert(word.translation && word.description && word.note && word.icon);
    assert.equal(word.ipaUs, null);
    assert.equal(word.ipaUk, null);
    assert.equal(word.examples.length, 2);
    assert(word.examples.every(example => example.en.length > 20 && example.tr.length > 20));
  }
  const commute = DAILY_ROUTINES_WORDS.find(word => word.word === "to commute")!;
  assert(commute.note?.includes("(to school, to work, etc.)"));
  for (const word of DAILY_ROUTINES_WORDS.filter(word => word.word.includes("one's"))) {
    assert(word.note?.includes("my/your/his/her/our/their"));
  }
});

test("all guessing tasks are unbanked meaningful definitions accepting canonical and natural possessives", () => {
  assert.equal(DAILY_ROUTINES_GUESSING.length, 19);
  assert.deepEqual(DAILY_ROUTINES_GUESSING.map(item => item.answer), expectedHeadwords);
  assert.equal(new Set(DAILY_ROUTINES_GUESSING.map(item => item.prompt)).size, 19);
  for (const item of DAILY_ROUTINES_GUESSING) {
    assert(item.prompt.length >= 25);
    assert(item.explanation.includes(item.answer));
    assert(item.accepted?.includes(item.answer.replace(/^to /, "")));
    assert(!("wordBank" in item) && !("choices" in item));
    assert(!item.prompt.toLowerCase().includes(item.answer.toLowerCase()));
    if (item.answer.includes("one's")) {
      for (const possessive of ["my", "your", "his", "her", "our", "their"]) {
        assert(item.accepted?.includes(item.answer.replace("one's", possessive)));
        assert(item.accepted?.includes(item.answer.replace("one's", possessive).replace(/^to /, "")));
      }
    }
  }
});

test("nineteen personal questions stay inclusive and do not require a particular job, pet or grooming routine", () => {
  assert.equal(DAILY_ROUTINES_PERSONAL_QUESTIONS.length, 19);
  assert.equal(new Set(DAILY_ROUTINES_PERSONAL_QUESTIONS).size, 19);
  assert(DAILY_ROUTINES_PERSONAL_QUESTIONS.every(question => question.includes("?") && /if |would /i.test(question)));
  assert(DAILY_ROUTINES_PERSONAL_QUESTIONS[1].includes("If you have a shave"));
  assert(DAILY_ROUTINES_PERSONAL_QUESTIONS[2].includes("If not"));
  assert(DAILY_ROUTINES_PERSONAL_QUESTIONS[8].includes("If you had to feed the dog"));
  assert(DAILY_ROUTINES_PERSONAL_QUESTIONS[15].includes("If you had to feed the cat"));
  assert(DAILY_ROUTINES_PERSONAL_QUESTIONS[18].includes("If you do not drink coffee"));
});

test("grammar contains three six-item contrasts with one gap, clear requested forms and full teacher explanations", () => {
  assert.equal(DAILY_ROUTINES_GRAMMAR_GROUPS.length, 3);
  assert.deepEqual(DAILY_ROUTINES_GRAMMAR_GROUPS.map(group => group.items.length), [6, 6, 6]);
  assert.equal(new Set(DAILY_ROUTINES_GRAMMAR_GROUPS.map(group => group.id)).size, 3);
  for (const group of DAILY_ROUTINES_GRAMMAR_GROUPS) {
    assert(group.title && group.instruction);
    for (const item of group.items) {
      assert.equal((item.prompt.match(/___/g) ?? []).length, 1);
      assert(item.answer && item.explanation.length > 60);
      assert(!/\bdid(?:n't| not)?\s+(?:you\s+)?used to\b/i.test(item.answer), item.answer);
    }
  }
  const [past, familiar, adapting] = DAILY_ROUTINES_GRAMMAR_GROUPS;
  assert(past.items.some(item => item.answer === "Did you use to"));
  assert(past.items.some(item => item.answer.startsWith("didn't use to")));
  assert(past.items.every(item => !/\b(?:making|hitting|grabbing|sleeping|setting)\b/.test(item.answer)));
  assert(familiar.items.every(item => /used to \w+ing\b/.test(item.answer)));
  assert(adapting.items.every(item => /used to \w+ing\b/.test(item.answer)));
  assert(adapting.items.some(item => item.answer.startsWith("got used to")));
  assert(adapting.items.some(item => item.answer.startsWith("will get used to")));
  assert(adapting.items.some(item => item.answer.startsWith("am getting used to")));
  assert(adapting.items.some(item => item.accepted?.some(answer => answer.includes("gotten used to"))));
});

test("homework stays compact and varied after normalization with a single optional bonus", () => {
  const plan = DAILY_ROUTINES_HOMEWORK;
  assert.equal(plan.kind, "INTERACTIVE_HOMEWORK_V1");
  assert.equal(plan.exercises.length, 7);
  assert.deepEqual(plan.exercises.map(exercise => exercise.items.length), [4, 4, 6, 4, 2, 1, 1]);
  assert.deepEqual(plan.exercises.map(exercise => exercise.kind), ["definition", "fill", "fill", "translate", "question-text", "question-audio", "question-text"]);
  assert.equal(plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0), 22);
  assert.deepEqual(homeworkProgress(plan, {}), { done: 0, total: 21 });
  assert.equal(plan.exercises.filter(exercise => exercise.optional).length, 1);
  assert.equal(plan.exercises.at(-1)?.optional, true);
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeInteractiveHomework(plan))), plan);
  const ids = plan.exercises.flatMap(exercise => [exercise.id, ...exercise.items.map(item => item.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert(plan.intro?.includes("20–25 minutes"));
  assert(plan.exercises.every(exercise => !exercise.wordBank));
});

test("automatic homework keys are accepted, grammar mistakes rejected, and open creative/voice tasks remain teacher reviewed", () => {
  const plan = DAILY_ROUTINES_HOMEWORK;
  for (const exercise of plan.exercises) {
    assert(exercise.instruction);
    for (const item of exercise.items) {
      if (isHomeworkAutoKind(exercise.kind) || exercise.kind === "translate") {
        assert(item.answer, item.id);
        for (const answer of [item.answer, ...(item.accepted ?? [])]) {
          assert(homeworkAnswerMatches(item, answer), `${item.id}: ${answer}`);
        }
        assert(!homeworkAnswerMatches(item, "an obviously wrong response"));
      } else assert(!item.answer && !item.accepted);
    }
  }
  const grammar = plan.exercises.find(exercise => exercise.id === "dr-hw-grammar")!;
  assert(!homeworkAnswerMatches(grammar.items[1], "didn't used to make"));
  assert(!homeworkAnswerMatches(grammar.items[3], "am used to check"));
  assert(!homeworkAnswerMatches(grammar.items[4], "is getting used to walk"));
  const translation = plan.exercises.find(exercise => exercise.kind === "translate")!;
  assert.equal(translation.translationLanguage, "UK");
  assert.equal(translation.translationDirection, "to-english");
  assert(translation.items.every(item => /[ієїґ]/i.test(item.prompt)));
  assert(plan.exercises.find(exercise => exercise.kind === "question-audio")?.instruction.includes("40–60-second"));
  assert(DAILY_ROUTINES_CREATIVE.teacherNotes.includes("base verb"));
  assert.equal(DAILY_ROUTINES_CREATIVE.prompts.length, 4);
});
