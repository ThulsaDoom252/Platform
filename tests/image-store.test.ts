import { test } from "node:test";
import assert from "node:assert/strict";
import { isStoredImage, storedFileName } from "../src/lib/image-store";

test("своя картинка опознаётся по пути", () => {
  assert.equal(isStoredImage("/uploads/words/1727520000-ab12cd34.jpg"), true);
  assert.equal(isStoredImage("/uploads/words/x.png"), true);
  assert.equal(isStoredImage("/uploads/words/x.webp"), true);
});

test("чужая ссылка своей не считается", () => {
  assert.equal(isStoredImage("https://pixabay.com/get/x.jpg"), false);
  assert.equal(isStoredImage("/uploads/twisters/x.jpg"), false);
  assert.equal(isStoredImage("/uploads/words/x.txt"), false);
  assert.equal(isStoredImage(""), false);
});

test("выход за папку хранилища не проходит", () => {
  // Перед удалением файла проверяется именно это: по строке из базы
  // нельзя позволить стереть что угодно на диске.
  for (const url of [
    "/uploads/words/../../../.env",
    "/uploads/words/../avatar.png",
    "/uploads/words/sub/dir.png",
    "/uploads/words/..%2F.env",
    "/uploads/words/.env",
  ]) {
    assert.equal(isStoredImage(url), false, url);
    assert.equal(storedFileName(url), null, url);
  }
});

test("имя файла достаётся только из своей ссылки", () => {
  assert.equal(storedFileName("/uploads/words/abc-123.png"), "abc-123.png");
  assert.equal(storedFileName("https://example.com/a.png"), null);
});
