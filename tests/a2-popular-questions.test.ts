import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildA2PopularQuestionsLesson,
  POPULAR_QUESTIONS_LESSON_TITLE,
} from "../src/lib/bundled-lessons/a2-popular-questions";
import {
  defaultRegularOpenSections,
  isRegularTranslationExercise,
  publicRegularLessonSections,
  regularAnswerMap,
  regularLessonReaderSections,
} from "../src/lib/regular-lesson";
import { normalizeHomeworkAnswer } from "../src/lib/lesson-homework";

const student = readFileSync(new URL("../scripts/fixtures/a2-popular-questions-student.html", import.meta.url), "utf8");
const teacher = readFileSync(new URL("../scripts/fixtures/a2-popular-questions-teacher.html", import.meta.url), "utf8");
const lesson = buildA2PopularQuestionsLesson(student, teacher);
const sourceSections = (source: string) => [...source.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)].map(match => match[1]);
const sourceStudent = sourceSections(student), sourceTeacher = sourceSections(teacher);
const section = (number: number) => lesson.sections.find(item => item.id === `popular-questions-${String(number).padStart(2, "0")}`)!;
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, "");
const items = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
const matches = (number: number, id: string, answer: string) => regularAnswerMap(section(number)).get(id)?.accepted
  .map(normalizeHomeworkAnswer).includes(normalizeHomeworkAnswer(answer));

test("Popular questions preserves all ten lesson blocks, a visible guidance block and private teacher notes without invented homework", () => {
  assert.equal(lesson.title, "A2 · Popular questions");
  assert.equal(lesson.title, POPULAR_QUESTIONS_LESSON_TITLE);
  assert.equal(lesson.sections.length, 12);
  assert.equal(lesson.homework.length, 0);
  assert.equal(regularLessonReaderSections(lesson.sections, false).length, 11);
  assert.equal(regularLessonReaderSections(lesson.sections, true).length, 11);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:popular-questions-02"]);
  for (let number = 1; number <= 10; number++) {
    assert.ok(section(number));
    assert.equal(section(number).teacherOnly, undefined);
    const original = sourceStudent[number - 1].replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "")
      .replace("The cake is in the kitchen.", "The cake is not on the table.")
      .replace("📌 from — у кінці питання! ✗ From where are you?", lesson.words[0].note!);
    assert.equal(plain(section(number).studentHtml), plain(original), `Lost student content in ${number}`);
  }
  const notes = lesson.sections.at(-1)!;
  assert.equal(notes.tone, "teacher");
  assert.equal(notes.teacherOnly, true);
  assert.equal(notes.studentHtml, "");
  assert.equal(items(notes.teacherHtml).length, 6);
  assert(notes.teacherHtml.includes("Victoria_Lesson04_Homework.docx"));
  assert.equal(plain(notes.teacherHtml), plain(sourceTeacher.at(-1)!));
});

test("nine native question cards retain all emojis, translations, examples and source notes except the explicit formality clarification", () => {
  assert.equal(lesson.words.length, 9);
  assert.equal(new Set(lesson.words.map(word => word.word)).size, 9);
  assert.equal(lesson.words.reduce((total, word) => total + word.examples.length, 0), 18);
  const notes = [...sourceStudent[1].matchAll(/<div class="note">([\s\S]*?)<\/div>/gi)].map(match => match[1]);
  for (const [index, word] of lesson.words.entries()) {
    assert(word.icon && word.translation && word.note);
    assert.equal(word.category, "Popular questions");
    assert.equal(word.translationLang, "UK");
    assert.equal(word.ipaUk, null);
    assert.equal(word.ipaUs, null);
    assert.equal(word.description, null);
    assert(sourceStudent[1].includes(word.word));
    assert(sourceStudent[1].includes(word.translation));
    for (const example of word.examples) assert(sourceStudent[1].includes(example.en));
    if (index > 0) assert.equal(plain(word.note), plain(notes[index]));
  }
  assert.match(lesson.words[0].note!, /граматично правильно/);
  assert.match(lesson.words[0].note!, /формально/);
  assert(!lesson.words[0].note!.includes("✗ From where"));
  assert(section(2).studentHtml.includes(lesson.words[0].note!));
  assert(section(2).teacherHtml.includes(lesson.words[0].note!));
  assert(student.includes("✗ From where are you?"), "Private source fixture should remain authentic");
});

