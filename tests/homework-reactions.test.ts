import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  HOMEWORK_REACTION_PREFIX,
  homeworkExerciseReactionKeys,
  homeworkHasReactions,
  homeworkReaction,
  homeworkReactionColor,
  homeworkReactionKey,
  mergeHomeworkReactions,
  setHomeworkReaction,
  withoutHomeworkReactions,
  type HomeworkExercise,
  type HomeworkStoredState,
} from "../src/lib/lesson-homework";
import {
  homeworkReactionPatchSql,
  homeworkReactionsResetSql,
} from "../src/lib/homework-reaction-persistence";

const exercise: HomeworkExercise = {
  id: "fill-main", title: "Fill", instruction: "Fill the gaps", kind: "fill",
  items: [
    { id: "fill-one", prompt: "I ___.", answer: "work" },
    { id: "fill-two", prompt: "We ___.", answer: "play" },
  ],
};
const retained: HomeworkStoredState = {
  "hw:value:fill-one": "work",
  "hw:status:fill-one": "correct",
  "hw:attempts:fill-two": '["wrong"]',
  "hw:note:fill-one": "Teacher note",
  "hw:note-visible:fill-one": "1",
  "hw:exercise-score:fill-main": "80",
  "hw:exercise-comment:fill-main": "Well done",
  "hw:highlight:homework:item:fill-one": "green",
  "hw:text-range-highlight:fill-one:prompt": '[{"start":0,"end":1,"color":"yellow"}]',
  "hw:assigned-at": "2026-10-08T10:00:00.000Z",
  "hw:submitted-at": "2026-10-08T11:00:00.000Z",
  "hw:reviewed-at": "2026-10-08T12:00:00.000Z",
  "hw:revision-requested-at": "2026-10-08T13:00:00.000Z",
  "hw:plan-override": '{"title":"Personal homework"}',
  "regular:answer:one": "An answer from the lesson",
};
const withReactions = () => ({
  ...retained,
  [homeworkReactionKey("exercise", "fill-main")]: "happy",
  [homeworkReactionKey("item", "fill-one")]: "check",
  [homeworkReactionKey("item", "fill-two")]: "warning",
  [homeworkReactionKey("exercise", "other")]: "angry",
  [homeworkReactionKey("item", "bonus-one")]: "cross",
  [`${HOMEWORK_REACTION_PREFIX}item:deleted-item`]: "invalid-old-reaction",
});

test("whole-homework reset removes all reactions, including obsolete targets, and nothing else", () => {
  const state = withReactions();
  const original = { ...state };
  assert.ok(homeworkHasReactions(state));
  assert.deepEqual(withoutHomeworkReactions(state), retained);
  assert.deepEqual(state, original);
  assert.equal(homeworkHasReactions(withoutHomeworkReactions(state)), false);
  assert.deepEqual(withoutHomeworkReactions(retained), retained);
});

test("exercise reset removes its own reaction and every sentence reaction, not other exercises or bonuses", () => {
  const next = withoutHomeworkReactions(withReactions(), exercise);
  assert.equal(homeworkHasReactions(next, exercise), false);
  assert.equal(homeworkReaction(next, "exercise", "other"), "angry");
  assert.equal(homeworkReaction(next, "item", "bonus-one"), "cross");
  assert.ok(homeworkHasReactions(next));
  for (const [key, value] of Object.entries(retained)) assert.equal(next[key], value);
  assert.equal(next[`${HOMEWORK_REACTION_PREFIX}item:deleted-item`], "invalid-old-reaction");
});

test("reset works for every exercise kind, including an empty or optional exercise", () => {
  for (const kind of ["fill", "definition", "describe", "drag", "translate", "question-text", "question-audio"] as const) {
    for (const optional of [false, true]) {
      const target = { ...exercise, kind, optional };
      assert.equal(homeworkHasReactions(withoutHomeworkReactions(withReactions(), target), target), false);
    }
  }
  const empty = { ...exercise, items: [] };
  assert.deepEqual(homeworkExerciseReactionKeys(empty), [homeworkReactionKey("exercise", exercise.id)]);
  assert.equal(homeworkReaction(withoutHomeworkReactions(withReactions(), empty), "item", "fill-one"), "check");
});

