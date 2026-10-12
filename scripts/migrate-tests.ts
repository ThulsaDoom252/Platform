/** Additive test storage setup: tables, indexes and nullable deadline/feedback metadata only. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Pool } from "pg";
import { TESTS_STORAGE_SQL, TESTS_DEADLINE_SQL, TESTS_FEEDBACK_SQL } from "../src/lib/db/tests-storage-schema";

async function main() {
  const production = process.argv.includes("--production");
  const apply = process.argv.includes("--apply");
  const loaded = config({ path: production ? ".env.production.local" : ".env", quiet: true });
  const connectionString = production ? loaded.parsed?.NEON_DATABASE_URL : loaded.parsed?.DATABASE_URL;
  if (!connectionString) throw new Error("No database configured");
  const connection = new URL(connectionString);
  assert.notEqual(connection.hostname, "base");
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  try {
    if (apply) {
      assert.ok(TESTS_STORAGE_SQL.includes(TESTS_DEADLINE_SQL));
      assert.ok(TESTS_STORAGE_SQL.includes(TESTS_FEEDBACK_SQL));
      assert.ok(!/^\s*(DROP|TRUNCATE|DELETE FROM|UPDATE|ALTER)\b/im.test(TESTS_STORAGE_SQL.replace(TESTS_DEADLINE_SQL, "").replace(TESTS_FEEDBACK_SQL, "")));
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("set local statement_timeout = '20s'");
      await client.query("set local search_path = public");
      const existing = await client.query("select to_regclass('public.test_assignments') as assignments, to_regclass('public.test_attempts') as attempts");
      const fingerprints = async () => {
        const values = [];
        for (const [name, exists] of [["test_assignments", existing.rows[0].assignments], ["test_attempts", existing.rows[0].attempts]] as const) {
          if (!exists) continue;
          const result = await client.query(`select count(*)::int as count, md5(coalesce(string_agg(md5((to_jsonb(t) - 'due_at' - 'teacher_feedback')::text), '' order by id), '')) as digest from public.${name} t`);
          values.push({ table: name, ...result.rows[0] });
        }
        return values;
      };
      // Hold writes briefly while proving the additive DDL preserves every existing row.
      if (existing.rows[0].assignments) await client.query("lock table public.test_assignments in share mode");
      if (existing.rows[0].attempts) await client.query("lock table public.test_attempts in share mode");
      const before = await fingerprints();
      await client.query(TESTS_STORAGE_SQL);
      assert.deepEqual(await fingerprints(), before, "Existing assignments/results changed during setup");
      await client.query("commit");
    }
    const { rows } = await client.query(`select table_name, column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name in ('test_assignments', 'test_attempts')`);
    for (const [table, columns] of Object.entries({ test_assignments: ["definition", "grading", "exercise_ids"], test_attempts: ["results", "checked_exercise_ids"] })) {
      for (const column of columns) { const row = rows.find((item) => item.table_name === table && item.column_name === column); assert.equal(row?.data_type, "jsonb"); assert.equal(row?.is_nullable, "NO"); }
    }
    const deadline = rows.find((row) => row.table_name === "test_assignments" && row.column_name === "due_at");
    assert.equal(deadline?.data_type, "timestamp without time zone"); assert.equal(deadline?.is_nullable, "YES");
    const feedback = rows.find((row) => row.table_name === "test_attempts" && row.column_name === "teacher_feedback");
    assert.equal(feedback?.data_type, "jsonb"); assert.equal(feedback?.is_nullable, "YES");
    console.log(JSON.stringify({ target: production ? "production" : "local", applied: apply, testTablesVerified: 2, deadlineColumnVerified: true, feedbackColumnVerified: true, existingDataRewritten: false }));
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error("Tests storage setup failed", { code: (error as { code?: string }).code ?? "unknown" }); process.exitCode = 1; });
