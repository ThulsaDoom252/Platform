import test from "node:test";
import assert from "node:assert/strict";
import { mergeTwisterStrokes, sanitizeTwisterStroke } from "../src/lib/twister-drawing";

test("штрих получает автора из сессии, а не из браузера", () => {
  const stroke = sanitizeTwisterStroke(
    {
      id: "one",
      twisterId: "card",
      author: "TEACHER",
      tool: "marker",
      color: "#facc15",
      points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    },
    "STUDENT",
  );
  assert.equal(stroke?.author, "STUDENT");
});

test("координаты рисунка не выходят за полотно", () => {
  const stroke = sanitizeTwisterStroke(
    {
      id: "one",
      twisterId: "card",
      tool: "brush",
      color: "#ef4444",
      points: [{ x: -50, y: 4000 }, { x: 1200, y: 500 }],
    },
    "TEACHER",
  );
  assert.deepEqual(stroke?.points, [{ x: 0, y: 1000 }, { x: 1000, y: 500 }]);
});

test("пустой или одиночный штрих не сохраняется", () => {
  assert.equal(
    sanitizeTwisterStroke(
      { id: "one", twisterId: "card", points: [{ x: 1, y: 1 }] },
      "TEACHER",
    ),
    null,
  );
});

test("рисунки из базы и optimistic UI объединяются без дублей", () => {
  const first = {
    id: "one",
    twisterId: "card",
    author: "TEACHER" as const,
    tool: "marker" as const,
    color: "#facc15",
    points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
  };
  const second = { ...first, id: "two" };
  assert.deepEqual(
    mergeTwisterStrokes([first], [first, second]).map((stroke) => stroke.id),
    ["one", "two"],
  );
});
