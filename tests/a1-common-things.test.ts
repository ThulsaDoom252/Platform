import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildA1CommonThingsLesson,
  COMMON_THINGS_LESSON_TITLE,
} from "../src/lib/bundled-lessons/a1-common-things";
import {
  defaultRegularOpenSections,
  isRegularTranslationExercise,
  publicRegularLessonSections,
  regularAnswerMap,
  regularLessonReaderSections,
} from "../src/lib/regular-lesson";
import { normalizeHomeworkAnswer } from "../src/lib/lesson-homework";

const student = readFileSync(new URL("../scripts/fixtures/a1-common-things-student.html", import.meta.url), "utf8");
const teacher = readFileSync(new URL("../scripts/fixtures/a1-common-things-teacher.html", import.meta.url), "utf8");
const lesson = buildA1CommonThingsLesson(student, teacher);
const sourceSections = (source: string) => [...source.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)].map(match => match[1]);
const sourceStudent = sourceSections(student), sourceTeacher = sourceSections(teacher);
const section = (number: number) => lesson.sections.find(item => item.id === `common-things-${String(number).padStart(2, "0")}`)!;
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, "");
const body = (html: string) => html.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "");
const items = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]);
const matches = (number: number, id: string, answer: string) => regularAnswerMap(section(number)).get(id)?.accepted
  .map(normalizeHomeworkAnswer).includes(normalizeHomeworkAnswer(answer));

