import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleGrantIds } from "../src/lib/material-grants";

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
