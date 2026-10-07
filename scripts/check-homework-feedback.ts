/** Integration checks use literal fixtures in a read-only transaction, never user rows. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { homeworkStateWithCurrentResultSql, revisionHomeworkScoreSql } from "../src/lib/homework-feedback-persistence";
import { HOMEWORK_OVERALL_REACTION_KEY, homeworkResultReaction } from "../src/lib/homework-feedback";
import { homeworkReactionsResetSql } from "../src/lib/homework-reaction-persistence";
import { scoreRevision, type RevisionAnswer } from "../src/lib/revision-score";

async function main() {
  const loaded = config({ path: ".env", quiet: true });
  const pool = new Pool({ connectionString: loaded.parsed?.DATABASE_URL, connectionTimeoutMillis: 8_000 });
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    const answers: RevisionAnswer[] = [
      { mode: "flashcards", phraseId: "test", word: "test", correct: true, ms: 1000 },
      ...Array.from({ length: 200 }, (_, i): RevisionAnswer => ({ mode: "choose", phraseId: `test-${i}`, word: "test", correct: i < 199, ms: 1000 })),
    ];
    const query = new PgDialect().sqlToQuery(sql`select ${revisionHomeworkScoreSql(sql`${JSON.stringify(answers)}::jsonb`)} as result`);
    const result = await client.query(query.sql, query.params);
    const expected = scoreRevision(answers);
    assert.deepEqual(result.rows[0].result, { right: expected.right, total: expected.total });
    assert.equal(homeworkResultReaction(result.rows[0].result), "good");
    const state = { "hw:value:test": "keep answer", "hw:exercise-score:test": "90", [HOMEWORK_OVERALL_REACTION_KEY]: "good" };
    const reset = new PgDialect().sqlToQuery(sql`select ${homeworkReactionsResetSql(sql`${JSON.stringify(state)}::jsonb`)} as state`);
    const resetResult = await client.query(reset.sql, reset.params);
    assert.deepEqual(resetResult.rows[0].state, { "hw:value:test": "keep answer", "hw:exercise-score:test": "90" });
    const deck = { settings: { sound: true }, cards: [{ word: "test" }], attempts: [{ durationMs: 1200 }], homeworkFeedback: { autoEnabled: false, manualReaction: "good" } };
    const updated = await client.query("select $1::jsonb || $2::jsonb as deck", [JSON.stringify(deck), JSON.stringify({ liveState: { at: 2 }, attemptStartedAt: null })]);
    assert.deepEqual(updated.rows[0].deck.homeworkFeedback, deck.homeworkFeedback);
    assert.deepEqual(updated.rows[0].deck.attempts, deck.attempts);
    assert.deepEqual(updated.rows[0].deck.cards, deck.cards);
    for (const existing of [{ [HOMEWORK_OVERALL_REACTION_KEY]: "excellent" }, {}]) {
      const preserve = new PgDialect().sqlToQuery(sql`select ${homeworkStateWithCurrentResultSql(sql`${JSON.stringify(existing)}::jsonb`, state)} as state`);
      const persisted = await client.query(preserve.sql, preserve.params);
      assert.deepEqual(persisted.rows[0].state, { "hw:value:test": "keep answer", "hw:exercise-score:test": "90", ...existing });
    }
    await client.query("rollback");
    console.log(JSON.stringify({ passed: 4, userRowsModified: 0 }));
  } finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => {
  console.error("Homework feedback checks failed", { code: (error as { code?: string }).code ?? "unknown" });
  process.exitCode = 1;
});
