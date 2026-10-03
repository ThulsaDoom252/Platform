import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addRegularLessonFocusIds,
  defaultRegularOpenSections,
  normalizeRegularLessonSections,
  publicRegularLessonSections,
  regularAnswerMap,
  regularExerciseOverrideKey,
  regularLessonSection,
  regularVoiceRecording,
  regularVoiceRecordingKey,
} from "../src/lib/regular-lesson";
import { cleanScriptHtml } from "../src/lib/script-html";

const source = [
  {
    id: "01-warm-up",
    title: "☕ Warm-up",
    tone: "warm",
    studentHtml: '<p onclick="bad()">Question</p>',
    teacherHtml: "<p>Question <span class=\"ans\">answer</span></p><script>bad()</script>",
    defaultOpen: false,
  },
  {
    id: "02-vocabulary",
    title: "📖 Vocabulary",
    tone: "vocab",
    studentHtml: "<p>meat</p>",
    teacherHtml: "<p>meat</p>",
    defaultOpen: true,
  },
  {
    id: "13-notes",
    title: "Teacher notes",
    tone: "teacher",
    studentHtml: "",
    teacherHtml: "<p>Private</p>",
    defaultOpen: false,
    teacherOnly: true,
  },
];

test("regular lesson sections are sanitized and keep their order", () => {
  const sections = normalizeRegularLessonSections(source);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].studentHtml, "<p>Question</p>");
  assert.ok(!sections[0].teacherHtml.includes("script"));
});

test("student payload contains neither answers nor teacher-only notes", () => {
  const sections = publicRegularLessonSections(source);
  assert.deepEqual(sections.map((section) => section.id), ["01-warm-up", "02-vocabulary"]);
  assert.ok(sections.every((section) => section.teacherHtml === ""));
});

test("warm-up stays closed while normal sections open by default", () => {
  assert.deepEqual(defaultRegularOpenSections(source), ["regular:02-vocabulary"]);
  assert.equal(regularLessonSection("regular:01-warm-up", source)?.title, "☕ Warm-up");
  assert.equal(regularLessonSection("regular:missing", source), null);
});

test("student and teacher content receive matching focus ids", () => {
  const student = addRegularLessonFocusIds(
    "<p>Task</p><ol><li>One</li><li>Two</li></ol><p>Next</p>",
  );
  const teacher = addRegularLessonFocusIds(
    '<p>Task <span class="ans">answer</span></p><ol><li>One</li><li>Two</li></ol>' +
      '<div class="key-wrap"><div class="key"><p>Answers</p><ol><li>One</li></ol></div></div>' +
      "<p>Next</p>",
  );
  assert.deepEqual(
    [...student.matchAll(/data-focus-id="([^"]+)"/g)].map((match) => match[1]),
    ["item-1", "item-2", "item-3", "item-4"],
  );
  assert.deepEqual(
    [...teacher.matchAll(/data-focus-id="([^"]+)"/g)].map((match) => match[1]),
    ["item-1", "item-2", "item-3", "item-4"],
  );
  assert.match(cleanScriptHtml(student), /data-focus-id="item-4"/);
});

test("checked regular exercises map blanks and true-false answers without exposing them", () => {
  const section = normalizeRegularLessonSections([{
    id: "practice",
    title: "Practice",
    tone: "exercise",
    defaultOpen: true,
    studentHtml:
      '<ol><li>I <span class="blank"></span> fish.</li></ol>' +
      '<ol><li>Salmon is a fish. <span class="tfbox">T / F</span></li></ol>',
    teacherHtml:
      '<ol><li>I <span class="ans">eat / have</span> fish.</li></ol>' +
      '<ol><li>Salmon is a fish. <span class="ans">T</span></li></ol>',
  }])[0];
  const answers = regularAnswerMap(section);

  assert.deepEqual(answers.get("list-1-item-1-blank-1"), {
    answer: "eat",
    accepted: ["eat", "have"],
    kind: "fill",
  });
  assert.deepEqual(answers.get("list-2-item-1-tf-1"), {
    answer: "T",
    accepted: ["T"],
    kind: "true-false",
  });
});

test("a personalized exercise override replaces the checked answer", () => {
  const section = normalizeRegularLessonSections([{
    id: "practice",
    title: "Practice",
    tone: "exercise",
    defaultOpen: true,
    studentHtml: '<ol><li>I <span class="blank"></span> fish.</li></ol>',
    teacherHtml: '<ol><li>I <span class="ans">eat</span> fish.</li></ol>',
  }])[0];
  const state = {
    [regularExerciseOverrideKey(section.id, 1)]: JSON.stringify({
      title: "Edited practice",
      instruction: "Complete the sentence.",
      kind: "fill",
      items: [{ prompt: "I ___ salmon.", answers: ["like"] }],
    }),
  };

  assert.equal(regularAnswerMap(section, state).get("list-1-item-1-blank-1")?.answer, "like");
});

test("voice sections and their published recording survive normalization", () => {
  const [section] = normalizeRegularLessonSections([{
    id: "speaking",
    title: "Speaking",
    tone: "dialogue",
    studentHtml: "",
    teacherHtml: "",
    defaultOpen: false,
    voiceExercise: {
      instruction: "Answer in one recording.",
      prompts: ["What happened?", "What will you do next?"],
      maxSeconds: 180,
    },
  }]);
  assert.deepEqual(section.voiceExercise, {
    instruction: "Answer in one recording.",
    prompts: ["What happened?", "What will you do next?"],
    maxSeconds: 180,
  });

  const state = {
    [regularVoiceRecordingKey(section.id)]: JSON.stringify({
      url: "https://store.public.blob.vercel-storage.com/uploads/lesson-audio/a.webm",
      durationSeconds: 42,
      mimeType: "audio/webm;codecs=opus",
      publishedAt: "2026-10-03T12:00:00.000Z",
    }),
  };
  assert.deepEqual(regularVoiceRecording(state, section.id), {
    url: "https://store.public.blob.vercel-storage.com/uploads/lesson-audio/a.webm",
    durationSeconds: 42,
    mimeType: "audio/webm;codecs=opus",
    publishedAt: "2026-10-03T12:00:00.000Z",
  });
});
