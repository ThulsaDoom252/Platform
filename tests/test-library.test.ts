import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestsLibraryView } from "../src/components/tests/tests-library-view";
import { dictionaries } from "../src/lib/i18n";
import { TEST_CATEGORIES, TEST_LEVELS, parseTestLibraryLocation, testLibraryHref } from "../src/lib/test-library";

test("Tests has the six requested levels in order and the seven requested categories", () => {
  assert.deepEqual(TEST_LEVELS.map((level) => level.label), ["A1", "A2", "B1", "B1+", "B2", "C1"]);
  assert.deepEqual(TEST_CATEGORIES, ["grammar", "vocabulary", "listening", "reading", "use-of-english", "writing", "exams"]);
  assert.equal(new Set(TEST_LEVELS.map((level) => level.id)).size, 6);
});

test("all 42 category folders and every level link survive refresh and bookmarking", () => {
  for (const level of TEST_LEVELS) {
    const levelUrl = new URL(testLibraryHref(level.id), "https://example.test");
    assert.deepEqual(parseTestLibraryLocation(levelUrl.searchParams), { level: level.id, category: null });
    for (const category of TEST_CATEGORIES) {
      const url = new URL(testLibraryHref(level.id, category), "https://example.test");
      assert.equal(url.pathname, "/teacher/tests");
      assert.deepEqual(parseTestLibraryLocation(url.searchParams), { level: level.id, category });
    }
  }
  assert.equal(testLibraryHref(), "/teacher/tests");
  assert.equal(testLibraryHref(null, "grammar"), "/teacher/tests");
});

test("unknown levels, categories and orphan category parameters fall back to a valid folder", () => {
  for (const query of ["", "level=nope&category=grammar", "category=grammar", "level=../../student", "level=%3Cscript%3E"]) {
    assert.deepEqual(parseTestLibraryLocation(new URLSearchParams(query)), { level: null, category: null });
  }
  assert.deepEqual(parseTestLibraryLocation(new URLSearchParams("level=a2&category=unknown")), { level: "a2", category: null });
});

test("the root renders six real folder links with a responsive grid in every language", () => {
  for (const dictionary of Object.values(dictionaries)) {
    const html = renderToStaticMarkup(createElement(TestsLibraryView, { location: { level: null, category: null }, labels: dictionary.testsLibrary }));
    assert.equal((html.match(/data-test-level=/g) ?? []).length, 6);
    assert.ok(html.includes("grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"));
    assert.ok(html.includes(dictionary.testsLibrary.levels));
    for (const level of TEST_LEVELS) assert.ok(html.includes(`href="${testLibraryHref(level.id)}"`));
    assert.ok(!html.includes("data-tests-empty"));
  }
});

test("every level renders all seven categories vertically and in the same order", () => {
  for (const dictionary of Object.values(dictionaries)) {
    for (const level of TEST_LEVELS) {
      const html = renderToStaticMarkup(createElement(TestsLibraryView, { location: { level: level.id, category: null }, labels: dictionary.testsLibrary }));
      assert.deepEqual([...html.matchAll(/data-test-category="([^"]+)"/g)].map((match) => match[1]), [...TEST_CATEGORIES]);
      assert.ok(html.includes('data-tests-categories="true" class="flex flex-col gap-3"'));
      for (const category of TEST_CATEGORIES) assert.ok(html.includes(dictionary.testsLibrary.categoryNames[category]));
      assert.ok(html.includes(`href="${testLibraryHref(level.id, "use-of-english").replaceAll("&", "&amp;")}"`));
      assert.ok(!html.includes("data-tests-empty"));
    }
  }
});

test("empty category folders stay empty; B1 Grammar links to the published First conditional test", () => {
  for (const level of TEST_LEVELS) {
    for (const category of TEST_CATEGORIES) {
      const html = renderToStaticMarkup(createElement(TestsLibraryView, { location: { level: level.id, category }, labels: dictionaries.en.testsLibrary }));
      if (level.id === "b1" && category === "grammar") {
        assert.ok(html.includes('data-library-test="first-conditional"'));
        assert.ok(html.includes('href="/teacher/tests/first-conditional"'));
        assert.ok(!html.includes("data-tests-empty"));
        continue;
      }
      assert.ok(html.includes("data-tests-empty"));
      assert.ok(html.includes(dictionaries.en.testsLibrary.emptyHint));
      assert.ok(html.includes('aria-current="page"'));
      assert.ok(html.includes(`href="${testLibraryHref(level.id)}"`));
      assert.ok(html.includes(dictionaries.en.testsLibrary.allCategories));
      assert.ok(!html.includes("data-test-category="));
    }
  }
});

test("all labels and descriptions are translated, including navigation and empty folders", () => {
  for (const dictionary of Object.values(dictionaries)) {
    assert.ok(dictionary.nav.tests.trim());
    assert.equal(dictionary.testsLibrary.title, dictionary.nav.tests);
    for (const category of TEST_CATEGORIES) {
      assert.ok(dictionary.testsLibrary.categoryNames[category].trim());
      assert.ok(dictionary.testsLibrary.categoryHints[category].trim());
    }
    for (const key of ["emptyTitle", "emptyHint", "openFolder", "allLevels", "allCategories", "breadcrumb"] as const) assert.ok(dictionary.testsLibrary[key].trim());
  }
});

test("Tests is reachable from desktop and mobile, and the compact menu can scroll rather than clipping items", () => {
  const desktop = readFileSync("src/components/teacher/sidebar-nav.tsx", "utf8");
  const mobile = readFileSync("src/components/teacher/mobile-nav.tsx", "utf8");
  for (const source of [desktop, mobile]) assert.ok(source.includes('{ href: "/teacher/tests", label: t.nav.tests, Icon: ClipboardCheck }'));
  assert.ok(desktop.includes("min-h-0 flex-1 flex-col gap-1 overflow-y-auto"));
  assert.ok(desktop.includes("group flex shrink-0 items-center"));
  assert.ok(mobile.includes("max-w-full truncate"));
});

test("folder transitions use browser history without refetches and retain streaming entry feedback", () => {
  const client = readFileSync("src/components/tests/tests-library.tsx", "utf8");
  const view = readFileSync("src/components/tests/tests-library-view.tsx", "utf8");
  const page = readFileSync("src/app/teacher/tests/page.tsx", "utf8");
  assert.ok(client.includes("window.history.pushState(null"));
  assert.ok(client.includes("useSearchParams()"));
  assert.ok(!client.includes("router.push"));
  assert.ok(!client.includes("router.refresh"));
  assert.ok(view.includes("prefetch={false}"));
  assert.ok(view.includes("event.metaKey || event.ctrlKey || event.shiftKey || event.altKey"));
  assert.ok(page.includes("<Suspense fallback={<TestsLibrarySkeleton />}>"));
  assert.ok(readFileSync("src/app/teacher/tests/loading.tsx", "utf8").includes("TestsLibrarySkeleton as default"));
});

test("the section follows platform theme tokens, supports keyboard focus and respects reduced motion", () => {
  const source = readFileSync("src/components/tests/tests-library-view.tsx", "utf8");
  for (const token of ["bg-surface", "text-content", "text-muted", "border-line", "bg-accent", "text-accent", "var(--c1)", "var(--c4b)"]) assert.ok(source.includes(token));
  assert.ok(source.includes("focus-visible:ring-2 focus-visible:ring-accent"));
  assert.ok(source.includes("motion-safe:hover:-translate-y-0.5"));
  assert.ok(!/#[a-f\d]{6}\b/i.test(source));
  assert.ok(source.includes("headingRef"));
});
