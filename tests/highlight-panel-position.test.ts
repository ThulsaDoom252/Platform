import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { clampHighlightPanelPosition, initialHighlightPanelPosition } from "../src/lib/highlight-panel-position";

test("floating highlights start at the top right below the Classic header, without reserving page space", () => {
  assert.deepEqual(initialHighlightPanelPosition({ width: 1280, height: 720 }, { width: 440, height: 66 }, 74), { x: 828, y: 86 });
  assert.deepEqual(initialHighlightPanelPosition({ width: 1280, height: 720 }, { width: 440, height: 66 }), { x: 828, y: 12 });
  const source = readFileSync("src/components/lessons/floating-highlight-toolbar.tsx", "utf8");
  assert(source.includes("if (target === undefined) return null"));
  assert(source.includes("tools.enabled && createPortal("));
  assert(source.includes("data-floating-highlight-panel"));
  assert(source.includes("fixed z-30"));
  assert(!source.includes("useModalLayer"), "The palette must not lock scrolling or trap the lesson's keyboard input");
});

test("drag positions stay reachable across phone, desktop, short-window and resize bounds", () => {
  for (const width of [320, 390, 1024, 1280, 3840]) for (const height of [300, 600, 844, 1080]) {
    const size = { width: Math.min(440, width - 24), height: 120 };
    const bounds = { width, height, bottom: height - 72 };
    for (const point of [{ x: -9999, y: -9999 }, { x: 9999, y: 9999 }, { x: NaN, y: Infinity }]) {
      const position = clampHighlightPanelPosition(point, bounds, size);
      assert(position.x >= 12 && position.x + size.width <= width - 12);
      assert(position.y >= 12 && position.y + size.height <= bounds.bottom - 12);
    }
  }
  assert.deepEqual(clampHighlightPanelPosition({ x: 900, y: 900 }, { width: 390, height: 844, bottom: 600 }, { width: 366, height: 120 }), { x: 12, y: 468 });
  assert.equal(clampHighlightPanelPosition({ x: 100, y: -999 }, { width: 1280, height: 720, top: 86 }, { width: 440, height: 66 }).y, 86, "Dragging cannot hide the palette behind the Classic header");
});

test("only teacher class bars expose the launcher slot; inherited homework palettes cannot duplicate it", () => {
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert(room.includes('{teacher && <div data-class-highlight-launcher className="contents" />}'));
  const palette = readFileSync("src/components/lessons/floating-highlight-toolbar.tsx", "utf8");
  assert(palette.includes('liveClass ? document.querySelector<HTMLElement>("[data-class-highlight-launcher]") : null'));
  assert(palette.includes("target ?? document.body"));
  assert(palette.includes("setPointerCapture(event.pointerId)"));
  assert(palette.includes("onPointerCancel={stopDrag}"));
  assert(palette.includes('event.key === "Escape"'));
  const homework = readFileSync("src/components/lessons/interactive-homework.tsx", "utf8");
  assert(homework.includes('event.target.closest("[data-highlight-controls]")'));
});
