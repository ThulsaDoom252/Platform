/** SQL integration checks on synthetic JSON only. Never reads or changes user data. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Pool } from "pg";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { homeworkGradeFeedbackPatchSql, homeworkStateWithCurrentResultSql } from "../src/lib/homework-feedback-persistence";
import { homeworkGradeFeedbackPatch, HOMEWORK_OVERALL_SCORE_KEY, type HomeworkStoredState } from "../src/lib/lesson-homework";
import { HOMEWORK_OVERALL_REACTION_KEY, HOMEWORK_RESULT_COMMENT_KEY } from "../src/lib/homework-feedback";

async function main() {
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 10_000, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    let checks = 0;
    const evaluate = async (expression: SQL) => {
      const query = new PgDialect().sqlToQuery(sql`SELECT ${expression} AS answers`);
      const result = await client.query<{ answers: HomeworkStoredState }>(query.sql, query.params);
      checks++;
      return result.rows[0].answers;
    };
    const initial = { "hw:value:one": "In-progress student answer", "hw:status:one": "correct", "hw:reviewed-at": "reviewed", "regular-answer:one": "Keep this lesson answer" };
    const literal = (state: HomeworkStoredState) => sql`${JSON.stringify(state)}::jsonb`;
    const graded = await evaluate(homeworkGradeFeedbackPatchSql(literal(initial), homeworkGradeFeedbackPatch("fill-main", 85, "Public note")));
    assert.deepEqual(graded, { ...initial, "hw:exercise-score:fill-main": "85", "hw:exercise-comment:fill-main": "Public note" });
    const zero = await evaluate(homeworkGradeFeedbackPatchSql(literal(graded), homeworkGradeFeedbackPatch(null, 0, "Overall note")));
    assert.equal(zero[HOMEWORK_OVERALL_SCORE_KEY], "0");
    assert.equal(zero["hw:value:one"], initial["hw:value:one"]);
    const reset = await evaluate(homeworkGradeFeedbackPatchSql(literal(zero), homeworkGradeFeedbackPatch("fill-main", null, "Public note")));
    assert.equal(reset["hw:exercise-score:fill-main"], undefined);
    assert.equal(reset["hw:exercise-comment:fill-main"], "Public note");
    const current = { ...zero, [HOMEWORK_OVERALL_REACTION_KEY]: "good", [HOMEWORK_RESULT_COMMENT_KEY]: "Activity note" };
    const stale = { ...initial, "hw:value:one": "Next student answer", "hw:exercise-score:fill-main": "100", [HOMEWORK_OVERALL_SCORE_KEY]: "100", [HOMEWORK_RESULT_COMMENT_KEY]: "Forged note" };
    const saved = await evaluate(homeworkStateWithCurrentResultSql(literal(current), stale));
    assert.deepEqual(saved, { ...current, "hw:value:one": "Next student answer" });
    const noResurrection = await evaluate(homeworkStateWithCurrentResultSql(literal(initial), stale));
    assert.deepEqual(noResurrection, { ...initial, "hw:value:one": "Next student answer" });
    const empty = await evaluate(homeworkStateWithCurrentResultSql(sql`NULL::jsonb`, stale));
    assert.deepEqual(empty, { ...initial, "hw:value:one": "Next student answer" });
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ checks, syntheticDataOnly: true, databaseWrites: 0, preservedAnswersAndReviewStatus: true }));
  } finally { client.release(); await pool.end(); }
}
main().catch((error: { name?: string; code?: string }) => { console.error({ stage: "grade-persistence-check", type: error.name, code: error.code }); process.exitCode = 1; });
