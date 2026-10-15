import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildC1VagueLanguageLesson, highlightVagueLanguageText, VAGUE_LANGUAGE_LESSON_TITLE } from "../src/lib/bundled-lessons/c1-vague-language";
import { feelingsVocabulary } from "../src/lib/bundled-lessons/c1-feelings-and-emotions";
import { VAGUE_LANGUAGE_DIALOGUES, VAGUE_LANGUAGE_NEW_WORDS, VAGUE_LANGUAGE_READINGS } from "../src/lib/bundled-lessons/c1-vague-language-content";
import { VAGUE_LANGUAGE_HOMEWORK } from "../src/lib/bundled-lessons/c1-vague-language-activities";
import { homeworkAnswerMatches, normalizeInteractiveHomework } from "../src/lib/lesson-homework";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap, regularLessonReaderSections } from "../src/lib/regular-lesson";
import { vagueLanguageImportApply } from "../scripts/create-c1-vague-language";

const source = readFileSync(new URL("../scripts/fixtures/c1-feelings-student.html", import.meta.url), "utf8");
const lesson = buildC1VagueLanguageLesson(source);
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

test("C1 Vague language is a complete native pack with only vocabulary initially open", () => {
  assert.equal(lesson.title, VAGUE_LANGUAGE_LESSON_TITLE);
  assert.equal(lesson.sections.length, 13);
  assert.equal(regularLessonReaderSections(lesson.sections, true).length, 13);
  assert.equal(regularLessonReaderSections(lesson.sections, false).length, 12);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:vague-vocabulary"]);
  assert.deepEqual(lesson.sections.filter(section => section.tone === "reading").map(section => section.id), ["vague-reading-1", "vague-reading-2"]);
  assert.deepEqual(lesson.sections.filter(section => section.tone === "dialogue").map(section => section.id), ["vague-dialogue-1", "vague-dialogue-2"]);
  const ids = lesson.sections.map(section => section.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("all twenty new cards and exact sixteen Feelings cards retain translations, examples and metadata", () => {
  assert.equal(lesson.words.length, 36);
  assert.deepEqual(lesson.words.slice(0, 20), VAGUE_LANGUAGE_NEW_WORDS);
  assert.deepEqual(lesson.words.slice(20), feelingsVocabulary(source).map(word => ({ ...word, category: `Review · Feelings · ${word.category}` })));
  assert.equal(lesson.words.reduce((sum, word) => sum + word.examples.length, 0), 56);
  assert(lesson.words.every(word => word.translationLang === "UK" && word.description && word.translation && word.note));
  assert(lesson.words.every(word => word.examples.every(example => example.en && example.tr)));
  assert.throws(() => buildC1VagueLanguageLesson(source.replace('class="vcard"', 'class="missing"')));
});

test("both complete readings, all twenty-eight dialogue turns and comprehension tasks survive native formatting", () => {
  for (const [index, reading] of VAGUE_LANGUAGE_READINGS.entries()) {
    const section = lesson.sections.find(item => item.id === `vague-reading-${index + 1}`)!;
    for (const paragraph of reading.paragraphs) assert(plain(section.studentHtml).includes(paragraph));
    assert.equal((section.studentHtml.match(/<li\b/g) ?? []).length, 8);
    assert.equal((section.studentHtml.match(/class="tfbox"/g) ?? []).length, 4);
    assert(section.studentHtml.includes("<strong>"));
  }
  for (const [index, dialogue] of VAGUE_LANGUAGE_DIALOGUES.entries()) {
    const section = lesson.sections.find(item => item.id === `vague-dialogue-${index + 1}`)!;
    assert.equal((section.studentHtml.match(/class="sp"/g) ?? []).length, 14);
    for (const turn of dialogue.turns) assert(plain(section.studentHtml).includes(turn.text));
    assert.equal((section.studentHtml.match(/<li\b/g) ?? []).length, 8);
    assert(section.studentHtml.includes("<strong>"));
  }
});

test("all 64 lesson controls have private canonical keys and accept every authored alternative", () => {
  let total = 0, fill = 0, tf = 0;
  for (const section of lesson.sections) {
    const map = regularAnswerMap(section);
    const controls = (section.studentHtml.match(/class="(?:blank|tfbox)"/g) ?? []).length;
    assert.equal(map.size, controls, section.id);
    for (const [id, key] of map) {
      assert(key.answer);
      assert(homeworkAnswerMatches({ id, prompt: "", answer: key.answer, accepted: key.accepted }, key.answer));
      for (const accepted of key.accepted) assert(homeworkAnswerMatches({ id, prompt: "", answer: key.answer, accepted: key.accepted }, accepted));
      assert(!homeworkAnswerMatches({ id, prompt: "", answer: key.answer, accepted: key.accepted }, "an unrelated incorrect answer"));
      if (key.kind === "fill") fill++;
      else {
        tf++;
        // Native lesson buttons submit T/F, not the displayed full word.
        assert(homeworkAnswerMatches({ id, prompt: "", answer: key.answer, accepted: key.accepted }, key.answer === "True" ? "T" : "F"));
      }
    }
    total += map.size;
    const teacherFocus = new Set([...section.teacherHtml.matchAll(/data-focus-id="([^"]+)"/g)].map(match => match[1]));
    for (const match of section.studentHtml.matchAll(/data-focus-id="([^"]+)"/g)) assert(teacherFocus.has(match[1]), `${section.id}/${match[1]}`);
  }
  assert.deepEqual({ total, fill, tf }, { total: 64, fill: 48, tf: 16 });
});

test("public lesson strips private route, keys, answer spans and model discussion answers", () => {
  const sections = publicRegularLessonSections(lesson.sections);
  assert.equal(sections.length, 12);
  for (const section of sections) {
    assert(!section.teacherOnly && !section.teacherHtml);
    assert.equal(regularAnswerMap(section).size, 0);
    assert(!/class="[^"\n]*\b(?:key|ans)\b/.test(section.studentHtml));
    assert(!section.studentHtml.includes("Suggested answer:"));
  }
  const publicText = JSON.stringify(sections);
  assert(!publicText.includes("Teacher route and flexible timing"));
  assert(!publicText.includes("Source continuity and references"));
});

test("new perfect guidance is explicit, while actual prior grammar is recycled separately", () => {
  const perfect = lesson.sections.find(section => section.id === "vague-perfect-grammar")!.studentHtml;
  assert(perfect.includes("had + past participle"));
  assert(perfect.includes("will have + past participle"));
  assert(perfect.includes("will not have / won't have"));
  assert(perfect.includes("do not automatically force the Past Perfect"));
  const bridge = lesson.sections.find(section => section.id === "vague-feelings-bridge")!.studentHtml;
  for (const marker of ["temporary behaviour", "stative", "want + object", "see + object", "Oliver", "Emma and Jack"]) {
    // Stative is conveyed explicitly by the opinion row rather than a label.
    if (marker === "stative") assert(bridge.includes("Think is an opinion")); else assert(bridge.includes(marker));
  }
  const usage = lesson.sections.find(section => section.id === "vague-usage")!.studentHtml;
  for (const marker of ["strictly more", "includes exactly", "not a precise", "fifty-one"]) {
    if (marker === "strictly more") assert(usage.includes("Strictly more"));
    else if (marker === "includes exactly") assert(usage.includes("fifty is possible"));
    else assert(usage.includes(marker));
  }
});

test("homework stays 16 quick automatic checks plus one short production after repeated native normalization", () => {
  const plan = normalizeInteractiveHomework(lesson.homework[0])!;
  assert.deepEqual(plan, normalizeInteractiveHomework(VAGUE_LANGUAGE_HOMEWORK));
  assert.deepEqual(normalizeInteractiveHomework(plan), plan);
  assert.equal(plan.exercises.length, 5);
  assert.equal(plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0), 17);
  const auto = plan.exercises.flatMap(exercise => exercise.items.filter(item => item.answer));
  assert.equal(auto.length, 16);
  const production = plan.exercises.filter(exercise => exercise.kind === "question-text");
  assert.equal(production.length, 1);
  assert.equal(production[0].items.length, 1);
  assert(production[0].instruction.includes("90–110"));
  assert(!plan.exercises.some(exercise => exercise.kind === "question-audio"));
  assert.equal(plan.exercises.filter(exercise => exercise.referenceText).length, 1);
  for (const item of auto) {
    assert(homeworkAnswerMatches(item, item.answer!));
    for (const accepted of item.accepted ?? []) assert(homeworkAnswerMatches(item, accepted));
  }
});

test("vocabulary highlighting never turns supplied text into active HTML", () => {
  const html = highlightVagueLanguageText('<img src=x onerror=alert(1)> Roughly 50; she had gone red and felt gutted.');
  assert(html.includes("&lt;img"));
  assert(!html.includes("<img"));
  assert(html.includes("<strong>Roughly</strong>"));
  assert(html.includes("<strong>gone red</strong>"));
  assert(html.includes("<strong>felt gutted</strong>"));
});

test("import is dry-run by default, rejects ambiguous flags and contains no assignment/class writes", () => {
  assert.equal(vagueLanguageImportApply([]), false);
  assert.equal(vagueLanguageImportApply(["--apply"]), true);
  assert.throws(() => vagueLanguageImportApply(["--apply", "--apply"]));
  assert.throws(() => vagueLanguageImportApply(["--apply-all"]));
  const script = readFileSync(new URL("../scripts/create-c1-vague-language.ts", import.meta.url), "utf8");
  assert(!/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:public\.)?(?:lesson_assignments|users|lesson_units|lesson_words)\b/i.test(script));
  assert(!/INSERT\s+INTO\s+(?:public\.)?lesson_assignments\b/i.test(script));
  assert(script.includes("ISOLATION LEVEL SERIALIZABLE") && script.includes("pg_advisory_xact_lock"));
  assert(script.includes("Existing lessons changed") && script.includes("Student assignments or work changed"));
});
