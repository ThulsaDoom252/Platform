import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { globalSearchPosition } from "../src/lib/global-search-position";

test("both roles keep navigation flush with the viewport, never inside a centered width cap", () => {
  for (const role of ["teacher", "student"]) {
    const source = readFileSync(`src/app/${role}/layout.tsx`, "utf8");
    const shell = source.match(/<div data-app-shell="[^"]+" className="([^"]+)"/);
    assert.ok(shell, `${role} must identify its application shell`);
    assert.ok(shell[1].includes("w-full") && shell[1].includes("min-w-0"));
    assert.ok(!shell[1].includes("mx-auto") && !shell[1].includes("max-w-"));
    assert.ok(source.includes('<main className="min-w-0 flex-1'));
  }
  const rail = readFileSync("src/components/sidebar-rail.tsx", "utf8");
  assert.ok(rail.includes("sticky top-0") && rail.includes("absolute left-0 top-0"));
  assert.ok(rail.includes("w-20 shrink-0 lg:block"));
});

test("desktop search aligns its right edge with its button and sits beneath the header", () => {
  const position = globalSearchPosition({ right: 1600, bottom: 70 }, { width: 1920, height: 1080 });
  assert.deepEqual(position, { left: 928, top: 78, width: 672, maxHeight: 680 });
  assert.equal(position.left + position.width, 1600);
});

test("search stays inside every tested viewport, even if its anchor is outside it", () => {
  for (const width of [1, 24, 320, 360, 390, 640, 768, 1024, 1280, 1440, 1920, 2560, 3840]) {
    for (const right of [-100, 32, width / 2, width - 100, width + 200]) {
      const position = globalSearchPosition({ right, bottom: 68 }, { width, height: 844 });
      assert.ok(position.left >= 0);
      assert.ok(position.left + position.width <= width + 0.001);
      assert.ok(position.width > 0 && position.width <= 672);
      assert.ok(position.top + position.maxHeight <= 844);
    }
  }
});

test("short screens and tall headers bound search height instead of clipping its input", () => {
  for (const height of [180, 220, 320, 480, 768]) {
    for (const bottom of [68, 110, 400, 1200]) {
      const position = globalSearchPosition({ right: 400, bottom }, { width: 640, height });
      assert.ok(position.top >= 0 && position.maxHeight >= 48);
      assert.ok(position.top + position.maxHeight <= height - 12 + 0.001);
    }
  }
  assert.ok(Object.values(globalSearchPosition({ right: NaN, bottom: Infinity }, { width: NaN, height: 0 })).every(Number.isFinite));
});

test("portal tracks resize/scroll, keeps one-click dismissal and never introduces a clear cross", () => {
  const source = readFileSync("src/components/global-search.tsx", "utf8");
  assert.ok(source.includes('window.addEventListener("resize", updatePosition)'));
  assert.ok(source.includes('window.removeEventListener("resize", updatePosition)'));
  assert.ok(source.includes('window.addEventListener("scroll", updatePosition, true)'));
  assert.ok(source.includes('window.removeEventListener("scroll", updatePosition, true)'));
  assert.ok(source.includes('document.documentElement.clientWidth'));
  assert.ok(source.includes('trigger.closest("header")'));
  assert.ok(source.includes('right: "auto"'));
  assert.ok(source.includes('min-h-0 flex-1 overflow-y-auto'));
  assert.ok(!source.includes("IconX"));
});
