import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const css = source("app/globals.css");
const search = source("components/global-search.tsx");

test("collapsed sidebar clips overflow instead of creating a scroll container", () => {
  assert.match(css, /\.sidebar-rail-nav\s*\{\s*overflow:\s*clip;/);
  assert.match(css, /\.sidebar-rail-nav > a\s*\{[^}]*flex:\s*1 1 0;[^}]*padding-block:\s*0;/);
  assert.match(css, /\.sidebar-rail:is\(:hover, :has\(:focus-visible\)\) \.sidebar-rail-nav\s*\{[^}]*overflow-y:\s*auto;/);
  for (const role of ["teacher", "student"]) {
    const nav = source(`components/${role}/sidebar-nav.tsx`);
    assert.match(nav, /<nav className="sidebar-rail-nav /);
    assert.ok(!nav.includes("overflow-y-auto"));
  }
});

test("invisible sidebar footer reserves no collapsed height for either role", () => {
  assert.match(css, /\.sidebar-rail-footer\s*\{\s*display:\s*none;/);
  assert.match(css, /\.sidebar-rail:is\(:hover, :has\(:focus-visible\)\) \.sidebar-rail-footer\s*\{\s*display:\s*flex;/);
  for (const role of ["teacher", "student"]) {
    const layout = source(`app/${role}/layout.tsx`);
    assert.ok(layout.includes("sidebar-rail-footer"));
    assert.match(layout, /<Link href="\/(?:teacher|student)" className="flex shrink-0 /);
  }
});

test("search has no clear or close cross in its input row", () => {
  assert.ok(!search.includes("IconX"));
  assert.ok(!search.includes("t.globalSearch.clear"));
  const row = search.slice(search.indexOf('<div className="flex items-center gap-2 border-b'), search.indexOf('{role === "TEACHER" &&'));
  assert.match(row, /<input/);
  assert.ok(!row.includes("<button"));
  assert.match(row, /setQuery\(event.target.value\)/);
});

test("every search close path resets the query and stale results", () => {
  const close = search.slice(search.indexOf("const closeSearch = useCallback"), search.indexOf("useEffect(() =>"));
  for (const reset of ['setOpen(false)', 'setQuery("")', 'setItems([])', 'setCompletedKey("")', 'setFailed(false)']) assert.ok(close.includes(reset));
  assert.equal(search.match(/setOpen\(false\)/g)?.length, 1);
  assert.match(search, /event.key === "Escape"\) closeSearch\(\)/);
  assert.equal(search.match(/onClick=\{closeSearch\}/g)?.length, 2);
  assert.match(search, /current = false;\s*window.clearTimeout\(timer\)/);
});

test("one outside click closes search via a viewport-wide portal above the header", () => {
  assert.match(search, /open && createPortal\(/);
  assert.match(search, /document.body,/);
  assert.match(search, /onClick=\{closeSearch\}\s*className="fixed inset-0 z-\[60\]/);
  assert.match(search, /role="search"\s*className="fixed [^"]*z-\[61\]/);
});

test("materials toolbar is opaque and above the reader inside its own stacking context", () => {
  const explorer = source("components/materials/materials-explorer.tsx");
  assert.match(explorer, /"isolate scroll-mt-36 /);
  assert.match(explorer, /className="materials-content-toolbar relative z-20 bg-surface lg:sticky/);
  const toolbar = explorer.match(/className="materials-content-toolbar ([^"]+)"/)?.[1];
  assert.ok(toolbar && !toolbar.includes("bg-surface/"));
  assert.ok(!toolbar.includes("backdrop-blur"));
  assert.match(css, /\.materials-content-toolbar\s*\{[^}]*background:\s*var\(--surface\);[^}]*opacity:\s*1;[^}]*isolation:\s*isolate;/);
  assert.match(explorer, /className="materials-reader-layer relative z-0"/);
});
