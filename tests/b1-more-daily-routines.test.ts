import assert from "node:assert/strict";
import test from "node:test";
import {
  buildB1MoreDailyRoutinesLesson, DAILY_ROUTINES_LEXICAL_PATTERNS,
  highlightDailyRoutinesText, MORE_DAILY_ROUTINES_LESSON_TITLE,
} from "../src/lib/bundled-lessons/b1-more-daily-routines";
import {
  DAILY_ROUTINES_WORDS, DAILY_ROUTINES_GUESSING, DAILY_ROUTINES_PERSONAL_QUESTIONS,
  DAILY_ROUTINES_GRAMMAR_GROUPS, DAILY_ROUTINES_HOMEWORK,
} from "../src/lib/bundled-lessons/b1-more-daily-routines-activities";
import { DAILY_ROUTINES_PASSAGES } from "../src/lib/bundled-lessons/b1-more-daily-routines-passages";
import {
  defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap, regularLessonReaderSections,
} from "../src/lib/regular-lesson";
import {
  assignedInteractiveHomework, homeworkAnswerMatches, homeworkPlanForAssignment,
  normalizeInteractiveHomework, homeworkAssignedAt, homeworkProgress,
} from "../src/lib/lesson-homework";

const lesson = buildB1MoreDailyRoutinesLesson();
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const prose = (passage: typeof DAILY_ROUTINES_PASSAGES[number]) => passage.kind === "reading"
  ? passage.paragraphs!.join("\n") : passage.turns!.map(turn => turn.text).join("\n");

test("B1 More daily routines is a native complete pack with only vocabulary initially visible", () => {
  assert.equal(lesson.title, MORE_DAILY_ROUTINES_LESSON_TITLE);
  assert.equal(lesson.title, "B1 · More daily routines");
  assert.equal(lesson.sections.length, 11);
  assert.equal(regularLessonReaderSections(lesson.sections, false).length, 10);
  assert.equal(regularLessonReaderSections(lesson.sections, true).length, 11);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:daily-vocabulary"]);
  assert.equal(lesson.sections.filter(section => section.tone === "reading").length, 1);
  assert.equal(lesson.sections.filter(section => section.tone === "dialogue").length, 2);
  assert.equal(new Set(lesson.sections.map(section => section.id)).size, 11);
  assert.equal(lesson.homework.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(lesson.homework)), lesson.homework);
});

test("all nineteen distinct screenshot phrases are infinitives, with three meals, both pets and an unqualified commute", () => {
  assert.equal(lesson.words.length, 19);
  assert.equal(new Set(lesson.words.map(word => word.word)).size, 19);
  assert.deepEqual(new Set(lesson.words.map(word => word.word)), new Set(Object.keys(DAILY_ROUTINES_LEXICAL_PATTERNS)));
  assert(lesson.words.every(word => word.word.startsWith("to ")));
  const commute = lesson.words.find(word => word.word === "to commute")!;
  assert(commute);
  assert(!commute.word.includes("work") && !commute.word.includes("school"));
  assert(commute.note?.includes("to school") && commute.note.includes("to work"));
  for (const word of lesson.words) {
    assert(word.translation && word.description && word.note && word.translationLang === "UK", word.word);
    assert.equal(word.examples.length, 2);
    assert(word.examples.every(example => example.en && example.tr));
  }
  assert.deepEqual(lesson.words, DAILY_ROUTINES_WORDS);
});

test("definition guessing and universal personal practice retain all nineteen items without an exposed answer bank", () => {
  const guess = lesson.sections.find(section => section.id === "daily-guess")!;
  assert.equal((guess.studentHtml.match(/class="blank"/g) ?? []).length, 19);
  assert.equal((guess.studentHtml.match(/<li\b/g) ?? []).length, 19);
  assert.equal((guess.teacherHtml.match(/class="ans"/g) ?? []).length, 19);
  assert(!guess.studentHtml.includes("Suggested answer:") && !guess.studentHtml.includes('class="key"'));
  for (const item of DAILY_ROUTINES_GUESSING) assert(plain(guess.studentHtml).includes(item.prompt));
  assert.deepEqual(new Set(DAILY_ROUTINES_GUESSING.map(item => item.answer)), new Set(lesson.words.map(word => word.word)));
  const personal = lesson.sections.find(section => section.id === "daily-personal")!;
  assert.equal(DAILY_ROUTINES_PERSONAL_QUESTIONS.length, 19);
  assert.equal((personal.studentHtml.match(/<li\b/g) ?? []).length, 19);
  assert(personal.studentHtml.includes("imaginary example"));
  assert(personal.teacherHtml.includes("Answers are personal"));
});

