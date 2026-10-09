import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { householdChoresHomework, householdChoresLesson, householdChoresVocabulary } from "../src/lib/bundled-lessons/a2-household-chores";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap, regularLessonReaderSections } from "../src/lib/regular-lesson";
import { homeworkAnswerMatches, normalizeInteractiveHomework } from "../src/lib/lesson-homework";

test("Household chores has 24 complete, original native vocabulary cards", () => {
  const words = householdChoresVocabulary();
  assert.equal(words.length, 24);
  assert.equal(new Set(words.map(word => word.word)).size, 24);
  assert(words.every(word => word.translation && word.description && word.note && word.icon && word.ipaUs && word.ipaUk && word.examples.length && word.examples[0].tr));
  for (const target of ["to make the bed", "to do the dishes", "to do the laundry", "to sweep the floor", "to mop the floor", "to take out the rubbish", "to share", "to take turns"]) assert(words.some(word => word.word === target));
  assert.match(words.find(word => word.word === "to take out the rubbish")!.note!, /trash/);
  assert.match(words.find(word => word.word === "to dust the furniture")!.note!, /незлічуване/);
  assert(!JSON.stringify(words).includes("https://"));
  words[0].examples[0].en = "changed";
  assert.notEqual(householdChoresVocabulary()[0].examples[0].en, "changed");
});

test("Home vocabulary uses exactly three disjoint groups of eight with real cloze sentences", () => {
  const words = householdChoresVocabulary();
  const plan = householdChoresHomework(words);
  const vocab = plan.exercises.filter(exercise => exercise.id.startsWith("chores-vocab-"));
  assert.deepEqual(vocab.map(exercise => [exercise.kind, exercise.items.length]), [["fill", 8], ["definition", 8], ["describe", 8]]);
  const targets = vocab.flatMap(exercise => exercise.items.map(item => item.vocabularyWord));
  assert.equal(new Set(targets).size, 24);
  assert.deepEqual(new Set(targets), new Set(words.map(word => word.word)));
  assert(vocab[0].items.every(item => item.prompt.includes("___") && !item.prompt.includes("word or phrase meaning")));
  for (const exercise of vocab.filter(exercise => exercise.kind !== "describe")) {
    assert.notDeepEqual(exercise.wordBank, exercise.items.map(item => item.answer));
    assert.deepEqual(new Set(exercise.wordBank), new Set(exercise.items.map(item => item.answer)));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeInteractiveHomework(plan))), JSON.parse(JSON.stringify(plan)));
});

test("Homework includes eight grammar items, eight Russian translations, personal answers and optional writing", () => {
  const plan = householdChoresHomework();
  const grammar = plan.exercises.find(exercise => exercise.id === "chores-grammar")!;
  assert.equal(grammar.items.length, 8);
  assert(grammar.items.every(item => item.prompt.match(/___/g)?.length === 1 && item.answer));
  assert.equal(grammar.items[2].answer, "don't have to");
  assert.deepEqual(grammar.items[2].accepted, ["do not have to"]);
  assert.equal(grammar.items[3].answer, "mustn't");
  const translation = plan.exercises.find(exercise => exercise.kind === "translate")!;
  assert.equal(translation.translationLanguage, "RU");
  assert.equal(translation.translationDirection, "to-english");
  assert.equal(translation.items.length, 8);
  assert(translation.items.every(item => item.answer && /[А-Яа-я]/.test(item.prompt)));
  assert.equal(plan.exercises.find(exercise => exercise.id === "chores-personal")!.items.length, 4);
  assert.deepEqual(plan.exercises.filter(exercise => exercise.optional).map(exercise => exercise.id), ["chores-bonus-plan"]);
  const ids = plan.exercises.flatMap(exercise => exercise.items.map(item => item.id));
  assert.equal(ids.length, new Set(ids).size);
});

test("Vocabulary accepts a bare infinitive and the British/American forms taught in tips", () => {
  const plan = householdChoresHomework();
  for (const exercise of plan.exercises.filter(exercise => exercise.id.startsWith("chores-vocab-") && exercise.kind !== "describe")) {
    for (const item of exercise.items) assert(homeworkAnswerMatches(item, item.vocabularyWord!.replace(/^to /, "")));
  }
  const item = plan.exercises.filter(exercise => exercise.id.startsWith("chores-vocab-") && exercise.kind !== "describe")
    .flatMap(exercise => exercise.items).find(item => item.vocabularyWord === "to take out the rubbish");
  if (item) {
    assert(homeworkAnswerMatches(item, "take out the trash"));
    assert(homeworkAnswerMatches(item, "take out the garbage"));
  }
});