test("helper bank, question-order advice, source lesson heading and all practice group sizes survive native conversion", () => {
  const guidance = lesson.sections.find(item => item.id === "popular-questions-vocabulary-guide")!;
  const support = sourceStudent[1].match(/<div class="support">([\s\S]*?)<\/div>/)![1];
  const tip = sourceStudent[1].match(/<div class="tip">([\s\S]*?)<\/div>/)![1];
  assert(plain(guidance.studentHtml).includes(plain(support)));
  assert(plain(guidance.studentHtml).includes(plain(tip)));
  assert(guidance.studentHtml.includes("Getting to Know People"));
  for (const word of ["languages", "Polish", "German", "Spanish", "Italian", "a little", "hobbies", "free time", "double", "zero", "drawing", "swimming", "chef", "neighbour", "building", "polite", "cake", "And you?", "What about you?"]) assert(guidance.studentHtml.includes(word));
  const listSizes = lesson.sections.filter(current => /^popular-questions-\d\d$/.test(current.id) && current.tone !== "vocab")
    .flatMap(current => [...current.studentHtml.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)].map(match => items(match[1]).length));
  assert.deepEqual(listSizes, [5, 5, 8, 9, 10, 10, 10, 10, 6, 10, 10, 8, 8, 10, 10]);
  assert.equal(listSizes.reduce((total, count) => total + count, 0), 129);
  assert(section(4).studentHtml.includes("постав вчителю всі 9 питань"));
  assert.equal(isRegularTranslationExercise(section(7), 1), false);
  assert.equal(isRegularTranslationExercise(section(7), 2), true);
});

test("both grammar tables, six full reading paragraphs and all 39 dialogue turns remain intact", () => {
  for (const number of [6, 7]) {
    const sourceTable = sourceStudent[number - 1].match(/<table\b[^>]*>[\s\S]*?<\/table>/)![0];
    const nativeTable = section(number).studentHtml.match(/<table\b[^>]*>[\s\S]*?<\/table>/)![0];
    assert.equal(plain(nativeTable), plain(sourceTable));
    assert.equal((nativeTable.match(/<tr\b/g) ?? []).length, 4);
  }
  for (const [number, expected] of [[8, 6], [9, 15], [10, 24]]) {
    const sourcePassage = sourceStudent[number - 1].replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "").split("<h3>")[0];
    const nativePassage = section(number).studentHtml.split("<h3")[0];
    assert.equal(plain(nativePassage), plain(sourcePassage));
    assert.equal((nativePassage.match(number === 8 ? /class="pn"/g : /class="ln"/g) ?? []).length, expected);
  }
});

test("all 81 automatic controls have private correct keys; focus ids and public payloads remain answer-safe", () => {
  let fill = 0, tf = 0;
  for (const current of lesson.sections.filter(item => !item.teacherOnly)) {
    const blanks = (current.studentHtml.match(/class="blank"/g) ?? []).length;
    const trueFalse = (current.studentHtml.match(/class="tfbox"/g) ?? []).length;
    const answers = regularAnswerMap(current);
    assert.equal(answers.size, blanks + trueFalse, current.title);
    fill += blanks; tf += trueFalse;
    const teacherIds = new Set([...current.teacherHtml.matchAll(/data-focus-id="([^"]+)"/g)].map(match => match[1]));
    for (const match of current.studentHtml.matchAll(/data-focus-id="([^"]+)"/g)) assert(teacherIds.has(match[1]), `${current.id}/${match[1]}`);
    for (const spec of answers.values()) {
      assert(spec.answer && spec.accepted.length);
      assert(spec.accepted.map(normalizeHomeworkAnswer).includes(normalizeHomeworkAnswer(spec.answer)));
      assert(!spec.accepted.map(normalizeHomeworkAnswer).includes(normalizeHomeworkAnswer("definitely wrong")));
    }
  }
  assert.equal(fill, 43);
  assert.equal(tf, 38);
  const publicSections = publicRegularLessonSections(lesson.sections);
  assert.equal(publicSections.length, 11);
  assert(publicSections.every(current => current.teacherHtml === "" && !/class="[^"\n]*\b(?:ans|key|key-wrap|teacher-note)\b/.test(current.studentHtml)));
  assert(!JSON.stringify(publicSections).includes("Victoria_Lesson04_Homework.docx"));
  assert(!JSON.stringify(publicSections).includes("Ключі T/F"));
  const teacherHtml = lesson.sections.map(current => current.teacherHtml).join("");
  assert.equal((teacherHtml.match(/class="key"/g) ?? []).length, 13);
  const originalKeys = [...teacher.matchAll(/<div class="key">([\s\S]*?)<\/div>/g)].map(match => plain(match[1]).replace("F—onthetable—репліка23", "F—thecakeisonthetable—репліка23"));
  const nativeKeys = [...teacherHtml.matchAll(/<div class="key">([\s\S]*?)<\/div>/g)].map(match => plain(match[1]));
  assert.deepEqual(nativeKeys, originalKeys, "Every private key explanation must survive conversion");
});

