import assert from "node:assert/strict";
import test from "node:test";
import {
  groupTeacherHomeworksByStudent,
  sortTeacherHomeworks,
  teacherHomeworkOverviewState,
  type TeacherHomeworkOrderable,
} from "../src/lib/teacher-homework-order";

type GroupableHomework = TeacherHomeworkOrderable & {
  studentId: string;
  studentAvatarUrl: string | null;
};

const item = (
  id: string,
  studentName: string,
  overrides: Partial<TeacherHomeworkOrderable> = {},
): TeacherHomeworkOrderable => ({
  id,
  studentName,
  nextLessonAt: null,
  assignedAt: "2026-10-01T12:00:00.000Z",
  submittedAt: null,
  reviewedAt: null,
  started: false,
  ...overrides,
});

test("статус домашки идёт от самого завершённого состояния", () => {
  assert.equal(teacherHomeworkOverviewState(item("1", "A")), "notStarted");
  assert.equal(teacherHomeworkOverviewState(item("2", "B", { started: true })), "inProgress");
  assert.equal(teacherHomeworkOverviewState(item("3", "C", { submittedAt: "2026-10-02" })), "submitted");
  assert.equal(teacherHomeworkOverviewState(item("4", "D", {
    submittedAt: "2026-10-02",
    reviewedAt: "2026-10-03",
  })), "reviewed");
});

test("домашки сортируются по имени и дате выдачи", () => {
  const rows = [
    item("b", "Bogdan", { assignedAt: "2026-10-03" }),
    item("a", "Alla", { assignedAt: "2026-10-01" }),
    item("k", "Ksenia", { assignedAt: "2026-10-02" }),
  ];
  assert.deepEqual(sortTeacherHomeworks(rows, "name", false).map((row) => row.id), ["a", "b", "k"]);
  assert.deepEqual(sortTeacherHomeworks(rows, "assigned", true).map((row) => row.id), ["b", "k", "a"]);
  assert.deepEqual(rows.map((row) => row.id), ["b", "a", "k"]);
});

test("ближайший урок идёт первым, ученик без урока всегда в конце", () => {
  const rows = [
    item("none", "No lesson"),
    item("later", "Later", { nextLessonAt: "2026-10-06T12:00:00.000Z" }),
    item("soon", "Soon", { nextLessonAt: "2026-10-04T12:00:00.000Z" }),
  ];
  assert.deepEqual(sortTeacherHomeworks(rows, "lesson", false).map((row) => row.id), ["soon", "later", "none"]);
  assert.deepEqual(sortTeacherHomeworks(rows, "lesson", true).map((row) => row.id), ["later", "soon", "none"]);
});

test("статусы сортируются в порядке reviewed, review, progress, not started", () => {
  const rows = [
    item("new", "New"),
    item("review", "Review", { submittedAt: "2026-10-02" }),
    item("doing", "Doing", { started: true }),
    item("done", "Done", { reviewedAt: "2026-10-03" }),
  ];
  assert.deepEqual(sortTeacherHomeworks(rows, "status", false).map((row) => row.id), [
    "done",
    "review",
    "doing",
    "new",
  ]);
});

test("домашки собираются в папки учеников со счётчиками статусов", () => {
  const groupable = (
    homework: TeacherHomeworkOrderable,
    studentId: string,
  ): GroupableHomework => ({ ...homework, studentId, studentAvatarUrl: null });
  const groups = groupTeacherHomeworksByStudent([
    groupable(item("alla-new", "Alla"), "alla"),
    groupable(item("bogdan-review", "Bogdan", { submittedAt: "2026-10-02" }), "bogdan"),
    groupable(item("alla-doing", "Alla", { started: true }), "alla"),
    groupable(item("alla-done", "Alla", { reviewedAt: "2026-10-03" }), "alla"),
  ]);

  assert.deepEqual(groups.map((group) => group.studentId), ["alla", "bogdan"]);
  assert.deepEqual(groups[0].counts, {
    total: 3,
    notStarted: 1,
    inProgress: 1,
    submitted: 0,
    reviewed: 1,
  });
  assert.deepEqual(groups[0].items.map((homework) => homework.id), [
    "alla-new",
    "alla-doing",
    "alla-done",
  ]);
});
