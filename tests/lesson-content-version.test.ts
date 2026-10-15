import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { lessonContentVersion } from "../src/lib/lesson-content-version";

const query = new PgDialect().sqlToQuery(lessonContentVersion);

test("the live lesson fingerprint includes template homework itself, not only its timestamp", () => {
  assert.match(query.sql, /^md5\(/);
  assert.match(query.sql, /"lesson_units"\."updated_at"::text/);
  assert.match(query.sql, /coalesce\("lesson_units"\."homework"::text, ''\)/);
  // The homework value is an independent hash input, outside any timestamp condition.
  assert.doesNotMatch(query.sql, /\bcase\b|\bwhen\b/i);
  assert.deepEqual(query.params, []);
});

test("personal content and homework overrides still invalidate the live lesson", () => {
  assert.match(query.sql, /coalesce\("lesson_assignments"\."content_override"::text, ''\)/);
  assert.match(query.sql, /jsonb_each_text\("lesson_assignments"\."answers"\)/);
  assert.match(query.sql, /where e\.key = 'hw:plan-override' or e\.key like 'hw:exercise-hidden:%'/);
  assert.match(query.sql, /string_agg\(e\.key \|\| ':' \|\| e\.value, '' order by e\.key\)/);
});

test("word, activity and learning-language changes remain fingerprint inputs", () => {
  assert.match(query.sql, /string_agg\(lw::text, '' order by lw\.id\)/);
  assert.match(query.sql, /from lesson_words lw where lw\.unit_id = "lesson_units"\."id"/);
  assert.match(query.sql, /string_agg\(wa\.updated_at::text, '' order by wa\.id\)/);
  assert.match(query.sql, /"lesson_units"\."activity_ids" \? wa\.id::text/);
  assert.match(query.sql, /u\.learning_language::text from users u where u\.id = "lesson_assignments"\."student_id"/);
});

test("student responses, progress and teacher marks do not invalidate lesson content", () => {
  const answerReferences = query.sql.match(/"lesson_assignments"\."answers"/g) ?? [];
  assert.equal(answerReferences.length, 1);
  // Only structural homework overrides are selected from answers; ordinary item
  // responses, submission state, feedback and grades cannot enter the aggregate.
  assert.match(query.sql, /jsonb_each_text\("lesson_assignments"\."answers"\) e\s+where e\.key = 'hw:plan-override' or e\.key like 'hw:exercise-hidden:%'/);
  assert.doesNotMatch(query.sql, /"lesson_assignments"\."(?:marks|updated_at|highlights|status)"/);
  assert.doesNotMatch(query.sql, /hw:(?:value|attempts|submitted-at|overall-score|reaction|note)/);
});
