import { test } from "node:test";
import assert from "node:assert/strict";
import { carryImages, carryKey, type CarryImage } from "../src/lib/phrase-carry";

const img = (phraseId: string, url: string, picked = true): CarryImage => ({
  phraseId,
  url,
  thumbUrl: url,
  origin: "manual",
  sortOrder: 0,
  picked,
});

test("ключ не зависит от регистра и лишних пробелов", () => {
  assert.equal(carryKey("To Sneeze"), carryKey("to sneeze"));
  assert.equal(carryKey("  a  piece   of cake "), "a piece of cake");
  assert.equal(carryKey("«umbrella»"), "umbrella");
  assert.equal(carryKey("fork."), "fork");
  assert.equal(carryKey(""), "");
});

test("картинка переезжает на новую запись того же слова", () => {
  /*
   * Ради этого перенос и делается: наполнение стирает фразы и создаёт
   * их заново с другими идентификаторами, а картинки учитель подбирал
   * руками по одной.
   */
  const carried = carryImages(
    [{ id: "old-1", phrase: "umbrella" }],
    [img("old-1", "/uploads/words/umbrella.jpg")],
    [{ id: "new-1", phrase: "umbrella" }],
  );

  assert.equal(carried.length, 1);
  assert.equal(carried[0].phraseId, "new-1");
  assert.equal(carried[0].url, "/uploads/words/umbrella.jpg");
  assert.equal(carried[0].picked, true);
});

test("несколько картинок одного слова переезжают все", () => {
  const carried = carryImages(
    [{ id: "old-1", phrase: "fork" }],
    [img("old-1", "a.jpg"), img("old-1", "b.jpg", false)],
    [{ id: "new-1", phrase: "fork" }],
  );

  assert.deepEqual(carried.map((i) => i.url).sort(), ["a.jpg", "b.jpg"]);
  assert.deepEqual(carried.map((i) => i.phraseId), ["new-1", "new-1"]);
});

test("слово ушло со страницы — картинка не переносится", () => {
  // Привязывать её не к чему: держать висящие строки незачем.
  const carried = carryImages(
    [{ id: "old-1", phrase: "umbrella" }],
    [img("old-1", "a.jpg")],
    [{ id: "new-1", phrase: "fork" }],
  );

  assert.deepEqual(carried, []);
});

test("слово пережило правку регистра и пробелов", () => {
  const carried = carryImages(
    [{ id: "old-1", phrase: "To  Sneeze" }],
    [img("old-1", "a.jpg")],
    [{ id: "new-1", phrase: "to sneeze" }],
  );

  assert.equal(carried.length, 1);
  assert.equal(carried[0].phraseId, "new-1");
});

test("при двух одинаковых словах картинка достаётся первому", () => {
  // Размножать выбор, которого учитель не делал, нельзя.
  const carried = carryImages(
    [{ id: "old-1", phrase: "fork" }],
    [img("old-1", "a.jpg")],
    [
      { id: "new-1", phrase: "fork" },
      { id: "new-2", phrase: "fork" },
    ],
  );

  assert.deepEqual(carried.map((i) => i.phraseId), ["new-1"]);
});

test("пустое слово ничего не ловит", () => {
  const carried = carryImages(
    [{ id: "old-1", phrase: "   " }],
    [img("old-1", "a.jpg")],
    [{ id: "new-1", phrase: "" }],
  );

  assert.deepEqual(carried, []);
});

test("без картинок и без записей ничего не ломается", () => {
  assert.deepEqual(carryImages([], [], []), []);
  assert.deepEqual(carryImages([{ id: "a", phrase: "x" }], [], []), []);
});
