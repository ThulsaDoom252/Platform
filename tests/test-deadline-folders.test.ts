import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "../src/lib/i18n";
import { parseTestDeadlineInput, testDeadlineInputValue, testDeadlineOverdue, formatTestDeadline } from "../src/lib/tests/deadline";
import { studentTestFolders } from "../src/lib/tests/student-folders";
import { TESTS_STORAGE_SQL, TESTS_DEADLINE_SQL, TESTS_FEEDBACK_SQL } from "../src/lib/db/tests-storage-schema";
import type { TestHomeworkCard } from "../src/lib/tests/types";
import { StudentTestFolders } from "../src/components/tests/student-test-folders";
import { TestDeadlineBadge } from "../src/components/tests/test-deadline-badge";
import { TestsLibraryView } from "../src/components/tests/tests-library-view";

function card(id: string, studentId: string, studentName: string, complete = false, percent: number | null = null): TestHomeworkCard {
  return { id, studentId, studentName, studentAvatarUrl: null, kind: "TEST", activityType: "TEST", title: "Conditional <test>", exerciseIds: ["exercise-1"],
    assignedAt: "2026-10-10T12:00:00.000Z", submittedAt: complete ? "2026-10-11T12:00:00.000Z" : null,
    reviewedAt: null, nextLessonAt: null, started: percent !== null, latestPercent: percent, attemptCount: percent === null ? 0 : 1 };
}

test("folders exist only for assigned students, group by id not name and count completed 0% as passed", () => {
  const items = [card("a", "s1", "Alex", true, 0), card("b", "s1", "Alex", false, 30), card("c", "s2", "Alex", true, 40), card("d", "s3", "Zoe")];
  const saved = structuredClone(items), folders = studentTestFolders(items);
  assert.deepEqual(folders.map((item) => [item.id, item.awaiting, item.passed]), [["s1", 1, 1], ["s2", 0, 1], ["s3", 1, 0]]);
  assert.equal(folders[0].results[0].percent, 0);
  assert.deepEqual(studentTestFolders([]), []); assert.deepEqual(items, saved);
  assert.equal(studentTestFolders([{ ...items[0], submittedAt: null, latestPercent: null }])[0].awaiting, 1);
});

test("root folder markup follows levels, escapes names, includes results and disappears within library categories", () => {
  const folders = createElement(StudentTestFolders, { items: [card("a", "s1", "Alex <script>", true, 0)], locale: "en" });
  const root = renderToStaticMarkup(createElement(TestsLibraryView, { location: { level: null, category: null }, labels: dictionaries.en.testsLibrary, studentFolders: folders }));
  assert.equal((root.match(/data-test-level=/g) ?? []).length, 6);
  assert.ok(root.indexOf("data-test-student-folders") > root.lastIndexOf("data-test-level="));
  assert.ok(root.includes('href="/teacher/tests/assigned/s1"')); assert.ok(root.includes("Alex &lt;script&gt;"));
  assert.ok(root.includes("0%") && root.includes("Awaiting: 0") && root.includes("Passed tests: 1"));
  const level = renderToStaticMarkup(createElement(TestsLibraryView, { location: { level: "b1", category: null }, labels: dictionaries.en.testsLibrary, studentFolders: folders }));
  assert.ok(!level.includes("data-test-student-folders"));
});

test("deadline input consistently uses the school clock, including midnight and leap days", () => {
  for (const [input, expected] of [["2026-10-12T18:30", "2026-10-12T15:30:00.000Z"], ["2026-10-12T00:15", "2026-10-11T21:15:00.000Z"], ["2028-02-29T12:00", "2028-02-29T09:00:00.000Z"]]) {
    assert.equal(parseTestDeadlineInput(input), expected); assert.equal(testDeadlineInputValue(expected), input);
  }
  for (const invalid of ["", "2026-02-29T12:00", "2026-10-12T25:00", "2026-13-12T12:00", "1999-10-12T12:00", "2101-01-01T12:00", "2026-10-12", "wrong"]) assert.equal(parseTestDeadlineInput(invalid), null);
  assert.equal(testDeadlineInputValue("wrong"), ""); assert.equal(testDeadlineInputValue(null), "");
  assert.match(formatTestDeadline("2026-10-12T15:30:00.000Z", "ru"), /18:30/);
});

test("overdue deadlines are visible but completed tests are never marked overdue", () => {
  const dueAt = "2020-10-12T15:30:00.000Z", now = new Date("2026-10-12T16:00:00.000Z");
  assert.equal(testDeadlineOverdue(dueAt, false, now), true); assert.equal(testDeadlineOverdue(dueAt, true, now), false);
  assert.equal(testDeadlineOverdue(null, false, now), false); assert.equal(testDeadlineOverdue("2099-01-01T00:00:00Z", false, now), false);
  const awaiting = renderToStaticMarkup(createElement(TestDeadlineBadge, { dueAt, locale: "en" }));
  assert.ok(awaiting.includes("Overdue") && awaiting.includes('dateTime="2020-10-12T15:30:00.000Z"'));
  assert.ok(!renderToStaticMarkup(createElement(TestDeadlineBadge, { dueAt, locale: "en", completed: true })).includes("Overdue"));
  assert.equal(renderToStaticMarkup(createElement(TestDeadlineBadge, { locale: "en" })), "");
});

test("storage setup adds only nullable deadline/feedback metadata; folder route checks role and scoped non-empty assignments", () => {
  assert.equal(TESTS_DEADLINE_SQL, "ALTER TABLE test_assignments ADD COLUMN IF NOT EXISTS due_at timestamp;");
  assert.equal(TESTS_STORAGE_SQL.split(TESTS_DEADLINE_SQL).length, 2);
  assert.equal(TESTS_FEEDBACK_SQL, "ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS teacher_feedback jsonb;");
  assert.equal(TESTS_STORAGE_SQL.split(TESTS_FEEDBACK_SQL).length, 2);
  assert.ok(!/^\s*(ALTER|DROP|TRUNCATE|UPDATE|DELETE FROM)\b/im.test(TESTS_STORAGE_SQL.replace(TESTS_DEADLINE_SQL, "").replace(TESTS_FEEDBACK_SQL, "")));
  const route = readFileSync("src/app/teacher/tests/assigned/[studentId]/page.tsx", "utf8");
  assert.ok(route.includes('session?.role !== "TEACHER"')); assert.ok(route.includes("testHomeworkCardsAction(studentId)")); assert.ok(route.includes("if (!items.length) notFound()"));
  const editor = readFileSync("src/components/tests/test-deadline-editor.tsx", "utf8");
  assert.ok(editor.includes("if (completed) return null")); assert.ok(editor.includes('type="datetime-local"'));
  const detail = readFileSync("src/components/tests/assigned-test-view.tsx", "utf8");
  assert.ok(detail.includes("setDueAt(current.dueAt ?? null)")); assert.ok(detail.includes("completed={completed}"));
});
