import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vegetablesCardsFromHtml, vegetablesVocabulary } from "../src/lib/bundled-lessons/a2-vegetables-vocabulary";
import { emptyLessonVocabularyReveal, toggleAllLessonVocabularyReveal, toggleLessonVocabularyReveal, lessonVocabularyReveal, lessonVocabularyRevealOptions } from "../src/lib/lesson-unit";
import { defaultRegularOpenSections } from "../src/lib/regular-lesson";

const wordNames = ["meat ✓ вже знайоме!", "vegetables", "a potato → potatoes", "a tomato → tomatoes", "a cucumber", "a carrot", "an onion", "garlic", "a pea → peas", "salad", "lettuce", "pepper", "mushrooms"];
const fixture = wordNames.map((name) => `<div class="vcard" data-focus-id="item-1"><div class="vhead"><span class="em">🥕</span><a class="snd" href="https://dictionary.cambridge.org/">🔊</a><b>${name}</b><span class="tr">/test/ → /tests/</span> — <span class="ua">овочі &amp; їжа</span></div><div class="note">📌 original tip</div><ul><li data-focus-id="item-2">I eat ${name}.</li><li>Second example.</li></ul></div>`).join("") + '<div class="tip">General tips.</div>';

test("Vegetables conversion keeps original translations, icons and examples without external audio links", () => {
  const parsed = vegetablesCardsFromHtml(fixture);
  assert.equal(parsed.length, 13);
  assert.equal(parsed[0].word, "meat");
  assert.equal(parsed[2].word, "a potato");
  assert.equal(parsed[0].translation, "овочі & їжа");
  assert.equal(parsed[0].examples.length, 2);
  assert.equal(parsed[0].ipaUk, "/test/");
  assert(!JSON.stringify(parsed).includes("https://"));
  assert(!JSON.stringify(parsed).includes("General tips"));
});

test("every Vegetables word and helper has tips and examples in the native vocabulary", () => {
  const words = vegetablesVocabulary(fixture);
  assert.equal(words.length, 28);
  assert.equal(new Set(words.map((word) => word.word)).size, 28);
  assert(words.every((word) => word.note && word.translation && word.examples.length && word.icon));
  assert(words.slice(0, 13).every((word) => word.ipaUs && word.ipaUk && word.description));
  assert(words.some((word) => word.word === "while"));
  assert.match(words.find((word) => word.word === "lettuce")!.note!, /salad/);
  assert.throws(() => vegetablesVocabulary("<p>Changed lesson</p>"));
});

test("translations, tips and examples start hidden; reveal all round trips through shared class state", () => {
  const closed = emptyLessonVocabularyReveal();
  assert(!closed.allTranslations && !closed.allDescriptions && !closed.allExamples && !closed.allNotes);
  const individual = toggleLessonVocabularyReveal(closed, "note", "carrot");
  assert.deepEqual(individual.notes, ["carrot"]);
  const shown = toggleAllLessonVocabularyReveal(individual);
  assert(shown.allTranslations && shown.allDescriptions && shown.allExamples && shown.allNotes);
  assert.deepEqual(shown.notes, []);
  assert.deepEqual(lessonVocabularyReveal(lessonVocabularyRevealOptions(shown)), shown);
  assert.deepEqual(toggleAllLessonVocabularyReveal(shown), closed);
  const hideOne = toggleLessonVocabularyReveal(shown, "example", "carrot");
  assert.deepEqual(hideOne.examples, ["carrot"]);
});

test("Warm-up is closed by default and cannot become a student fallback when every section is closed", () => {
  assert.deepEqual(defaultRegularOpenSections([
    { id: "warm", title: "Warm-up", tone: "warm", defaultOpen: true, studentHtml: "Hello" },
    { id: "vocabulary", title: "Vocabulary", tone: "vocab", defaultOpen: true, studentHtml: "Words" },
  ]), ["regular:vocabulary"]);
  const source = readFileSync(new URL("../src/components/lessons/regular-lesson-view.tsx", import.meta.url), "utf8");
  assert.match(source, /teacher \? available\[0\] : undefined/);
  assert(!source.includes("teacher || !lockClosed ? available[0]"));
  assert.match(source, /activeId && \(\s*teacher \|\|\s*visibleSections\.some/);
});

test("native regular vocabulary reuses Activities speech, reveal state and materials-copy controls", () => {
  const view = readFileSync(new URL("../src/components/lessons/regular-lesson-view.tsx", import.meta.url), "utf8");
  const vocab = readFileSync(new URL("../src/components/lessons/lesson-vocab.tsx", import.meta.url), "utf8");
  assert.match(view, /active\.tone === "vocab" && words\.length > 0/);
  assert.match(view, /<LessonVocab/);
  assert.match(vocab, /<SpeakPair/);
  assert.match(vocab, /<LessonVocabToMaterials/);
  assert.match(vocab, /toggleAllLessonVocabularyReveal\(reveal\)/);
  assert(!vocab.includes("dictionary.cambridge.org"));
});
