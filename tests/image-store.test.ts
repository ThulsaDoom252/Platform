import { test } from "node:test";
import assert from "node:assert/strict";
import { isStoredImage, storedFileName } from "../src/lib/image-store";

test("своя картинка опознаётся по пути", () => {
  assert.equal(isStoredImage("/uploads/words/1727520000-ab12cd34.jpg"), true);
  assert.equal(isStoredImage("/uploads/words/x.png"), true);
  assert.equal(isStoredImage("/uploads/words/x.webp"), true);
});

test("картинка из Vercel Blob остаётся своей", () => {
  const url =
    "https://store.public.blob.vercel-storage.com/uploads/words/abc-123.png";
  assert.equal(isStoredImage(url), true);
  assert.equal(storedFileName(url), "abc-123.png");
});

test("похожий чужой Blob-домен не считается своим", () => {
  assert.equal(
    isStoredImage(
      "https://store.public.blob.vercel-storage.com.evil.test/uploads/words/x.png",
    ),
    false,
  );
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

test("папка скороговорок — тоже наша, но отдельная", () => {
  // Одна функция служит двум хранилищам, и перепутать их нельзя:
  // удаление картинки слова не должно доставать до скороговорок.
  assert.equal(isStoredImage("/uploads/twisters/a-1.jpg", "twisters"), true);
  assert.equal(isStoredImage("/uploads/twisters/a-1.jpg"), false);
  assert.equal(isStoredImage("/uploads/words/a-1.jpg", "twisters"), false);
  assert.equal(storedFileName("/uploads/twisters/a-1.jpg", "twisters"), "a-1.jpg");
});

test("выход за папку не проходит и для скороговорок", () => {
  for (const url of [
    "/uploads/twisters/../words/x.jpg",
    "/uploads/twisters/../../.env",
    "/uploads/twisters/sub/x.jpg",
  ]) {
    assert.equal(isStoredImage(url, "twisters"), false, url);
  }
});

test("в скороговорки годится только путь их собственной папки", () => {
  /*
   * По этому правилу раздел и отбирает, что показывать. Обложки
   * материалов, аватары и картинки словника лежат в своих папках, и
   * попасть в пул они не должны даже через базу.
   */
  assert.equal(isStoredImage("/uploads/twisters/a-1.webp", "twisters"), true);

  for (const foreign of [
    "/uploads/materials/cover-1.jpg",
    "/uploads/words/word-1.png",
    "/uploads/avatar-1.jpg",
    "https://example.com/a.jpg",
  ]) {
    assert.equal(isStoredImage(foreign, "twisters"), false, foreign);
  }
});
