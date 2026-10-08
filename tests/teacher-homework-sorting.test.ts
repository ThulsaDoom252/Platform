import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "../src/lib/i18n";
import { HomeworkSortControls } from "../src/components/teacher/homework-sort-controls";
import { HomeworkSortedFolders } from "../src/components/teacher/homework-sorted-folders";
import { HomeworkGroupedList } from "../src/components/teacher/homework-grouped-list";
import { groupTeacherHomeworksByStudent, groupTeacherHomeworkPriorities, readTeacherHomeworkSort,
  sortTeacherHomeworks, sortTeacherHomeworkStudentGroups, TEACHER_HOMEWORK_SORT_KEYS,
  type TeacherHomeworkOrderable, type TeacherHomeworkSortKey } from "../src/lib/teacher-homework-order";

function row(id: string, overrides: Partial<TeacherHomeworkOrderable> = {}) {
  return { id, studentId: id.split("-")[0], studentName: id.split("-")[0], studentAvatarUrl: null,
    title: id, nextLessonAt: null, assignedAt: "2026-10-08T10:00:00Z", submittedAt: null,
    reviewedAt: null, started: false, ...overrides };
}
const states = [row("new"), row("waiting", { submittedAt: "2026-10-08" }),
  row("doing", { started: true }), row("done", { submittedAt: "2026-10-07", reviewedAt: "2026-10-08", started: true })];

test("sorting accepts all requested modes, preserves legacy links and has safe defaults", () => {
  for (const key of TEACHER_HOMEWORK_SORT_KEYS) assert.equal(readTeacherHomeworkSort(key, undefined).key, key);
  assert.deepEqual(readTeacherHomeworkSort(undefined, undefined, "name"), { key: "name", desc: false });
  assert.deepEqual(readTeacherHomeworkSort(undefined, undefined), { key: "assigned", desc: true });
  assert.deepEqual(readTeacherHomeworkSort("waiting", undefined), { key: "waiting", desc: false });
  assert.deepEqual(readTeacherHomeworkSort("lesson", "desc"), { key: "lesson", desc: true });
  assert.deepEqual(readTeacherHomeworkSort(["lesson"], "bad", "name"), { key: "name", desc: false });
  assert.deepEqual(readTeacherHomeworkSort("<script>", "asc"), { key: "assigned", desc: false });
});

test("each chosen status is first without filtering out other homework or treating reviewed work as waiting", () => {
  const snapshot = JSON.stringify(states);
  for (const [key, expected] of [["waiting", "waiting"], ["notStarted", "new"], ["inProgress", "doing"]] as const) {
    const sorted = sortTeacherHomeworks(states, key, false);
    assert.equal(sorted[0].id, expected);
    assert.equal(sortTeacherHomeworks(states, key, true).at(-1)?.id, expected);
    assert.deepEqual(sorted.map((item) => item.id).sort(), ["doing", "done", "new", "waiting"]);
  }
  assert.equal(JSON.stringify(states), snapshot);
});

test("alphabetical sorting inside a student folder uses homework titles rather than identical student names", () => {
  const items = [row("9", { title: "Unit 10", studentName: "Alla" }), row("1", { title: "apple", studentName: "Alla" }),
    row("8", { title: "Unit 2", studentName: "Alla" })];
  assert.deepEqual(sortTeacherHomeworks(items, "name", false).map((item) => item.title), ["apple", "Unit 2", "Unit 10"]);
  assert.deepEqual(sortTeacherHomeworks(items, "name", true).map((item) => item.title), ["Unit 10", "Unit 2", "apple"]);
});

test("student folders prioritize counts of waiting, not-started and in-progress tasks; ties are alphabetical", () => {
  const items = [row("Alla-new"), row("Bogdan-review", { submittedAt: "2026-10-08" }),
    row("Ksenia-review-1", { submittedAt: "2026-10-08" }), row("Ksenia-review-2", { submittedAt: "2026-10-08" }),
    row("Alla-doing", { started: true }), row("Bogdan-new")];
  const groups = groupTeacherHomeworksByStudent(items);
  const snapshot = JSON.stringify(groups);
  assert.deepEqual(sortTeacherHomeworkStudentGroups(groups, "waiting", false).map((group) => group.studentId), ["Ksenia", "Bogdan", "Alla"]);
  assert.deepEqual(sortTeacherHomeworkStudentGroups(groups, "inProgress", false).map((group) => group.studentId), ["Alla", "Bogdan", "Ksenia"]);
  assert.deepEqual(sortTeacherHomeworkStudentGroups(groups, "notStarted", false).map((group) => group.studentId), ["Alla", "Bogdan", "Ksenia"]);
  assert.deepEqual(sortTeacherHomeworkStudentGroups(groups, "name", true).map((group) => group.studentId), ["Ksenia", "Bogdan", "Alla"]);
  assert.equal(JSON.stringify(groups), snapshot);
});