test("one reading and two medium dialogues each use all nineteen phrases and all three grammar families", () => {
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    const text = prose(passage);
    const words = text.split(/\s+/).length;
    assert(words >= 240 && words <= 380, `${passage.id}: ${words} words`);
    if (passage.kind === "dialogue") assert(passage.turns!.length >= 18 && passage.turns!.length <= 24);
    const section = lesson.sections.find(section => section.id === passage.id)!;
    for (const paragraph of passage.paragraphs ?? []) assert(plain(section.studentHtml).includes(paragraph));
    for (const turn of passage.turns ?? []) assert(plain(section.studentHtml).includes(turn.text));
    for (const [headword, pattern] of Object.entries(DAILY_ROUTINES_LEXICAL_PATTERNS)) {
      assert(new RegExp(`\\b(?:${pattern})\\b`, "i").test(text), `${passage.id}: ${headword}`);
    }
    assert(/\bused to (?:stay|sleep|hit|check|buy|work)/i.test(text), `${passage.id}: past habit`);
    assert(/(?:is |I'm |are you )used to \w+ing/i.test(text), `${passage.id}: familiar state`);
    assert(/getting used to \w+ing/i.test(text), `${passage.id}: adaptation`);
    const body = section.studentHtml.split(/<h3\b/)[0];
    const withoutBold = body.replace(/<strong>[\s\S]*?<\/strong>/g, "");
    for (const pattern of Object.values(DAILY_ROUTINES_LEXICAL_PATTERNS)) assert(!new RegExp(pattern, "i").test(plain(withoutBold)), `${passage.id}: unbolded target`);
    assert(!/\b(?:used|use) to\b/i.test(plain(withoutBold)), `${passage.id}: unbolded grammar`);
  }
});

test("every passage has eight True/False decisions and eight questions with evidence and private model answers", () => {
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    assert.equal(passage.trueFalse.length, 8);
    assert.equal(passage.questions.length, 8);
    assert.equal(passage.trueFalse.filter(item => item.answer).length, 4);
    assert(passage.trueFalse.every(item => item.prompt && item.explanation));
    assert(passage.questions.every(item => item.prompt.endsWith("?") && item.suggestedAnswer));
    const section = lesson.sections.find(section => section.id === passage.id)!;
    assert.equal((section.studentHtml.match(/<li\b/g) ?? []).length, 16);
    assert.equal((section.studentHtml.match(/class="tfbox"/g) ?? []).length, 8);
    assert.equal((section.teacherHtml.match(/Suggested answer:/g) ?? []).length, 8);
    assert.equal((section.teacherHtml.match(/class="key"/g) ?? []).length, 16);
    for (const item of passage.questions) assert(plain(section.teacherHtml).includes(item.suggestedAnswer));
  }
});

