import assert from "node:assert/strict";
import test from "node:test";
import {
  VAGUE_LANGUAGE_DIALOGUES,
  VAGUE_LANGUAGE_NEW_WORDS,
  VAGUE_LANGUAGE_READINGS,
} from "../src/lib/bundled-lessons/c1-vague-language-content";

const allProse = [...VAGUE_LANGUAGE_READINGS.flatMap(reading => reading.paragraphs),
  ...VAGUE_LANGUAGE_DIALOGUES.flatMap(dialogue => dialogue.turns.map(turn => turn.text))].join(" ");

test("twenty original vague-language entries have Ukrainian translations, English meanings and forty bilingual examples", () => {
  assert.equal(VAGUE_LANGUAGE_NEW_WORDS.length, 20);
  assert.equal(new Set(VAGUE_LANGUAGE_NEW_WORDS.map(word => word.word)).size, 20);
  for (const word of VAGUE_LANGUAGE_NEW_WORDS) {
    assert.equal(word.translationLang, "UK");
    assert.match(word.translation!, /[а-яіїєґ]/iu);
    assert.ok(word.description && word.description.length > 30);
    assert.ok(word.note && word.note.length > 30);
    assert.ok(word.category && word.icon && word.sectionColor);
    assert.equal(word.examples.length, 2);
    assert.equal(word.ipaUs, null);
    assert.equal(word.ipaUk, null);
    for (const example of word.examples) {
      assert.ok(example.en.length > 35);
      assert.match(example.tr, /[а-яіїєґ]/iu);
      assert.doesNotMatch(example.en, /<[^>]+>|\*\*/);
    }
  }
});

test("word-order, register, ranges and inclusive or strict bounds are distinguished", () => {
  const note = (headword: string) => VAGUE_LANGUAGE_NEW_WORDS.find(word => word.word === headword)!.note!;
  assert.match(note("or so"), /After the quantity/);
  assert.match(note("or thereabouts"), /Bare thereabouts/);
  assert.match(note("a ballpark figure"), /noun phrase/);
  assert.match(note("-odd"), /over twenty/);
  assert.match(note("-something"), /20–29/);
  assert.match(note("at least"), /inclusive minimum/);
  assert.match(note("at most"), /inclusive maximum/);
  assert.match(note("in excess of"), /strict lower threshold/);
  assert.match(note("no less than"), /no fewer than/);
  assert.match(note("to some extent"), /To an extent/);
  assert.match(note("on the order of"), /of the order of/);
  assert.match(note("in the low ..."), /not an exact universally fixed range/);
  const upperBoundExample = VAGUE_LANGUAGE_NEW_WORDS.find(word => word.word === "no more than")!.examples[0];
  assert.match(upperBoundExample.tr, /не більше трьох відповідей/);
});

test("two complete original readings have 220–280 words and evidence-backed comprehension", () => {
  assert.equal(VAGUE_LANGUAGE_READINGS.length, 2);
  for (const reading of VAGUE_LANGUAGE_READINGS) {
    const words = reading.paragraphs.join(" ").trim().split(/\s+/).length;
    assert.ok(words >= 220 && words <= 280, `${reading.id}: ${words} words`);
    assert.equal(reading.paragraphs.length, 4);
    assert.equal(reading.questions.length, 4);
    assert.equal(reading.trueFalse.length, 4);
    assert.equal(reading.trueFalse.filter(item => item.answer).length, 2);
    for (const question of reading.questions) assert.ok(question.prompt && question.suggestedAnswer.length > 40);
    for (const item of reading.trueFalse) assert.ok(item.prompt && item.explanation.length > 40);
  }
});

test("two fourteen-turn dialogues retain real exchanges and balanced comprehension", () => {
  assert.equal(VAGUE_LANGUAGE_DIALOGUES.length, 2);
  for (const dialogue of VAGUE_LANGUAGE_DIALOGUES) {
    assert.equal(dialogue.turns.length, 14);
    assert.equal(new Set(dialogue.turns.map(turn => turn.speaker)).size, 2);
    assert.equal(dialogue.questions.length, 4);
    assert.equal(dialogue.trueFalse.length, 4);
    assert.equal(dialogue.trueFalse.filter(item => item.answer).length, 2);
    assert.ok(dialogue.turns.every(turn => turn.text.length > 40));
    for (const question of dialogue.questions) assert.ok(question.prompt && question.suggestedAnswer.length > 40);
    for (const item of dialogue.trueFalse) assert.ok(item.prompt && item.explanation.length > 40);
  }
});

test("all sixteen previous Feelings expressions reappear naturally in the new reference material", () => {
  const patterns = [
    /freak out/, /was taken aback/, /been on edge/, /lose (?:her|his) temper/, /clammed up/, /felt gutted/,
    /cringed|cringe/, /felt flustered|of flustered/, /was mortified/, /went red/, /burst out laughing/,
    /cracked up/, /laughed my head off/, /was thrilled to bits|are thrilled to bits/, /was moved/, /was.*?overwhelmed|felt overwhelmed/,
  ];
  for (const pattern of patterns) assert.match(allProse, pattern);
  assert.match(allProse, /objected to people treating/);
  assert.match(allProse, /mind you giving/);
});

test("every reference context uses past-before-past and completion-by-future-point forms", () => {
  const contexts = [
    ...VAGUE_LANGUAGE_READINGS.map(reading => reading.paragraphs.join(" ")),
    ...VAGUE_LANGUAGE_DIALOGUES.map(dialogue => dialogue.turns.map(turn => turn.text).join(" ")),
  ];
  for (const context of contexts) {
    assert.match(context, /had (?:checked|watched|only given|the fundraising page reached)/i);
    assert.match(context, /before|By the time/i);
    assert.match(context, /By (?:Friday|opening night|three|tomorrow|Monday|the next)/);
    assert.match(context, /will have (?:checked|confirmed|tested|prepared|verified|thanked)/);
    assert.doesNotMatch(context, /<[^>]+>|\*\*/);
  }
});

test("new stories explicitly continue two first-lesson situations rather than recycling only isolated emotion words", () => {
  assert.match(VAGUE_LANGUAGE_READINGS[0].paragraphs.join(" "), /investor pitch to Margaret Hale.*helping Ben/);
  const continuation = VAGUE_LANGUAGE_DIALOGUES[0];
  assert.deepEqual([...new Set(continuation.turns.map(turn => turn.speaker))], ["Emma", "Jack"]);
  assert.match(continuation.turns[0].text, /last month’s argument about bugs and changing requirements/);
});

test("source-like claims have one answer supported by the actual facts rather than accidental general knowledge", () => {
  const reading = VAGUE_LANGUAGE_READINGS[0];
  assert.match(reading.paragraphs.join(" "), /forty-seven visitors/);
  assert.match(reading.trueFalse.find(item => item.prompt.includes("sixty"))!.explanation, /chairs/);
  const roof = VAGUE_LANGUAGE_READINGS[1];
  assert.match(roof.paragraphs.join(" "), /at most eighty guests/);
  assert.match(roof.paragraphs.join(" "), /single screening: safety rules allow only eighty tickets/);
  assert.equal(roof.trueFalse.find(item => item.prompt.includes("exceed eighty"))!.answer, false);
  const donations = VAGUE_LANGUAGE_DIALOGUES[1];
  assert.match(donations.turns.at(-1)!.text, /Saturday.*Monday afternoon/);
  assert.equal(donations.trueFalse.find(item => item.prompt.includes("after donations"))!.answer, true);
});
