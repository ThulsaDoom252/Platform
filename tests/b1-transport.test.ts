import assert from "node:assert/strict";
import test from "node:test";
import { buildB1TransportLesson, highlightTransportText, TRANSPORT_LESSON_TITLE } from "../src/lib/bundled-lessons/b1-transport";
import { TRANSPORT_VOCABULARY, transportWordAnswers } from "../src/lib/bundled-lessons/b1-transport-vocabulary";
import { TRANSPORT_PASSAGES } from "../src/lib/bundled-lessons/b1-transport-passages";
import { TRANSPORT_PREPOSITION_PRACTICE, TRANSPORT_TENSE_PRACTICE, TRANSPORT_HOMEWORK } from "../src/lib/bundled-lessons/b1-transport-activities";
import { defaultRegularOpenSections, isRegularTranslationExercise, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";
import { assignedInteractiveHomework, homeworkAnswerMatches, homeworkProgress, normalizeInteractiveHomework } from "../src/lib/lesson-homework";
import { collectLearningTranslations } from "../src/lib/learning-language-content";

const lesson = buildB1TransportLesson();
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const expected = ["a traffic light", "a roundabout", "a speed camera", "a bus stop", "it takes + time", "to miss", "to commute", "to get on", "to get in", "to jump in / to hop in", "a bus lane", "a highway", "a platform", "a road", "a path", "a traffic jam", "a road accident", "a motorway", "a coach", "a ferry", "a tram", "a van", "a lorry", "a car accident / a car crash", "to board", "to fill up"];

test("Transport retains all 26 requested entries, reviewed localized support and corrected bus lane", () => {
  assert.deepEqual(lesson.words.map(word => word.word), expected);
  for (const word of lesson.words) {
    assert(word.translation && /[\u0400-\u04ff]/.test(word.translation), word.word);
    assert.notEqual(word.word, word.translation);
    assert.equal(word.translationLang, "UK");
    assert(word.description && word.note && word.icon);
    assert.equal(word.examples.length, 2);
    assert(word.examples.every(example => example.en && /[\u0400-\u04ff]/.test(example.tr)));
    assert.equal(word.ipaUs, null); assert.equal(word.ipaUk, null);
  }
  const commute = lesson.words.find(word => word.word === "to commute")!;
  assert(commute.note?.includes("(to work, to school, etc.)"));
  assert(lesson.words.find(word => word.word === "a bus lane")!.note?.includes("не bust lane"));
  assert.equal(new Set(TRANSPORT_VOCABULARY.map(word => word.question)).size, 26);
  const personal = lesson.sections.find(section => section.id === "transport-personal")!;
  assert.equal((personal.studentHtml.match(/<li\b/g) ?? []).length, 26);
});

test("the native pack has 16 sections, one reading, two dialogues and only vocabulary initially open", () => {
  assert.equal(lesson.title, TRANSPORT_LESSON_TITLE);
  assert.equal(lesson.sections.length, 16);
  assert.equal(new Set(lesson.sections.map(section => section.id)).size, 16);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:transport-vocabulary"]);
  assert.equal(lesson.sections.filter(s => s.tone === "reading").length, 1);
  assert.equal(lesson.sections.filter(s => s.tone === "dialogue").length, 2);
  assert.deepEqual(lesson, JSON.parse(JSON.stringify(lesson)));
});

test("the original medium-length stories use the complete vocabulary and bold every occurrence in context", () => {
  const allText = TRANSPORT_PASSAGES.map(p => p.paragraphs?.join(" ") ?? p.turns!.map(t => t.text).join(" ")).join(" ");
  const reading = TRANSPORT_PASSAGES[0].paragraphs!.join(" ");
  for (const seed of TRANSPORT_VOCABULARY) {
    assert(new RegExp(`\\b(?:${seed.pattern})\\b`, "i").test(allText), seed.word);
    assert(new RegExp(`\\b(?:${seed.pattern})\\b`, "i").test(reading), `reading: ${seed.word}`);
  }
  for (const p of TRANSPORT_PASSAGES) {
    const text = p.paragraphs?.join(" ") ?? p.turns!.map(t => t.text).join(" ");
    const count = text.split(/\s+/).length;
    assert(count >= 240 && count <= 420, `${p.id}: ${count} words`);
    assert(/\bhad(?:n't| not)? (?:already )?\w+/.test(text));
    assert(/\b(?:reached|got|went|arrived|boarded)\b/.test(text));
    const section = lesson.sections.find(s => s.id === p.id)!;
    const body = section.studentHtml.split("<h3")[0];
    for (const paragraph of p.paragraphs ?? []) assert(plain(body).includes(paragraph));
    for (const turn of p.turns ?? []) assert(plain(body).includes(turn.text));
    const withoutBold = plain(body.replace(/<strong>[\s\S]*?<\/strong>/g, ""));
    for (const seed of TRANSPORT_VOCABULARY) assert(!new RegExp(`\\b(?:${seed.pattern})\\b`, "i").test(withoutBold), `${p.id}: unbolded ${seed.word}`);
  }
  assert(highlightTransportText("We had a pleasant journey.").includes("had a pleasant"));
  assert(!highlightTransportText("We had a pleasant journey.").includes("<strong>had a</strong>"));
});

test("each passage has 8 balanced True/False items and 8 questions with private evidence and model answers", () => {
  for (const passage of TRANSPORT_PASSAGES) {
    assert.equal(passage.trueFalse.length, 8); assert.equal(passage.questions.length, 8);
    assert.equal(passage.trueFalse.filter(item => item.answer).length, 4);
    assert(passage.trueFalse.every(item => item.prompt && item.explanation));
    assert(passage.questions.every(item => item.prompt.endsWith("?") && item.suggestedAnswer));
    const section = lesson.sections.find(section => section.id === passage.id)!;
    assert.equal((section.studentHtml.match(/class="tfbox"/g) ?? []).length, 8);
    assert.equal((section.teacherHtml.match(/Suggested answer:/g) ?? []).length, 8);
    assert.equal((section.teacherHtml.match(/class="key"/g) ?? []).length, 16);
    for (const item of passage.questions) assert(plain(section.teacherHtml).includes(item.suggestedAnswer));
  }
});

test("all 92 auto controls have usable server keys, accepted variants and matching focus IDs", () => {
  let total = 0;
  for (const section of lesson.sections) {
    const keys = regularAnswerMap(section);
    assert.equal(keys.size, (section.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length, section.id);
    for (const [id, key] of keys) {
      const item = { id, prompt: "", answer: key.answer, accepted: key.accepted };
      for (const answer of [key.answer, ...key.accepted]) assert(homeworkAnswerMatches(item, answer));
      assert(!homeworkAnswerMatches(item, "unrelated answer"));
    }
    const teacherIds = new Set([...section.teacherHtml.matchAll(/data-focus-id="([^"]+)"/g)].map(m => m[1]));
    for (const m of section.studentHtml.matchAll(/data-focus-id="([^"]+)"/g)) assert(teacherIds.has(m[1]), `${section.id}/${m[1]}`);
    total += keys.size;
  }
  assert.equal(total, 92);
  const guesses = regularAnswerMap(lesson.sections.find(s => s.id === "transport-guess")!);
  TRANSPORT_VOCABULARY.forEach((seed, index) => {
    const key = [...guesses.values()][index];
    for (const answer of transportWordAnswers(seed)) {
      // The native parser stores slash-separated alternatives individually.
      for (const alternative of answer.split(/\s+\/\s+/)) assert(homeworkAnswerMatches({ id: "", prompt: "", answer: key.answer, accepted: key.accepted }, alternative), `${seed.word}: ${alternative}`);
    }
  });
});

test("guides teach real transport exceptions and meaningful narrative order without false blanket rules", () => {
  const onIn = plain(lesson.sections.find(s => s.id === "transport-on-in")!.studentHtml);
  for (const phrase of ["in a/the/my car", "on a bike", "by + transport", "on foot", "get out of", "Board the train", "shortcuts fail"]) assert(onIn.includes(phrase), phrase);
  const past = plain(lesson.sections.find(s => s.id === "transport-past-guide")!.studentHtml);
  for (const phrase of ["had + past participle", "Did you board", "Had you booked", "already be clear", "Past Simple can also be natural", "not simply"]) assert(past.includes(phrase), phrase);
  for (const group of [TRANSPORT_PREPOSITION_PRACTICE, TRANSPORT_TENSE_PRACTICE]) {
    assert.equal(group.items.length, 12);
    for (const item of group.items) assert.equal(item.prompt.split("___").length, 2);
  }
  const translation = lesson.sections.find(s => s.id === "transport-translation")!;
  assert(isRegularTranslationExercise(translation, 1));
  const plan = collectLearningTranslations({ words: lesson.words }, "RU");
  assert.equal(plan.segments.filter(segment => segment.requiresCyrillic && expected.includes(segment.text)).length, 26);
});

test("public lessons expose no teacher keys, guidance or suggested passage answers", () => {
  const sections = publicRegularLessonSections(lesson.sections);
  assert.equal(sections.length, 15);
  assert(!JSON.stringify(sections).includes("Transport rescue: flexible teaching route"));
  for (const section of sections) {
    assert.equal(section.teacherHtml, ""); assert.equal(regularAnswerMap(section).size, 0);
    assert(!/class="(?:key|ans|teacher-note)"/.test(section.studentHtml));
    assert(!section.studentHtml.includes("Suggested answer:"));
  }
});

test("homework is light, varied and assignable without automatically creating any student work", () => {
  const plan = lesson.homework[0];
  assert.deepEqual(plan, JSON.parse(JSON.stringify(normalizeInteractiveHomework(TRANSPORT_HOMEWORK))));
  assert.deepEqual(plan.exercises.map(e => e.items.length), [4, 2, 6, 3, 2, 1, 1]);
  assert.deepEqual(plan.exercises.map(e => e.kind), ["definition", "describe", "fill", "translate", "question-text", "question-audio", "question-text"]);
  assert.deepEqual(homeworkProgress(plan, {}), { done: 0, total: 18 });
  assert.equal(plan.exercises.filter(e => e.optional).length, 1);
  assert.equal(assignedInteractiveHomework(plan, {}), null);
  const ids = plan.exercises.flatMap(e => [e.id, ...e.items.map(i => i.id)]);
  assert.equal(new Set(ids).size, ids.length);
  for (const exercise of plan.exercises) for (const item of exercise.items) {
    if (item.answer) for (const answer of [item.answer, ...(item.accepted ?? [])]) assert(homeworkAnswerMatches(item, answer));
    if (exercise.kind === "translate") assert(/[\u0400-\u04ff]/.test(item.prompt));
  }
});

test("bold markup remains safe and preserves complete overlapping word and grammar ranges", () => {
  const input = '<img src=x onerror=alert(1)> We had already filled up. There had been a road accident. We got in the van.';
  const html = highlightTransportText(input);
  assert(!html.includes("<img") && html.includes("&lt;img"));
  assert(html.includes("<strong>had already filled up</strong>"));
  assert(html.includes("<strong>road accident</strong>"));
  assert.equal(plain(html), input);
});

test("copied native answer alternatives normalize without changing unrelated literal slash answers", () => {
  const plan = normalizeInteractiveHomework({ kind: "INTERACTIVE_HOMEWORK_V1", title: "Copies", exercises: [{ id: "group", kind: "fill", title: "Examples", instruction: "Fill the gap", items: [
    { id: "regular-transport-invitation-1", prompt: "Your friend says ___!", answer: "Hop in / Jump in", accepted: ["Get in"] },
    { id: "custom-1", prompt: "Write the label ___", answer: "on / off" },
  ] }] })!;
  assert.deepEqual(plan.exercises[0].items[0].accepted, ["Jump in", "Get in"]);
  for (const answer of ["Hop in", "Jump in", "Get in"]) assert(homeworkAnswerMatches(plan.exercises[0].items[0], answer));
  assert(!homeworkAnswerMatches(plan.exercises[0].items[0], "Hop in Jump in"));
  assert.equal(plan.exercises[0].items[1].answer, "on / off");
  assert(!homeworkAnswerMatches(plan.exercises[0].items[1], "on"));
  assert.deepEqual(normalizeInteractiveHomework(plan), plan);
});
