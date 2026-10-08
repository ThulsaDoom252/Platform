import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildRevision } from "../src/lib/revision-build";
import { DEFAULT_SHOW, readShow, type RevisionWord } from "../src/lib/revision-modes";
import { scoreRevision, type RevisionAnswer } from "../src/lib/revision-score";
import { uniqueRevisionWords, validateRevisionStrugglingIds, revisionStrugglingWords } from "../src/lib/revision-struggling";
import { RevisionStrugglingPanel, RevisionStrugglingSummary } from "../src/components/revision/revision-struggling-panel";
import { I18nProvider } from "../src/components/i18n-provider";
import { dictionaries } from "../src/lib/i18n";

const words: RevisionWord[] = [
  { phraseId: "a", word: "to fasten", translation: "застегнуть", description: "To close securely", imageUrl: "/fasten.jpg" },
  { phraseId: "b", word: "cooperation", translation: "сотрудничество", description: "Working together", imageUrl: null },
  { phraseId: "c", word: "<difficult & word>", translation: null, description: null, imageUrl: null },
];
const plan = buildRevision(words, ["flashcards", "choose", "pairs", "unscramble", "definitionPairs", "picture"], { shuffleWords: false });

function render(children: ReturnType<typeof createElement>, locale: "en" | "ru" | "uk" = "en") {
  return renderToStaticMarkup(createElement(I18nProvider,
    { locale, dictionary: dictionaries[locale], realtimeConfigured: false } as Parameters<typeof I18nProvider>[0], children));
}

test("difficult-word lists are enabled for new presets and every legacy assignment", () => {
  assert.equal(DEFAULT_SHOW.strugglingWith, true);
  const legacy: (Record<string, boolean> | null | undefined)[] = [null, undefined, {}, { cardTranslation: true }];
  for (const stored of legacy) assert.equal(readShow(stored).strugglingWith, true);
  assert.equal(readShow({ strugglingWith: false }).strugglingWith, false);
  assert.equal(readShow({ cardIcon: true }).cardIcon, true);
  assert.equal(readShow({}).cardDescription, false);
});

test("all modes share a deduplicated list, including flashcard-only words", () => {
  assert.deepEqual(uniqueRevisionWords(plan).map((word) => word.phraseId), ["a", "b", "c"]);
  assert.equal(uniqueRevisionWords(plan).length, words.length);
  assert.deepEqual(validateRevisionStrugglingIds(plan, ["c", "a", "a"]), ["c", "a"]);
  assert.deepEqual(validateRevisionStrugglingIds(plan, []), []);
});

test("unknown IDs, malformed payloads and oversized lists cannot be persisted", () => {
  for (const value of [null, "a", [null], [4], ["other-attempt"], Array(5_001).fill("a")]) {
    assert.equal(validateRevisionStrugglingIds(plan, value), null);
  }
});

test("every attempt resolves its own marks from its original snapshot", () => {
  const first = revisionStrugglingWords(plan, ["a"]);
  const second = revisionStrugglingWords(plan, ["b", "c"]);
  assert.deepEqual(first, [{ phraseId: "a", word: "to fasten" }]);
  assert.deepEqual(second.map((word) => word.phraseId), ["b", "c"]);
  assert.deepEqual(revisionStrugglingWords(plan, []), []);
  assert.deepEqual(revisionStrugglingWords(plan, undefined), []);
  assert.equal(first[0].word, "to fasten");
});

test("marking a word is independent of its answers, flashcards and scoring", () => {
  const answers: RevisionAnswer[] = [
    { mode: "flashcards", phraseId: "c", word: "card", correct: true, ms: 5_000 },
    { mode: "choose", phraseId: "a", word: "to fasten", correct: true, ms: 400 },
    { mode: "choose", phraseId: "b", word: "cooperation", correct: false, ms: 900 },
  ];
  const before = scoreRevision(answers);
  revisionStrugglingWords(plan, ["a", "b", "c"]);
  assert.deepEqual(scoreRevision(answers), before);
  assert.equal(before.total, 2);
  assert.equal(before.accuracy, 50);
});

test("compact list is collapsed initially, themed and accessible in each language", () => {
  for (const locale of ["en", "ru", "uk"] as const) {
    const html = render(createElement(RevisionStrugglingPanel, { words, selected: ["a"], onToggle: () => {} }), locale);
    assert.ok(html.includes(dictionaries[locale].revision.strugglingWith));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(html.includes("aria-controls="));
    assert.ok(html.includes("bg-accent-soft"));
    assert.ok(html.includes("to fasten"));
    assert.ok(!html.includes('type="search"'));
    assert.ok(!html.includes("cooperation"));
  }
});

test("per-attempt summary escapes words and explicitly reports an empty list", () => {
  const html = render(createElement(RevisionStrugglingSummary, { words: revisionStrugglingWords(plan, ["c"]) }));
  assert.ok(html.includes("&lt;difficult &amp; word&gt;"));
  assert.ok(!html.includes("<difficult"));
  const empty = render(createElement(RevisionStrugglingSummary, { words: [] }));
  assert.ok(empty.includes(dictionaries.en.revision.strugglingEmpty));
});

test("server writes are student-owned, plan-validated, open-attempt-only and do not replace answers", () => {
  const action = readFileSync("src/lib/actions/revision.ts", "utf8");
  const marks = action.slice(action.indexOf("export async function saveRevisionStrugglingWordsAction"), action.indexOf("export type TeacherRevisionHomeworkCard"));
  assert.ok(marks.includes('session.role !== "STUDENT"'));
  assert.ok(marks.includes("eq(wordRevisions.studentId, session.userId)"));
  assert.ok(marks.includes("readShow(row.show).strugglingWith"));
  assert.ok(marks.includes("validateRevisionStrugglingIds"));
  assert.ok(marks.includes("isNull(wordRevisionAttempts.finishedAt)"));
  assert.ok(marks.includes(".set({ strugglingWords: ids })"));
  assert.ok(!marks.includes("answers:"));
  assert.ok(!marks.includes(".delete("));
  const runner = readFileSync("src/components/revision/revision-runner.tsx", "utf8");
  assert.ok(runner.includes("saveQueue.current.then"));
  assert.ok(runner.includes("strugglingRef.current = view.strugglingWords"));
  assert.ok(runner.includes("saveAnswersAction(attempt.id, next, finished, ids)"));
  assert.ok(runner.includes('phase === "done"'));
  assert.ok(runner.includes("strugglingRetry"));
});

test("migration is additive and verifies pre-existing attempts are unchanged", () => {
  const migration = readFileSync("scripts/migrate-revision-struggling.ts", "utf8");
  assert.ok(migration.includes("add column if not exists struggling_words jsonb not null default '[]'::jsonb"));
  assert.ok(migration.includes("assert.deepEqual"));
  assert.ok(!/update\s+public\./i.test(migration));
  assert.ok(!/delete\s+from/i.test(migration));
  const summary = readFileSync("src/components/revision/revision-teacher-list.tsx", "utf8");
  assert.ok(summary.includes("row.finishedAt && <RevisionStrugglingSummary words={row.strugglingWords}"));
});
