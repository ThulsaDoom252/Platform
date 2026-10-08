import assert from "node:assert/strict";
import test from "node:test";
import { berriesHomework, berriesLessonFromHtml, berriesVocabulary } from "../src/lib/bundled-lessons/a2-berries";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";
import { normalizeInteractiveHomework } from "../src/lib/lesson-homework";

const names = ["fruit", "a berry → berries", "an apple ✓", "a pineapple", "an orange ✓", "a banana", "a strawberry → strawberries", "a raspberry → raspberries", "a grape → grapes", "a watermelon", "a melon"];
const fixture = names.map(name => `<div class="vcard"><div class="vhead"><span class="em">🍓</span><a class="snd" href="https://dictionary.cambridge.org/">🔊</a><b>${name}</b><span class="tr">/test/ → /tests/</span> — <span class="ua">фрукти &amp; ягоди</span></div><ul><li>Original example for ${name}.</li></ul></div>`).join("") + '<div class="tip">General tips.</div>';
const definitions = [
  ["warm", "Warm-up"], ["vocab", "Vocabulary"], ["ex", "Guess the word"], ["ex", "Personal questions"],
  ["ex", "True or False"], ["gram", "Grammar"], ["read", "Text"], ["dlg", "Dialogue 1"], ["dlg", "Dialogue 2"],
];
const sources = (teacher: boolean) => definitions.map(([className, title]) => `<section class="block ${className}"><h2>${title}</h2>${className === "vocab" ? fixture : `<p>Original ${title} content.</p><ol><li>A sweet ${teacher ? '<span class="ans">berry</span>' : '<span class="blank"></span>'}.</li></ol>`}</section>`).join("")
  + (teacher ? '<section class="block teacher-note key-wrap"><div class="key">Private teaching notes</div></section>' : "");

test("Berries has all eleven source headwords plus eleven helpers with native vocabulary details", () => {
  const words = berriesVocabulary(fixture);
  assert.equal(words.length, 22);
  assert.equal(new Set(words.map(word => word.word)).size, 22);
  assert(words.every(word => word.note && word.description && word.icon && word.translation && word.ipaUs && word.ipaUk && word.examples.length));
  assert(words.slice(0, 11).every(word => word.examples[0].en.startsWith("Original example")));
  assert.equal(words.find(word => word.word === "a grape")!.translation, "виноградина / виноград");
  assert.match(words.find(word => word.word === "to give")!.note!, /give → gave → given/);
  assert(!JSON.stringify(words).includes("https://"));
  assert.throws(() => berriesVocabulary(fixture.replace("a melon", "a pear")));
  assert.throws(() => berriesVocabulary(fixture + fixture));
});

test("Berries homework covers each target once in balanced groups of at most eight, with shuffled banks", () => {
  const words = berriesVocabulary(fixture);
  const plan = berriesHomework(words);
  const vocab = plan.exercises.filter(exercise => exercise.id.startsWith("berries-vocab-"));
  assert.deepEqual(vocab.map(exercise => [exercise.kind, exercise.items.length]), [["fill", 8], ["definition", 7], ["describe", 7]]);
  const targets = vocab.flatMap(exercise => exercise.items.map(item => item.vocabularyWord));
  assert.equal(new Set(targets).size, 22);
  assert.deepEqual(new Set(targets), new Set(words.map(word => word.word)));
  for (const exercise of vocab.filter(exercise => exercise.kind !== "describe")) {
    assert.notDeepEqual(exercise.wordBank, exercise.items.map(item => item.answer));
    assert.deepEqual(new Set(exercise.wordBank), new Set(exercise.items.map(item => item.answer)));
  }
  const fill = vocab[0];
  assert(fill.items.every(item => item.prompt.includes("___") && !item.prompt.includes("word or phrase meaning")));
  assert.equal(plan.exercises.find(exercise => exercise.kind === "translate")!.translationLanguage, "RU");
  assert.equal(plan.exercises.find(exercise => exercise.kind === "translate")!.items.length, 8);
  assert.equal(plan.exercises.filter(exercise => exercise.optional).length, 2);
  assert(plan.exercises.filter(exercise => exercise.optional).every(exercise => exercise.items.length === 8));
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeInteractiveHomework(plan))), JSON.parse(JSON.stringify(plan)));
});

test("HTML import preserves sections, closes warm-up, strips external audio and seals teacher keys", () => {
  const lesson = berriesLessonFromHtml(sources(false), sources(true));
  assert.equal(lesson.title, "A2 · Berries");
  assert.equal(lesson.sections.length, 10);
  assert.equal(lesson.sections[0].defaultOpen, false);
  assert.equal(defaultRegularOpenSections(lesson.sections).length, 1);
  assert.equal(lesson.sections.filter(section => section.tone === "dialogue").length, 2);
  assert.equal(lesson.sections.filter(section => section.tone === "reading").length, 1);
  assert.equal(lesson.sections.at(-1)!.teacherOnly, true);
  assert.equal(lesson.sections.at(-1)!.studentHtml, "");
  assert(!JSON.stringify(lesson.sections).includes("https://dictionary.cambridge.org"));
  assert.match(lesson.sections[2].studentHtml, /Original Guess the word content/);
  assert.equal(regularAnswerMap(lesson.sections[2]).get("list-1-item-1-blank-1")!.answer, "berry");
  const student = publicRegularLessonSections(lesson.sections);
  assert.equal(student.length, 9);
  assert(student.every(section => !section.teacherHtml));
  assert(!JSON.stringify(student).includes("Private teaching notes"));
  assert(!JSON.stringify(student).includes('class=\\"ans\\"'));
});

test("Berries refuses mismatched or incomplete files and teacher answers in the student layer", () => {
  assert.throws(() => berriesLessonFromHtml(sources(false), sources(true).replace("<h2>Dialogue 2", "<h2>Different dialogue")));
  assert.throws(() => berriesLessonFromHtml(sources(false).replace('<span class="blank"></span>', '<span class="ans">berry</span>'), sources(true)));
  assert.throws(() => berriesLessonFromHtml(sources(false), sources(false)));
});
