import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptStudentPassword,
  encryptStudentPassword,
} from "../src/lib/password-vault";

const secret = "test-only-secret-that-is-long-and-stable";

test("пароль шифруется и раскрывается только для своего ученика", () => {
  const encrypted = encryptStudentPassword("Qwerty 123!", "student-a", secret);
  assert.notEqual(encrypted, "Qwerty 123!");
  assert.equal(
    decryptStudentPassword(encrypted, "student-a", secret),
    "Qwerty 123!",
  );
  assert.equal(decryptStudentPassword(encrypted, "student-b", secret), null);
});

test("одинаковые пароли получают разные шифротексты", () => {
  const first = encryptStudentPassword("same", "student-a", secret);
  const second = encryptStudentPassword("same", "student-a", secret);
  assert.notEqual(first, second);
});

test("подменённая запись не расшифровывается", () => {
  const encrypted = encryptStudentPassword("secret", "student-a", secret);
  const changed = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
  assert.equal(decryptStudentPassword(changed, "student-a", secret), null);
});
