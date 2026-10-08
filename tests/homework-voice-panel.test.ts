import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("overall teacher voice messages are temporarily hidden in homework, while voice answer tasks remain", () => {
  const homework = readFileSync("src/components/lessons/interactive-homework.tsx", "utf8");
  assert.doesNotMatch(homework, /HomeworkTeacherVoiceMessages|homework-teacher-voice-messages/);
  assert.match(homework, /<RegularVoiceRecorder/);
  const storedMessages = readFileSync("src/lib/lesson-homework.ts", "utf8");
  assert.match(storedMessages, /export function homeworkTeacherVoiceMessages\(/);
  const recorder = readFileSync("src/components/lessons/homework-teacher-voice-messages.tsx", "utf8");
  assert.match(recorder, /export function HomeworkTeacherVoiceMessages\(/);
});