test("removing one reaction keeps the exercise reaction and other sentence reactions", () => {
  const next = setHomeworkReaction(withReactions(), "item", "fill-one", null);
  assert.equal(homeworkReaction(next, "item", "fill-one"), null);
  assert.equal(homeworkReaction(next, "item", "fill-two"), "warning");
  assert.equal(homeworkReaction(next, "exercise", "fill-main"), "happy");
});

test("live feedback applies additions, changes and resets without replacing an unsaved answer", () => {
  const local = { ...withReactions(), "hw:value:fill-one": "Currently typing" };
  const incoming = setHomeworkReaction({ ...retained }, "item", "fill-one", "angry");
  const merged = mergeHomeworkReactions(local, incoming);
  assert.equal(merged["hw:value:fill-one"], "Currently typing");
  assert.equal(homeworkReaction(merged, "item", "fill-one"), "angry");
  assert.equal(homeworkReaction(merged, "exercise", "fill-main"), null);
  assert.deepEqual(mergeHomeworkReactions(merged, retained), { ...retained, "hw:value:fill-one": "Currently typing" });
  assert.equal(mergeHomeworkReactions(merged, incoming), merged, "unchanged feedback must not cause another render");
});

test("all six reactions retain their semantic green, yellow or red feedback", () => {
  for (const reaction of ["thumbs-up", "happy", "check"] as const) assert.equal(homeworkReactionColor(reaction), "green");
  for (const reaction of ["angry", "cross"] as const) assert.equal(homeworkReactionColor(reaction), "red");
  assert.equal(homeworkReactionColor("warning"), "yellow");
  assert.equal(homeworkReactionColor(null), null);
});

const dialect = new PgDialect();
const answers = sql.identifier("answers");
test("DB reaction writes atomically patch the current JSONB, without supplying stale student answers", () => {
  const key = homeworkReactionKey("item", "fill-one");
  const add = dialect.sqlToQuery(homeworkReactionPatchSql(answers, key, "check"));
  assert.match(add.sql, /coalesce\("answers", '\{\}'::jsonb\) \|\| jsonb_build_object/);
  assert.deepEqual(add.params, [key, "check"]);
  const remove = dialect.sqlToQuery(homeworkReactionPatchSql(answers, key, null));
  assert.match(remove.sql, /coalesce\("answers", '\{\}'::jsonb\) - \$1/);
  assert.deepEqual(remove.params, [key]);
});

test("DB exercise reset deletes only bound reaction keys; whole reset filters the exact reaction prefix", () => {
  const keys = homeworkExerciseReactionKeys(exercise);
  const scoped = dialect.sqlToQuery(homeworkReactionsResetSql(answers, keys));
  assert.match(scoped.sql, / - ARRAY\[\$1, \$2, \$3\]::text\[\]/);
  assert.deepEqual(scoped.params, keys);
  const whole = dialect.sqlToQuery(homeworkReactionsResetSql(answers));
  assert.match(whole.sql, /jsonb_each\(coalesce\("answers", '\{\}'::jsonb\)\)/);
  assert.match(whole.sql, /where left\(reaction_entry.key, \$1\) <> \$2/);
  assert.deepEqual(whole.params, [HOMEWORK_REACTION_PREFIX.length, HOMEWORK_REACTION_PREFIX]);
  assert.deepEqual(dialect.sqlToQuery(homeworkReactionsResetSql(answers, [])).params, []);
});

test("feedback uses theme surfaces and status tokens, preserves focus rings and respects reduced motion", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  for (const [color, token] of [["green", "green"], ["yellow", "amber"], ["red", "rose"]]) {
    assert.match(css, new RegExp(`\\.homework-reaction-badge\\[data-homework-reaction="${color}"\\] \\{\\s*--homework-feedback: var\\(--t-${token}\\);`));
  }
  const block = css.match(/\.homework-reaction-block\[data-homework-reaction\] \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(block);
  assert.match(block, /var\(--surface\)/);
  assert.match(block, /var\(--tw-ring-shadow/);
  assert.match(block, /inset 5px/);
  assert.doesNotMatch(block, /#fff|emerald-50|yellow-50|rose-50/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.homework-reaction-visible \{\s*animation: none;/);
});
