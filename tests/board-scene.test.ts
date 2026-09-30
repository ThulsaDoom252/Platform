import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeBoardScene } from "../src/lib/board-scene";

test("доска сохраняет поддерживаемые объекты", () => {
  const scene = sanitizeBoardScene({
    name: "Lesson",
    objects: [
      { id: 4, type: "text", x: 10, y: 20, text: "word", size: 32 },
      { id: 5, type: "arrow", x1: 0, y1: 0, x2: 50, y2: 50 },
    ],
  });
  assert.equal(scene?.objects.length, 2);
  assert.equal(scene?.objects[0].id, 4);
});
test("доска отбрасывает неизвестные типы и внешние картинки", () => {
  const scene = sanitizeBoardScene({
    objects: [
      { id: 1, type: "script", text: "alert(1)" },
      { id: 2, type: "image", _imgSrc: "https://evil.test/pixel.png" },
      { id: 3, type: "rect", x: 0, y: 0, w: 20, h: 20 },
    ],
  });
  assert.deepEqual(scene?.objects.map((object) => object.id), [3]);
});

test("текстовые поля не переносят произвольные свойства", () => {
  const scene = sanitizeBoardScene({
    objects: [{ id: 1, type: "text", text: "hello", onclick: "steal()" }],
  });
  assert.equal(scene?.objects[0].onclick, undefined);
});