test("Common things retains every original lesson block, a visible helper guide and private homework keys without invented student homework", () => {
  assert.equal(lesson.title, "A1 · Common things");
  assert.equal(lesson.title, COMMON_THINGS_LESSON_TITLE);
  assert.equal(sourceStudent.length, 11);
  assert.equal(sourceTeacher.length, 12);
  assert.equal(lesson.sections.length, 13);
  assert.deepEqual(lesson.homework, []);
  assert.equal(regularLessonReaderSections(lesson.sections, false).length, 12);
  assert.equal(regularLessonReaderSections(lesson.sections, true).length, 12);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:common-things-02"]);
  for (let number = 1; number <= 11; number++) {
    assert.ok(section(number));
    assert.equal(section(number).teacherOnly, undefined);
    let original = body(sourceStudent[number - 1]).replace(/<a\b[^>]*class=["']snd["'][^>]*>[\s\S]*?<\/a>/gi, "");
    let native = section(number).studentHtml;
    if (number === 3) original = original.replace("You live in a house.", "People can live in a house.")
      .replace("You need a computer for the internet.", "You can use a computer for the internet.");
    if (number === 4) {
      original = original.replace(/<div class="trap">[\s\S]*?<\/div>/g, trap => trap.includes("Has she a computer?")
        ? '<div class="note">📌 Has she a computer? — граматично правильно, але формально й нетипово для повсякденної англійської. Звичайні форми для цього уроку: Has she got a computer? / Does she have a computer?</div>' : trap);
    }
    if (number === 5) native = native.replace(/<p\b[^>]*><b>have(?: got)? · question:<\/b>[\s\S]*?<\/p>/gi, "");
    assert.equal(plain(native), plain(original), `Lost student source prose in section ${number}`);
  }
  const notes = lesson.sections.at(-1)!;
  assert.equal(notes.id, "common-things-homework-keys");
  assert.equal(notes.title, "🔑 Homework keys");
  assert.equal(notes.tone, "teacher");
  assert.equal(notes.teacherOnly, true);
  assert.equal(notes.studentHtml, "");
  assert.equal(items(notes.teacherHtml).length, 6);
  assert.equal(plain(notes.teacherHtml), plain(body(sourceTeacher.at(-1)!)));
});

test("ten native words preserve all source icons, bilingual examples, notes and the fourteen actual US/UK IPA labels", () => {
  assert.deepEqual(lesson.words.map(word => word.word), ["book", "wallet", "backpack", "car", "TV", "umbrella", "computer", "house", "shoes", "mobile phone"]);
  assert.equal(lesson.words.reduce((total, word) => total + word.examples.length, 0), 20);
  assert.equal(lesson.words.filter(word => word.ipaUs).length, 10);
  assert.equal(lesson.words.filter(word => word.ipaUk).length, 4);
  for (const word of lesson.words) {
    assert.equal(word.category, "Common things");
    assert.equal(word.translationLang, "UK");
    assert.equal(word.description, null);
    assert(word.icon && word.translation && word.note && word.ipaUs);
    for (const value of [word.word, word.icon, word.translation, word.note, word.ipaUs, word.ipaUk].filter(Boolean)) assert(sourceStudent[1].includes(value!));
    for (const example of word.examples) {
      assert(sourceStudent[1].includes(example.en), example.en);
      assert(sourceStudent[1].includes(example.tr), example.tr);
      assert(!example.tr.startsWith("—"));
    }
  }
  const wallet = lesson.words.find(word => word.word === "wallet")!;
  assert.equal(wallet.ipaUs, "/ˈwɑː.lɪt/");
  assert.equal(wallet.ipaUk, "/ˈwɒl.ɪt/");
  const phone = lesson.words.at(-1)!;
  assert.equal(phone.ipaUs, "/ˌmoʊ.bəl ˈfoʊn/");
  assert.equal(phone.ipaUk, "/ˌməʊ.baɪl ˈfəʊn/");
  assert(!JSON.stringify(lesson.sections).includes("dictionary.cambridge.org"), "Native speech must not use external pronunciation links");
});

test("helper bank and lesson introduction stay visible outside native vocabulary, with all 165 source practice prompts", () => {
  const guidance = lesson.sections.find(item => item.id === "common-things-vocabulary-guide")!;
  assert.equal(guidance.tone, "warm");
  const helpers = sourceStudent[1].match(/<div class="helpers">([\s\S]*?)<\/div>/)![1];
  assert(plain(guidance.studentHtml).includes(plain(helpers)));
  assert(guidance.studentHtml.includes("Lesson 5 · Everyday things"));
  for (const value of ["and / but", "new", "old", "big", "small", "very", "a friend", "this / that", "here", "today", "too", "I don't know"]) assert(guidance.studentHtml.includes(value));
  const listSizes = lesson.sections.filter(current => /^common-things-\d\d$/.test(current.id))
    .flatMap(current => [...current.studentHtml.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)].map(match => items(match[1]).length));
  assert.deepEqual(listSizes, [8, 8, 10, 10, 10, 8, 8, 6, 8, 10, 10, 5, 8, 10, 10, 8, 8, 10, 10]);
  assert.equal(listSizes.reduce((total, count) => total + count, 0), 165);
  assert(section(8).studentHtml.includes("максимум 10 питань!"));
  assert(section(11).studentHtml.includes("Ти загубила річ"));
  assert.equal(isRegularTranslationExercise(section(5), 3), false);
  assert.equal(isRegularTranslationExercise(section(5), 4), true);
});

test("all five original grammar/revision tables, six reading paragraphs and forty-two dialogue turns survive intact", () => {
  for (const number of [4, 6, 7, 8]) {
    const originals = [...sourceStudent[number - 1].matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(match => plain(match[0]));
    const native = [...section(number).studentHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(match => plain(match[0]));
    assert.deepEqual(native, originals, `Changed grammar table in section ${number}`);
  }
  for (const [number, expected] of [[9, 6], [10, 14], [11, 28]]) {
    const sourcePassage = body(sourceStudent[number - 1]).split("<h3>")[0];
    const nativePassage = section(number).studentHtml.split("<h3")[0];
    assert.equal(plain(nativePassage), plain(sourcePassage));
    assert.equal((nativePassage.match(number === 9 ? /class="pn"/g : /class="ln"/g) ?? []).length, expected);
  }
});

test("all 137 native controls have private keys and matching focus ids; public payloads omit every teacher-only field", () => {
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
  assert.equal(fill, 99);
  assert.equal(tf, 38);
  const publicSections = publicRegularLessonSections(lesson.sections);
  assert.equal(publicSections.length, 12);
  assert(publicSections.every(current => current.teacherHtml === "" && !/class="[^"\n]*\b(?:ans|key|key-wrap|teacher-note)\b/.test(current.studentHtml)));
  for (const privateText of ["Homework keys", "Ключі T/F", "Ключі (питання)", "Writing / Vocaroo", "(не have!)"]) assert(!JSON.stringify(publicSections).includes(privateText), privateText);
  const originalKeys = [...teacher.matchAll(/<div class="key">([\s\S]*?)<\/div>/g)].map(match => plain(match[1]));
  const nativeKeys = [...lesson.sections.map(current => current.teacherHtml).join("").matchAll(/<div class="key">([\s\S]*?)<\/div>/g)].map(match => plain(match[1]));
  assert.equal(originalKeys.length, 7);
  assert.deepEqual(nativeKeys, originalKeys, "Every source teacher key/explanation remains private and unchanged");
});

test("six question rows require both constructions and matching short answers in four separately graded fields", () => {
  const sourceList = [...sourceStudent[4].matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)][2][1];
  const nativeList = [...section(5).studentHtml.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)][2][1];
  assert.equal((sourceList.match(/class="blank"/g) ?? []).length, 6);
  assert.equal((nativeList.match(/class="blank"/g) ?? []).length, 24);
  for (let index = 1; index <= 6; index++) {
    const answerMap = regularAnswerMap(section(5));
    for (let control = 1; control <= 4; control++) assert(answerMap.has(`list-3-item-${index}-blank-${control}`));
  }
  assert(matches(5, "list-3-item-1-blank-1", "Do you have a car?"));
  assert(matches(5, "list-3-item-1-blank-2", "Yes, I do."));
  assert(matches(5, "list-3-item-1-blank-3", "Have you got a car?"));
  assert(matches(5, "list-3-item-1-blank-4", "Yes, I have."));
  assert(!matches(5, "list-3-item-1-blank-1", "Have you got a car?"));
  assert(!matches(5, "list-3-item-1-blank-4", "Yes, I do."));
  assert(matches(5, "list-3-item-2-blank-2", "No, she does not."));
  assert(matches(5, "list-3-item-2-blank-4", "No, she has not."));
});

