/** Creates only two new test tables and their indexes. Existing data is untouched. */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Pool } from "pg";
import { TESTS_STORAGE_SQL } from "../src/lib/db/tests-storage-schema";

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
      assert.ok(!/^\s*(DROP|TRUNCATE|DELETE FROM|UPDATE|ALTER)\b/im.test(TESTS_STORAGE_SQL));
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("set local statement_timeout = '20s'");
      await client.query("set local search_path = public");
      await client.query(TESTS_STORAGE_SQL);
      await client.query("commit");
    }
    const { rows } = await client.query(`select table_name, column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name in ('test_assignments', 'test_attempts')`);
    for (const [table, columns] of Object.entries({ test_assignments: ["definition", "grading", "exercise_ids"], test_attempts: ["results", "checked_exercise_ids"] })) {
      for (const column of columns) { const row = rows.find((item) => item.table_name === table && item.column_name === column); assert.equal(row?.data_type, "jsonb"); assert.equal(row?.is_nullable, "NO"); }
    }
    console.log(JSON.stringify({ target: production ? "production" : "local", applied: apply, testTablesVerified: 2, existingDataRewritten: false }));
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error("Tests storage setup failed", { code: (error as { code?: string }).code ?? "unknown" }); process.exitCode = 1; });