test("normal full forms, contractions, source slash alternatives and optional years-old wording are accepted privately", () => {
  assert(matches(1, "list-3-item-2-blank-1", "had better"));
  assert(matches(1, "list-3-item-5-blank-1", "had better not"));
  assert(matches(3, "list-1-item-4-blank-1", "What's your favourite food?"));
  assert(matches(3, "list-1-item-4-blank-1", "What's your favorite food?"));
  assert(matches(3, "list-1-item-7-blank-1", "What's your phone number?"));
  assert(matches(6, "list-1-item-5-blank-1", "should not"));
  assert(matches(6, "list-1-item-7-blank-1", "cannot"));
  assert(matches(7, "list-1-item-9-blank-1", "do not like"));
  for (const answer of ["I'm twenty-nine.", "I'm twenty-nine years old.", "I am twenty-nine.", "I am twenty-nine years old."]) assert(matches(7, "list-2-item-2-blank-1", answer), answer);
  assert.equal(regularAnswerMap(section(7)).get("list-2-item-2-blank-1")!.answer, "I'm twenty-nine.");
  for (const answer of ["I'd like to work as a doctor.", "I'd like to be a doctor.", "I would like to work as a doctor.", "I would like to be a doctor."]) assert(matches(7, "list-2-item-3-blank-1", answer));
  assert(matches(7, "list-2-item-4-blank-1", "You should study English every day."));
  assert(matches(7, "list-2-item-5-blank-1", "If I lived in Italy, I'd speak Italian."));
  assert(matches(7, "list-2-item-6-blank-1", "If you give me your phone number, I will call you tomorrow."));
});

test("the ambiguous kitchen statement is corrected only in native content and retains the source's private F key", () => {
  assert(student.includes("The cake is in the kitchen."));
  assert(teacher.includes("The cake is in the kitchen."));
  assert(section(10).studentHtml.includes("The cake is not on the table."));
  assert(!section(10).studentHtml.includes("The cake is in the kitchen."));
  assert(section(10).teacherHtml.includes("the cake is on the table — репліка 23"));
  assert(matches(10, "list-2-item-10-tf-1", "F"));
  assert(!matches(10, "list-2-item-10-tf-1", "T"));
});

test("incomplete, mismatched, missing-key and teacher-contaminated sources cannot silently create a partial lesson", () => {
  assert.throws(() => buildA2PopularQuestionsLesson(student.replace('<section class="block warm">', '<article class="block warm">'), teacher));
  assert.throws(() => buildA2PopularQuestionsLesson(student, teacher.replace("Dialogue 1 · Nice to Meet You", "Wrong dialogue")));
  assert.throws(() => buildA2PopularQuestionsLesson(student.replace("What is your favourite food?", "What food?"), teacher));
  assert.throws(() => buildA2PopularQuestionsLesson(student, teacher.replace('<span class="ans">raspberries</span>', "raspberries")));
  assert.throws(() => buildA2PopularQuestionsLesson(student.replace("How are you doing today?", '<div class="key">private</div>How are you doing today?'), teacher));
  assert.throws(() => buildA2PopularQuestionsLesson(student.replace("<li>It's like a watermelon, but smaller and yellow — a <span class=\"blank\"></span>.</li>", ""), teacher));
});
