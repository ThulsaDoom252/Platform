import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { feelingsLessonFromHtml, FEELINGS_LESSON_TITLE } from "../src/lib/bundled-lessons/c1-feelings-and-emotions";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap, regularLessonReaderSections } from "../src/lib/regular-lesson";
import { homeworkAnswerMatches, normalizeInteractiveHomework } from "../src/lib/lesson-homework";
import { HomeworkReferenceText } from "../src/components/lessons/homework-reference-text";

const student = readFileSync(new URL("../scripts/fixtures/c1-feelings-student.html", import.meta.url), "utf8");
const teacher = readFileSync(new URL("../scripts/fixtures/c1-feelings-teacher.html", import.meta.url), "utf8");
const lesson = feelingsLessonFromHtml(student, teacher);
const sections = [...student.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)].map(match => match[1]);
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, "").trim();
const section = (number: number) => lesson.sections.find(item => item.id === `feelings-${String(number).padStart(2, "0")}`)!;

test("C1 Feelings preserves all fifteen original sections plus vocabulary guidance and the private teacher warm-up", () => {
  assert.equal(lesson.title, FEELINGS_LESSON_TITLE);
  assert.equal(lesson.sections.length, 17);
  for (let number = 1; number <= 15; number++) assert.ok(section(number), `Section ${number} missing`);
  assert.equal(regularLessonReaderSections(lesson.sections, true).length, 17);
  assert.equal(regularLessonReaderSections(lesson.sections, false).length, 16);
  const warmup = lesson.sections[0];
  assert.equal(warmup.teacherOnly, true);
  assert.equal(warmup.studentHtml, "");
  for (const topic of ["Greeting", "causative", "3rd conditional", "inversion", "cleft", "reporting verb", "had better", "mixed conditional", "Lead-in", "loose", "clammed up"]) assert.ok(warmup.teacherHtml.includes(topic), `Teacher warm-up lost ${topic}`);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:feelings-01"]);
});

test("all sixteen emotion expressions retain their categories, emojis, UK pronunciation, definitions and complete examples", () => {
  assert.equal(lesson.words.length, 16);
  assert.equal(new Set(lesson.words.map(word => word.word)).size, 16);
  assert.deepEqual([...new Set(lesson.words.map(word => word.category))], ["Shock, stress & anger", "Embarrassment", "Laughter", "Strong positive feelings"]);
  for (const word of lesson.words) {
    assert(word.icon && word.ipaUk && word.ipaUs && word.description && word.translation && word.note && word.sectionColor);
    assert.equal(word.translationLang, "UK");
    assert.equal(word.examples.length, 1);
    assert(word.examples[0].en && word.examples[0].tr);
    assert(plain(sections[0]).includes(plain(word.description!)));
    assert(plain(sections[0]).includes(plain(word.examples[0].en)));
    assert(sections[0].includes(word.ipaUk!));
  }
  assert(lesson.sections.find(item => item.id === "feelings-vocabulary-guide")?.studentHtml.includes("make sb cringe"));
});

test("grammar tables, both full readings, every dialogue turn and all comprehension items survive conversion", () => {
  const grammar = sections[4].replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "");
  assert.equal(plain(section(5).studentHtml), plain(grammar));
  for (const number of [11, 12, 13, 14]) {
    const sourceContext = sections[number - 1].replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "").split("<h3>Questions</h3>")[0].replace(/<p\b[^>]*class="instr"[^>]*>[\s\S]*?<\/p>/i, "");
    const exercises = lesson.homework[0].exercises.filter(exercise => exercise.id.startsWith(`regular-feelings-${number}-`));
    assert.equal(exercises.length, 2);
    for (const exercise of exercises) assert.equal(plain(exercise.referenceText!), plain(sourceContext), `Incomplete homework passage ${number}`);
    assert.equal((section(number).studentHtml.match(/<li\b/g) ?? []).length, (sections[number - 1].match(/<li\b/g) ?? []).length);
    if ([12, 14].includes(number)) assert.equal((section(number).studentHtml.match(/<b class="sp">/g) ?? []).length, (sections[number - 1].match(/<div class="sp">/g) ?? []).length);
  }
  assert(section(9).studentHtml.includes("want sth done"));
  assert(section(15).studentHtml.includes("Speaking questions"));
  assert.equal((section(15).studentHtml.match(/<li\b/g) ?? []).length, 9);
});