test("schedule sorting uses the nearest lesson and keeps missing or malformed dates last in both directions", () => {
  const groups = groupTeacherHomeworksByStudent([row("Alla-later", { nextLessonAt: "2026-10-10T12:00:00Z" }),
    row("Alla-soon", { nextLessonAt: "2026-10-08T15:00:00Z" }), row("Bogdan", { nextLessonAt: "2026-10-09T12:00:00Z" }),
    row("Ksenia"), row("Zed", { nextLessonAt: "bad-date" })]);
  assert.deepEqual(sortTeacherHomeworkStudentGroups(groups, "lesson", false).map((group) => group.studentId), ["Alla", "Bogdan", "Ksenia", "Zed"]);
  assert.deepEqual(sortTeacherHomeworkStudentGroups(groups, "lesson", true).map((group) => group.studentId), ["Bogdan", "Alla", "Ksenia", "Zed"]);
  assert.equal(sortTeacherHomeworks([row("bad", { nextLessonAt: "bad" }), row("soon", { nextLessonAt: "2026-10-09" })], "lesson", true).at(-1)?.id, "bad");
});

test("status buckets include every assignment exactly once and respect reverse order", () => {
  for (const key of ["waiting", "notStarted", "inProgress", "status"] as TeacherHomeworkSortKey[]) {
    const buckets = groupTeacherHomeworkPriorities(states, key, false);
    const reverse = groupTeacherHomeworkPriorities(states, key, true);
    assert.deepEqual(reverse.map((bucket) => bucket.state), buckets.map((bucket) => bucket.state).reverse());
    assert.deepEqual(buckets.flatMap((bucket) => bucket.items).map((item) => item.id).sort(), ["doing", "done", "new", "waiting"]);
  }
  assert.equal(groupTeacherHomeworkPriorities(states, "name", false).length, 1);
});

test("compact sorting controls expose all modes with localized labels and an accessible direction button", () => {
  for (const locale of ["en", "ru", "uk"] as const) {
    const labels = dictionaries[locale].teacherHomeworks;
    const html = renderToStaticMarkup(createElement(HomeworkSortControls, { state: { key: "waiting", desc: false }, labels, onChange: () => {} }));
    for (const key of TEACHER_HOMEWORK_SORT_KEYS) assert.ok(html.includes(`value="${key}"`));
    assert.ok(html.includes('value="waiting" selected=""'));
    assert.ok(html.includes(labels.sortName));
    assert.ok(html.includes(labels.waiting));
    assert.ok(html.includes(labels.reverseSort));
    assert.ok(html.includes("bg-accent-soft"));
    assert.ok(html.includes("<label"));
  }
});

test("server-rendered folders and grouped cards honor initial sorting, including older waiting work above newer untouched work", () => {
  const labels = dictionaries.en.teacherHomeworks;
  const items = [row("Alla-new"), row("Bogdan-waiting", { assignedAt: "2026-10-01T10:00:00Z", submittedAt: "2026-10-08" })];
  const folders = groupTeacherHomeworksByStudent(items).map((group) => ({ ...group, card: createElement("article", { "data-student": group.studentId }) }));
  const folderHtml = renderToStaticMarkup(createElement(HomeworkSortedFolders, { folders, initialSort: { key: "waiting", desc: false }, labels, locale: "en-US" }));
  assert.ok(folderHtml.indexOf('data-student="Bogdan"') < folderHtml.indexOf('data-student="Alla"'));
  const cards = items.map((item) => ({ id: item.id, kind: "LESSON" as const, assignedAt: item.assignedAt, order: item,
    card: createElement("article", { "data-card": item.id }) }));
  const html = renderToStaticMarkup(createElement(HomeworkGroupedList, { cards, locale: "en-US", sortControls: null,
    initialSort: { key: "waiting", desc: false }, sortLabels: labels,
    statusLabels: { reviewed: labels.reviewed, submitted: labels.submitted, inProgress: labels.inProgress, notStarted: labels.notStarted },
    labels: { grouping: labels.grouping, groupByAssignedDate: labels.groupByAssignedDate, groupByHomeworkType: labels.groupByHomeworkType,
      interactiveHomeworks: labels.interactiveHomeworks, activities: "Activities", unknownAssignedDate: labels.unknownAssignedDate,
      activityTypes: { WORDS: "Words", GUESS_DESCRIPTION: "Description", GUESS_PICTURE: "Picture", SPELLING: "Spelling", REVISION: "Revision", OTHER: "Other" } } }));
  assert.ok(html.indexOf('data-card="Bogdan-waiting"') < html.indexOf('data-card="Alla-new"'));
  assert.ok(html.includes('data-homework-assigned-day="2026-10-01"'));
  assert.ok(html.includes('data-homework-assigned-day="2026-10-08"'));
  assert.equal((html.match(/data-card=/g) ?? []).length, 2);
  assert.equal((html.match(/type="checkbox"[^>]*checked=""/g) ?? []).length, 2);
});

test("changing sorting only uses native history, preserves other URL parameters and performs no data writes or requests", () => {
  const source = readFileSync("src/components/teacher/homework-sort-controls.tsx", "utf8");
  assert.ok(source.includes("new URL(window.location.href)"));
  assert.ok(source.includes("window.history.replaceState"));
  assert.ok(source.includes("url.hash"));
  assert.ok(!source.includes("router.push"));
  assert.ok(!source.includes("router.refresh"));
  assert.ok(!source.includes("fetch("));
  assert.ok(!source.includes("/lib/actions/"));
  const page = readFileSync("src/app/teacher/homeworks/page.tsx", "utf8");
  assert.ok(page.includes("HomeworkSortedFolders"));
  assert.ok(page.includes("order: homeworkSortData(item)"));
});
