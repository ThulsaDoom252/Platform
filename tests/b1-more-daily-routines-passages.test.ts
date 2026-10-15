import assert from "node:assert/strict";
import test from "node:test";
import { DAILY_ROUTINES_PASSAGES } from "../src/lib/bundled-lessons/b1-more-daily-routines-passages";

const textOf = (passage: (typeof DAILY_ROUTINES_PASSAGES)[number]) =>
  passage.paragraphs?.join(" ") ?? passage.turns?.map(turn => turn.text).join(" ") ?? "";

const lexicalTargets: [string, RegExp][] = [
  ["to hit the snooze button", /\bhits? the snooze button\b/i],
  ["to have a shave", /\b(?:have|has|having) a shave\b/i],
  ["to commute", /\bcommut(?:e|es|ing)\b/i],
  ["to make one's own dinner", /\bmak(?:e|es|ing) (?:my|your|his|her|our|their) own dinner\b/i],
  ["to run errands", /\bruns? errands\b/i],
  ["to set one's alarm", /\bsets? (?:my|your|his|her|our|their) alarm\b/i],
  ["to make one's own lunch", /\bmak(?:e|es|ing) (?:my|your|his|her|our|their) own lunch\b/i],
  ["to have an early night", /\b(?:have|has|having) an early night\b/i],
  ["to feed the dog", /\bfeeds? the dog\b/i],
  ["to chill on the sofa", /\bchills? on the sofa\b/i],
  ["to walk the dog", /\bwalks? the dog\b/i],
  ["to check one's messages", /\bchecks? (?:my|your|his|her|our|their) messages\b/i],
  ["to check one's phone", /\bchecks? (?:my|your|his|her|our|their) phone\b/i],
  ["to have a nap", /\b(?:have|has|having) a nap\b/i],
  ["to stay up late", /\bstays? up late\b/i],
  ["to feed the cat", /\bfeeds? the cat\b/i],
  ["to make one's own breakfast", /\bmak(?:e|es|ing) (?:my|your|his|her|our|their) own breakfast\b/i],
  ["to sleep in", /\bsleeps? in\b/i],
  ["to grab a coffee", /\bgrabs? a coffee\b/i],
];

test("daily routines includes one medium reading and two medium two-speaker dialogues", () => {
  assert.equal(DAILY_ROUTINES_PASSAGES.length, 3);
  assert.equal(new Set(DAILY_ROUTINES_PASSAGES.map(passage => passage.id)).size, 3);
  assert.equal(DAILY_ROUTINES_PASSAGES.filter(passage => passage.kind === "reading").length, 1);
  assert.equal(DAILY_ROUTINES_PASSAGES.filter(passage => passage.kind === "dialogue").length, 2);
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    const words = textOf(passage).trim().split(/\s+/).length;
    if (passage.kind === "reading") {
      assert.ok(words >= 300 && words <= 360, `${passage.id}: ${words} words`);
      assert.ok(passage.paragraphs && passage.paragraphs.length >= 4);
      assert.equal(passage.turns, undefined);
    } else {
      assert.ok(words >= 240 && words <= 330, `${passage.id}: ${words} words`);
      assert.ok(passage.turns && passage.turns.length >= 18 && passage.turns.length <= 24);
      assert.equal(new Set(passage.turns.map(turn => turn.speaker)).size, 2);
      assert.equal(passage.paragraphs, undefined);
    }
  }
});

test("each daily routines passage naturally uses every one of the nineteen vocabulary targets", () => {
  assert.equal(lexicalTargets.length, 19);
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    for (const [target, expression] of lexicalTargets) {
      assert.match(textOf(passage), expression, `${passage.id}: missing ${target}`);
    }
  }
});

test("each daily routines passage contrasts former habits, familiar routines and adapting", () => {
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    const text = textOf(passage);
    assert.match(text, /\b(?:he|she|I|you|they) used to \w+/i, `${passage.id}: former habit`);
    assert.match(text, /(?:\bis|\bam|\bare|'m|'re|'s) used to \w+ing\b/i, `${passage.id}: familiar routine`);
    assert.match(text, /(?:\bis|\bam|\bare|'m|'re|'s) (?:still )?getting used to \w+ing\b/i, `${passage.id}: adapting`);
    assert.doesNotMatch(text, /\bused to (?:to |commuteing|makeing|geting)\b/i);
  }
});

test("each daily routines passage has eight balanced true-false items with specific evidence", () => {
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    assert.equal(passage.trueFalse.length, 8, passage.id);
    assert.equal(passage.trueFalse.filter(item => item.answer).length, 4, passage.id);
    assert.equal(passage.trueFalse.filter(item => !item.answer).length, 4, passage.id);
    assert.equal(new Set(passage.trueFalse.map(item => item.prompt)).size, 8);
    for (const item of passage.trueFalse) {
      assert.ok(item.prompt.trim().length > 20);
      assert.ok(item.explanation.trim().length > 40);
      assert.equal(typeof item.answer, "boolean");
    }
  }
});

test("each daily routines passage has eight distinct comprehension questions and teacher answers", () => {
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    assert.equal(passage.questions.length, 8, passage.id);
    assert.equal(new Set(passage.questions.map(item => item.prompt)).size, 8);
    for (const question of passage.questions) {
      assert.ok(question.prompt.endsWith("?"));
      assert.ok(question.suggestedAnswer.trim().length > 30);
    }
  }
});

test("daily routines passages are plain text ready for escaped lesson highlighting", () => {
  for (const passage of DAILY_ROUTINES_PASSAGES) {
    assert.doesNotMatch(textOf(passage), /<[^>]+>|\*\*/);
  }
});