test("all 126 automatic lesson controls have teacher-only answers; public sections contain no keys or private warm-up", () => {
  let total = 0;
  for (const current of lesson.sections.filter(item => !item.teacherOnly)) {
    const controls = (current.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length;
    assert.equal(regularAnswerMap(current).size, controls, current.title);
    total += controls;
    const teacherFocus = new Set([...current.teacherHtml.matchAll(/data-focus-id="([^"]+)"/g)].map(match => match[1]));
    for (const match of current.studentHtml.matchAll(/data-focus-id="([^"]+)"/g)) assert(teacherFocus.has(match[1]), `Focus missing ${current.id}/${match[1]}`);
  }
  assert.equal(total, 126);
  const publicSections = publicRegularLessonSections(lesson.sections);
  assert.equal(publicSections.length, 16);
  assert(publicSections.every(item => !item.teacherHtml && !/class="[^"\n]*\bkey\b/.test(item.studentHtml)));
  assert(!JSON.stringify(publicSections).includes("Teaching tip"));
  assert(section(5).teacherHtml.includes("Teaching tip"));
  assert(section(11).teacherHtml.includes("the pitch I’ve been rehearsing for two months"));
  const reader = readFileSync(new URL("../src/components/lessons/regular-lesson-view.tsx", import.meta.url), "utf8");
  assert.match(reader, /const bodyMarkup = useMemo/);
  assert.match(reader, /dangerouslySetInnerHTML=\{bodyMarkup\}/);
});

test("homework contains 19 native exercises and 189 items, including complete references, all translations and nine recordings", () => {
  const plan = normalizeInteractiveHomework(lesson.homework[0])!;
  assert.equal(plan.exercises.length, 19);
  assert.equal(plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0), 189);
  const vocabulary = plan.exercises.filter(exercise => exercise.items.some(item => item.vocabularyWord));
  assert.deepEqual(vocabulary.map(exercise => exercise.kind), ["fill", "definition", "describe"]);
  assert.deepEqual(vocabulary.map(exercise => exercise.items.length), [6, 5, 5]);
  assert.equal(new Set(vocabulary.flatMap(exercise => exercise.items.map(item => item.vocabularyWord))).size, 16);
  assert(vocabulary.filter(exercise => exercise.kind === "fill").flatMap(exercise => exercise.items).every(item => !/[а-яіїєґ]/iu.test(item.prompt)));
  const reference = plan.exercises.filter(exercise => exercise.referenceText);
  assert.equal(reference.length, 8);
  assert(reference.every(exercise => exercise.referenceText!.length > 1_000 && !exercise.referenceText!.includes("Key:")));
  for (const original of lesson.homework[0].exercises.filter(exercise => exercise.referenceText)) assert.equal(plan.exercises.find(exercise => exercise.id === original.id)?.referenceText, original.referenceText);
  assert.equal(plan.exercises.filter(exercise => exercise.kind === "translate")[0].translationLanguage, "UK");
  assert.equal(plan.exercises.filter(exercise => exercise.kind === "translate")[0].items.length, 12);
  assert.equal(plan.exercises.at(-1)?.kind, "question-audio");
  assert.equal(plan.exercises.at(-1)?.items.length, 9);
  assert(plan.exercises.filter(exercise => exercise.id.startsWith("regular-") && exercise.kind === "fill").every(exercise => !exercise.wordBank));
  const ids = plan.exercises.flatMap(exercise => exercise.items.map(item => item.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("every native automatic homework item accepts its full key and alternatives, not truncated or malformed slash answers", () => {
  for (const exercise of lesson.homework[0].exercises.filter(exercise => ["fill", "definition", "translate"].includes(exercise.kind))) {
    for (const item of exercise.items) {
      assert(item.answer, `${exercise.title}/${item.id}: missing key`);
      assert(homeworkAnswerMatches(item, item.answer!), item.id);
      for (const alternative of item.accepted ?? []) assert(homeworkAnswerMatches(item, alternative), `${item.id}/${alternative}`);
      assert(!homeworkAnswerMatches(item, "something completely wrong"));
      if (exercise.kind === "fill") assert.equal((item.prompt.match(/___/g) ?? []).length, 1, item.id);
    }
  }
  const present = lesson.homework[0].exercises.find(exercise => exercise.id === "regular-feelings-07-1")!;
  assert(homeworkAnswerMatches(present.items[0], "are you being"));
  assert.equal(present.items[0].prompt, "Why ___ (you / be) so flustered today? It’s just a short presentation.");
  assert(homeworkAnswerMatches(present.items[6], "I'm not denying".replace("I", "")));
  const corrections = lesson.homework[0].exercises.find(exercise => exercise.id === "regular-feelings-08-1")!;
  assert(homeworkAnswerMatches(corrections.items[4], "I was very taken aback by his reaction."));
  assert(homeworkAnswerMatches(corrections.items[9], "Correct"));
});

test("homework reference material is escaped, accessible and backward-compatible with exercises without a passage", () => {
  const exercise = { id: "ref", title: "Questions", instruction: "Answer.", kind: "question-text" as const, items: [], referenceTitle: "Full reading", referenceText: "Start\n<script>alert(1)</script>\nEnd" };
  const html = renderToStaticMarkup(React.createElement(HomeworkReferenceText, { exercise }));
  assert(html.includes("<details") && html.includes("<summary") && html.includes("Full reading"));
  assert(html.includes("&lt;script&gt;") && !html.includes("<script>"));
  assert(html.includes("whitespace-pre-wrap") && html.includes("break-words"));
  assert.equal(renderToStaticMarkup(React.createElement(HomeworkReferenceText, { exercise: { ...exercise, referenceText: undefined } })), "");
  const editor = readFileSync(new URL("../src/components/lessons/student-homework-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /referenceText: original.referenceText, referenceTitle: original.referenceTitle/);
});

test("mismatched, incomplete and teacher-contaminated source files cannot silently create a partial lesson", () => {
  assert.throws(() => feelingsLessonFromHtml(student.replace("<section>", "<article>"), teacher));
  assert.throws(() => feelingsLessonFromHtml(student, teacher.replace("Grammar practice B", "Wrong section")));
  assert.throws(() => feelingsLessonFromHtml(student.replace("Read the expressions", '<div class="key">private</div>Read the expressions'), teacher));
});
