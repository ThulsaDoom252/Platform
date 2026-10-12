/** Additive migration. Without --apply this only inspects the selected database. */
import { config } from "dotenv";
import { Pool } from "pg";
import assert from "node:assert/strict";
import { LEARNING_LANGUAGE_STORAGE_SQL } from "../src/lib/db/learning-language-schema";

async function main() {
  const production = process.argv.includes("--production");
  const loaded = config({ path: production ? ".env.production.local" : ".env", quiet: true });
  const connectionString = production ? loaded.parsed?.NEON_DATABASE_URL || loaded.parsed?.DATABASE_URL : loaded.parsed?.DATABASE_URL;
  if (!connectionString) throw new Error("No database configured");
  const connection = new URL(connectionString);
  assert(connection.hostname !== "base", "Placeholder database configuration");
  if (!production) assert(["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname), "Local migration refuses a remote database. Select --production explicitly.");
  if (production) connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 8_000 });
  const client = await pool.connect();
  try {
    if (process.argv.includes("--apply")) {
      // Restore the connection default if a pooled backup client left a
      // session-only search_path behind. DDL below also explicitly names public.
      await client.query("RESET search_path");
      await client.query("begin");
      await client.query("set local lock_timeout = '5s'");
      await client.query("lock table public.users in access exclusive mode");
      const fingerprintSql = `select count(*)::int as count,
        md5(coalesce(string_agg(md5((to_jsonb(u)-'learning_language')::text), '|' order by id), '')) as fingerprint
        from public.users u`;
      const snapshot = await client.query(fingerprintSql);
      await client.query(LEARNING_LANGUAGE_STORAGE_SQL);
      assert.deepEqual((await client.query(fingerprintSql)).rows, snapshot.rows, "Existing accounts changed during migration");
      await client.query("commit");
    }
    const column = await client.query("select udt_name, is_nullable from information_schema.columns where table_schema='public' and table_name='users' and column_name='learning_language'");
    const tables = await client.query("select table_name from information_schema.tables where table_schema='public' and table_name in ('student_learning_translations','student_learning_translation_jobs') order by table_name");
    console.log(JSON.stringify({ target: production ? "production" : "local", applied: process.argv.includes("--apply"), column: column.rows[0] ?? null, tables: tables.rows.map(row => row.table_name), existingAccountsPreserved: true }));
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => {
  // Do not print connection errors: they may contain credentials.
  const code = (error as { code?: string }).code ?? "unknown";
  console.error("Learning-language migration failed", { code, ...(code === "42P01" && error instanceof Error ? { relation: error.message } : {}) });
  process.exitCode = 1;
});
