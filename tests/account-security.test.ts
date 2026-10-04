import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTeacherLogin,
  validateTeacherLogin,
  validateTeacherPassword,
} from "../src/lib/account-security";

test("teacher login is trimmed but keeps its case", () => {
  assert.equal(normalizeTeacherLogin("  Vlad.Teacher  "), "Vlad.Teacher");
});

test("teacher login rejects short, long, or spaced values", () => {
  assert.equal(validateTeacherLogin("ab"), "LOGIN_INVALID");
  assert.equal(validateTeacherLogin("teacher login"), "LOGIN_INVALID");
  assert.equal(validateTeacherLogin("a".repeat(81)), "LOGIN_INVALID");
  assert.equal(validateTeacherLogin("teacher.login"), null);
});

test("teacher password requires eight characters and matching confirmation", () => {
  assert.equal(validateTeacherPassword("short", "short"), "PASSWORD_INVALID");
  assert.equal(validateTeacherPassword("long-enough", "different"), "PASSWORD_MISMATCH");
  assert.equal(validateTeacherPassword("long-enough", "long-enough"), null);
});
