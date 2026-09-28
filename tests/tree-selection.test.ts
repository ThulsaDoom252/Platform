import { test } from "node:test";
import assert from "node:assert/strict";
import {
  descendantIds,
  selectRange,
  selectRangeDeep,
  toggleWithChildren,
  type TreeNodeLike,
} from "../src/lib/tree-selection";

/**
 * Hellraiser
 *   ├ A clerical error
 *   ├ Banishment
 *   └ Deeper
 *       └ Carter's judgment
 * Evil seeks evil
 */
const TREE: TreeNodeLike[] = [
  { id: "hell", parentId: null },
  { id: "clerical", parentId: "hell" },
  { id: "banish", parentId: "hell" },
  { id: "deeper", parentId: "hell" },
  { id: "carter", parentId: "deeper" },
  { id: "evil", parentId: null },
];

const ORDER = ["hell", "clerical", "banish", "deeper", "carter", "evil"];

const sorted = (set: Set<string>) => [...set].sort();

test("содержимое папки находится на любой глубине", () => {
  assert.deepEqual(descendantIds(TREE, "hell").sort(), [
    "banish",
    "carter",
    "clerical",
    "deeper",
  ]);
  assert.deepEqual(descendantIds(TREE, "deeper"), ["carter"]);
  assert.deepEqual(descendantIds(TREE, "clerical"), []);
});

test("сама папка в своё содержимое не входит", () => {
  assert.equal(descendantIds(TREE, "hell").includes("hell"), false);
});

test("выбор папки берёт всё внутри", () => {
  const next = toggleWithChildren(new Set(), TREE, "hell");
  assert.deepEqual(sorted(next), ["banish", "carter", "clerical", "deeper", "hell"]);
});

test("снятие папки убирает и содержимое", () => {
  const on = toggleWithChildren(new Set(), TREE, "hell");
  const off = toggleWithChildren(on, TREE, "hell");
  assert.equal(off.size, 0);
});

test("снятие одной папки не трогает соседнюю ветку", () => {
  const both = toggleWithChildren(
    toggleWithChildren(new Set(), TREE, "deeper"),
    TREE,
    "evil",
  );
  const off = toggleWithChildren(both, TREE, "deeper");
  assert.deepEqual(sorted(off), ["evil"]);
});

test("файл выбирается сам по себе", () => {
  const next = toggleWithChildren(new Set(), TREE, "clerical");
  assert.deepEqual(sorted(next), ["clerical"]);
});

test("исходный выбор не портится", () => {
  const before = new Set(["evil"]);
  toggleWithChildren(before, TREE, "hell");
  assert.deepEqual(sorted(before), ["evil"]);
});

test("Ctrl добирает диапазон, а не заменяет выбор", () => {
  // Ровно то, что просили: отметил одно, зажал Ctrl, ткнул ниже —
  // всё между ними тоже отмечено, и прежнее на месте.
  const next = selectRange(new Set(["evil"]), ORDER, "clerical", "deeper");
  assert.deepEqual(sorted(next), ["banish", "clerical", "deeper", "evil"]);
});

test("диапазон работает и снизу вверх", () => {
  const down = selectRange(new Set(), ORDER, "clerical", "carter");
  const up = selectRange(new Set(), ORDER, "carter", "clerical");
  assert.deepEqual(sorted(down), sorted(up));
});

test("диапазон из одного узла — он сам", () => {
  const next = selectRange(new Set(), ORDER, "banish", "banish");
  assert.deepEqual(sorted(next), ["banish"]);
});

test("без точки отсчёта отмечается только нажатое", () => {
  assert.deepEqual(sorted(selectRange(new Set(), ORDER, null, "banish")), ["banish"]);
});

test("точка отсчёта из другого списка не ломает выбор", () => {
  // В дереве слева и в плитке справа порядки разные.
  const next = selectRange(new Set(), ORDER, "чужой-id", "banish");
  assert.deepEqual(sorted(next), ["banish"]);
});

test("папка внутри диапазона выбирается целиком", () => {
  /*
   * Иначе два правила спорят: нажатие на папку берёт содержимое, а
   * протяжка через неё — нет.
   */
  const next = selectRangeDeep(new Set(), TREE, ORDER, "banish", "deeper");
  assert.deepEqual(sorted(next), ["banish", "carter", "deeper"]);
});

test("протяжка по всему списку берёт всё дерево", () => {
  const next = selectRangeDeep(new Set(), TREE, ORDER, "hell", "evil");
  assert.deepEqual(sorted(next), [
    "banish",
    "carter",
    "clerical",
    "deeper",
    "evil",
    "hell",
  ]);
});

test("кольцо в связях не вешает обход", () => {
  // Дерево держится на коде приложения, внешнего ключа на родителя нет.
  const broken: TreeNodeLike[] = [
    { id: "a", parentId: "b" },
    { id: "b", parentId: "a" },
  ];
  assert.doesNotThrow(() => descendantIds(broken, "a"));
});
