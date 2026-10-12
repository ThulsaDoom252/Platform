import assert from "node:assert/strict";
import test from "node:test";
import {
  BREAKING_BAD_FOLDER,
  WALT_MEETS_GUS_QUESTIONS,
  WALT_MEETS_GUS_SPEAKERS,
  WALT_MEETS_GUS_TITLE,
  WALT_MEETS_GUS_TRANSCRIPT,
  WALT_MEETS_GUS_VOCABULARY,
  WALT_MEETS_GUS_VIDEO_TITLE,
  WALT_MEETS_GUS_VIDEO_URL,
  parseWaltMeetsGusSource,
  validateWaltMeetsGusSource,
  waltMeetsGusVocabulary,
} from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus";
import { richLineWords } from "../src/lib/lesson-unit";
import { parseLessonVideoSource } from "../src/lib/class-video";

test("Walt meets Gus uses the supplied YouTube video in the native player", () => {
  assert.equal(WALT_MEETS_GUS_VIDEO_URL, "https://www.youtube.com/watch?v=L6G0VxscwqE");
  assert.match(WALT_MEETS_GUS_VIDEO_TITLE, /Walter White Meets Gustavo Fring/);
  assert.deepEqual(parseLessonVideoSource(WALT_MEETS_GUS_VIDEO_URL), {
    kind: "youtube", src: WALT_MEETS_GUS_VIDEO_URL, videoId: "L6G0VxscwqE", startAt: 0, endAt: null,
  });
});

test("Breaking Bad activity has the requested title and all four corrected questions", () => {
  assert.equal(BREAKING_BAD_FOLDER, "Breaking Bad");
  assert.equal(WALT_MEETS_GUS_TITLE, "Walt meets Gus");
  assert.deepEqual(WALT_MEETS_GUS_QUESTIONS, [
    "Why did Walt want five minutes of Gus's time?",
    "What were they talking about?",
    "Why didn't Gus want to work with Walter?",
    "Did they reach a deal by the end of the conversation?",
  ]);
});

test("all 19 screenshot entries are retained with corrected spelling and usage notes", () => {
  const words = waltMeetsGusVocabulary();
  assert.equal(words.length, 19);
  assert.equal(new Set(words.map((word) => word.word)).size, 19);
  for (const word of words) {
    assert.ok(word.translation && word.description && word.note && word.icon);
    assert.equal(word.examples.length, 2);
    assert.ok(word.examples.every((example) => example.en && example.tr));
  }
  for (const headword of ["impeccable", "to have poor judgment", "That is not the only factor.",
    "to submit something through an email system", "at a moment's notice",
    "You're confusing me with someone else."]) {
    assert.ok(words.some((word) => word.word === headword), headword);
  }
  assert.match(words.find((word) => word.word.startsWith("You're confusing"))!.note!, /confusing me for someone else/);
});

test("46 original utterances keep their speakers, ordering and source wording", () => {
  assert.deepEqual(WALT_MEETS_GUS_SPEAKERS, { 0: "Gustavo", 1: "Walter White" });
  assert.equal(WALT_MEETS_GUS_TRANSCRIPT.length, 46);
  assert.deepEqual(WALT_MEETS_GUS_TRANSCRIPT[0], { speaker: "Gustavo", text: "**Can I help you**, sir?" });
  assert.equal(WALT_MEETS_GUS_TRANSCRIPT[1].speaker, "Walter White");
  assert.equal(WALT_MEETS_GUS_TRANSCRIPT.at(-1)!.speaker, "Gustavo");
  assert.ok(WALT_MEETS_GUS_TRANSCRIPT.every((line) => Object.values(WALT_MEETS_GUS_SPEAKERS).includes(line.speaker as "Gustavo" | "Walter White")));
  assert.match(WALT_MEETS_GUS_TRANSCRIPT[10].text, /confusing me for someone else/);
  assert.equal(WALT_MEETS_GUS_TRANSCRIPT[43].text, "W- will I hear from you?");
});

test("every vocabulary entry is bold in the dialogue, including nested submit phrases", () => {
  const boldSegments = WALT_MEETS_GUS_TRANSCRIPT.flatMap((line) =>
    Array.from(line.text.matchAll(/\*\*(.+?)\*\*/g), (match) => match[1].toLowerCase()));
  for (const entry of WALT_MEETS_GUS_VOCABULARY) {
    assert.ok(entry.dialogueForms.some((form) => boldSegments.some((segment) => segment.includes(form.toLowerCase()))), entry.word);
  }
  for (const line of WALT_MEETS_GUS_TRANSCRIPT) {
    assert.equal((line.text.match(/\*\*/g)?.length ?? 0) % 2, 0);
    assert.equal(richLineWords(line.text).map((word) => word.text).join(""), line.text.replace(/\*\*/g, ""));
  }
  assert.ok(richLineWords(WALT_MEETS_GUS_TRANSCRIPT[27].text).some((word) => word.bold && word.text === "impeccable"));
});

test("timed transcript parser maps Speaker 0/1 and handles CRLF, BOM and wrapped text", () => {
  assert.deepEqual(parseWaltMeetsGusSource("\uFEFF00:00:05,720 --> 00:00:06,340 [Speaker 0]\r\nCan I help you, sir? \r\n\r\n00:00:09,420 --> 00:00:10,420 [Speaker 1]\r\nDiet Coke,\r\nplease. \r\n"), [
    { speaker: "Gustavo", text: "Can I help you, sir?" },
    { speaker: "Walter White", text: "Diet Coke, please." },
  ]);
  for (const source of ["", "00:00:05,720 --> 00:00:06,340 [Speaker 2]\nHello.", "00:00:05,720 --> 00:00:06,340 [Speaker 0]\n"]) {
    assert.throws(() => parseWaltMeetsGusSource(source), /Invalid transcript block/);
  }
});

function sourceFixture() {
  return WALT_MEETS_GUS_TRANSCRIPT.map((line) =>
    `00:00:00,000 --> 00:00:01,000 [Speaker ${line.speaker === "Gustavo" ? 0 : 1}]\n${line.text.replace(/\*\*/g, "")}`
  ).join("\n\n");
}

test("installer validation prevents importing truncated, changed or mislabelled dialogue", () => {
  const source = sourceFixture();
  assert.doesNotThrow(() => validateWaltMeetsGusSource(source));
  assert.throws(() => validateWaltMeetsGusSource(source.split("\n\n").slice(1).join("\n\n")), /Expected 46 source lines/);
  assert.throws(() => validateWaltMeetsGusSource(source.replace("Can I help you", "How can I help you")), /line 1/);
  assert.throws(() => validateWaltMeetsGusSource(source.replace("[Speaker 0]", "[Speaker 1]")), /line 1/);
});

test("vocabulary builder returns independent native vocabulary data", () => {
  const first = waltMeetsGusVocabulary();
  first[0].examples[0].en = "Changed";
  assert.notEqual(waltMeetsGusVocabulary()[0].examples[0].en, "Changed");
});
