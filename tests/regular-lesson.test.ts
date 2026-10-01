import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addRegularLessonFocusIds,
  defaultRegularOpenSections,
  normalizeRegularLessonSections,
  publicRegularLessonSections,
  regularLessonSection,
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
