import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeworkGroupedList } from "../src/components/teacher/homework-grouped-list";
import {
  groupTeacherHomeworkContent,
  groupTeacherHomeworkDates,
  type TeacherHomeworkGroupable,
} from "../src/lib/teacher-homework-groups";
import { sortTeacherHomeworks } from "../src/lib/teacher-homework-order";

const row = (
  id: string,
  kind: TeacherHomeworkGroupable["kind"],
  assignedAt = "2026-10-08T10:00:00.000Z",
  activityType?: string,
): TeacherHomeworkGroupable => ({ id, kind, assignedAt, activityType });

test("default grouping uses assignment days, newest first, with a stable order inside the day", () => {
  const items = [
    row("old", "LESSON", "2026-10-07T10:00:00Z"),
    row("new-game", "ACTIVITY", "2026-10-08T12:00:00Z", "SPELLING"),
    row("new-homework", "LESSON", "2026-10-08T11:00:00Z"),
  ];
  const snapshot = JSON.stringify(items);
  const groups = groupTeacherHomeworkDates(items);
  assert.deepEqual(groups.map((group) => group.day), ["2026-10-08", "2026-10-07"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["new-game", "new-homework"]);
  assert.deepEqual(groupTeacherHomeworkDates(items, true, false).map((group) => group.day), ["2026-10-07", "2026-10-08"]);
  assert.equal(JSON.stringify(items), snapshot);
});

test("assignment days follow school time, not UTC or the viewer's browser zone", () => {
  const groups = groupTeacherHomeworkDates([
    row("before-midnight", "LESSON", "2026-10-07T20:59:59Z"),
    row("after-midnight", "ACTIVITY", "2026-10-07T21:00:00Z", "WORDS"),
    row("same-local-day", "REVISION", "2026-10-08T09:00:00Z"),
  ]);
  assert.deepEqual(groups.map((group) => group.day), ["2026-10-08", "2026-10-07"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["after-midnight", "same-local-day"]);
});

test("interactive homework precedes activities, which are separated by every supported game type", () => {
  const items = [
    row("revision", "REVISION"), row("spell", "ACTIVITY", undefined, "SPELLING"),
    row("picture", "ACTIVITY", undefined, "GUESS_PICTURE"),
    row("description", "ACTIVITY", undefined, "GUESS_DESCRIPTION"),
    row("lesson", "LESSON"), row("words-1", "ACTIVITY", undefined, "WORDS"),
    row("words-2", "ACTIVITY", undefined, "WORDS"), row("future-game", "ACTIVITY", undefined, "FUTURE"),
  ];
  const groups = groupTeacherHomeworkContent(items);
  assert.deepEqual(groups.map((group) => group.kind), ["LESSON", "ACTIVITY"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["lesson"]);
  assert.deepEqual(groups[1].activityGroups.map((group) => group.type), [
    "WORDS", "GUESS_DESCRIPTION", "GUESS_PICTURE", "SPELLING", "REVISION", "OTHER",
  ]);
  assert.deepEqual(groups[1].activityGroups[0].items.map((item) => item.id), ["words-1", "words-2"]);
  assert.equal(groups[1].activityGroups.flatMap((group) => group.items).length, items.length - 1);
});

test("the two grouping switches are independent and never drop or duplicate an assignment", () => {
  const items = [row("l1", "LESSON"), row("a1", "ACTIVITY", undefined, "SPELLING"), row("r1", "REVISION", "2026-10-07T10:00:00Z")];
  for (const byDate of [false, true]) {
    for (const byType of [false, true]) {
      const dates = groupTeacherHomeworkDates(items, byDate);
      const content = dates.flatMap((group) => groupTeacherHomeworkContent(group.items, byType));
      const actual = content.flatMap((group) => group.kind === "ACTIVITY"
        ? group.activityGroups.flatMap((activity) => activity.items)
        : group.items);
      assert.deepEqual(actual.map((item) => item.id).sort(), ["a1", "l1", "r1"]);
      if (!byDate) assert.equal(dates.length, 1);
      if (!byType) assert.ok(content.every((group) => group.kind === "ALL"));
      if (!byDate && !byType) assert.deepEqual(actual, items);
    }
  }
});

test("empty categories are omitted, unknown dates are last, and different years stay separate", () => {
  assert.deepEqual(groupTeacherHomeworkDates([]), []);
  assert.deepEqual(groupTeacherHomeworkContent([]), []);
  assert.deepEqual(groupTeacherHomeworkContent([row("lesson", "LESSON")]).map((group) => group.kind), ["LESSON"]);
  const groups = groupTeacherHomeworkDates([
    row("invalid", "LESSON", "not-a-date"),
    row("this-year", "LESSON", "2026-10-08T10:00:00Z"),
    row("next-year", "LESSON", "2027-10-08T10:00:00Z"),
  ]);
  assert.deepEqual(groups.map((group) => group.key), ["2027-10-08", "2026-10-08", "undated"]);
  assert.equal(groupTeacherHomeworkDates(groups.flatMap((group) => group.items), true, false).at(-1)?.key, "undated");
});

test("status sorting is retained within date/type groups and input objects remain untouched", () => {
  const items = [
    { ...row("new", "ACTIVITY", undefined, "WORDS"), studentName: "Student", nextLessonAt: null, submittedAt: null, reviewedAt: null, started: false },
    { ...row("done", "ACTIVITY", undefined, "WORDS"), studentName: "Student", nextLessonAt: null, submittedAt: null, reviewedAt: "2026-10-08T11:00:00Z", started: true },
  ];
  const sorted = sortTeacherHomeworks(items, "status", false);
  const activities = groupTeacherHomeworkContent(groupTeacherHomeworkDates(sorted)[0].items)[0];
  assert.deepEqual(activities.activityGroups[0].items.map((item) => item.id), ["done", "new"]);
  assert.deepEqual(items.map((item) => item.id), ["new", "done"]);
  assert.equal(activities.activityGroups[0].items[0], items[1]);
});

test("server-rendered teacher list enables both switches by default and renders localized groups once", () => {
  const cards = [row("homework", "LESSON"), row("spelling", "ACTIVITY", undefined, "SPELLING"), row("revision", "REVISION")]
    .map((item) => ({ ...item, card: createElement("article", { "data-test-card": item.id }, item.id) }));
  const html = renderToStaticMarkup(createElement(HomeworkGroupedList, {
    cards, locale: "ru-RU", sortControls: createElement("span", null, "Sort controls"),
    labels: {
      grouping: "Группировка", groupByAssignedDate: "По датам назначения", groupByHomeworkType: "Домашки и активности отдельно",
      interactiveHomeworks: "Интерактивные домашки", activities: "Активности", unknownAssignedDate: "Дата неизвестна",
      activityTypes: { WORDS: "Слова", GUESS_DESCRIPTION: "По описанию", GUESS_PICTURE: "По картинке", SPELLING: "Spelling Practice", REVISION: "Повторение слов", OTHER: "Другие" },
    },
  }));
  assert.equal((html.match(/type="checkbox"[^>]*checked=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-homework-assigned-day="2026-10-08"/g) ?? []).length, 1);
  assert.match(html, /Интерактивные домашки/);
  assert.match(html, /data-homework-activity-type="SPELLING"/);
  assert.match(html, /data-homework-activity-type="REVISION"/);
  assert.equal((html.match(/data-test-card=/g) ?? []).length, cards.length);
});
