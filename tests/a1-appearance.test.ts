import assert from "node:assert/strict";
import test from "node:test";
import {
  a1AppearanceHomework,
  a1AppearanceSections,
  a1AppearanceVocabulary,
} from "../src/lib/bundled-lessons/a1-appearance";
import {
  homeworkVoiceRecordingItemId,
  homeworkVoiceRecordingTarget,
} from "../src/lib/lesson-homework";
import {
  publicRegularLessonSections,
  regularAnswerMap,
} from "../src/lib/regular-lesson";

test("A1 Appearance preserves the complete vocabulary, practice, reading and dialogues", () => {
  assert.equal(a1AppearanceVocabulary.length, 18);
  assert.equal(new Set(a1AppearanceVocabulary.map((entry) => entry.word)).size, 18);
  assert.equal(a1AppearanceSections.length, 19);
  assert.ok(a1AppearanceSections.some((section) => section.title.includes("A New Life in Germany")));
  assert.ok(a1AppearanceSections.some((section) => section.title.includes("At the Train Station")));
  assert.ok(a1AppearanceSections.some((section) => section.title.includes("Meeting in the Forest")));
});

test("student lesson payload never contains teacher keys", () => {
  const objectiveAnswers = a1AppearanceSections.reduce(
    (total, section) => total + regularAnswerMap(section).size,
    0,
  );
  assert.equal(objectiveAnswers, 54);
  const publicSections = publicRegularLessonSections(a1AppearanceSections);
  assert.ok(publicSections.every((section) => section.teacherHtml === ""));
  assert.ok(publicSections.every((section) => !section.studentHtml.includes("<b>Key:</b>")));
});

test("A1 Appearance homework is complete and uses native voice recording", () => {
  assert.equal(a1AppearanceHomework.exercises.length, 6);
  assert.deepEqual(
    a1AppearanceHomework.exercises.map((exercise) => exercise.kind),
    ["fill", "fill", "question-text", "fill", "question-text", "question-audio"],
  );
  const audio = a1AppearanceHomework.exercises.at(-1);
  assert.equal(audio?.items.length, 1);
  assert.equal(audio?.kind, "question-audio");
  assert.equal(JSON.stringify(a1AppearanceHomework).toLowerCase().includes("vocaroo"), false);
  assert.ok(
    a1AppearanceHomework.exercises
      .filter((exercise) => exercise.kind === "fill")
      .flatMap((exercise) => exercise.items)
      .every((item) => (item.prompt.match(/___/g) ?? []).length === 1 && item.answer),
  );
});

test("homework voice target round-trips only safe item ids", () => {
  const target = homeworkVoiceRecordingTarget("appearance-hw-speaking-one");
  assert.equal(homeworkVoiceRecordingItemId(target), "appearance-hw-speaking-one");
  assert.equal(homeworkVoiceRecordingItemId("homework:../bad"), null);
  assert.equal(homeworkVoiceRecordingItemId("lesson:appearance-hw-speaking-one"), null);
});
