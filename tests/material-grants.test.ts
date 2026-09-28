import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleGrantIds, visibleNodeIds } from "../src/lib/material-grants";

test("keeps a granted section visible after it is moved under another folder", () => {
  const nodes = [
    { id: "folder", parentId: null },
    { id: "granted", parentId: "folder" },
  ];

  assert.deepEqual(getVisibleGrantIds(nodes, ["granted"]), ["granted"]);
});

test("does not duplicate a granted child when its ancestor is also granted", () => {
  const nodes = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
    { id: "leaf", parentId: "child" },
  ];

  assert.deepEqual(getVisibleGrantIds(nodes, ["root", "child", "leaf"]), ["root"]);
});

test("preserves independent grants and ignores deleted material ids", () => {
  const nodes = [
    { id: "one", parentId: null },
    { id: "two", parentId: null },
  ];

  assert.deepEqual(getVisibleGrantIds(nodes, ["missing", "one", "two"]), [
    "one",
    "two",
  ]);
});

test("виден выданный раздел и всё, что внутри него", () => {
  const nodes = [
    { id: "root", parentId: null },
    { id: "unit", parentId: "root" },
    { id: "vocab", parentId: "unit" },
    { id: "other", parentId: null },
    { id: "otherVocab", parentId: "other" },
  ];

  const visible = visibleNodeIds(nodes, ["unit"]);

  assert.deepEqual([...visible].sort(), ["unit", "vocab"]);
  // Корень над выданным разделом не открывается: выдали ветку, а не всё.
  assert.equal(visible.has("root"), false);
  assert.equal(visible.has("otherVocab"), false);
});

test("без выдачи не видно ничего", () => {
  const nodes = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
  ];
  assert.equal(visibleNodeIds(nodes, []).size, 0);
});

test("выдача на несуществующий узел ничего не открывает", () => {
  const nodes = [{ id: "root", parentId: null }];
  assert.equal(visibleNodeIds(nodes, ["ghost"]).size, 0);
});

test("кольцо в дереве не вешает обход", () => {
  // Данные приходят из базы, и битая связь там возможна.
  const nodes = [
    { id: "a", parentId: "b" },
    { id: "b", parentId: "a" },
    { id: "c", parentId: null },
  ];
  assert.doesNotThrow(() => visibleNodeIds(nodes, ["c"]));
});
