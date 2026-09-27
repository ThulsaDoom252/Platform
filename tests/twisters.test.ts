import { test } from "node:test";
import assert from "node:assert/strict";
import { moveItem, repeatWarning, sortTwisters } from "../src/lib/twisters";

const item = (id: string, sortOrder: number, createdAt: string, title: string | null = null) => ({
  id,
  sortOrder,
  createdAt,
  title,
});

test("перетаскивание переставляет ровно один элемент", () => {
  const ids = ["a", "b", "c", "d"];

  assert.deepEqual(moveItem(ids, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(ids, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(ids, 1, 1), ids);

  // Исходный список не трогаем: перестановка возвращает новый.
  assert.deepEqual(ids, ["a", "b", "c", "d"]);
});

test("промах мимо списка ничего не меняет", () => {
  const ids = ["a", "b", "c"];
  for (const [from, to] of [
    [-1, 1],
    [1, -1],
    [5, 0],
    [0, 5],
  ]) {
    assert.deepEqual(moveItem(ids, from, to), ids, `${from} → ${to}`);
  }
});

test("ручной порядок идёт по sortOrder, а не по дате", () => {
  const pool = [
    item("new", 3, "2026-09-28T10:00:00.000Z"),
    item("old", 1, "2026-01-01T10:00:00.000Z"),
    item("mid", 2, "2026-05-01T10:00:00.000Z"),
  ];

  assert.deepEqual(
    sortTwisters(pool, "manual").map((t) => t.id),
    ["old", "mid", "new"],
  );
});

test("по свежести — наоборот, от новой к старой", () => {
  const pool = [
    item("old", 1, "2026-01-01T10:00:00.000Z"),
    item("new", 2, "2026-09-28T10:00:00.000Z"),
  ];

  assert.deepEqual(
    sortTwisters(pool, "newest").map((t) => t.id),
    ["new", "old"],
  );
});

test("по названию: безымянные уходят вниз", () => {
  const pool = [
    item("none", 1, "2026-01-01T10:00:00.000Z", null),
    item("sea", 2, "2026-01-02T10:00:00.000Z", "She sells"),
    item("peck", 3, "2026-01-03T10:00:00.000Z", "Peter Piper"),
  ];

  assert.deepEqual(
    sortTwisters(pool, "title").map((t) => t.id),
    ["peck", "sea", "none"],
  );
});

test("сортировка не портит исходный список", () => {
  const pool = [item("b", 2, "2026-01-02T00:00:00.000Z"), item("a", 1, "2026-01-01T00:00:00.000Z")];
  sortTwisters(pool, "manual");
  assert.deepEqual(pool.map((t) => t.id), ["b", "a"]);
});

test("о новой скороговорке не предупреждаем", () => {
  assert.equal(repeatWarning(undefined), null);
  assert.equal(repeatWarning({ times: 0, lastAt: null }), null);
});

test("о повторе предупреждаем с числом и датой", () => {
  const seen = { times: 2, lastAt: "2026-09-14T09:00:00.000Z" };
  assert.deepEqual(repeatWarning(seen), seen);
});
