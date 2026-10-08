import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("teacher lesson stays on the left while twister and activities share a right-aligned, wrapping group", () => {
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert.ok(room.includes("{lessonTabButton(LESSON_TABS[0])}"));
  assert.ok(room.includes("{LESSON_TABS.slice(1).map(lessonTabButton)}"));
  assert.ok(room.includes('className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1"'));
  assert.ok(room.includes('"h-9 shrink-0 rounded-xl px-3.5 text-sm font-semibold transition"'));
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
  assert.ok(topic.includes('className="mt-1 flex flex-wrap items-center gap-3"'));
  assert.equal((assigned.match(/\{topic\}/g) ?? []).length, 2);
});