test("Regular lesson has all standard sections and only vocabulary opens by default", () => {
  const lesson = householdChoresLesson();
  assert.equal(lesson.title, "A2 · Household chores");
  assert.equal(lesson.sections.length, 12);
  assert.equal(lesson.sections.filter(section => section.tone === "dialogue").length, 2);
  assert.equal(lesson.sections.filter(section => section.tone === "reading").length, 1);
  assert.equal(lesson.sections[0].tone, "warm");
  assert.equal(lesson.sections[0].defaultOpen, false);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:chores-vocabulary"]);
  assert.equal(regularLessonReaderSections(lesson.sections, true).length, 11);
  const student = publicRegularLessonSections(lesson.sections);
  assert.equal(student.length, 11);
  assert(student.every(section => section.teacherHtml === "" && !section.teacherOnly));
  assert(!JSON.stringify(student).includes('class=\\"ans\\"'));
  assert(!JSON.stringify(student).includes("teaching guide"));
  assert(lesson.sections.filter(section => !section.teacherOnly).every(section => section.studentHtml.includes("data-focus-id")));
  assert(!JSON.stringify(lesson.sections).includes("<script"));
  assert(!JSON.stringify(lesson.sections).includes("https://"));
});

test("All 50 class controls have private keys, contraction variants and British/American alternatives", () => {
  const lesson = householdChoresLesson();
  let total = 0;
  for (const section of lesson.sections) {
    const controls = (section.studentHtml.match(/class=["'][^"']*\b(?:blank|tfbox)\b/gi) ?? []).length;
    const keys = regularAnswerMap(section);
    assert.equal(keys.size, controls, section.title);
    assert([...keys.values()].every(key => key.answer && key.accepted.includes(key.answer)));
    total += keys.size;
  }
  assert.equal(total, 50);
  const vocabulary = regularAnswerMap(lesson.sections.find(section => section.id === "chores-vocabulary-practice")!);
  assert.deepEqual(vocabulary.get("list-1-item-2-blank-1")!.accepted, ["take out the rubbish", "take out the trash", "take out the garbage"]);
  const grammar = regularAnswerMap(lesson.sections.find(section => section.id === "chores-grammar-practice")!);
  assert.deepEqual(grammar.get("list-3-item-1-blank-1")!.accepted, ["don't have to", "do not have to"]);
  const reading = regularAnswerMap(lesson.sections.find(section => section.id === "chores-reading")!);
  assert.deepEqual([...reading.values()].map(item => item.answer), ["True", "False", "False", "True", "False", "True"]);
});

test("Grammar distinguishes no obligation from prohibition, and dialogues/text recycle the lesson targets", () => {
  const lesson = householdChoresLesson();
  const grammar = lesson.sections.find(section => section.id === "chores-grammar")!.studentHtml;
  for (const phrase of ["have to", "has to", "don't have to", "doesn't have to", "mustn't", "необязательно", "запрет"]) assert(grammar.includes(phrase));
  assert(grammar.includes("don't have to ≠ mustn't") || grammar.includes("Don't have to ≠ mustn't"));
  for (const section of lesson.sections.filter(section => section.tone === "dialogue" || section.tone === "reading")) {
    assert(section.studentHtml.includes("<strong>"));
    assert(section.studentHtml.includes("have to"));
    assert(section.studentHtml.includes("questions") || section.studentHtml.includes("Questions"));
  }
  const script = readFileSync("scripts/create-a2-household-chores.ts", "utf8");
  assert(script.includes("BEGIN READ ONLY") && script.includes('process.argv.includes("--apply")'));
  assert(script.includes("preserving teacher edits") && script.includes("pg_advisory_xact_lock"));
  assert(!/\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+lesson_assignments\b/i.test(script));
  assert(!/\b(?:UPDATE|DELETE FROM)\s+(?:lesson_units|lesson_words)\b/i.test(script));
});
