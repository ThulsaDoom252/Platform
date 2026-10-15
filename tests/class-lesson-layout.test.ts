import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Updated groups Lesson, twister and activities on one row before the right-aligned participants", () => {
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  const toolbar = readFileSync("src/components/class/class-material-toolbar.tsx", "utf8");
  assert.ok(room.includes("{lessonTabButton(LESSON_TABS[0])}"));
  assert.ok(room.includes("{LESSON_TABS.slice(1).map(lessonTabButton)}"));
  assert.ok(toolbar.includes('className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1"'));
  assert.ok(room.includes("<ClassMaterialToolbar lesson={lessonTabButton(LESSON_TABS[0])}"));
  assert.ok(room.includes('"h-9 shrink-0 whitespace-nowrap rounded-xl font-semibold transition"'));
  assert.ok(room.includes('view === "UPDATED" ? "px-2 text-xs sm:px-3.5 sm:text-sm" : "px-3.5 text-sm"'));
  const inline = toolbar.slice(toolbar.indexOf('className="class-toolbar-container'));
  assert.ok(inline.indexOf("{lesson}") < inline.indexOf("{actions}"));
  assert.ok(inline.indexOf("{actions}") < inline.indexOf("{participants}"));
  assert.ok(inline.includes("class-toolbar-sections flex min-w-0 max-w-full items-center gap-1 overflow-x-auto"));
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.class-material-toolbar\s*\{[^}]*display: flex;[^}]*flex-wrap: wrap/);
  assert.match(css, /\.class-toolbar-participants\s*\{[^}]*margin-left: auto/);
  assert.match(css, /\.class-toolbar-participants \.class-participants\s*\{ justify-content: flex-end/);
  assert.ok(room.includes("onClick={() => setLessonTab(tab.key)}"));
  assert.ok(room.includes("aria-pressed={lessonTab === tab.key}"));
  assert.ok(!room.includes("t.classRoom.onlyYou"));
});

test("changing the lesson is passed into the topic rather than rendered in a separate row", () => {
  const classLesson = readFileSync("src/components/class/class-lesson.tsx", "utf8");
  assert.ok(classLesson.includes("onChangeLesson={teacher ? () => setChangingLesson(true) : undefined}"));
  assert.ok(!classLesson.includes('className="flex justify-end"'));
  assert.ok(classLesson.includes("teacher && loaded && (!data || changingLesson)"));
  assert.ok(classLesson.includes("onClick={add}"));
  assert.ok(classLesson.includes("onClick={() => setChangingLesson(false)}"));
});

test("both lesson types share responsive topic actions, restricted to the teacher and excluded from highlighting", () => {
  const assigned = readFileSync("src/components/lessons/assigned-lesson.tsx", "utf8");
  const topic = assigned.slice(assigned.indexOf("const topic = ("), assigned.indexOf("const liveEditor ="));
  assert.ok(topic.includes("{teacher && ("));
  assert.ok(topic.includes("{liveClass && onChangeLesson && ("));
  assert.ok(topic.includes("onClick={onChangeLesson}"));
  assert.ok(topic.includes("onClick={() => setEditingLesson(true)}"));
  assert.ok(topic.includes("{t.lessonUnits.changeClass}"));
  assert.ok(topic.includes('data-no-lesson-highlight className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2"'));
  assert.ok(topic.includes('className="flex flex-wrap items-center gap-3"'));
  assert.ok(!topic.includes("t.lessonUnits.topic"));
  assert.equal((assigned.match(/\{topic\}/g) ?? []).length, 2);
});
