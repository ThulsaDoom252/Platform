import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const zIndex = (classes: string) => {
  const value = classes.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/);
  assert.ok(value, `Missing explicit stacking layer: ${classes}`);
  return Number(value[1] ?? value[2]);
};
const headerClasses = (role: string) => {
  const classes = source(`app/${role}/layout.tsx`).match(/<header className="([^"]+)"/)?.[1];
  assert.ok(classes);
  return classes;
};

for (const role of ["teacher", "student"]) {
  test(`${role} notifications remain above the floating Highlight palette through the header layer`, () => {
    const header = headerClasses(role);
    assert.match(header, /sticky top-0/);
    for (const file of ["assigned-lesson.tsx", "interactive-homework.tsx"]) {
      assert.ok(source(`components/lessons/${file}`).includes("<FloatingHighlightToolbar"));
    }
    const toolbar = source("components/lessons/floating-highlight-toolbar.tsx").match(/className="(fixed z-30 [^"]+)"/)?.[1];
    assert.ok(toolbar);
    assert.ok(zIndex(header) > zIndex(toolbar), `${role} notifications must cover the palette`);
    assert.match(source(`app/${role}/layout.tsx`), /<NotificationBell items=\{items\} unreadCount=\{unreadCount\}/);
  });
}

test("notification headers stay below expanded navigation, dialogs and search overlays", () => {
  const sidebar = source("components/sidebar-rail.tsx").match(/className="(sticky top-0 [^"]+)"/)?.[1];
  const dialog = source("components/teacher/schedule-client.tsx").match(/className="(fixed inset-0 [^"]+)"/)?.[1];
  const search = source("components/global-search.tsx").match(/className="(fixed inset-0 [^"]+)"/)?.[1];
  assert.ok(sidebar && dialog && search);
  for (const role of ["teacher", "student"]) {
    const headerLayer = zIndex(headerClasses(role));
    assert.ok(headerLayer < zIndex(sidebar));
    assert.ok(headerLayer < zIndex(dialog));
    assert.ok(headerLayer < zIndex(search));
  }
});
