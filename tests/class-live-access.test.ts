import assert from "node:assert/strict";
import test from "node:test";
import { canReadClassDeck, canReadClassLesson } from "../src/lib/class-live-access";

test("live lesson reads cannot cross student accounts", () => {
  const session = { role: "STUDENT" as const, userId: "student-a" };
  assert.equal(canReadClassLesson(session, "student-a", { studentId: "student-a", authorId: "teacher-a" }), true);
  assert.equal(canReadClassLesson(session, "student-a", { studentId: "student-b", authorId: "teacher-a" }), false);
  assert.equal(canReadClassLesson(session, "student-b", { studentId: "student-b", authorId: "teacher-a" }), false);
});

test("teacher live reads require the selected student and the lesson author", () => {
  const session = { role: "TEACHER" as const, userId: "teacher-a" };
  assert.equal(canReadClassLesson(session, "student-a", { studentId: "student-a", authorId: "teacher-a" }), true);
  assert.equal(canReadClassLesson(session, "student-a", { studentId: "student-b", authorId: "teacher-a" }), false);
  assert.equal(canReadClassLesson(session, "student-a", { studentId: "student-a", authorId: "teacher-b" }), false);
});

test("live decks require the same class student and WORD_DECK kind", () => {
  const student = { role: "STUDENT" as const, userId: "student-a" };
  const teacher = { role: "TEACHER" as const, userId: "teacher-a" };
  assert.equal(canReadClassDeck(student, "student-a", { studentId: "student-a", kind: "WORD_DECK" }), true);
  assert.equal(canReadClassDeck(student, "student-b", { studentId: "student-b", kind: "WORD_DECK" }), false);
  assert.equal(canReadClassDeck(teacher, "student-a", { studentId: "student-b", kind: "WORD_DECK" }), false);
  assert.equal(canReadClassDeck(teacher, "student-a", { studentId: "student-a", kind: "GUESS_PICTURE" }), false);
});