test("all sixty-one automatic native controls resolve private keys, including both True/False button forms", () => {
  let total = 0, fill = 0, trueFalse = 0;
  for (const section of lesson.sections) {
    const map = regularAnswerMap(section);
    assert.equal(map.size, (section.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length, section.id);
    for (const [id, key] of map) {
      const item = { id, prompt: "", answer: key.answer, accepted: key.accepted };
      assert(homeworkAnswerMatches(item, key.answer));
      for (const answer of key.accepted) assert(homeworkAnswerMatches(item, answer));
      assert(!homeworkAnswerMatches(item, "an unrelated answer"));
      if (key.kind === "true-false") {
        trueFalse++;
        assert(homeworkAnswerMatches(item, key.answer === "True" ? "T" : "F"));
      } else fill++;
    }
    total += map.size;
    const teacherIds = new Set([...section.teacherHtml.matchAll(/data-focus-id="([^"]+)"/g)].map(match => match[1]));
    for (const match of section.studentHtml.matchAll(/data-focus-id="([^"]+)"/g)) assert(teacherIds.has(match[1]), `${section.id}/${match[1]}`);
  }
  assert.deepEqual({ total, fill, trueFalse }, { total: 61, fill: 37, trueFalse: 24 });
});

test("grammar guide distinguishes all meanings and standard did-use forms; three practice groups remain complete", () => {
  const guide = lesson.sections.find(section => section.id === "daily-grammar")!.studentHtml;
  for (const form of ["used to + base verb", "be used to + -ing", "get used to + -ing", "didn't use to", "Did you use to", "a preposition", "present simple", "does not mean I enjoy it"]) assert(plain(guide).includes(form), form);
  assert.equal(DAILY_ROUTINES_GRAMMAR_GROUPS.length, 3);
  for (const group of DAILY_ROUTINES_GRAMMAR_GROUPS) {
    assert.equal(group.items.length, 6);
    for (const item of group.items) assert.equal(item.prompt.split("___").length, 2);
  }
});

test("student payloads reveal neither teacher keys nor model answers; teacher retains personal and creative guidance", () => {
  const publicSections = publicRegularLessonSections(lesson.sections);
  assert.equal(publicSections.length, 10);
  for (const section of publicSections) {
    assert.equal(section.teacherHtml, "");
    assert(!/class="[^"\n]*\b(?:key|ans|teacher-note)\b/.test(section.studentHtml));
    assert(!section.studentHtml.includes("Suggested answer:"));
    assert.equal(regularAnswerMap(section).size, 0);
  }
  assert(!JSON.stringify(publicSections).includes("Teacher route and answer guidance"));
  const creative = lesson.sections.find(section => section.id === "daily-creative")!;
  assert(creative.studentHtml.includes("<ol"));
  assert(creative.teacherHtml.includes('class="key"'));
});

test("homework is varied, portable and light, with one optional creative item; creating it does not assign anything", () => {
  const plan = lesson.homework[0];
  assert.deepEqual(plan, JSON.parse(JSON.stringify(normalizeInteractiveHomework(DAILY_ROUTINES_HOMEWORK))));
  assert.equal(plan.exercises.length, 7);
  assert.equal(plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0), 22);
  assert.equal(plan.exercises.filter(exercise => exercise.optional).length, 1);
  assert(plan.exercises.some(exercise => exercise.kind === "translate"));
  assert(plan.exercises.some(exercise => exercise.kind === "question-audio"));
  assert(plan.exercises.some(exercise => exercise.kind === "question-text"));
  for (const exercise of plan.exercises) for (const item of exercise.items) {
    if (item.answer) for (const answer of [item.answer, ...(item.accepted ?? [])]) assert(homeworkAnswerMatches(item, answer));
  }
  const state = { "lesson:answer": "Keep this draft" };
  const before = structuredClone(state);
  assert.equal(homeworkAssignedAt(state), null);
  assert.equal(assignedInteractiveHomework(plan, state), null);
  assert.deepEqual(homeworkPlanForAssignment(plan, state), plan);
  assert.deepEqual(state, before);
  assert.equal(homeworkProgress(plan, {}).total, 21);
});

test("highlighting escapes text, handles inflections and merges overlapping lexical and grammar ranges", () => {
  const input = '<img src=x onerror=alert(1)> I used to stay up late. I am used to making my own lunch. She is getting used to commuting.';
  const html = highlightDailyRoutinesText(input);
  assert(!html.includes("<img") && html.includes("&lt;img"));
  assert(html.includes("<strong>used to stay up late</strong>"));
  assert(html.includes("<strong>am used to making my own lunch</strong>"));
  assert(html.includes("<strong>getting used to commuting</strong>"));
  assert.equal(plain(html), input);
  assert(!/<strong>[^]*?<strong>/.test(html.replace(/<strong>[^]*?<\/strong>/g, "")));
  assert.equal(highlightDailyRoutinesText("A routine."), "A routine.");
});