test("private keys accept optional got, article-free guesses, slash alternatives and valid contractions/full forms only", () => {
  assert(matches(3, "list-1-item-1-blank-1", "umbrella"));
  assert(matches(3, "list-1-item-1-blank-1", "an umbrella"));
  assert(matches(3, "list-1-item-6-blank-1", "mobile phone"));
  for (const answer of ["I have got a backpack.", "I've got a backpack."]) assert(matches(5, "list-2-item-1-blank-1", answer), answer);
  for (const answer of ["She has got a wallet.", "She's got a wallet."]) assert(matches(5, "list-2-item-2-blank-1", answer), answer);
  for (const answer of ["I have a book.", "I have got a book.", "I've got a book."]) assert(matches(5, "list-4-item-1-blank-1", answer), answer);
  for (const answer of ["She doesn't have a car.", "She does not have a car.", "She hasn't got a car.", "She has not got a car.", "She's not got a car."]) assert(matches(5, "list-4-item-2-blank-1", answer), answer);
  assert(matches(5, "list-2-item-5-blank-1", "We've not got a car."));
  assert(matches(5, "list-2-item-8-blank-1", "Ben's not got a TV."));
  for (const answer of ["I'm thirty.", "I am thirty."]) assert(matches(5, "list-4-item-8-blank-1", answer), answer);
  for (const answer of ["No, it isn't.", "No, it is not.", "No, it's not."]) assert(matches(6, "list-1-item-5-blank-1", answer), answer);
  assert(matches(8, "list-1-item-2-blank-1", "Has she got long hair?"));
  assert(matches(8, "list-1-item-2-blank-1", "Does she have long hair?"));
  for (const answer of ["Yes, I'm.", "Yes, I've."]) assert(!matches(6, "list-1-item-1-blank-1", answer), answer);
  assert(!matches(6, "list-1-item-2-blank-1", "Yes, she's."));
  assert(!matches(6, "list-1-item-7-blank-1", "Yes, she's got."));
  assert(!matches(5, "list-3-item-1-blank-4", "Yes, I've got."));
  assert(!matches(5, "list-3-item-2-blank-4", "No, she's not."));
  assert(!matches(5, "list-4-item-8-blank-1", "I have thirty."));
});

test("derived T/F statements are unambiguous and the formal have question is clarified without changing source fixtures", () => {
  assert(student.includes("You live in a house."));
  assert(student.includes("You need a computer for the internet."));
  assert(teacher.includes("You live in a house."));
  assert(section(3).studentHtml.includes("People can live in a house."));
  assert(section(3).studentHtml.includes("You can use a computer for the internet."));
  assert(matches(3, "list-3-item-4-tf-1", "T"));
  assert(matches(3, "list-3-item-9-tf-1", "T"));
  assert(student.includes('<span class="bad">Has she a computer?</span>'));
  for (const html of [section(4).studentHtml, section(4).teacherHtml]) {
    assert(html.includes("Has she a computer? — граматично правильно"));
    assert(html.includes("формально й нетипово"));
    assert(!html.includes('<span class="bad">Has she a computer?</span>'));
  }
});

test("incomplete, mismatched, missing-key and contaminated sources cannot silently produce a partial lesson", () => {
  assert.throws(() => buildA1CommonThingsLesson(student.replace('<section class="block">', '<article class="block">'), teacher));
  assert.throws(() => buildA1CommonThingsLesson(student, teacher.replace("Dialogue 1: Is This Your Wallet?", "Wrong dialogue")));
  assert.throws(() => buildA1CommonThingsLesson(student.replace("How old is Emma?", "How old?"), teacher));
  assert.throws(() => buildA1CommonThingsLesson(student, teacher.replace('<span class="ans">an umbrella</span>', "an umbrella")));
  assert.throws(() => buildA1CommonThingsLesson(student.replace("Hi! How are you doing today?", '<div class="key">private</div>Hi! How are you doing today?'), teacher));
  assert.throws(() => buildA1CommonThingsLesson(student.replace('<li>I <span class="blank"></span> a bit tired today.</li>', ""), teacher));
  assert.throws(() => buildA1CommonThingsLesson(student, teacher.replace("Have you got a car? — Yes, I have.", "Have you got a car?")));
  assert.throws(() => buildA1CommonThingsLesson(student.replace("US /bʊk/", ""), teacher));
});
